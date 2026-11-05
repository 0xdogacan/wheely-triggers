import { get, set } from '../lib/kv.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id, ownerToken } = req.body || {};
  const rule = await get(`rule:${id}`);
  if (!rule || rule.ownerToken !== ownerToken || rule.destination !== 'telegram') return res.status(404).json({ error: 'Telegram rule not found.' });
  if (!process.env.TELEGRAM_BOT_TOKEN) return res.status(503).json({ error: 'Telegram bot is not configured yet.' });
  try {
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`);
    const data = await response.json();
    const expected = `/start ${rule.telegramCode}`;
    const update = (data.result || []).slice().reverse().find(item => item.message?.text === expected);
    if (!update) return res.status(200).json({ connected: false, message: 'Open the bot link, tap Start, then try again.' });
    rule.telegramChatId = String(update.message.chat.id);
    rule.enabled = true;
    rule.telegramCode = null;
    await set(`rule:${rule.id}`, rule);
    const { ownerToken: ignored, ...publicRule } = rule;
    res.status(200).json({ connected: true, rule: publicRule });
  } catch {
    res.status(502).json({ error: 'Telegram could not be reached.' });
  }
}