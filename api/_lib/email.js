// api/_lib/email.js
// The ONLY module that touches Resend. Every email path goes through sendEmail
// so the isolation rule — missing env / Resend failure logs and continues,
// never breaks the app — is enforced in one place.
import { render } from '@react-email/render';

export const emailEnabled = () => !!process.env.RESEND_API_KEY;
export const fromAddress = () => process.env.NOTIFY_FROM || 'onboarding@resend.dev';
export const appUrl = () => process.env.APP_URL || 'https://innsaeit-client-dashboard.vercel.app';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Renders a React element and sends one email. Returns {skipped:true} when the
// API key is missing (warn only — the app must work without email configured).
// Throws on a Resend error so the caller's per-recipient try/catch records it.
export async function sendEmail({ to, subject, element }) {
  if (!emailEnabled()) {
    console.warn(`[email] RESEND_API_KEY missing — skipped "${subject}" -> ${to}`);
    return { skipped: true };
  }
  // TEST_MODE: redirect EVERY send to a single test inbox so the full pipeline
  // (subjects, bodies, data) can run without reaching real recipients. Content
  // is untouched — only the To field changes. Each dropped recipient is logged
  // so it can be verified in the Vercel logs. Absent/'false' = normal sending.
  if (process.env.TEST_MODE === 'true') {
    const target = process.env.TEST_MODE_RECIPIENT;
    const original = Array.isArray(to) ? to : [to];
    for (const r of original) {
      if (r && (!target || r.toLowerCase() !== target.toLowerCase())) {
        console.log(`[TEST_MODE] Suppressed send to ${r}`);
      }
    }
    if (!target) {
      // Never fall through to real recipients in test mode.
      console.warn(`[TEST_MODE] TEST_MODE_RECIPIENT not set — suppressing send to ${original.join(', ')}`);
      return { skipped: true };
    }
    to = target;
  }
  const { Resend } = await import('resend'); // lazy: cron boots fine without the key
  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = await render(element);
  const { data, error } = await resend.emails.send({
    from: fromAddress(), to, subject, html,
  });
  if (error) throw new Error(`Resend: ${error.message || error.name || JSON.stringify(error)}`);
  return { id: data?.id };
}
