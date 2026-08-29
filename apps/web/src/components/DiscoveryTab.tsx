'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link2, Trash2, Pencil, X } from 'lucide-react';
import { COLORS, GRADIENT, FONTS, THEMES } from '@/utils/theme';
import { DestinationInput } from '@/components/DestinationInput';

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

function themeInfo(id: string) {
  return THEMES.find((t) => t.id === id) ?? null;
}

// Detected from the pasted URL's domain — the spec's 4 platform values are
// ig | tiktok | pinterest | manual; anything else pasted still counts as a
// real link (shows the generic source badge) but isn't one of those 3, so it
// falls back to 'manual' for the platform field while sourceUrl is preserved.
function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('pinterest.')) return 'pinterest';
  if (u.includes('tiktok.')) return 'tiktok';
  if (u.includes('instagram.') || u.includes('instagr.am')) return 'ig';
  return 'manual';
}

function sourceBadge(d: Discovery) {
  if (d.platform === 'pinterest') return 'P';
  if (d.sourceUrl) return '🔗';
  return '+';
}

function newDiscoveryId() {
  return `discovery_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
}

type ModalState =
  | { mode: 'create'; sourceUrl: string; platform: string }
  | { mode: 'edit'; discovery: Discovery };

// Lightweight handoff shape, matching how the Advisor already hands off to
// Plan via TripSuggestion — DiscoveryTab doesn't need to know Trip's full
// shape, page.tsx (which owns emptyTrip()) builds the actual draft from this.
export type PromoteDraft = {
  destination: string;
  theme: string;
  sourceLinks: { label: string; url: string; platform: string }[];
};

// Called from page.tsx's createMutation.onSuccess, once the reviewed draft
// trip actually saves — never called earlier than that, so a discovery can
// never end up marked "promoted" pointing at a trip that was never created
// (e.g. if the user opens the pre-filled editor and cancels instead of
// saving).
export async function promoteDiscoveries(discoveries: Discovery[], tripId: string) {
  await Promise.all(
    discoveries.map((d) =>
      fetch(`/api/discoveries/${d.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: d.sourceUrl,
          platform: d.platform,
          title: d.title,
          destination: d.destination,
          notes: d.notes,
          themeGuess: d.themeGuess,
          imageUrl: d.imageUrl,
          status: 'promoted',
          promotedTripId: tripId,
        }),
      })
    )
  );
}

