import { Router } from "express";
import authenticate from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleVisibility,
} from "./category.controller";
import {
  getCategoriesSchema,
  getCategoryByIdSchema,
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
  toggleVisibilitySchema,
} from "./category.validators";

const router = Router();

router.use(authenticate);

router
  .route("/")
  .get(validate(getCategoriesSchema), getCategories)
  .post(validate(createCategorySchema), createCategory);

router
  .route("/:id")
  .get(validate(getCategoryByIdSchema), getCategoryById)
  .put(validate(updateCategorySchema), updateCategory)
  .delete(validate(deleteCategorySchema), deleteCategory);

router
  .route("/:id/toggle")
  .patch(validate(toggleVisibilitySchema), toggleVisibility);

export default router;