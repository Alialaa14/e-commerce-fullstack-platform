import { userModel } from "./user.model";
import AppError from "../../shared/errors/AppError";
import { StatusCodes } from "http-status-codes";


class UserService {
    async getCurrentUser(userId: string) {
        const user = await userModel.findProfileById(userId);
        if (!user) throw new AppError("User not found", StatusCodes.NOT_FOUND);
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            role: user.role,
        }

    }
}

export const userService = new UserService();
