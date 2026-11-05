const base = () => process.env.STORAGE_URL;
const token = () => process.env.STORAGE_TOKEN;

async function command(args) {
  if (!base() || !token()) throw new Error('Storage is not connected.');
  const response = await fetch(base(), {
    method: 'POST',
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!response.ok) throw new Error('Storage request failed.');
  const json = await response.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

export async function get(key) {
  const value = await command(['GET', key]);
  return value ? JSON.parse(value) : null;
}
export async function set(key, value) {
  return command(['SET', key, JSON.stringify(value)]);
}
export async function del(key) {
  return command(['DEL', key]);
}
export async function members(key) {
  return (await command(['SMEMBERS', key])) || [];
}
export async function addMember(key, value) {
  return command(['SADD', key, value]);
}
export async function removeMember(key, value) {
  return command(['SREM', key, value]);
}