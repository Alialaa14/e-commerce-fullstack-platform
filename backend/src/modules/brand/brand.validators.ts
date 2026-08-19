import { z } from "zod";
import { BrandDocType } from "../../generated/prisma/enums";

const booleanLikeSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  return value;
}, z.boolean().optional());

export const brandVerificationStatusSchema = z.object({
  brandId: z.string().uuid({ message: "Invalid brand ID format" }),
});

export const createBrandSchema = z.object({
  name: z.string().trim().min(2, "Brand name is required"),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
});

export const getBrandProfileSchema = z.object({
  brandId: z.string().uuid({ message: "Invalid brand ID format" }),
});

export const updateBrandProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Brand name must be at least 2 characters long")
    .optional(),
  isActive: booleanLikeSchema,
});

const brandDocTypeValues = Object.values(BrandDocType) as [string, ...string[]];

const normalizeDocTypes = (value: unknown) => {
  if (typeof value === "string") return JSON.parse(value);
  if (Array.isArray(value)) return value;
  return value;
};

export const createBrandDocumentsSchema = z
  .object({
    brandId: z.string().uuid({ message: "Invalid brand ID format" }),
    docTypes: z.preprocess(
      normalizeDocTypes,
      z
        .array(z.enum(brandDocTypeValues, { message: "Invalid document type" }))
        .nonempty("At least one document type is required")
        .min(1, "At least one document type is required"),
    ),
  })
  .transform((data) => ({ ...data, docTypes: data.docTypes ?? [] }));
