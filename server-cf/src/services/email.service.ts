/**
 * @fileoverview Email delivery — Resend + dev fallback.
 *
 * Uses Resend REST API via fetch (no SDK import needed for Workers,
 * but the `resend` package also works). Keeping the SDK for consistency.
 */

import { Resend } from 'resend';

interface EmailEnv {
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  NODE_ENV: string;
}

export class EmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailError';
  }
}

// ─── HTML templates ────────────────────────────────────────────────────────

function _buildResetHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Reset your Neon Siege password</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#0f0f1a;border:1px solid rgba(0,255,255,0.15);border-radius:12px;padding:40px 36px;">
      <tr><td align="center" style="padding-bottom:24px;">
        <h1 style="margin:0;font-size:26px;letter-spacing:4px;text-transform:uppercase;color:#00ffff;text-shadow:0 0 14px #00ffff;">NEON SIEGE</h1>
        <p style="margin:8px 0 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ff2dec;">Password Reset</p>
      </td></tr>
      <tr><td style="color:#ccc;font-size:15px;line-height:1.6;padding-bottom:28px;">
        <p style="margin:0 0 12px;">We received a request to reset the password for your Neon Siege account.</p>
        <p style="margin:0;">Click the button below to set a new password. This link expires in <strong style="color:#fff;">1 hour</strong>.</p>
      </td></tr>
      <tr><td align="center" style="padding-bottom:28px;">
        <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:transparent;border:2px solid #00ffff;border-radius:6px;color:#00ffff;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;box-shadow:0 0 18px rgba(0,255,255,0.25);">RESET PASSWORD</a>
      </td></tr>
      <tr><td style="color:#555;font-size:12px;line-height:1.6;padding-bottom:24px;">
        <p style="margin:0 0 4px;">If the button doesn't work, copy and paste this link:</p>
        <a href="${resetUrl}" style="color:#00ffff;word-break:break-all;">${resetUrl}</a>
      </td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;color:#444;font-size:11px;line-height:1.5;">
        If you didn't request a password reset, you can safely ignore this email — your account remains secure.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function _buildRegistrationCodeHtml(code: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Verify your Neon Siege account</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#0f0f1a;border:1px solid rgba(0,255,255,0.15);border-radius:12px;padding:40px 36px;">
      <tr><td align="center" style="padding-bottom:24px;">
        <h1 style="margin:0;font-size:26px;letter-spacing:4px;text-transform:uppercase;color:#00ffff;text-shadow:0 0 14px #00ffff;">NEON SIEGE</h1>
        <p style="margin:8px 0 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ff2dec;">Email Verification</p>
      </td></tr>
      <tr><td style="color:#ccc;font-size:15px;line-height:1.6;padding-bottom:20px;">
        Enter this verification code in the registration form to finish creating your account.
        The code expires in <strong style="color:#fff;">10 minutes</strong>.
      </td></tr>
      <tr><td align="center" style="padding:8px 0 24px;">
        <div style="display:inline-block;padding:14px 22px;border:2px solid #00ffff;border-radius:8px;color:#00ffff;font-size:30px;font-weight:700;letter-spacing:10px;line-height:1;">${code}</div>
      </td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;color:#444;font-size:11px;line-height:1.5;">
        If you didn't request this, you can ignore this email.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// ─── Send functions ────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  env: EmailEnv,
  to: string,
  resetUrl: string,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email.service] DEV MODE — password reset link for ${to}:\n  ${resetUrl}`);
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Reset your Neon Siege password',
    html: _buildResetHtml(resetUrl),
  });

  if (error) {
    const statusCode = (error as any)?.statusCode;
    const name = (error as any)?.name;

    if (env.NODE_ENV !== 'production' && statusCode === 403 && name === 'validation_error') {
      console.warn('[email.service] Resend sandbox restriction. Falling back to logged link.');
      console.log(`[email.service] DEV FALLBACK — password reset link for ${to}:\n  ${resetUrl}`);
      return;
    }

    console.error('[email.service] Resend error:', error);
    throw new EmailError('Failed to send password reset email. Please try again later.');
  }
}

export async function sendRegistrationCodeEmail(
  env: EmailEnv,
  to: string,
  code: string,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email.service] DEV MODE — registration code for ${to}:\n  ${code}`);
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: 'Your Neon Siege verification code',
    html: _buildRegistrationCodeHtml(code),
  });

  if (error) {
    const statusCode = (error as any)?.statusCode;
    const name = (error as any)?.name;

    if (env.NODE_ENV !== 'production' && statusCode === 403 && name === 'validation_error') {
      console.warn('[email.service] Resend sandbox restriction. Falling back to logged code.');
      console.log(`[email.service] DEV FALLBACK — registration code for ${to}:\n  ${code}`);
      return;
    }

    console.error('[email.service] Resend error:', error);
    throw new EmailError('Failed to send verification email. Please try again later.');
  }
}
