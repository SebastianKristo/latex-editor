// Miljøvariabler, samme navn som deploy/generators.js skriver i .env.
const bool = v => String(v).toLowerCase() === 'true';
const env = process.env;

export function loadConfig(over = {}) {
  const e = { ...env, ...over };
  return {
    port: Number(e.KOBLING_PORT || 8080),
    httpsPort: Number(e.KOBLING_HTTPS_PORT || 8443),
    publicUrl: e.KOBLING_PUBLIC_URL || '',
    dataDir: e.KOBLING_DATA || '/data',
    webDir: e.KOBLING_WEB_DIR || '',
    adminEmail: e.KOBLING_ADMIN_EMAIL || '',
    adminPassword: e.KOBLING_ADMIN_PASSWORD || '',
    duck: {
      on: bool(e.DUCKDNS_ENABLED), domain: e.DUCKDNS_SUBDOMAIN || '', token: e.DUCKDNS_TOKEN || '',
      interval: Number(e.DUCKDNS_INTERVAL_MIN || 5), ipv6: bool(e.DUCKDNS_IPV6), tls: bool(e.TLS_LETSENCRYPT)
    },
    smb: {
      on: bool(e.BACKUP_ENABLED), host: e.BACKUP_SMB_HOST || '', share: e.BACKUP_SMB_SHARE || 'backup', path: e.BACKUP_SMB_PATH || 'kobling',
      user: e.BACKUP_SMB_USER || '', pass: e.BACKUP_SMB_PASS || '', domain: e.BACKUP_SMB_DOMAIN || 'WORKGROUP', ver: e.BACKUP_SMB_VERSION || '3.0',
      cron: e.BACKUP_CRON || '0 3 * * *', keep: Number(e.BACKUP_KEEP || 14),
      include: (e.BACKUP_INCLUDE || 'docs,figs,hist,users').split(',').filter(Boolean)
    },
    smtp: {
      host: e.SMTP_HOST || '', port: Number(e.SMTP_PORT || 587), sec: e.SMTP_SECURITY || 'starttls',
      user: e.SMTP_USER || '', pass: e.SMTP_PASS || '', from: e.SMTP_FROM || '', notify: e.NOTIFY_COMMENTS !== 'false'
    }
  };
}

export const SECRET_KEYS = ['token', 'pass'];
// Hemmeligheter maskeres i API-svar; ekte verdier bare i nedlasting/bruk på serveren.
export const mask = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, SECRET_KEYS.includes(k) && v ? '••••••••' : v]));
