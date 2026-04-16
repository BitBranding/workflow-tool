export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { email } = await req.body;
  if (!email) return res.status(400).json({ error: 'missing email' });

  // Always log to Vercel function logs as a free backup
  console.log('[email-capture]', new Date().toISOString(), email);

  const results = { email, timestamp: new Date().toISOString(), hl: null, backup: null };

  // Primary: HighLevel webhook
  const hlUrl = process.env.HIGHLEVEL_WEBHOOK_URL;
  if (hlUrl) {
    try {
      const r = await fetch(hlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'ad-workflow-tool' })
      });
      results.hl = r.ok ? 'ok' : `error:${r.status}`;
    } catch (e) {
      results.hl = `failed:${e.message}`;
      console.error('[hl-webhook-error]', e.message);
    }
  } else {
    results.hl = 'not_configured';
  }

  // Backup: any webhook URL (Make.com, Zapier, Formspree, etc.)
  const backupUrl = process.env.BACKUP_WEBHOOK_URL;
  if (backupUrl) {
    try {
      const r = await fetch(backupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'ad-workflow-tool', timestamp: results.timestamp })
      });
      results.backup = r.ok ? 'ok' : `error:${r.status}`;
    } catch (e) {
      results.backup = `failed:${e.message}`;
      console.error('[backup-webhook-error]', e.message);
    }
  } else {
    results.backup = 'not_configured';
  }

  return res.status(200).json(results);
}
