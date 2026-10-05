// Brevo marks SMTP keys inactive after 3 months without a send; calsync can go
// that long without a booking. Cron runs this monthly on the VPS.
import nodemailer from "nodemailer";

process.loadEnvFile(new URL("../.env", import.meta.url));

const to = process.argv[2];
if (!to) {
  console.error("usage: node scripts/smtp-keepalive.mjs <recipient>");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_PORT === "465",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const info = await transporter.sendMail({
  from: process.env.SMTP_FROM,
  to,
  subject: "calsync SMTP keep-alive",
  text: `Monthly send to keep calsync's Brevo SMTP key active. Sent ${new Date().toISOString()}.`,
});
console.log(new Date().toISOString(), "sent", info.messageId);
