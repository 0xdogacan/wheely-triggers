import { randomBytes } from 'node:crypto';

export default function handler(req, res) {
  const nonce = randomBytes(24).toString('hex');
  res.setHeader('Set-Cookie', `wt_nonce=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=300`);
  res.status(200).json({ message: `Sign in to Wheely Triggers\n\nNonce: ${nonce}` });
}