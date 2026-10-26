import nodemailer from 'nodemailer';

// Gratiskontoer hos Proton har ikke SMTP-token; da må Proton Bridge brukes.
export const PROTON_FREE = /@(proton\.me|protonmail\.com|protonmail\.ch|pm\.me)$/i;

export function smtpProblem(m) {
  if (!m.host) return 'SMTP er ikke satt opp.';
  if (m.host === 'smtp.protonmail.ch' && PROTON_FREE.test(m.user || ''))
    return 'Proton SMTP-token krever betalt plan og en adresse på eget domene. Bruk Proton Bridge for @proton.me-adresser.';
  return '';
}

export function transport(m) {
  return nodemailer.createTransport({
    host: m.host, port: Number(m.port),
    secure: m.sec === 'tls' || Number(m.port) === 465,
    requireTLS: m.sec === 'starttls',
    auth: m.user ? { user: m.user, pass: m.pass } : undefined,
    tls: m.host === '127.0.0.1' ? { rejectUnauthorized: false } : undefined
  });
}

const escH = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function layout({ title, lines, button, url }) {
  const text = [title, '', ...lines, '', button + ': ' + url, '', '– Kobling'].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#fbfaf8;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;color:#1f1e1c">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<div style="font-weight:700;font-size:18px;margin-bottom:24px">Kobling</div>
<div style="background:#fff;border:1px solid #e2dfd9;border-radius:12px;padding:24px">
<div style="font-size:17px;font-weight:600;margin-bottom:12px">${escH(title)}</div>
${lines.map(l => `<p style="font-size:14px;line-height:1.55;color:#3d3a36;margin:0 0 10px">${escH(l)}</p>`).join('')}
<a href="${escH(url)}" style="display:inline-block;margin-top:12px;background:oklch(0.52 0.15 250);background-color:#2b62c4;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">${escH(button)}</a>
<p style="font-size:12px;color:#8d8982;margin:16px 0 0">${escH(url)}</p>
</div></div></body></html>`;
  return { text, html };
}

export function inviteMail({ from, docTitle, role, url, message }) {
  return {
    subject: `${from} har invitert deg til «${docTitle}»`,
    ...layout({
      title: `Invitasjon til «${docTitle}»`,
      lines: [`${from} har gitt deg tilgang (${role.toLowerCase()}).`, ...(message ? [message] : []), 'Lenken er gyldig i 7 dager og virker uten konto.'],
      button: 'Godta invitasjon', url
    })
  };
}

export function sharedMail({ from, docTitle, url, message }) {
  return { subject: `«${docTitle}» er delt med deg`, ...layout({ title: `«${docTitle}» er delt med deg`, lines: [`${from} sendte deg dokumentet.`, ...(message ? [message] : [])], button: 'Åpne dokumentet', url }) };
}

export function commentMail({ from, docTitle, text, url }) {
  return { subject: `Ny kommentar i «${docTitle}»`, ...layout({ title: `Ny kommentar fra ${from}`, lines: [text], button: 'Vis kommentaren', url }) };
}

export async function sendMail(db, m, kind, to, mail, attachments) {
  const problem = smtpProblem(m);
  const log = (status, error) => db.prepare('INSERT INTO mail_log (kind, to_addr, subject, status, error, created) VALUES (?, ?, ?, ?, ?, ?)')
    .run(kind, to, mail.subject, status, error || null, Date.now());
  if (problem) { log('utboks', problem); return { ok: false, queued: true, error: problem } }
  try {
    await transport(m).sendMail({ from: m.from || m.user, to, subject: mail.subject, text: mail.text, html: mail.html, attachments });
    log('sendt');
    return { ok: true };
  } catch (e) {
    log('feil', e.message);
    return { ok: false, error: e.message };
  }
}
