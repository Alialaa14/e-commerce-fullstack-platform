import z, { object } from "zod";

export const updateProfileSchema = z
  .object({
    name: z.string().min(1, "Name cannot be empty").optional(),
    email: z.string().email("Invalid email format").optional(),
    phone: z.string().min(8, "Phone must be at least 8 characters").optional(),
    profilePictureUrl: z.string().url("Invalid URL").optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });
