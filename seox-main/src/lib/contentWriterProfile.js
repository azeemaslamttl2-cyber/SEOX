export async function loadContentWriterProfile() {
  const response = await fetch('/api/content-writer');
  if (!response.ok) throw new Error('Could not load saved articles.');
  return response.json();
}

export async function saveContentWriterProfile(profile) {
  const response = await fetch('/api/content-writer', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
  if (!response.ok) throw new Error('Could not save articles.');
}

export async function updateContentWriterProfile(fields) {
  const current = await loadContentWriterProfile().catch(() => ({}));
  return saveContentWriterProfile({ ...current, ...fields });
}
