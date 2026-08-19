import { z } from "zod";

// ─── جلب التصنيفات (GET /api/categories) ───
export const getCategoriesSchema = z.object({
    search: z.string().optional().default(""),
    page: z
        .string()
        .optional()
        .default("1")
        .refine((val) => Number(val) > 0, "Page must be greater than 0"),
    limit: z
        .string()
        .optional()
        .default("10")
        .refine(
            (val) => Number(val) > 0 && Number(val) <= 100,
            "Limit must be between 1 and 100"
        ),
    sortBy: z.enum(["name", "createdAt", "updateAt"]).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

// ─── جلب تصنيف بالـ ID (GET /api/categories/:id) ───
export const getCategoryByIdSchema = z.object({
    id: z.string().uuid("Invalid category ID format"),
});

// ─── إنشاء تصنيف (POST /api/categories) ───
export const createCategorySchema = z.object({
    name: z
        .string()
        .min(1, "Category name is required")
        .max(100, "Category name must be at most 100 characters")
        .trim(),
    description: z
        .string()
        .min(1, "Description is required")
        .max(500, "Description must be at most 500 characters")
        .trim(),
    media: z.any().optional().default({}),
});

// ─── تحديث تصنيف (PUT /api/categories/:id) ───
export const updateCategorySchema = z.object({
    id: z.string().uuid("Invalid category ID format"),
    name: z.string().min(1).max(100).trim().optional(),
    description: z.string().min(1).max(500).trim().optional(),
    media: z.any().optional(),
    isHidden: z.boolean().optional(),
});

// ─── حذف تصنيف (DELETE /api/categories/:id) ───
export const deleteCategorySchema = z.object({
    id: z.string().uuid("Invalid category ID format"),
});

// ─── تبديل الإخفاء (PATCH /api/categories/:id/toggle) ───
export const toggleVisibilitySchema = z.object({
    id: z.string().uuid("Invalid category ID format"),
});