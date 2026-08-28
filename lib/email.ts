import 'server-only';

import { env } from './env';
import { formatHour12, formatHourRange, formatMoney } from './hours';

/**
 * Resend is optional. Every helper here is best-effort: a mail failure must
 * never fail a webhook, because Dodo would then retry a payment we already
 * recorded.
 */
async function send(to: string, subject: string, html: string): Promise<void> {
  if (!env.resendApiKey) return;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: env.resendFrom, to: [to], subject, html }),
      cache: 'no-store',
    });
    if (!response.ok) {
      console.error('[resend] send failed', response.status, await response.text());
    }
  } catch (error) {
    console.error('[resend] send threw', error);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(body: string): string {
  return `<div style="font-family:Inter,Helvetica,Arial,sans-serif;color:#0a0a0a;line-height:1.6">${body}
    <p style="color:#6b7280;font-size:12px;margin-top:24px">24hrs.lol — own an hour, own the attention.</p>
  </div>`;
}

export async function sendWinnerEmail(
  to: string,
  hourNumber: number,
  amount: number,
  brandName: string,
  campaignDays: number,
): Promise<void> {
  const short = formatHour12(hourNumber);
  const slot = formatHourRange(hourNumber);
  await send(
    to,
    `🏆 You own ${short} — 24hrs.lol`,
    shell(`
      <h2 style="margin:0 0 8px">${escapeHtml(brandName)} owns ${short}.</h2>
      <p>Your bid of <strong>${formatMoney(amount)}</strong> won ${slot} UTC.</p>
      <p>Your brand is featured on the homepage clock during that hour, every day, for the
      next ${campaignDays} days — or until someone outbids you.</p>
      <p><a href="${env.siteUrl}" style="color:#2563eb">See it live →</a></p>
    `),
  );
}

export async function sendOutbidEmail(
  to: string,
  hourNumber: number,
  newAmount: number,
): Promise<void> {
  const short = formatHour12(hourNumber);
  await send(
    to,
    `You've been outbid on ${short} — 24hrs.lol`,
    shell(`
      <h2 style="margin:0 0 8px">Someone just took ${short}.</h2>
      <p>Someone bid <strong>${formatMoney(newAmount)}</strong> for ${short}.
      Bid ${formatMoney(newAmount + 1)} to reclaim it.</p>
      <p><a href="${env.siteUrl}" style="color:#2563eb">Reclaim ${escapeHtml(short)} →</a></p>
    `),
  );
}

export async function sendRefundEmail(
  to: string,
  hourNumber: number,
  amount: number,
): Promise<void> {
  const slot = formatHourRange(hourNumber);
  await send(
    to,
    `Refunding your ${slot} UTC bid`,
    shell(`
      <h2 style="margin:0 0 8px">Your bid did not take ${slot} UTC.</h2>
      <p>A higher bid landed while your payment was settling, so your ${formatMoney(amount)} is being refunded in full.</p>
      <p><a href="${env.siteUrl}" style="color:#2563eb">Try another hour →</a></p>
    `),
  );
}
