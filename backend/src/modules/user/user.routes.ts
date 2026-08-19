
import { Router } from "express";
import authenticate from "../../shared/middleware/authenticate";
import { getCurrentUser } from "./user.controller";

const router = Router();

router.get("/me", authenticate, getCurrentUser);

export default router;