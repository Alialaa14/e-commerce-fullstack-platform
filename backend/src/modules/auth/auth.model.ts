import prisma from "../../config/database";
import { Role } from "../../generated/prisma/enums";
class AuthModel {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        password: true,
        role: true,
        picture_url: true,
        refreshToken: true,
        isBanned: true,
        isOnline: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        otp: true,
        otp_expiration: true,
        otp_purpose: true,
        passwordChangedAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findFirst({ where: { email } });
  }

  async findUserByIdentifier(identifier: string) {
    return prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
  }

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    picture_url?: string;
    picture_url_id?: string;
    isVerified?: boolean;
  }) {
    return prisma.user.create({ data });
  }

  async updateRefreshToken(userId: string, refreshToken: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });
  }

  async updateAfterLogin(userId: string, refreshToken: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        isOnline: true,
        refreshToken,
      },
    });
  }

  async incrementFailedAttempts(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    const failedAttempts = user.failedLoginAttempts + 1;
    const updateData: any = { failedLoginAttempts: failedAttempts };
    if (failedAttempts >= 5) {
      updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
    return prisma.user.update({ where: { id: userId }, data: updateData });
  }

  async updateOtp(
    userId: string,
    otp: string,
    expiration: Date,
    purpose: string,
  ) {
    return prisma.user.update({
      where: { id: userId },
      data: { otp, otp_expiration: expiration, otp_purpose: purpose as any },
    });
  }

  async clearOtp(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { otp: null, otp_expiration: null, otp_purpose: null },
    });
  }

  async updatePassword(userId: string, hashedPassword: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });
  }

  async setOffline(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null, isOnline: false },
    });
  }

  async updateUser(
    userId: string,
    data: {
      username?: string;
      email?: string;
      phone?: string;
      picture_url?: string | null;
      picture_url_id?: string | null;
      isVerified?: boolean;
      role?: Role;
    },
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}

export const authModel = new AuthModel();
