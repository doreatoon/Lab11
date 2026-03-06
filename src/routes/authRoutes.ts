import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { User } from "../models/User";

const router = Router();

// BONUS: Advanced Rate Limiter with countdown data
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    handler: (req, res) => {
        // Calculate seconds until the limit resets
        const resetTime = (req as any).rateLimit.resetTime;
        const secondsLeft = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
        res.redirect(`/login?err=locked&wait=${secondsLeft}`);
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post("/register", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash });
    res.send({ message: "registered", userId: user._id.toString() });
});

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    // If login fails, calculate remaining attempts from the rate limiter
    const remaining = (req as any).rateLimit.remaining;

    if (!user || !(await bcrypt.compare(password, (user as any).passwordHash))) {
        return res.redirect(`/login?err=invalid&left=${remaining}`);
    }

    const token = jwt.sign(
        { userId: user._id.toString(), email },
        process.env.JWT_SECRET!,
        { expiresIn: "2h" }
    );

    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 2 * 60 * 60 * 1000,
    });
    res.redirect("/profile");
});

router.post("/logout", (req: Request, res: Response) => {
    res.clearCookie("token");
    res.redirect("/");
});

export default router;