import { Router } from "express";
import { validate } from "../../shared/middleware/validate";
import authenticate from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { upload } from "../../shared/utils/upload";
import {
  brandVerificationStatus,
  createBrand,
  createBrandDocument,
  updateBrandProfile,
  getPublicBrandProfile,
} from "./brand.controller";
import {
  brandVerificationStatusSchema,
  createBrandDocumentsSchema,
  createBrandSchema,
  updateBrandProfileSchema,
  getBrandProfileSchema,
} from "./brand.validators";

const router = Router();
router.use(authenticate);

router
  .route("/")
  .post(validate(createBrandSchema), authorize("admin", "user"), createBrand);

router.patch(
  "/:brandId/profile",
  authorize("admin", "brand"),
  upload.single("logo"),
  validate(updateBrandProfileSchema),
  updateBrandProfile,
);

router.get(
  "/:brandId/verification-status",
  authorize("admin", "brand"),
  validate(brandVerificationStatusSchema),
  brandVerificationStatus,
);

router.get("/:brandId", validate(getBrandProfileSchema), getPublicBrandProfile);

router.get(
  "/:brandId/verification-status",
  authenticate,
  validate(brandVerificationStatusSchema),
  brandVerificationStatus,
);

router.post(
  "/:brandId/documents",
  authorize("admin", "brand"),
  upload.array("documents"),
  validate(createBrandDocumentsSchema),
  createBrandDocument,
);

export default router;
