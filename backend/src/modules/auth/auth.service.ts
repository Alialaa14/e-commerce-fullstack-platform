import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import { ENV } from "../../config/env";
import { authModel } from "./auth.model";
import { tokenService } from "./token.service";
import { sendEmail } from "../../shared/utils/email";
import { otpEmailTemplate } from "../../shared/utils/emailTemplates";
import { uploadToCloudinary } from "../../shared/utils/cloudinary";
import { removeFileFromDisk } from "../../shared/utils/upload";
import Otp from "../../shared/utils/otp";
import AppError from "../../shared/errors/AppError";
import { StatusCodes } from "http-status-codes";

class AuthService {

  async register(username: string, email: string, password: string, filePath?: string) {
    const existingUser = await authModel.findByEmail(email);
    if (existingUser) {
      throw new AppError(`User with email ${email} already exists`, 409);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let picture: { url: string; id: string } | undefined;
    if (filePath) {
      try {
        const result = await uploadToCloudinary(filePath, "users");
        picture = { url: result.secure_url, id: result.public_id };
      } finally { removeFileFromDisk(filePath); }
    }

    const otpUtil = new Otp(5);
    const generatedOtp = otpUtil.generateOtp();
    const otpSalt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(generatedOtp, otpSalt);

    try {
      await sendEmail(email, "Sign up Verification",
        otpEmailTemplate({ name: username, otp: generatedOtp, expiresInMinutes: otpUtil.otp_expiration_minutes, appName: "Fashion Connect", supportEmail: "example@gmail.com" }));
    } catch (error) {
      if (picture?.id) {
        const { deleteFromCloudinary } = await import("../../shared/utils/cloudinary");
        await deleteFromCloudinary(picture.id);
      }
      throw error;
    }

    const token = jwt.sign(
      { purpose: "signup-pending", username, email, password: hashedPassword, picture, otpHash: hashedOtp },
      ENV.ACCESS_TOKEN_SECRET!,
      { expiresIn: otpUtil.otp_expiration_minutes * 60 * 1000 });

    return { Token: token, expiration: otpUtil.otp_expiration_minutes };
  }

  async verifyRegisterOtp(token: string, otp: string) {
    const payload = jwt.verify(token, ENV.ACCESS_TOKEN_SECRET!) as JwtPayload;
    if (payload?.purpose !== "signup-pending")
      throw new AppError("Invalid Registration Session", 400);

    const otpMatches = await bcrypt.compare(otp, payload.otpHash!);
    if (!otpMatches)
      throw new AppError("OTP does not match", 400);

    const existingUser = await authModel.findByEmail(payload.email);
    if (existingUser) {
      if (payload.picture?.id) {
        const { deleteFromCloudinary } = await import("../../shared/utils/cloudinary");
        await deleteFromCloudinary(payload.picture.id);
      }
      throw new AppError("Email already exists", 409);
    }

    await authModel.createUser({
      username: payload.username, email: payload.email,
      password: payload.password, picture_url: payload.picture?.url,
      picture_url_id: payload.picture?.id, isVerified: true });
  }

  async login(identifier: string, password: string) {
    const user = await authModel.findUserByIdentifier(identifier);
    if (!user) throw new AppError("Invalid credentials", 401);

    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new AppError("Account is locked", 403);
    if (user.isBanned)
      throw new AppError("Account is banned", 403);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await authModel.incrementFailedAttempts(user.id);
      throw new AppError("Invalid credentials", 401);
    }

    const accessToken = tokenService.generateAccessToken({ id: user.id });
    const refreshToken = tokenService.generateRefreshToken({ id: user.id });
    await authModel.updateAfterLogin(user.id, refreshToken);

    return {
      accessToken, refreshToken,
      accessTokenExpiration: Number(ENV.ACCESS_TOKEN_EXPIRY),
      refreshTokenExpiration: Number(ENV.REFRESH_TOKEN_EXPIRY),
      user: { id: user.id, username: user.username, phone: user.phone, email: user.email, role: user.role, picture_url: user.picture_url },
    };
  }

