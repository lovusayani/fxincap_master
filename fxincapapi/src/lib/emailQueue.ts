import fs from 'fs';
import path from 'path';

export type QueuedEmail = {
  to: string;
  subject: string;
  html: string;
  createdAt: string;
};

const queueDir = path.resolve(process.cwd(), 'logs/email-queue');

export const enqueueEmail = async (email: QueuedEmail) => {
  try {
    if (!fs.existsSync(queueDir)) {
      fs.mkdirSync(queueDir, { recursive: true });
    }
    const fileName = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    const filePath = path.join(queueDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(email, null, 2));
    console.log(`[EMAIL QUEUE] Enqueued email to ${email.to} → ${fileName}`);
  } catch (err: any) {
    console.error('[EMAIL QUEUE] Failed to enqueue email:', err?.message || err);
  }
};
