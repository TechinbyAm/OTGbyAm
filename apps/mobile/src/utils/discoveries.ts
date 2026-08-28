import fetchToWeb from '@/__create/fetch';

export type Discovery = {
  id: string;
  sourceUrl: string;
  platform: string;
  title: string;
  destination: string;
  themeGuess: string;
  notes: string;
  imageUrl: string;
  status: string;
  promotedTripId: string | null;
  createdAt: string;
};

// Detected from the pasted URL's domain — the spec's 4 platform values are
// ig | tiktok | pinterest | manual; anything else pasted still counts as a
// real link (shows the generic source badge) but isn't one of those 3, so it
// falls back to 'manual' for the platform field while sourceUrl is preserved.
// Mirrors the same function in apps/web/src/components/DiscoveryTab.tsx.
export function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('pinterest.')) return 'pinterest';
  if (u.includes('tiktok.')) return 'tiktok';
  if (u.includes('instagram.') || u.includes('instagr.am')) return 'ig';
  return 'manual';
}

export function sourceBadge(d: Discovery): string {
  if (d.platform === 'pinterest') return 'P';
  if (d.sourceUrl) return '🔗';
  return '+';
}

export function newDiscoveryId() {
  return `discovery_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function fetchDiscoveries(): Promise<Discovery[]> {
  const res = await fetchToWeb('/api/discoveries');
  if (!res.ok) throw new Error('Failed to load discoveries');
  return res.json();
}

export async function createDiscovery(payload: {
  sourceUrl: string;
  platform: string;
  destination: string;
  notes: string;
}) {
  const res = await fetchToWeb('/api/discoveries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: newDiscoveryId(), ...payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(err.error || 'Failed to save discovery');
  }
}

export async function updateDiscovery(
  id: string,
  payload: {
    sourceUrl: string;
    platform: string;
    destination: string;
    notes: string;
    themeGuess: string;
    imageUrl: string;
    status: string;
  }
) {
  const res = await fetchToWeb(`/api/discoveries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(err.error || 'Failed to update discovery');
  }
}

export async function deleteDiscovery(id: string) {
  const res = await fetchToWeb(`/api/discoveries/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete discovery');
}
