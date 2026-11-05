function allowed(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !/^(localhost|127\\.|0\\.0\\.0\\.0|10\\.|192\\.168\\.|172\\.(1[6-9]|2\\d|3[01])\\.)/.test(u.hostname);
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { endpoint, wallet } = req.body || {};
  if (!allowed(endpoint)) return res.status(400).json({ error: 'Use a public HTTPS webhook URL.' });
  const payload = { source: 'Wheely Triggers', type: 'wheely.test', sentAt: new Date().toISOString(), wallet: wallet || null, message: 'Test event: your wheel automation is connected.' };
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'WheelyTriggers/0.1' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(7000)
    });
    if (!upstream.ok) return res.status(502).json({ error: `Webhook returned ${upstream.status}.` });
    res.status(200).json({ delivered: true });
  } catch { res.status(502).json({ error: 'Webhook could not be reached.' }); }
}