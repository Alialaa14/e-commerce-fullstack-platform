import prisma from "../../config/database";


class UserModel {
    async findProfileById(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                email: true,
                phone: true,
                role: true,
            }
        })
    }

    async findByEmail(email: string) {
        return prisma.user.findFirst({ where: { email } })
    }
    async findByPhone(phone: string) {
        return prisma.user.findFirst({ where: { phone } });
    }

}


export const userModel = new UserModel();
