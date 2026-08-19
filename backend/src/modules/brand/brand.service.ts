import { BrandDocType } from "../../generated/prisma/browser";
import { brandModel } from "./brand.model";
import AppError from "../../shared/errors/AppError";
import { StatusCodes } from "http-status-codes";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../shared/utils/cloudinary";
import { removeFileFromDisk } from "../../shared/utils/upload";
import { ENV } from "../../config/env";
import axios from "axios";

class BrandService {
  async createBrand(data: { userId: string; name: string; logoUrl?: string }) {
    const userBrand = await brandModel.getUserBrand(data.userId);
    if (userBrand) {
      throw new AppError(
        "You have already created a brand",
        StatusCodes.BAD_REQUEST,
      );
    }

    const brandName = await brandModel.getBrandByCondition({ name: data.name });
    if (brandName) {
      throw new AppError("Brand name already exists", StatusCodes.BAD_REQUEST);
    }

    let logoUrl: string | null = null;
    let logoUrl_id: string | null = null;

    if (data.logoUrl) {
      const { secure_url, public_id } = await uploadToCloudinary(
        data.logoUrl,
        "brand-logos",
      );
      logoUrl = secure_url;
      logoUrl_id = public_id;
    }
    const brandData = {
      userId: data.userId,
      name: data.name,
      logoUrl: logoUrl ?? undefined,
      logoUrl_id: logoUrl_id ?? undefined,
    };

    const brand = await brandModel.createBrand(
      brandData as {
        userId: string;
        name: string;
        logoUrl?: string;
        logoUrl_id?: string;
      },
    );

    if (!brand) {
      throw new AppError(
        "Brand creation failed",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    return brand;
  }

  async getPublicBrandProfile(brandId: string) {
    const brand = await brandModel.findApprovedBrandById(brandId);
    if (!brand) throw new AppError("Brand not found", 404);

    return {
      id: brand.id,
      name: brand.name,
      verificationStatus: brand.verificationStatus,
      rating: Number(brand.rating),
      logoUrl: brand.logoUrl,
    };
  }

  async updateBrandProfile(
    userId: string,
    brandId: string,
    data: {
      name?: string;
      isActive?: boolean;
      logoFilePath?: string;
    },
  ) {
    const brand = await brandModel.findBrandById(brandId);
    if (!brand) {
      throw new AppError("Brand not found", StatusCodes.NOT_FOUND);
    }

    if (brand.userId !== userId) {
      throw new AppError("Unauthorized", StatusCodes.FORBIDDEN);
    }

    const updateData: {
      name?: string;
      isActive?: boolean;
      logoUrl?: string | null;
      logoUrl_id?: string | null;
    } = {};

    if (typeof data.name === "string") {
      const trimmedName = data.name.trim();
      if (!trimmedName) {
        throw new AppError(
          "Brand name cannot be empty",
          StatusCodes.BAD_REQUEST,
        );
      }

      const nameExists = await brandModel.getBrandByCondition({
        name: trimmedName,
        NOT: { id: brandId },
      });

      if (nameExists) {
        throw new AppError(
          "Brand name already exists",
          StatusCodes.BAD_REQUEST,
        );
      }

      updateData.name = trimmedName;
    }

    if (typeof data.isActive === "boolean") {
      updateData.isActive = data.isActive;
    }

    if (data.logoFilePath) {
      try {
        const { secure_url, public_id } = await uploadToCloudinary(
          data.logoFilePath,
          "brand-logos",
        );
        updateData.logoUrl = secure_url;
        updateData.logoUrl_id = public_id;

        if (brand.logoUrl_id) {
          try {
            await deleteFromCloudinary(brand.logoUrl_id);
          } catch (error) {
            console.warn("Failed to delete previous brand logo", error);
          }
        }
      } finally {
        removeFileFromDisk(data.logoFilePath);
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError("No changes provided", StatusCodes.BAD_REQUEST);
    }

    return brandModel.updateBrand(brandId, updateData);
  }

  async getBrandVerificationStatus(
    brandId: string,
    userId: string,
    role: string,
  ) {
    const brand = await brandModel.findBrandWithDocuments(brandId);
    if (!brand) throw new AppError("Brand not found", 404);

    if (brand.userId !== userId && role !== "admin") {
      throw new AppError("Unauthorized", 403);
    }

    const allTypes = Object.values(BrandDocType);
    const submitted = new Set(brand.documents.map((d) => d.docType));
    const missing = allTypes.filter((t) => !submitted.has(t));

    return {
      verificationStatus: brand.verificationStatus,
      submittedDocuments: brand.documents.map((d) => ({
        docType: d.docType,
        fileUrl: d.fileUrl,
        status: d.status,
        rejectionReason: (d as any).rejectionReason ?? null,
      })),
      missingDocuments: missing,
    };
  }

  async getLocation(longitude: number, latitude: number) {
    try {
      const response = await axios.get(
        `https://geocode.googleapis.com/v4/geocode/location?location.latitude=${latitude}&location.longitude=${longitude}&key=${ENV.Google_Maps_Key}`,
      );
      return {
        latitude: response.data.results[0].location.latitude,
        longitude: response.data.results[0].location.longitude,
        placeId: response.data.results[0].placeId,
        formattedAddress: response.data.results[0].formattedAddress,
        addressLine: response.data.results[0].addressLine,
        city: response.data.results[0].city,
        state: response.data.results[0].state,
        country: response.data.results[0].country,
        postalCode: response.data.results[0].postalCode,
        locationGranularity: response.data.results[0].granularity,
      };
    } catch (error) {
      console.log(error);
      throw new AppError(
        "Failed to get location details",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createBranchLocation(
    brandId: string,
    branchName: string,
    locationDetails: {
      latitude: number;
      longitude: number;
      placeId: string;
      formattedAddress: string;
      addressLine: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
      locationGranularity: string;
    },
    isMain?: boolean,
    isActive?: boolean,
  ) {
    const branchLocation = await brandModel.CreateBrandLocation({
      brandId,
      name: branchName,
      ...locationDetails,
      isMain: isMain || false,
    });
    if (!branchLocation) {
      throw new AppError(
        "Failed to create branch location",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
    return branchLocation;
  }

  async createBrandDocuments(
    brandId: string,
    data: { docType: BrandDocType; fileUrl: string; fileUrl_id: string }[],
  ) {
    const brand = await brandModel.findBrandById(brandId);
    if (!brand) {
      throw new AppError("Brand not found", StatusCodes.NOT_FOUND);
    }

    const brandDocument = await brandModel.createBrandDocuments(brandId, data);
    if (!brandDocument || brandDocument.length === 0) {
      throw new AppError(
        "Failed to create brand document",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
    return brandDocument;
  }

  async getBrandByCondition(where: any) {
    return await brandModel.getBrandByCondition(where);
  }
}

export const brandService = new BrandService();
