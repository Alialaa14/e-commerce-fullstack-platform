import z from "zod";
import AppError from "../errors/AppError";
import { type Request, type Response, type NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = { ...req.body, ...req.query, ...req.params };
      const parsedData = schema.parse(data);
      if (parsedData) return next();
    } catch (error) {
      if (error && error instanceof z.ZodError) {
        return next(
          new AppError(error.issues[0]!.message, StatusCodes.BAD_REQUEST),
        );
      }
    }
  };
};
