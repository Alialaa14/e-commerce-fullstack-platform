import { type Request, type Response, type NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { ENV } from "../../config/env";
import { asyncHandler } from "../utils/asyncHandler";
import AppError from "../errors/AppError";

const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token =
      req.headers.authorization?.startsWith("Bearer ") &&
      req.headers.authorization.split(" ")[1];
    if (!token)
      throw new AppError("No token provided", StatusCodes.UNAUTHORIZED);

    try {
      const decoded = jwt.verify(token, ENV.ACCESS_TOKEN_SECRET!) as JwtPayload;
      console.log("Decoded Token:", decoded); // Debugging line to check the decoded token
      console.log(decoded);
      // todo => if the user has removed but the user know the token he will always have access to some controllers
      (req as any).user = decoded;
      next();
    } catch {
      throw new AppError("Invalid or expired token", StatusCodes.UNAUTHORIZED);
    }
  },
);
export default authenticate;
