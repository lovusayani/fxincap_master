import { Router } from "express";
import { sendDepositEmail } from "../lib/mailer.js";
import { verifyToken, AuthRequest } from "./auth.js";

const router = Router();

router.get("/email-test", verifyToken, async (req: AuthRequest, res) => {
  try {
    // Authenticated via JWT; optional: could restrict to admins here
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    await sendDepositEmail({
      to: process.env.ADMIN_EMAIL || "sprsinfotech@gmail.com",
      amount: 1,
      currency: "USD",
      cryptoSymbol: "USDT",
      chain: "TRC20",
      walletOwnerName: "EmailTester",
      reference: `TEST-${Date.now()}`,
      userId: Number(user.id),
      userEmail: "tester@suimfx.com",
      notes: "Automated email health check",
      verificationUrl: process.env.VERIFICATION_URL,
    });

    res.json({ success: true, message: "Email sent via SendGrid" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Email send failed" });
  }
});

export default router;

