import { Request, Response } from "express";
import { brandService } from "./brand.service";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import AppError from "../../shared/errors/AppError";
import { authModel } from "../auth/auth.model";
import { uploadToCloudinary } from "../../shared/utils/cloudinary";
import { StatusCodes } from "http-status-codes";

export const createBrand = asyncHandler(async (req: any, res: Response) => {
  const {
    name,
    location,
    branchName,
  }: {
    name: string;
    location: {
      latitude: number;
      longitude: number;
    };
    branchName: string;
  } = req.body;
  const user = (req as any).user;
  const filePath = req.file?.path;

  const brand = await brandService.createBrand({
    userId: user.id,
    name,
    logoUrl: filePath,
  });

  // Update the brand's role to "brand" after creating the brand
  await authModel.updateUser(user.id, { role: "brand" });
  const locationDetails = await brandService.getLocation(
    location.longitude,
    location.latitude,
  );

  const branchLocation = await brandService.createBranchLocation(
    brand.id,
    branchName,
    locationDetails,
    true, // isMain
  );
});

export const getPublicBrandProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const { brandId } = req.params as { brandId: string };

    const result = await brandService.getPublicBrandProfile(brandId);

    return res.status(200).json({
      success: true,
      message: "Brand profile retrieved successfully",
      data: result,
    });
  },
);

export const updateBrandProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { brandId } = req.params as { brandId: string };
    const { name, isActive } = req.body as {
      name?: string;
      isActive?: boolean;
      isPromoted?: boolean;
    };

    if (!user?.id) {
      throw new AppError("Not authenticated", StatusCodes.UNAUTHORIZED);
    }

    const filePath = req.file?.path;
    const brand = await brandService.updateBrandProfile(user.id, brandId, {
      name,
      isActive,
      logoFilePath: filePath,
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Brand profile updated successfully",
      data: brand,
    });
  },
);

export const brandVerificationStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { brandId } = req.params as { brandId: string };
    const user = (req as any).user;

    if (!user?.id) {
      throw new AppError("Not authenticated", 401);
    }

    const result = await brandService.getBrandVerificationStatus(
      brandId,
      user.id,
      user.role,
    );

    return res.status(200).json({ success: true, message: "OK", data: result });
  },
);

export const createBrandDocument = asyncHandler(
  async (req: Request, res: Response) => {
    console.log(req.body, req.files);
    const { brandId } = req.params as { brandId: string };
    const user = (req as any).user;
    const files = req.files as Express.Multer.File[] | undefined;
    const rawDocTypes = req.body?.docTypes;
    const docTypes = Array.isArray(rawDocTypes)
      ? rawDocTypes
      : typeof rawDocTypes === "string"
        ? JSON.parse(rawDocTypes)
        : [];

    if (!files || files.length === 0) {
      throw new AppError("No document provided", StatusCodes.BAD_REQUEST);
    }
    console.log(docTypes);
    if (!Array.isArray(docTypes) || docTypes.length === 0) {
      throw new AppError(
        "Document types are required",
        StatusCodes.BAD_REQUEST,
      );
    }
    console.log(`User Id ${user.id} and brandId ${brandId}`);
    const brand = await brandService.getBrandByCondition({
      id: brandId,
      userId: user.id,
    });
    if (!brand) {
      throw new AppError(
        "You are not authorized to upload documents for this brand",
        StatusCodes.FORBIDDEN,
      );
    }

    if (files.length !== docTypes.length) {
      throw new AppError(
        "Number of uploaded documents must match the number of document types",
        StatusCodes.BAD_REQUEST,
      );
    }

    const uploadedDocuments = await Promise.all(
      files.map(async (file, index) => {
        const { public_id, secure_url } = await uploadToCloudinary(
          file.path,
          `brand-documents/${brandId}/${docTypes[index]}`,
        );
        return {
          docType: docTypes[index] as any,
          fileUrl: secure_url,
          fileUrl_id: public_id,
        };
      }),
    );

    const createDocuments = await brandService.createBrandDocuments(
      brandId,
      uploadedDocuments,
    );

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Brand documents created successfully",
      data: createDocuments,
    });
  },
);
