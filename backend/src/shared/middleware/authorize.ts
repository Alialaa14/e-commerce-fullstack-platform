import { type Response, type NextFunction } from "express";
import AppError from "../errors/AppError";
import { StatusCodes } from "http-status-codes";
import prisma from "../../config/database";

export const authorize = (...roles: string[]) => {
  return async (req: any, res: Response, next: NextFunction) => {
    // todo => Search what is the practical way of signing the token will some info or just with user id
    const userId = req.user?.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!roles.includes(user?.role!)) {
      return next(
        new AppError(
          "You are not Authorized to Access This Route",
          StatusCodes.FORBIDDEN,
        ),
      );
    }
    return next();
  };
};
