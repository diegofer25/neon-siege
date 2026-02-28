/**
 * @fileoverview Email delivery service via Resend.
 *
 * In development (RESEND_API_KEY unset) the reset link is printed to stdout
 * instead of being sent, so the feature works without credentials locally.
 */

import { Resend } from 'resend';
import { env } from '../config/env';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export class EmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailError';
  }
}

function _buildResetHtml(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your Neon Siege password</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#0f0f1a;border:1px solid rgba(0,255,255,0.15);border-radius:12px;padding:40px 36px;">

          <!-- Logo / title -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <h1 style="margin:0;font-size:26px;letter-spacing:4px;text-transform:uppercase;color:#00ffff;text-shadow:0 0 14px #00ffff;">
                NEON SIEGE
              </h1>
              <p style="margin:8px 0 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ff2dec;">
                Password Reset
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="color:#ccc;font-size:15px;line-height:1.6;padding-bottom:28px;">
              <p style="margin:0 0 12px;">We received a request to reset the password for your Neon Siege account.</p>
              <p style="margin:0;">Click the button below to set a new password. This link expires in <strong style="color:#fff;">1 hour</strong>.</p>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <a href="${resetUrl}"
                 style="display:inline-block;padding:14px 36px;background:transparent;border:2px solid #00ffff;border-radius:6px;color:#00ffff;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;box-shadow:0 0 18px rgba(0,255,255,0.25);">
                RESET PASSWORD
              </a>
            </td>
          </tr>

          <!-- Fallback URL -->
          <tr>
            <td style="color:#555;font-size:12px;line-height:1.6;padding-bottom:24px;">
              <p style="margin:0 0 4px;">If the button doesn't work, copy and paste this link:</p>
              <a href="${resetUrl}" style="color:#00ffff;word-break:break-all;">${resetUrl}</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;color:#444;font-size:11px;line-height:1.5;">
              If you didn't request a password reset, you can safely ignore this email — your account remains secure.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!resend) {
    // Dev fallback — works without Resend credentials
    console.log(`\n[email.service] DEV MODE — password reset link for ${to}:\n  ${resetUrl}\n`);
    return;
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Reset your Neon Siege password',
    html: _buildResetHtml(resetUrl),
  });

  if (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    const name = (error as { name?: string })?.name;

    if (env.NODE_ENV !== 'production' && statusCode === 403 && name === 'validation_error') {
      console.warn('[email.service] Resend sandbox restriction. Falling back to logged reset link in development.');
      console.warn('[email.service] To send to any recipient, verify a domain in Resend and set EMAIL_FROM to that domain.');
      console.log(`\n[email.service] DEV FALLBACK — password reset link for ${to}:\n  ${resetUrl}\n`);
      return;
    }

    console.error('[email.service] Resend error:', error);
    throw new EmailError('Failed to send password reset email. Please try again later.');
  }
}
