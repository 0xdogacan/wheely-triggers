export default async function handler(req, res) {
  try {
    const upstream = await fetch('https://api.squeekchain.com/v1/status', { headers: { accept: 'application/json' } });
    const body = await upstream.text();
    res.setHeader('Cache-Control', 'no-store');
    res.status(upstream.status).send(body);
  } catch {
    res.status(503).json({ status: 'unavailable', message: 'Squeekchain status is temporarily unavailable.' });
  }
}