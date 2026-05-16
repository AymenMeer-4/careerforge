/**
 * lib/email.ts
 *
 * Transactional email via Resend. Two bilingual templates:
 *  - sendInterviewEmail: status → interview (Section 6.5)
 *  - sendOfferEmail:      status → offered, includes corporate contact info
 *
 * Negotiation / scheduling happens off-platform, so both emails surface the
 * relevant contact details. Failures are logged and returned, never thrown,
 * so a mail outage cannot block a status change.
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || '');
const FROM = process.env.RESEND_FROM || 'CareerForge AI <onboarding@resend.dev>';

export type Lang = 'en' | 'ar';

interface BaseArgs {
  to: string;
  lang?: Lang;
  studentName: string;
  companyName: string;
  jobTitle: string;
  corporateEmail?: string;
  corporatePhone?: string;
}

export type EmailResult = { ok: true; id?: string } | { ok: false; error: string };

function shell(lang: Lang, title: string, bodyHtml: string): string {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const align = lang === 'ar' ? 'right' : 'left';
  return `<!doctype html><html dir="${dir}"><body style="margin:0;background:#f4f2ff;padding:24px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e3fb;">
    <div style="background:linear-gradient(135deg,#6c5ce7,#00cec9);padding:20px 28px;color:#fff;font-size:18px;font-weight:700;">CareerForge AI</div>
    <div style="padding:28px;color:#2d2d3a;font-size:15px;line-height:1.7;text-align:${align};">
      <h2 style="margin:0 0 16px;font-size:20px;color:#1a1a2e;">${title}</h2>
      ${bodyHtml}
    </div>
  </div></body></html>`;
}

async function send(to: string, subject: string, html: string): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error('Resend error:', error);
      return { ok: false, error: error.message || 'Email send failed' };
    }
    return { ok: true, id: data?.id };
  } catch (e: any) {
    console.error('Resend exception:', e);
    return { ok: false, error: e?.message || 'Email send failed' };
  }
}

export async function sendInterviewEmail(args: BaseArgs): Promise<EmailResult> {
  const lang: Lang = args.lang === 'ar' ? 'ar' : 'en';
  const contact = [args.corporateEmail, args.corporatePhone].filter(Boolean).join(' / ');
  if (lang === 'ar') {
    const html = shell('ar', 'لديك مقابلة عمل 🎉', `
      <p>مرحباً ${args.studentName}،</p>
      <p>لديك مقابلة لوظيفة <strong>${args.jobTitle}</strong> في <strong>${args.companyName}</strong>.</p>
      <p>ستتواصل معك الشركة خلال 48 ساعة${contact ? ` عبر: <strong>${contact}</strong>` : ''}.</p>
      <p>بالتوفيق!<br/>فريق CareerForge AI</p>`);
    return send(args.to, `مقابلة عمل: ${args.jobTitle} — ${args.companyName}`, html);
  }
  const html = shell('en', 'You have an interview 🎉', `
    <p>Hi ${args.studentName},</p>
    <p>You have an interview for <strong>${args.jobTitle}</strong> at <strong>${args.companyName}</strong>.</p>
    <p>The company will contact you within 48 hours${contact ? ` at <strong>${contact}</strong>` : ''}.</p>
    <p>Good luck!<br/>The CareerForge AI team</p>`);
  return send(args.to, `Interview: ${args.jobTitle} — ${args.companyName}`, html);
}

export async function sendOfferEmail(args: BaseArgs): Promise<EmailResult> {
  const lang: Lang = args.lang === 'ar' ? 'ar' : 'en';
  const contact = [args.corporateEmail, args.corporatePhone].filter(Boolean).join(' / ') || '—';
  if (lang === 'ar') {
    const html = shell('ar', 'لقد تلقيت عرض عمل 🎊', `
      <p>مرحباً ${args.studentName}،</p>
      <p>قدّمت لك <strong>${args.companyName}</strong> عرضاً لوظيفة <strong>${args.jobTitle}</strong>.</p>
      <p>للتفاوض على التفاصيل، تواصل معهم على: <strong>${contact}</strong>.</p>
      <p>تتم المفاوضات خارج المنصة.<br/>فريق CareerForge AI</p>`);
    return send(args.to, `عرض عمل: ${args.jobTitle} — ${args.companyName}`, html);
  }
  const html = shell('en', 'You received an offer 🎊', `
    <p>Hi ${args.studentName},</p>
    <p><strong>${args.companyName}</strong> has extended you an offer for <strong>${args.jobTitle}</strong>.</p>
    <p>Contact them at <strong>${contact}</strong> for negotiation details.</p>
    <p>Negotiation happens off-platform.<br/>The CareerForge AI team</p>`);
  return send(args.to, `Offer: ${args.jobTitle} — ${args.companyName}`, html);
}
