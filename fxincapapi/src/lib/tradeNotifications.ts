import { sendEmail } from "./mailer.js";
import { canSendNotification, recordNotificationSent, type NotificationCategory } from "./notificationSettings.js";

async function sendGatedEmail(
  userId: string,
  category: NotificationCategory,
  payload: { to: string | null | undefined; subject: string; html: string }
): Promise<void> {
  try {
    if (!payload.to) return;
    const allowed = await canSendNotification(userId, category);
    if (!allowed) {
      console.log(`[NOTIF] Skipped ${category} email to ${payload.to} (disabled or daily cap reached)`);
      return;
    }
    await sendEmail({ to: payload.to, subject: payload.subject, html: payload.html });
    await recordNotificationSent(userId, category);
  } catch (err: any) {
    console.warn(`[NOTIF] Failed to send ${category} email:`, err?.message || err);
  }
}

const wrap = (title: string, accentColor: string, bodyHtml: string) => `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0b0f1a;color:#e2e8f0;border-radius:12px">
    <h2 style="color:${accentColor};margin:0 0 16px">${title}</h2>
    ${bodyHtml}
    <p style="color:#64748b;font-size:12px;margin-top:24px;border-top:1px solid #1e293b;padding-top:12px">
      This is an automated notification from your trading account.
    </p>
  </div>
`;

export async function notifyDepositApproved(input: {
  userId: string;
  to: string | null | undefined;
  firstName?: string;
  amount: number;
  currency?: string;
  accountNumber?: string | null;
}): Promise<void> {
  const currency = input.currency || "USD";
  const html = wrap(
    "Deposit Approved",
    "#22c55e",
    `
      <p>Hi ${input.firstName || "there"},</p>
      <p>Your deposit has been approved and credited to your account.</p>
      <p style="font-size:22px;font-weight:bold;color:#f8fafc;margin:16px 0">${currency} ${input.amount.toFixed(2)}</p>
      ${input.accountNumber ? `<p style="color:#94a3b8;font-size:13px">Account: ${input.accountNumber}</p>` : ""}
    `
  );
  await sendGatedEmail(input.userId, "deposit", {
    to: input.to,
    subject: `Deposit Approved — ${currency} ${input.amount.toFixed(2)}`,
    html,
  });
}

export async function notifyWithdrawalProcessed(input: {
  userId: string;
  to: string | null | undefined;
  firstName?: string;
  amount: number;
  currency?: string;
  status: "approved" | "rejected";
  accountNumber?: string | null;
}): Promise<void> {
  const currency = input.currency || "USD";
  const isApproved = input.status === "approved";
  const html = wrap(
    isApproved ? "Withdrawal Approved" : "Withdrawal Rejected",
    isApproved ? "#22c55e" : "#f43f5e",
    `
      <p>Hi ${input.firstName || "there"},</p>
      <p>
        ${isApproved
          ? "Your withdrawal request has been approved and processed."
          : "Your withdrawal request was rejected and the amount has been credited back to your account."}
      </p>
      <p style="font-size:22px;font-weight:bold;color:#f8fafc;margin:16px 0">${currency} ${input.amount.toFixed(2)}</p>
      ${input.accountNumber ? `<p style="color:#94a3b8;font-size:13px">Account: ${input.accountNumber}</p>` : ""}
    `
  );
  await sendGatedEmail(input.userId, "withdrawal", {
    to: input.to,
    subject: `Withdrawal ${isApproved ? "Approved" : "Rejected"} — ${currency} ${input.amount.toFixed(2)}`,
    html,
  });
}

export async function notifyTradeExecuted(input: {
  userId: string;
  to: string | null | undefined;
  firstName?: string;
  symbol: string;
  side: string;
  volume: number;
  entryPrice: number;
  accountNumber?: string | null;
}): Promise<void> {
  const html = wrap(
    "Trade Executed",
    "#38bdf8",
    `
      <p>Hi ${input.firstName || "there"},</p>
      <p>A new trade has been opened on your account.</p>
      <table style="width:100%;font-size:14px;margin:16px 0;border-collapse:collapse">
        <tr><td style="color:#94a3b8;padding:4px 0">Symbol</td><td style="text-align:right;font-weight:bold;color:#f8fafc">${input.symbol}</td></tr>
        <tr><td style="color:#94a3b8;padding:4px 0">Side</td><td style="text-align:right;font-weight:bold;color:${input.side === "BUY" ? "#22c55e" : "#f43f5e"}">${input.side}</td></tr>
        <tr><td style="color:#94a3b8;padding:4px 0">Volume</td><td style="text-align:right;color:#f8fafc">${input.volume}</td></tr>
        <tr><td style="color:#94a3b8;padding:4px 0">Entry Price</td><td style="text-align:right;color:#f8fafc">${input.entryPrice}</td></tr>
      </table>
      ${input.accountNumber ? `<p style="color:#94a3b8;font-size:13px">Account: ${input.accountNumber}</p>` : ""}
    `
  );
  await sendGatedEmail(input.userId, "trade", {
    to: input.to,
    subject: `Trade Executed — ${input.symbol} ${input.side}`,
    html,
  });
}
