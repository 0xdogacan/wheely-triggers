import { randomBytes, randomUUID } from 'node:crypto';
import { get, set, del, members, addMember, removeMember } from './lib/kv.js';

const clean = value => String(value || '').trim();
const validDiscord = url => {
  try { const u = new URL(url); return u.protocol === 'https:' && /(^|\.)discord(?:app)?\.com$/.test(u.hostname); } catch { return false; }
};
const ownerId = () => randomBytes(24).toString('hex');

async function list(owner) {
  const ids = await members(`owner:${owner}`);
  const rules = await Promise.all(ids.map(id => get(`rule:${id}`)));
  return rules.filter(Boolean).map(({ ownerToken, ...rule }) => rule);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const owner = clean(req.headers['x-wheely-owner']);
      if (!owner) return res.status(401).json({ error: 'Missing workspace key.' });
      return res.status(200).json({ rules: await list(owner) });
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      const destination = body.destination === 'telegram' ? 'telegram' : 'discord';
      const trigger = ['wheel_start', 'block', 'rpm', 'sleep'].includes(body.trigger) ? body.trigger : 'wheel_start';
      if (destination === 'discord' && !validDiscord(body.webhookUrl)) return res.status(400).json({ error: 'Use a valid Discord webhook URL.' });
      const ownerToken = clean(body.ownerToken) || ownerId();
      const id = randomUUID();
      const rule = {
        id, ownerToken, destination, trigger, webhookUrl: destination === 'discord' ? clean(body.webhookUrl) : null,
        threshold: trigger === 'rpm' ? Math.max(1, Math.min(500, Number(body.threshold) || 50)) : null,
        sleepMinutes: trigger === 'sleep' ? Math.max(1, Math.min(120, Number(body.sleepMinutes) || 3)) : null,
        telegramCode: destination === 'telegram' ? randomBytes(5).toString('hex') : null,
        telegramChatId: null, enabled: destination === 'discord', createdAt: new Date().toISOString(),
        lastFiredAt: null, deliveries: 0
      };
      await set(`rule:${id}`, rule);
      await addMember(`owner:${ownerToken}`, id);
      const { ownerToken: ignored, ...publicRule } = rule;
      return res.status(201).json({ rule: publicRule, ownerToken });
    }
    if (req.method === 'PATCH') {
      const owner = clean(req.headers['x-wheely-owner']);
      const id = clean(req.body?.id);
      const rule = await get(`rule:${id}`);
      if (!rule || rule.ownerToken !== owner) return res.status(404).json({ error: 'Rule not found.' });
      rule.enabled = Boolean(req.body?.enabled);
      await set(`rule:${id}`, rule);
      const { ownerToken, ...publicRule } = rule;
      return res.status(200).json({ rule: publicRule });
    }
    if (req.method === 'DELETE') {
      const owner = clean(req.headers['x-wheely-owner']);
      const id = clean(req.query.id);
      const rule = await get(`rule:${id}`);
      if (!rule || rule.ownerToken !== owner) return res.status(404).json({ error: 'Rule not found.' });
      await del(`rule:${id}`);
      await removeMember(`owner:${owner}`, id);
      return res.status(200).json({ deleted: true });
    }
    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message || 'Could not update rules.' });
  }
}