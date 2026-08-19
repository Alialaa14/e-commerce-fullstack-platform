import jwt from "jsonwebtoken";
import { ENV } from "../../config/env";

class TokenService {
  generateAccessToken(payload: object): string {
    return jwt.sign(payload, ENV.ACCESS_TOKEN_SECRET!, {
      expiresIn: Number(ENV.ACCESS_TOKEN_EXPIRY),
    });
  }

  generateRefreshToken(payload: object): string {
    return jwt.sign(payload, ENV.REFRESH_TOKEN_SECRET!, {
      expiresIn: Number(ENV.REFRESH_TOKEN_EXPIRY),
    });
  }

  verifyAccessToken(token: string) {
    return jwt.verify(token, ENV.ACCESS_TOKEN_SECRET!);
  }

  verifyRefreshToken(token: string) {
    return jwt.verify(token, ENV.REFRESH_TOKEN_SECRET!);
  }
}

export const tokenService = new TokenService();
