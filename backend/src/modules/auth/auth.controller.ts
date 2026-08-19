import { Request, Response } from "express";
import { authService } from "./auth.service";
import { StatusCodes } from "http-status-codes";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import AppError from "../../shared/errors/AppError";
import { ENV } from "../../config/env";

const isProduction = ENV.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : ("lax" as "none" | "lax"),
  path: "/",
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  if (!username) {
    throw new AppError("Username is required", StatusCodes.BAD_REQUEST);
  }

  const filePath = req.file?.path;
  const result = await authService.register(
    username,
    email,
    password,
    filePath,
  );
  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "OTP sent to email. Please verify to complete registration.",
    data: result,
  });
});

export const verifyRegisterOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, otp } = req.body;
    await authService.verifyRegisterOtp(token, otp);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Email verified successfully. You can now login.",
    });
  },
);

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  const result = await authService.login(identifier, password);

  res.cookie("refreshToken", result.refreshToken, {
    ...baseCookieOptions,
    maxAge: Number(ENV.REFRESH_TOKEN_EXPIRY) * 1000,
  });
  res.status(StatusCodes.OK).json({
    success: true,
    message: "Login successful",
    data: {
      accessToken: result.accessToken,
      accessTokenExpiration: result.accessTokenExpiration,
      user: result.user,
    },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  const accessToken = req.headers.authorization?.split(" ")[1];

  await authService.logout(refreshToken, accessToken);

  res.clearCookie("refreshToken", baseCookieOptions);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Logged out successfully",
  });
});

export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, purpose } = req.body;

  const result = await authService.sendOtp(email, purpose);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "OTP sent to email",
    data: result,
  });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { token, otp } = req.body;

  const result = await authService.verifyOtp(token, otp);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "OTP verified successfully",
    data: result,
  });
});

export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    await authService.resetPassword(token, newPassword);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Password reset successfully",
    });
  },
);

export const refreshAccessToken = asyncHandler(
  async (req: Request, res: Response) => {
    const incomingRefreshToken = req.cookies?.refreshToken;
    if (!incomingRefreshToken) {
      throw new AppError("No refresh token provided", StatusCodes.UNAUTHORIZED);
    }

    const result = await authService.refreshAccessToken(incomingRefreshToken);

    res.cookie("refreshToken", result.refreshToken, {
      ...baseCookieOptions,
      maxAge: Number(ENV.REFRESH_TOKEN_EXPIRY) * 1000,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Access token refreshed",
      data: {
        accessToken: result.accessToken,
        accessTokenExpiration: result.accessTokenExpiration,
      },
    });
  },
);
