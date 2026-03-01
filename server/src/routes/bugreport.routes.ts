/**
 * @fileoverview Bug report route — receives multipart form data with description,
 * screenshot, diagnostics JSON, and optional file attachments; emails everything
 * to the configured recipient via Resend.
 *
 * POST /  (mounted at /api/bug-reports)
 *   Body: multipart/form-data
 *     - description  (text, required)
 *     - userAgent    (text, optional)
 *     - url          (text, optional)
 *     - screenshot   (file, optional)
 *     - diagnostics  (file, optional — JSON)
 *     - attachments  (file[], optional — max 3)
 */

import { Hono } from 'hono';
import type { Env, AppVariables } from '../types';
import { createRateLimiter, getClientIp } from '../middleware/rateLimit';
import { sendFeedbackEmail } from '../services/email.service';

type BugReportEnv = { Bindings: Env; Variables: AppVariables };

export const bugReportRoutes = new Hono<BugReportEnv>();

// IP-based rate limiter — max 3 reports per 10 minutes
const limiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 3,
  prefix: 'bugreport_ip',
  keyFn: (c) => getClientIp(c) ?? 'unknown',
});

bugReportRoutes.post('/', limiter, async (c) => {
  const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10 MB total

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Invalid multipart body' }, 400);
  }

  // ─── Extract fields ─────────────────────────────────────

  const description = formData.get('description');
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return c.json({ error: 'Description is required' }, 400);
  }
  if (description.length > 2000) {
    return c.json({ error: 'Description must be under 2000 characters' }, 400);
  }

  const userAgent = (formData.get('userAgent') as string) || 'unknown';
  const url = (formData.get('url') as string) || 'unknown';
  const type = (formData.get('type') as string) === 'feature' ? 'feature' : 'bug';

  // ─── Collect file attachments ───────────────────────────

  interface Attachment {
    filename: string;
    content: Buffer;
    contentType: string;
  }

  const attachments: Attachment[] = [];
  let totalSize = 0;

  async function addFile(file: File | null, defaultName: string) {
    if (!file || !(file instanceof File)) return;
    const buf = Buffer.from(await file.arrayBuffer());
    totalSize += buf.byteLength;
    if (totalSize > MAX_TOTAL_SIZE) return; // skip if over limit
    attachments.push({
      filename: file.name || defaultName,
      content: buf,
      contentType: file.type || 'application/octet-stream',
    });
  }

  // Screenshot
  await addFile(formData.get('screenshot') as File | null, 'screenshot.png');

  // Diagnostics JSON
  await addFile(formData.get('diagnostics') as File | null, 'diagnostics.json');

  // Extra user attachments (may be single File or multiple)
  const extras = formData.getAll('attachments');
  for (const entry of extras) {
    if (typeof entry !== 'string' && 'arrayBuffer' in entry) {
      await addFile(entry as File, (entry as File).name);
    }
  }

  if (totalSize > MAX_TOTAL_SIZE) {
    return c.json({ error: 'Total attachment size exceeds 10 MB' }, 400);
  }

  // ─── Send email ─────────────────────────────────────────

  try {
    await sendFeedbackEmail(
      {
        RESEND_API_KEY: c.env.RESEND_API_KEY,
        EMAIL_FROM: c.env.EMAIL_FROM,
        NODE_ENV: c.env.NODE_ENV,
      },
      {
        type,
        description: description.trim(),
        userAgent,
        url,
        attachments,
      },
      c.env.FEEDBACK_EMAIL,
    );
  } catch (err) {
    console.error('[bug-report] Failed to send email:', err);
    return c.json({ error: 'Failed to send feedback. Please try again later.' }, 500);
  }

  return c.json({ success: true });
});
