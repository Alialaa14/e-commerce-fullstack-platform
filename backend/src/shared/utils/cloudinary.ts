import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { ENV } from "../../config/env";
import AppError from "../errors/AppError";
import path from "path";

type ResourceType = "image" | "video" | "raw" | "auto";
console.log(
  ENV.CLOUDINARY_NAME,
  ENV.CLOUDINARY_API_KEY,
  ENV.CLOUDINARY_API_SECRET,
);
cloudinary.config({
  cloud_name: ENV.CLOUDINARY_NAME,
  api_key: ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
});

// Upload from file path
export const uploadToCloudinary = async (
  filePath: string,
  folder: string,
): Promise<UploadApiResponse> => {
  if (!filePath) {
    throw new AppError("File path is required", 400);
  }

  const filePathResolved = path.resolve(filePath);

  try {
    const result = await cloudinary.uploader.upload(filePathResolved, {
      folder,
    });
    return result;
  } catch (error: any) {
    throw new AppError(error?.message || "Cloudinary upload failed", 500);
  }
};

// Upload from Buffer (MemoryStorage)
export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  folder: string,
): Promise<UploadApiResponse> => {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error || !result) {
          reject(new AppError(error?.message || "Buffer upload failed", 500));
        } else {
          resolve(result);
        }
      },
    );
    stream.end(buffer);
  });
};

// Delete
export const deleteFromCloudinary = async (
  publicId: string,
  resource_type: ResourceType = "image",
): Promise<{ result: string }> => {
  if (!publicId) {
    throw new AppError("publicId is required", 400);
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type,
    });
    return result;
  } catch (error: any) {
    throw new AppError(error?.message || "Cloudinary delete failed", 500);
  }
};
