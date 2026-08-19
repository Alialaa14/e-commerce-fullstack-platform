import { Request, Response } from "express";
import { userService } from "./user.service";
import { StatusCodes } from "http-status-codes";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import AppError from "../../shared/errors/AppError";

export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.id; // ← جاية من authenticate
    if (!userId) {
      throw new AppError("Not authenticated", StatusCodes.UNAUTHORIZED);
    }

    const profile = await userService.getCurrentUser(userId);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Profile retrieved successfully",
      data: profile,
    });
  },
);
