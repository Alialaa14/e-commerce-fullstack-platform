import { Router } from "express";
import { validate } from "../../shared/middleware/validate";
import authenticate from "../../shared/middleware/authenticate";
import { upload } from "../../shared/utils/upload";
import {
  login,
  register,
  verifyRegisterOtp,
  logout,
  sendOtp,
  verifyOtp,
  resetPassword,
  refreshAccessToken,
} from "./auth.controller";
import {
  loginSchema,
  registerSchema,
  otpSchema,
  forgetPasswordSchema,
  resetPasswordSchema,
} from "./auth.validators";

const router = Router();

router.post("/login", validate(loginSchema), login);
router.post(
  "/register",
  upload.single("picture"),
  validate(registerSchema),
  register,
);
router.post("/register-verify-otp", validate(otpSchema), verifyRegisterOtp);
router.post("/forget-password", validate(forgetPasswordSchema), sendOtp);
router.post("/verify-otp", validate(otpSchema), verifyOtp);
router.patch("/reset-password", validate(resetPasswordSchema), resetPassword);
router.post("/logout", authenticate, logout);
router.post("/refresh-accessToken", refreshAccessToken);

export default router;
