import { Router, Request, Response } from "express";
import { sendEmail } from "../lib/mailer.js";

const router: Router = Router();

/**
 * POST /api/email/send
 * Public endpoint to send emails via SendGrid
 * 
 * Body:
 * {
 *   "to": "recipient@example.com",
 *   "subject": "Email Subject",
 *   "html": "<h1>Hello</h1><p>Email body in HTML</p>",
 *   "attachments": [  // optional
 *     {
 *       "content": "base64-encoded-file-content",
 *       "filename": "file.pdf",
 *       "type": "application/pdf",
 *       "disposition": "attachment"
 *     }
 *   ]
 * }
 * 
 * Response:
 * { "success": true, "message": "Email sent" }
 */
router.post("/send", async (req: Request, res: Response) => {
  try {
    const { to, subject, html, attachments } = req.body;

    console.log("[EMAIL] Received request:", { to, subject });

    // Basic validation
    if (!to || !subject || !html) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: to, subject, html",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email address",
      });
    }

    console.log("[EMAIL] Calling sendEmail...");
    await sendEmail({
      to,
      subject,
      html,
      attachments: attachments || undefined,
    });

    console.log("[EMAIL] Success!");
    res.json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.error("[EMAIL] Send error:", error);
    if (error?.response?.body) {
      console.error("[EMAIL] SendGrid response body:", error.response.body);
    }
    res.status(500).json({
      success: false,
      error: error?.message || "Failed to send email",
    });
  }
});

export default router;

