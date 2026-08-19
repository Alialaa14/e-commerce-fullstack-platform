import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { ENV } from "./config/env";
import { connectDB } from "./config/database";
import authRouter from "./modules/auth/auth.routes";
import brandRouter from "./modules/brand/brand.routes";
import usersRouter from "./modules/user/user.routes";
import categoryRouter from "./modules/category/category.routes";
import { StatusCodes } from "http-status-codes";
import userRouter from "./modules/user/user.routes";

const app = express();
connectDB();

// Middleware — كلها كانت مفقودة قبل كده
app.use(helmet()); // أمان HTTP headers
app.use(cors({ origin: true, credentials: true })); // CORS للـ frontend
app.use(morgan("dev")); // تسجيل الطلبات
app.use(express.json());
app.use(cookieParser()); // ← جديد: عشان req.cookies يشتغل

// Routes — من الموديولات الجديدة
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/brands", brandRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/categories", categoryRouter);

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  const statusCode = err.statusCode || 500;
  console.log(err);
  res
    .status(statusCode)
    .json({ success: false, message: err.message || "Internal Server Error" });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.listen(ENV.PORT, () => {
  console.log(`Server is running on port ${ENV.PORT}`);
});
