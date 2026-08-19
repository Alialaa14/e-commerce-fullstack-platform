import {
  categoryModel,
  type CategoryFilter,
  type CategoryResult,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "./category.model";

class CategoryService {

  async getCategories(filter: CategoryFilter): Promise<CategoryResult<any>> {
    return await categoryModel.getCategories(filter);
  }

  async getCategoryById(id: string) {
    return await categoryModel.getCategoryById(id);
  }

  async createCategory(data: CreateCategoryInput) {
    const createData = {
      name: data.name,
      description: data.description,
      media: data.media ?? {},
    };
    return await categoryModel.createCategory(createData);
  }
  async updateCategory(id: string, data: UpdateCategoryInput) {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.media !== undefined) updateData.media = data.media;
    if (data.isHidden !== undefined) updateData.ishidden = data.isHidden;

    return await categoryModel.updateCategory(id, updateData);
  }


  async deleteCategory(id: string, soft = true) {
    return await categoryModel.deleteCategory(id, soft);
  }

  async toggleVisibility(id: string) {
    return await categoryModel.toggleVisibility(id);
  }
}

export const categoryService = new CategoryService();