  async logout(refreshToken: string | undefined, accessToken: string | undefined) {
    const token = accessToken || refreshToken;
    if (!token) throw new AppError("No token", 401);
    try {
      const payload = jwt.verify(token, ENV.ACCESS_TOKEN_SECRET!) as JwtPayload;
      await authModel.setOffline(payload.id);
    } catch { throw new AppError("Invalid token", 401); }
  }

  async sendOtp(email: string, purpose: string) {
    if (purpose !== "resetpassword" && purpose !== "signup")
      throw new AppError("Invalid purpose", 400);

    const user = await authModel.findByEmail(email);
    if (!user) throw new AppError("User not found", 404);

    const otpUtil = new Otp(5);
    const generatedOtp = otpUtil.generateOtp();
    await sendEmail(email, "OTP Verification",
      otpEmailTemplate({ name: user.username, otp: generatedOtp, expiresInMinutes: otpUtil.otp_expiration_minutes, appName: "Fashion Connect", supportEmail: "example@gmail.com" }));

    const token = jwt.sign(
      { id: user.id, purpose: "reset-password" }, ENV.ACCESS_TOKEN_SECRET!,
      { expiresIn: otpUtil.otp_expiration_minutes * 60 * 1000 });
    await authModel.updateOtp(user.id, generatedOtp, otpUtil.otp_expiration_date, purpose);
    return { Token: token, expiration: otpUtil.otp_expiration_minutes };
  }

  async verifyOtp(token: string, otp: string) {
    const payload = jwt.verify(token, ENV.ACCESS_TOKEN_SECRET!) as JwtPayload;
    if (payload?.purpose !== "reset-password")
      throw new AppError("Invalid session", 400);

    const user = await authModel.findById(payload.id);
    if (!user) throw new AppError("User not found", 404);

    if (new Date() > user.otp_expiration!)
      throw new AppError("OTP expired", 400);
    if (user.otp !== otp)
      throw new AppError("Invalid OTP", 400);

    await authModel.clearOtp(user.id);
    const verifyToken = jwt.sign(
      { id: user.id, purpose: "verify-otp" }, ENV.ACCESS_TOKEN_SECRET!,
      { expiresIn: 5 * 60 });
    return { Token: verifyToken, expiration: 5 };
  }

  async resetPassword(token: string, newPassword: string) {
    const payload = jwt.verify(token, ENV.ACCESS_TOKEN_SECRET!) as JwtPayload;
    if (payload?.purpose !== "verify-otp")
      throw new AppError("Invalid session", 400);

    const user = await authModel.findById(payload.id);
    if (!user) throw new AppError("User not found", 404);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await authModel.updatePassword(user.id, hashedPassword);
  }

  async refreshAccessToken(incomingRefreshToken: string) {
    const payload = tokenService.verifyRefreshToken(incomingRefreshToken) as JwtPayload;

    const user = await authModel.findById(payload.id);
    if (!user) throw new AppError("User not found", 404);

    if (user.refreshToken !== incomingRefreshToken)
      throw new AppError("Refresh token revoked", 401);
    if (user.isBanned)
      throw new AppError("Account banned", 403);
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new AppError("Account locked", 403);

    const newAccessToken = tokenService.generateAccessToken({ id: user.id });
    const newRefreshToken = tokenService.generateRefreshToken({ id: user.id });
    await authModel.updateRefreshToken(user.id, newRefreshToken);

    return {
      accessToken: newAccessToken, refreshToken: newRefreshToken,
      accessTokenExpiration: Number(ENV.ACCESS_TOKEN_EXPIRY),
      refreshTokenExpiration: Number(ENV.REFRESH_TOKEN_EXPIRY),
    };
  }
}

export const authService = new AuthService();
