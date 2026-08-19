import { asyncHandler } from "../../shared/utils/asyncHandler";
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { categoryService } from "./category.service";

// ─── Types ───
// حقول الجلب مع الترتيب والصفحات — بتيجي من الـ query string
interface ListQuery {
  search?: string;
  limit?: string;
  page?: string;
  sortBy?: string;
  sortOrder?: string;
}

// حقل الـ id — بييجي من الـ URL params
type IdParam = { id: string };

// بيانات الإدخال للـ create — بتيجي من الـ body
interface CreateBody {
  name: string;
  description: string;
  media?: unknown;
}

// بيانات الإدخال للـ update — بتيجي من الـ body (كلها اختيارية)
interface UpdateBody {
  name?: string;
  description?: string;
  media?: unknown;
  isHidden?: boolean;
}

// ─── Helper: استجابة موحدة لكل الـ endpoints ───
function sendSuccess<T>(
  res: Response,
  status: number,
  message: string,
  data?: T,
) {
  return res.status(status).json({
    success: true,
    message,
    ...(data !== undefined && { data }),
  });
}

// ─── GET /api/v1/categories — جلب كل التصنيفات (pagination + search + sort) ───
export const getCategories = asyncHandler(
  async (req: Request, res: Response) => {
    // 1) نقرأ الفلاتر من الـ query ونضع قيم افتراضية
    const { search = "", limit = "10", page = "1", sortBy = "createdAt", sortOrder = "desc" } =
      req.query as ListQuery;

    // 2) نحسب الـ skip للتقسيم على صفحات
    const skip = (Number(page) - 1) * Number(limit);

    // 3) نجهز الفلتر اللي الـ model هيستخدمه
    const filter = {
      search,
      skip,
      take: Number(limit),
      sortBy,
      sortOrder: sortOrder as "asc" | "desc",
    };

    // 4) ننادي الـ service ونرجع النتيجة مع بيانات الصفحة
    const result = await categoryService.getCategories(filter);

    return sendSuccess(res, StatusCodes.OK, "OK", {
      categories: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  },
);

// ─── GET /api/v1/categories/:id — جلب تصنيف واحد بالمعرّف ───
export const getCategoryById = asyncHandler(
  async (req: Request<IdParam>, res: Response) => {
    const { id } = req.params;
    const category = await categoryService.getCategoryById(id);

    return sendSuccess(res, StatusCodes.OK, "OK", { category });
  },
);

// ─── POST /api/v1/categories — إنشاء تصنيف جديد ───
export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, description, media } = req.body as CreateBody;

    const category = await categoryService.createCategory({
      name,
      description,
      media,
    });

    return sendSuccess(res, StatusCodes.CREATED, "Category created successfully", {
      category,
    });
  },
);

// ─── PUT /api/v1/categories/:id — تحديث تصنيف موجود ───
export const updateCategory = asyncHandler(
  async (req: Request<IdParam>, res: Response) => {
    const { id } = req.params;
    const { name, description, media, isHidden } = req.body as UpdateBody;

    const category = await categoryService.updateCategory(id, {
      name,
      description,
      media,
      isHidden,
    });

    return sendSuccess(res, StatusCodes.OK, "Category updated successfully", {
      category,
    });
  },
);

// ─── DELETE /api/v1/categories/:id — حذف تصنيف (ناعم — يخفيه فقط) ───
export const deleteCategory = asyncHandler(
  async (req: Request<IdParam>, res: Response) => {
    const { id } = req.params;
    await categoryService.deleteCategory(id);

    return sendSuccess(res, StatusCodes.OK, "Category deleted successfully");
  },
);

// ─── PATCH /api/v1/categories/:id/toggle — تبديل حالة الإخفاء (ظاهر ⇄ مخفي) ───
export const toggleVisibility = asyncHandler(
  async (req: Request<IdParam>, res: Response) => {
    const { id } = req.params;
    const category = await categoryService.toggleVisibility(id);

    return sendSuccess(res, StatusCodes.OK, "Category visibility toggled", {
      category,
    });
  },
);
