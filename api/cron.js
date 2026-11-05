import { get, set, members } from './lib/kv.js';

const telegram = async (chatId, text) => {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text })
  });
  return response.ok;
};
const discord = async (webhookUrl, text) => {
  const response = await fetch(webhookUrl, {
    method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'WheelyTriggers/1.0' },
    body: JSON.stringify({ content: text })
  });
  return response.ok;
};

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const upstream = await fetch('https://api.squeekchain.com/v1/status', {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 WheelyTriggers/1.0' },
      signal: AbortSignal.timeout(9000)
    });
    if (!upstream.ok) throw new Error('Telemetry unavailable');
    const data = await upstream.json();
    const m = data.measurement || {}, b = data.builder || {};
    const current = {
      running: m.coreStatus === 'RUNNING',
      rpm: Number(m.rpmMilli || 0) / 1000,
      height: String(b.anchor?.blockHeight || b.projected?.blockHeight || ''),
      at: data.generatedAt || new Date().toISOString()
    };
    const previous = await get('state:latest');
    if (!current.running) current.idleSince = previous?.running ? Date.now() : (previous?.idleSince || Date.now());
    if (!previous) return res.status(200).json({ ok: true, primed: true, current });

    const ids = await members('rules:all');
    let delivered = 0;
    for (const id of ids) {
      const rule = await get(`rule:${id}`);
      if (!rule?.enabled) continue;
      let message = null;
      if (rule.trigger === 'wheel_start' && !previous.running && current.running) message = '⚡ Squeektoshi started running. The wheel is live.';
      if (rule.trigger === 'block' && current.height && previous.height && current.height !== previous.height) message = `🧱 New Squeek block: #${current.height}.`;
      if (rule.trigger === 'rpm' && current.rpm >= rule.threshold && previous.rpm < rule.threshold) message = `💨 Wheel RPM crossed ${rule.threshold}. Current RPM: ${current.rpm.toFixed(1)}.`;
      if (rule.trigger === 'sleep' && !current.running) {
        const idleSince = Number(current.idleSince || Date.now());
        if (Date.now() - idleSince >= rule.sleepMinutes * 60000 && rule.lastFiredAt !== new Date(idleSince).toISOString()) {
          message = `🌙 Squeektoshi has been idle for ${rule.sleepMinutes}+ minutes.`;
          rule.lastFiredAt = new Date(idleSince).toISOString();
        }
      }
      if (!message) continue;
      const ok = rule.destination === 'telegram'
        ? await telegram(rule.telegramChatId, message)
        : await discord(rule.webhookUrl, message);
      if (ok) { rule.deliveries = (rule.deliveries || 0) + 1; rule.lastFiredAt = current.at; await set(`rule:${id}`, rule); delivered++; }
    }
    await set('state:latest', current);
    res.status(200).json({ ok: true, delivered, current });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Trigger runner failed.' });
  }
}