export default function DiscoveryTab({
  onPromoteToTrip,
}: {
  onPromoteToTrip: (draft: PromoteDraft, discoveries: Discovery[]) => void;
}) {
  const queryClient = useQueryClient();
  const [themeFilter, setThemeFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState | null>(null);
  const [pasteValue, setPasteValue] = useState('');

  const { data: discoveries = [], isLoading } = useQuery<Discovery[]>({
    queryKey: ['discoveries'],
    queryFn: async () => {
      const res = await fetch('/api/discoveries');
      if (!res.ok) throw new Error('Failed to load discoveries');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      sourceUrl: string;
      platform: string;
      destination: string;
      notes: string;
    }) => {
      const res = await fetch('/api/discoveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newDiscoveryId(),
          sourceUrl: payload.sourceUrl,
          platform: payload.platform,
          destination: payload.destination,
          notes: payload.notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(err.error || 'Failed to save discovery');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveries'] });
      toast.success('Saved to Discovery.');
      setModal(null);
      setPasteValue('');
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Could not save — try again.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      sourceUrl: string;
      platform: string;
      destination: string;
      notes: string;
      themeGuess: string;
      imageUrl: string;
      status: string;
    }) => {
      const res = await fetch(`/api/discoveries/${payload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: payload.sourceUrl,
          platform: payload.platform,
          destination: payload.destination,
          notes: payload.notes,
          themeGuess: payload.themeGuess,
          imageUrl: payload.imageUrl,
          status: payload.status,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(err.error || 'Failed to update discovery');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveries'] });
      toast.success('Discovery updated.');
      setModal(null);
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Could not update — try again.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/discoveries/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveries'] });
      toast.success('Removed.');
    },
    onError: () => toast.error('Could not remove — try again.'),
  });

  function handlePromote() {
    const chosen = discoveries.filter((d) => selected.has(d.id));
    if (chosen.length === 0) return;

    const destinations = new Set(chosen.map((d) => d.destination.trim().toLowerCase()));
    if (destinations.size > 1) {
      toast.error('Select discoveries for one destination at a time.');
      return;
    }

    // Most common non-empty theme guess among the selection; falls back to
    // THEMES[0] (matching emptyTrip()'s own default) since nothing has real
    // theme classification yet — every discovery is "Unthemed" today.
    const themeCounts = new Map<string, number>();
    for (const d of chosen) {
      if (!d.themeGuess) continue;
      themeCounts.set(d.themeGuess, (themeCounts.get(d.themeGuess) ?? 0) + 1);
    }
    let theme: string = THEMES[0].id;
    let bestCount = 0;
    for (const [id, count] of themeCounts) {
      if (count > bestCount) {
        theme = id;
        bestCount = count;
      }
    }

    const sourceLinks = chosen
      .filter((d) => d.sourceUrl)
      .map((d) => ({ label: d.title || d.destination, url: d.sourceUrl, platform: d.platform }));

    onPromoteToTrip({ destination: chosen[0].destination, theme, sourceLinks }, chosen);
    setSelected(new Set());
  }

  const filtered = useMemo(
    () => (themeFilter === 'all' ? discoveries : discoveries.filter((d) => d.themeGuess === themeFilter)),
    [discoveries, themeFilter]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Discovery[]>();
    for (const d of filtered) {
      const key = d.destination || 'Unsorted';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePasteAdd() {
    const url = pasteValue.trim();
    if (!url) return;
    setModal({ mode: 'create', sourceUrl: url, platform: detectPlatform(url) });
  }

  const destinationCount = grouped.length;

  return (
    <section>
      <div className="mb-5">
        <div
          className="text-xs uppercase tracking-[0.25em]"
          style={{ color: COLORS.terracotta, fontFamily: FONTS.mono }}
        >
          {discoveries.length} save{discoveries.length === 1 ? '' : 's'}
          {destinationCount > 0 &&
            ` · ${destinationCount} destination${destinationCount === 1 ? '' : 's'}`}
        </div>
        <h1 className="text-3xl sm:text-4xl mt-1" style={{ fontFamily: FONTS.display, color: COLORS.ink }}>
          Everything that's caught your eye
        </h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <div
          className="flex-1 min-w-[14rem] flex items-center gap-2 rounded-full border pl-4 pr-1.5 py-1.5"
          style={{ borderColor: COLORS.borderMedium, background: COLORS.white }}
        >
          <Link2 size={14} style={{ color: COLORS.gray, flexShrink: 0 }} />
          <input
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePasteAdd();
            }}
            placeholder="Paste a link — Instagram, TikTok, Pinterest, anywhere"
            className="flex-1 outline-none bg-transparent text-sm min-w-0"
            style={{ color: COLORS.ink, fontFamily: FONTS.body }}
          />
          <button
            onClick={handlePasteAdd}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-white whitespace-nowrap shrink-0"
            style={{ background: GRADIENT.solid, fontFamily: FONTS.body }}
          >
            Add
          </button>
        </div>
        <button
          onClick={() => setModal({ mode: 'create', sourceUrl: '', platform: 'manual' })}
          className="rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap"
          style={{ borderColor: COLORS.borderMedium, color: COLORS.ink, fontFamily: FONTS.body }}
        >
          + Quick add
        </button>
      </div>

      {discoveries.length > 0 && (
        <div className="flex flex-nowrap sm:flex-wrap gap-2 mb-6 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 -mx-5 px-5 sm:mx-0 sm:px-0">
          <button
            onClick={() => setThemeFilter('all')}
            className="rounded-full border px-3 py-1.5 text-xs shrink-0"
            style={{
              borderColor: themeFilter === 'all' ? COLORS.ink : COLORS.borderMedium,
              background: themeFilter === 'all' ? COLORS.ink : 'transparent',
              color: themeFilter === 'all' ? 'white' : COLORS.gray,
              fontFamily: FONTS.body,
            }}
          >
            All themes
          </button>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setThemeFilter(t.id)}
              className="rounded-full border px-3 py-1.5 text-xs flex items-center gap-1 shrink-0"
              style={{
                borderColor: themeFilter === t.id ? COLORS.ink : COLORS.borderMedium,
                background: themeFilter === t.id ? COLORS.ink : 'transparent',
                color: themeFilter === t.id ? 'white' : COLORS.gray,
                fontFamily: FONTS.body,
              }}
            >
              <span style={{ fontSize: '0.7rem' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-neutral-400 text-sm">Loading discoveries…</p>
      ) : discoveries.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed p-10 text-center flex flex-col items-center gap-3"
          style={{ borderColor: COLORS.borderDashed, background: COLORS.cloud }}
        >
          <p style={{ fontFamily: FONTS.display, fontStyle: 'italic', fontSize: '1.05rem', color: COLORS.ink }}>
            Nothing saved yet
          </p>
          <p className="text-sm max-w-xs" style={{ color: COLORS.gray, fontFamily: FONTS.body }}>
            Paste a link from anywhere you found inspiration — Instagram, TikTok, Pinterest, or just
            type it in.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed p-10 text-center"
          style={{ borderColor: COLORS.borderDashed }}
        >
          <p className="text-sm" style={{ color: COLORS.gray, fontFamily: FONTS.body }}>
            Nothing saved under this theme yet.
          </p>
        </div>
      ) : (
        grouped.map(([destination, items]) => (
          <div key={destination} className="mb-7">
            <div
              className="flex items-baseline gap-2 mb-3 pb-2 border-b border-dashed"
              style={{ borderColor: COLORS.borderMedium }}
            >
              <span
                className="text-xs uppercase tracking-[0.14em]"
                style={{ fontFamily: FONTS.mono, color: COLORS.ink }}
              >
                {destination}
              </span>
              <span className="text-xs" style={{ fontFamily: FONTS.mono, color: COLORS.terracotta }}>
                {items.length} save{items.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.map((d) => {
                const t = themeInfo(d.themeGuess);
                const isSelected = selected.has(d.id);
                return (
                  <div
                    key={d.id}
                    className="rounded-2xl overflow-hidden flex flex-col"
                    style={{
                      border: isSelected ? `2px solid ${COLORS.teal}` : `1px solid ${COLORS.border}`,
                      boxShadow: isSelected ? `0 0 0 3px ${COLORS.tealTint}` : 'none',
                      background: COLORS.white,
                    }}
                  >
                    <div
                      className="relative flex items-center gap-2 px-3.5"
                      style={{ background: GRADIENT.header, height: '4.75rem' }}
                    >
                      <div
                        className="shrink-0 rounded-full border-2 flex items-center justify-center"
                        style={{
                          width: 30,
                          height: 30,
                          borderStyle: 'dashed',
                          borderColor: 'rgba(255,255,255,0.6)',
                          background: 'rgba(255,255,255,0.08)',
                          color: 'white',
                          fontSize: '0.9rem',
                        }}
                      >
                        {t?.icon ?? '?'}
                      </div>
                      <span
                        className="text-[10px] uppercase tracking-[0.12em]"
                        style={{ fontFamily: FONTS.mono, color: 'rgba(255,255,255,0.8)' }}
                      >
                        {t?.label ?? 'Unthemed'}
                      </span>

                      {/* Real checkbox input, visually hidden — native keyboard
                          focus + screen-reader semantics, custom circle styled
                          on top via the label. No prior checkbox pattern
                          existed in this app before Discovery. */}
                      <label
                        className="absolute cursor-pointer"
                        style={{ top: '0.5rem', right: '0.5rem', width: 26, height: 26 }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(d.id)}
                          className="sr-only peer"
                        />
                        <span
                          // Gold ring, not white — a white ring on this
                          // circle's own white/dashed resting-state border
                          // was technically applied (confirmed via
                          // getComputedStyle) but visually imperceptible.
                          // Hex must stay in sync with COLORS.gold in
                          // theme.ts (Tailwind class names can't reference
                          // a JS import).
                          className="w-full h-full rounded-full border-2 flex items-center justify-center peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#C9A227] peer-focus-visible:ring-offset-0"
                          style={{
                            borderStyle: isSelected ? 'solid' : 'dashed',
                            borderColor: isSelected ? 'transparent' : 'rgba(255,255,255,0.85)',
                            background: isSelected ? GRADIENT.solid : 'rgba(20,33,61,0.18)',
                          }}
                        >
                          {isSelected && (
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <path
                                d="M3 8.5L6.2 11.5L13 4.5"
                                stroke="#fff"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                      </label>

                      <div
                        className="absolute rounded-full flex items-center justify-center text-[10px] font-medium"
                        style={{
                          bottom: '0.5rem',
                          right: '0.5rem',
                          width: 18,
                          height: 18,
                          background: 'rgba(247,245,241,0.94)',
                          border: '1px solid rgba(255,255,255,0.6)',
                          fontFamily: FONTS.mono,
                          color: COLORS.ink,
                        }}
                      >
                        {sourceBadge(d)}
                      </div>
                    </div>
                    <div className="px-3.5 pt-3 pb-3.5 flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          style={{
                            fontFamily: FONTS.display,
                            fontWeight: 600,
                            fontSize: '0.9375rem',
                            color: COLORS.ink,
                          }}
                        >
                          {d.title || d.destination}
                        </span>
                        <div className="flex items-center gap-2.5 shrink-0 mt-0.5">
                          <button
                            onClick={() => setModal({ mode: 'edit', discovery: d })}
                            style={{ color: COLORS.gray }}
                            aria-label="Edit discovery"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(d.id)}
                            style={{ color: COLORS.terracotta }}
                            aria-label="Remove discovery"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <span
                        className="text-xs italic"
                        style={{ fontFamily: FONTS.body, color: COLORS.gray, lineHeight: 1.4 }}
                      >
                        {d.notes || (d.sourceUrl ? '' : 'Added manually — no source link')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {selected.size > 0 && (
        <div
          className="sticky bottom-4 flex items-center justify-between gap-4 rounded-2xl px-4 py-3.5 mt-4"
          style={{ background: COLORS.ink, color: 'white' }}
        >
          <span className="text-sm" style={{ fontFamily: FONTS.mono, color: 'rgba(255,255,255,0.75)' }}>
            {selected.size} selected
          </span>
          <button
            onClick={handlePromote}
            className="rounded-full px-4 py-2 text-sm font-medium text-white whitespace-nowrap"
            style={{ background: GRADIENT.solid, fontFamily: FONTS.body }}
          >
            Start a trip from these
          </button>
        </div>
      )}

      {modal && (
        <IntakeModal
          state={modal}
          onCancel={() => setModal(null)}
          onSave={(destination, notes) => {
            if (modal.mode === 'edit') {
              updateMutation.mutate({
                id: modal.discovery.id,
                sourceUrl: modal.discovery.sourceUrl,
                platform: modal.discovery.platform,
                themeGuess: modal.discovery.themeGuess,
                imageUrl: modal.discovery.imageUrl,
                status: modal.discovery.status,
                destination,
                notes,
              });
            } else {
              createMutation.mutate({
                sourceUrl: modal.sourceUrl,
                platform: modal.platform,
                destination,
                notes,
              });
            }
          }}
          saving={modal.mode === 'edit' ? updateMutation.isPending : createMutation.isPending}
        />
      )}
    </section>
  );
}

function IntakeModal({
  state,
  onCancel,
  onSave,
  saving,
}: {
  state: ModalState;
  onCancel: () => void;
  onSave: (destination: string, notes: string) => void;
  saving: boolean;
}) {
  const isEdit = state.mode === 'edit';
  const sourceUrl = isEdit ? state.discovery.sourceUrl : state.sourceUrl;
  const [destination, setDestination] = useState(isEdit ? state.discovery.destination : '');
  const [notes, setNotes] = useState(isEdit ? state.discovery.notes : '');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-6">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 style={{ fontFamily: FONTS.display }} className="text-2xl">
            {isEdit ? 'Edit discovery' : sourceUrl ? 'Save this' : 'Quick add'}
          </h3>
          <button onClick={onCancel} aria-label="Close">
            <X size={20} style={{ color: COLORS.ink }} />
          </button>
        </div>

        {sourceUrl && (
          <div
            className="text-xs mb-4 px-3 py-2 rounded-lg break-all"
            style={{ background: COLORS.cloud, color: COLORS.gray, fontFamily: FONTS.mono }}
          >
            {sourceUrl}
          </div>
        )}

        <div className="mb-4">
          <label className="text-sm font-medium" style={{ color: COLORS.ink }}>
            Destination
          </label>
          <DestinationInput value={destination} onChange={setDestination} />
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium" style={{ color: COLORS.ink }}>
            Why I saved this
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="One line is plenty"
            rows={2}
            className="w-full mt-1 border rounded-lg px-3 py-2 outline-none focus:ring-2 text-sm"
            style={{ borderColor: COLORS.borderDashed, fontFamily: FONTS.body }}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-sm font-medium"
            style={{ color: COLORS.ink, fontFamily: FONTS.body }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(destination, notes)}
            disabled={saving || !destination.trim()}
            className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50"
            style={{ background: GRADIENT.solid, fontFamily: FONTS.body }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
