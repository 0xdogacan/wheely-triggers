import { verifyMessage, getAddress } from 'ethers';

function cookies(value = '') {
  return Object.fromEntries(value.split(';').map(x => x.trim().split('=')));
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { address, message, signature } = req.body || {};
  const nonce = cookies(req.headers.cookie).wt_nonce;
  if (!address || !message || !signature || !nonce || !message.includes(nonce)) {
    return res.status(400).json({ error: 'Invalid sign-in request.' });
  }
  try {
    if (getAddress(verifyMessage(message, signature)) !== getAddress(address)) throw new Error('Signature mismatch');
    res.setHeader('Set-Cookie', 'wt_nonce=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
    res.status(200).json({ address: getAddress(address) });
  } catch {
    res.status(401).json({ error: 'Wallet signature could not be verified.' });
  }
}