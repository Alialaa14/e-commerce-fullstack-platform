import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().nonempty("Email or phone number is required"),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(2, "Username must be at least 2 characters long")
    .nonempty("Username is required"),
  email: z
    .string()
    .email("Please enter a valid email address")
    .nonempty("Email is required"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .nonempty("Password is required"),
  phone: z.string().optional(),
});

export const otpSchema = z.object({
  token: z.string().nonempty("Token is required"),
  otp: z.string().length(5).nonempty("OTP is required"),
});

export const forgetPasswordSchema = z.object({
  email: z.string().email().nonempty("Email is required"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email().nonempty("Email is required"),
  otp: z.string().length(5).nonempty("OTP is required"),
  password: z.string().min(6).nonempty("Password is required"),
});
