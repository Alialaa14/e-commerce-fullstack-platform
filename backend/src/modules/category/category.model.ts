import prisma from "../../config/database";
import AppError from "../../shared/errors/AppError";
import { StatusCodes } from "http-status-codes";
import { Prisma } from "../../generated/prisma/client";



export interface CategoryFilter {
  search?: string;
  skip?: number;
  take?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  isHidden?: boolean;

}


export interface CategoryResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;

}

export interface CreateCategoryInput {
  name: string;
  description: string;
  media?: any;
}
export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  media?: any;
  isHidden?: boolean;
}




// ─── Model ───
class CategoryModel {
  private buildWhereClause(filter: CategoryFilter): any {
    const where: any = {};


    if (filter.isHidden === undefined || filter.isHidden === false) {
      where.isHidden = false
    }



    if (filter.search) {
      where.OR = [
        { name: { search: filter.search } },
        { description: { search: filter.search } },
      ]
    }

    return where;

  }
  async getCategories(filter: CategoryFilter): Promise<CategoryResult<any>> {
    try {
      const where = this.buildWhereClause(filter);
      const take = filter.take ?? 10;
      const skip = filter.skip ?? 0;

      const [total, data] = await Promise.all([
        prisma.category.count({ where }),
        prisma.category.findMany({
          where,
          skip,
          take,
          orderBy: filter.sortBy
            ? { [filter.sortBy]: filter.sortOrder ?? "asc" }
            : { createdAt: "desc" },
        }),
      ]);

      return {
        data,
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      };
    } catch (error) {
      throw new AppError(
        "فشل في جلب التصنيفات",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }


  async getCategoryById(id: string) {
    try {
      const category = await prisma.category.findUnique({ where: { id } });
      if (!category) {
        throw new AppError("التصنيف غير موجود", StatusCodes.NOT_FOUND);

      }
      return category;

    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("فشل في جلب التصنيف", StatusCodes.INTERNAL_SERVER_ERROR)
    }
  }


  async createCategory(data: any) {
    try {
      // تحقق من عدم التكرار
      const existing = await prisma.category.findUnique({
        where: { name: data.name },
      });
      if (existing) {
        throw new AppError(
          `التصنيف "${data.name}" موجود مسبقاً`,
          StatusCodes.CONFLICT
        );
      }
      return prisma.category.create({ data });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "فشل في إنشاء التصنيف",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  async updateCategory(id: string, data: any) {
    try {
      // تحقق من الوجود أولاً
      await this.getCategoryById(id);

      // تحقق من عدم تكرار الاسم إذا كان التحديث يشمل الاسم
      if (data.name) {
        const existing = await prisma.category.findUnique({
          where: { name: data.name },
        });
        if (existing && existing.id !== id) {
          throw new AppError(
            `التصنيف "${data.name}" موجود مسبقاً`,
            StatusCodes.CONFLICT
          );
        }
      }

      return prisma.category.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "فشل في تحديث التصنيف",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }


  async deleteCategory(id: string, soft = true) {
    try {
      await this.getCategoryById(id);

      // حذف ناعم — إخفاء فقط
      if (soft) {
        return prisma.category.update({
          where: { id },
          data: { ishidden: true },
        });
      }

      // حذف دائم
      return prisma.category.delete({ where: { id } });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "فشل في حذف التصنيف",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }


  async toggleVisibility(id: string) {
    try {
      const category = await this.getCategoryById(id);
      return prisma.category.update({
        where: { id },
        data: { ishidden: !category.ishidden },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "فشل في تبديل حالة التصنيف",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
}

export const categoryModel = new CategoryModel();

