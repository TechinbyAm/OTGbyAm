'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Compass,
  MapPin,
  Plus,
  X,
  Send,
  Users,
  Calendar,
  Link2,
  Sparkles,
  Lock,
  Globe,
  Trash2,
  Edit3,
  CheckCircle,
} from 'lucide-react';
import useHandleStreamResponse from '@/utils/useHandleStreamResponse';
import { COLORS, GRADIENT, FONTS, FONT_LINK, THEMES } from '@/utils/theme';
import { DestinationInput } from '@/components/DestinationInput';
import DiscoveryTab, { promoteDiscoveries, type Discovery, type PromoteDraft } from '@/components/DiscoveryTab';

type AffiliateLink = { label: string; url: string };
// Discovery source links attached via promote-to-trip (T8) — separate from
// affiliateLinks (revenue-only) and notes (free-text). `platform` is the
// discovery's origin (ig | tiktok | pinterest | manual).
type SourceLink = { label: string; url: string; platform: string };
type Trip = {
  id: string;
  title: string;
  destination: string;
  theme: string;
  startDate: string;
  endDate: string;
  capacity: number;
  status: 'draft' | 'published';
  priceFrom: string;
  notes: string;
  affiliateLinks: AffiliateLink[];
  sourceLinks: SourceLink[];
};
type Message = { role: 'user' | 'assistant'; content: string };

function emptyTrip(): Trip {
  const uid =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${performance.now()}`;
  return {
    id: `trip_${uid}`,
    title: '',
    destination: '',
    theme: THEMES[0].id,
    startDate: '',
    endDate: '',
    capacity: 8,
    status: 'draft',
    priceFrom: '',
    notes: '',
    affiliateLinks: [],
    sourceLinks: [],
  };
}

function themeInfo(id: string) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d: string) {
  if (!d) return 'TBD';
  const parts = d.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return d;
  const [year, month, day] = parts;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

// ---------- Itinerary parser ----------
function parseItinerary(notes: string): { subtitle: string | null; lines: string[] } {
  if (!notes) return { subtitle: null, lines: [] };

  // "Day 1:" / "Day 1 -" / "Day 1–" patterns
  if (/Day\s+\d+[\s]*[:\-–]/i.test(notes)) {
    const parts = notes
      .split(/(?=Day\s+\d+[\s]*[:\-–])/i)
      .map((s) => s.trim())
      .filter(Boolean);
    const firstIsDay = /^Day\s+\d+/i.test(parts[0]);
    const subtitle = !firstIsDay ? parts[0] : null;
    const lines = (firstIsDay ? parts : parts.slice(1)).slice(0, 3);
    return { subtitle, lines };
  }

  // Numbered list "1." or "1)"
  if (/^\d+[.)]/m.test(notes)) {
    const all = notes
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const firstIsItem = /^\d+[.)]/.test(all[0]);
    return {
      subtitle: !firstIsItem ? all[0] : null,
      lines: (firstIsItem ? all : all.slice(1)).slice(0, 3),
    };
  }

  // Dash / bullet list
  if (/^[-•*]/m.test(notes)) {
    const all = notes
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const firstIsBullet = /^[-•*]/.test(all[0]);
    return {
      subtitle: !firstIsBullet ? all[0] : null,
      lines: (firstIsBullet ? all : all.slice(1))
        .filter((s) => /^[-•*]/.test(s))
        .map((s) => s.replace(/^[-•*]\s*/, ''))
        .slice(0, 3),
    };
  }

  // Newline-separated — first line is subtitle, rest are items
  const splitLines = notes
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (splitLines.length > 1) {
    return { subtitle: splitLines[0], lines: splitLines.slice(1, 4) };
  }

  // Plain paragraph
  return { subtitle: null, lines: [notes.slice(0, 90) + (notes.length > 90 ? '…' : '')] };
}

// ---------- Passport stamp badge ----------
function StampBadge({ theme, small }: { theme: string; small?: boolean }) {
  const t = themeInfo(theme);
  return (
    <div
      className={`shrink-0 rounded-full border-2 flex flex-col items-center justify-center text-center select-none ${
        small ? 'w-14 h-14' : 'w-20 h-20'
      }`}
      style={{
        borderColor: COLORS.gold,
        borderStyle: 'dashed',
        color: COLORS.gold,
        background: COLORS.goldTint,
      }}
    >
      <span className={small ? 'text-base' : 'text-xl'}>{t.icon}</span>
      {!small && (
        <span
          className="text-[8px] tracking-widest uppercase mt-0.5"
          style={{ fontFamily: FONTS.mono }}
        >
          {t.label.split(' ')[0]}
        </span>
      )}
    </div>
  );
}

function TripCard({
  trip,
  onEdit,
  onDelete,
  onToggleStatus,
  editable,
}: {
  trip: Trip;
  onEdit?: (trip: Trip) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (trip: Trip) => void;
  editable: boolean;
}) {
  const t = themeInfo(trip.theme);
  const { subtitle, lines } = parseItinerary(trip.notes);
  const itineraryBlock = trip.notes ? (
    <div className="space-y-1.5">
      <div
        className="text-[9px] uppercase tracking-widest"
        style={{ fontFamily: FONTS.mono, color: COLORS.gold }}
      >
        Itinerary
      </div>
      {subtitle && (
        <p
          className="text-xs italic leading-snug"
          style={{ fontFamily: FONTS.display, color: COLORS.ink }}
        >
          {subtitle}
        </p>
      )}
      {lines.length > 0 && (
        <ul className="space-y-1">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-neutral-600">
              <span
                className="mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-semibold"
                style={{ background: COLORS.tealTint, color: COLORS.teal }}
              >
                {i + 1}
              </span>
              <span className="line-clamp-2">{line}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;

  return (
    <Link href={`/trips/${trip.id}`} className="block">
      <div
        className="rounded-2xl overflow-hidden border flex flex-col hover:shadow-lg transition-shadow cursor-pointer"
        style={{ borderColor: COLORS.border, background: COLORS.white }}
      >
        <div
          className="p-5 flex items-start gap-4"
          style={{ background: GRADIENT.header }}
        >
          <StampBadge theme={trip.theme} />
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] uppercase tracking-[0.2em] text-white/60"
              style={{ fontFamily: FONTS.mono }}
            >
              {t.label}
            </div>
            <h3
              className="text-white text-xl leading-tight mt-1 truncate"
              style={{ fontFamily: FONTS.display, fontWeight: 600 }}
              title={trip.title || 'Untitled trip'}
            >
              {trip.title || 'Untitled trip'}
            </h3>
            <div className="flex items-center gap-1.5 text-white/70 text-sm mt-1">
              <MapPin size={13} />
              <span className="truncate">{trip.destination || 'Destination TBD'}</span>
            </div>
          </div>
        </div>
        <div className="p-5 flex-1 flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm" style={{ color: COLORS.ink }}>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} style={{ color: COLORS.terracotta }} />
              {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} style={{ color: COLORS.terracotta }} />
              Up to {trip.capacity || 10}
            </span>
          </div>
          {trip.priceFrom && (
            <div className="text-sm" style={{ fontFamily: FONTS.mono, color: COLORS.teal }}>
              from ${trip.priceFrom}
            </div>
          )}
          {itineraryBlock}
          {trip.affiliateLinks?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {trip.affiliateLinks.map((l, i) => (
                <a
                  key={i}
                  href={l.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-full border flex items-center gap-1 hover:bg-neutral-50 transition"
                  style={{ borderColor: COLORS.gold, color: COLORS.goldDark }}
                >
                  <Link2 size={11} />
                  {l.label || 'Link'}
                </a>
              ))}
            </div>
          )}
          <div className="mt-auto pt-3 flex items-center justify-between">
            {editable ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onToggleStatus?.(trip);
                }}
                title={trip.status === 'published' ? 'Click to unpublish' : 'Click to publish'}
                className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full flex items-center gap-1 transition hover:opacity-70"
                style={{
                  fontFamily: FONTS.mono,
                  background:
                    trip.status === 'published' ? COLORS.tealTint : 'rgba(196,98,42,0.1)',
                  color: trip.status === 'published' ? COLORS.teal : COLORS.terracotta,
                }}
              >
                {trip.status === 'published' ? <Globe size={10} /> : <Lock size={10} />}
                {trip.status === 'published' ? 'Published' : 'Draft'}
              </button>
            ) : (
              <span
                className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full"
                style={{
                  fontFamily: FONTS.mono,
                  background:
                    trip.status === 'published' ? COLORS.tealTint : 'rgba(196,98,42,0.1)',
                  color: trip.status === 'published' ? COLORS.teal : COLORS.terracotta,
                }}
              >
                {trip.status === 'published' ? 'Published' : 'Draft'}
              </span>
            )}
            {editable && (
              <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onEdit?.(trip);
                  }}
                  className="p-1.5 rounded-full hover:bg-neutral-100 transition"
                >
                  <Edit3 size={14} style={{ color: COLORS.ink }} />
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete?.(trip.id);
                  }}
                  className="p-1.5 rounded-full hover:bg-neutral-100 transition"
                >
                  <Trash2 size={14} style={{ color: COLORS.terracotta }} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------- Destination autocomplete input ----------
// ---------- TripEditor — replace destination plain input with DestinationInput ----------
function TripEditor({
  trip,
  onSave,
  onClose,
}: {
  trip: Trip;
  onSave: (trip: Trip) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Trip>(trip);
  const set = <K extends keyof Trip>(k: K, v: Trip[K]) => setForm((f) => ({ ...f, [k]: v }));
  const addLink = () =>
    set('affiliateLinks', [...(form.affiliateLinks || []), { label: '', url: '' }]);
  const updateLink = (i: number, k: keyof AffiliateLink, v: string) => {
    const links = [...form.affiliateLinks];
    links[i] = { ...links[i], [k]: v };
    set('affiliateLinks', links);
  };
  const removeLink = (i: number) =>
    set(
      'affiliateLinks',
      form.affiliateLinks.filter((_, idx) => idx !== i)
    );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-6">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 style={{ fontFamily: FONTS.display }} className="text-2xl">
            {trip.title ? 'Edit trip' : 'New trip'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500">Trip title</label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Amalfi Golden Hour"
              className="w-full mt-1 border rounded-lg px-3 py-2 outline-none focus:ring-2"
              style={{ borderColor: COLORS.borderDashed }}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500">Destination</label>
            <DestinationInput value={form.destination} onChange={(v) => set('destination', v)} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500">Theme</label>
            <select
              value={form.theme}
              onChange={(e) => set('theme', e.target.value)}
              className="w-full mt-1 border rounded-lg px-3 py-2 outline-none"
              style={{ borderColor: COLORS.borderDashed }}
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-neutral-500">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2 outline-none"
                style={{ borderColor: COLORS.borderDashed }}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-neutral-500">End date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2 outline-none"
                style={{ borderColor: COLORS.borderDashed }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-neutral-500">
                Capacity (max 10)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.capacity}
                onChange={(e) =>
                  set('capacity', Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                }
                className="w-full mt-1 border rounded-lg px-3 py-2 outline-none"
                style={{ borderColor: COLORS.borderDashed }}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-neutral-500">
                Price from ($)
              </label>
              <input
                value={form.priceFrom}
                onChange={(e) => set('priceFrom', e.target.value)}
                placeholder="2400"
                className="w-full mt-1 border rounded-lg px-3 py-2 outline-none"
                style={{ borderColor: COLORS.borderDashed }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500">Status</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => set('status', 'draft')}
                className="flex-1 py-2 rounded-lg text-sm border flex items-center justify-center gap-1.5"
                style={{
                  borderColor: COLORS.terracotta,
                  background: form.status === 'draft' ? 'rgba(196,98,42,0.1)' : 'transparent',
                  color: COLORS.terracotta,
                }}
              >
                <Lock size={13} /> Draft (private)
              </button>
              <button
                onClick={() => set('status', 'published')}
                className="flex-1 py-2 rounded-lg text-sm border flex items-center justify-center gap-1.5"
                style={{
                  borderColor: COLORS.teal,
                  background: form.status === 'published' ? COLORS.tealTint : 'transparent',
                  color: COLORS.teal,
                }}
              >
                <Globe size={13} /> Published
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500">
              Notes / itinerary sketch
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              className="w-full mt-1 border rounded-lg px-3 py-2 outline-none resize-none"
              style={{ borderColor: COLORS.borderDashed }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wide text-neutral-500">
                Affiliate links
              </label>
              <button
                onClick={addLink}
                className="text-xs flex items-center gap-1"
                style={{ color: COLORS.teal }}
              >
                <Plus size={13} /> Add link
              </button>
            </div>
            <div className="space-y-2 mt-1.5">
              {(form.affiliateLinks || []).map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={l.label}
                    onChange={(e) => updateLink(i, 'label', e.target.value)}
                    placeholder="Label (e.g. Flights)"
                    className="w-1/3 border rounded-lg px-2 py-1.5 text-sm outline-none"
                    style={{ borderColor: COLORS.borderDashed }}
                  />
                  <input
                    value={l.url}
                    onChange={(e) => updateLink(i, 'url', e.target.value)}
                    placeholder="https://..."
                    className="flex-1 border rounded-lg px-2 py-1.5 text-sm outline-none"
                    style={{ borderColor: COLORS.borderDashed }}
                  />
                  <button onClick={() => removeLink(i)} className="p-1.5">
                    <X size={14} style={{ color: COLORS.terracotta }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => onSave(form)}
          className="w-full mt-6 py-3 rounded-lg text-white font-medium"
          style={{
            background: GRADIENT.solid,
            fontFamily: FONTS.body,
          }}
        >
          Save trip
        </button>
      </div>
    </div>
  );
}

// ---------- Advisor ----------
type TripSuggestion = {
  title: string;
  destination: string;
  theme: string;
  notes: string;
  startDate: string;
  endDate: string;
  capacity: number;
  priceFrom: string;
};

type ActivitySuggestion = {
  tripId: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
};

// The advisor emits exactly one of TRIP_DATA (a whole new trip / full
// itinerary) or ACTIVITY_DATA (a single item added to an existing trip) —
// never both. Check for either marker.
function parseAdvisorMessage(message: string): {
  display: string;
  trip: TripSuggestion | null;
  activity: ActivitySuggestion | null;
} {
  const activityMarker = 'ACTIVITY_DATA:';
  const tripMarker = 'TRIP_DATA:';
  const activityIdx = message.indexOf(activityMarker);
  const tripIdx = message.indexOf(tripMarker);

  if (activityIdx !== -1) {
    const display = message.slice(0, activityIdx).trim();
    try {
      const activity = JSON.parse(message.slice(activityIdx + activityMarker.length).trim());
      return { display, trip: null, activity };
    } catch {
      return { display, trip: null, activity: null };
    }
  }

  if (tripIdx !== -1) {
    const display = message.slice(0, tripIdx).trim();
    try {
      const trip = JSON.parse(message.slice(tripIdx + tripMarker.length).trim());
      return { display, trip, activity: null };
    } catch {
      return { display, trip: null, activity: null };
    }
  }

  return { display: message, trip: null, activity: null };
}

function Advisor({
  trips,
  onCreateTrip,
}: {
  trips: Trip[];
  onCreateTrip: (trip: TripSuggestion) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "I'm your On The Go by Am travel advisor. Tell me what you're dreaming up — a region, a vibe, a month — and I'll help you shape it into a trip worth hosting.",
    },
  ]);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [pendingTrips, setPendingTrips] = useState<Record<number, TripSuggestion>>({});
  const [pendingActivities, setPendingActivities] = useState<Record<number, ActivitySuggestion>>({});
  const [addingActivity, setAddingActivity] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const handleFinish = useCallback((message: string) => {
    const { display, trip, activity } = parseAdvisorMessage(message);
    setMessages((prev) => {
      const newIdx = prev.length;
      if (trip) {
        setPendingTrips((pt) => ({ ...pt, [newIdx]: trip }));
      }
      if (activity) {
        setPendingActivities((pa) => ({ ...pa, [newIdx]: activity }));
      }
      return [...prev, { role: 'assistant', content: display }];
    });
    setStreamingMessage('');
    setLoading(false);
  }, []);

  const handleAddActivity = async (index: number, activity: ActivitySuggestion) => {
    setAddingActivity(index);
    try {
      const id = `activity_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const res = await fetch(`/api/trips/${activity.tripId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          date: activity.date,
          time: activity.time,
          title: activity.title,
          description: activity.description,
          location: activity.location,
          linkedTicketId: null,
        }),
      });
      if (!res.ok) throw new Error('Failed to add activity');
      queryClient.invalidateQueries({ queryKey: ['activities', activity.tripId] });
      toast.success(`Added "${activity.title}" to the trip!`);
      setPendingActivities((pa) => {
        const n = { ...pa };
        delete n[index];
        return n;
      });
    } catch {
      toast.error('Could not add that activity.');
    } finally {
      setAddingActivity(null);
    }
  };

  const handleStreamResponse = useHandleStreamResponse({
    onChunk: setStreamingMessage,
    onFinish: handleFinish,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          trips,
        }),
      });
      if (!res.ok) throw new Error(`Advisor error ${res.status}`);
      handleStreamResponse(res);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong reaching the advisor. Try again in a moment.',
        },
      ]);
      setLoading(false);
    }
  }, [input, messages, loading, trips, handleStreamResponse]);

  return (
    <div
      className="flex flex-col h-[70vh] rounded-2xl border overflow-hidden"
      style={{ borderColor: COLORS.border }}
    >
      <div
        className="px-5 py-3 flex items-center gap-2 border-b"
        style={{ borderColor: COLORS.borderLight, background: COLORS.navy }}
      >
        <Sparkles size={16} style={{ color: COLORS.gold }} />
        <span className="text-white text-sm" style={{ fontFamily: FONTS.display }}>
          Travel Advisor
        </span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-3"
        style={{ background: '#FBFAF7' }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                m.role === 'user' ? 'text-white' : 'text-neutral-800'
              }`}
              style={{
                background:
                  m.role === 'user' ? GRADIENT.solid : COLORS.white,
                border: m.role === 'user' ? 'none' : `1px solid ${COLORS.borderLight}`,
              }}
            >
              {m.content}
            </div>
            {pendingTrips[i] && (
              <button
                onClick={() => {
                  onCreateTrip(pendingTrips[i]);
                  setPendingTrips((pt) => {
                    const n = { ...pt };
                    delete n[i];
                    return n;
                  });
                }}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs text-white font-medium"
                style={{ background: GRADIENT.solid }}
              >
                <CheckCircle size={13} />
                Save "{pendingTrips[i].title || 'this trip'}" to Plan
              </button>
            )}
            {pendingActivities[i] &&
              (() => {
                const activity = pendingActivities[i];
                const targetTrip = trips.find((t) => t.id === activity.tripId);
                return (
                  <button
                    onClick={() => handleAddActivity(i, activity)}
                    disabled={addingActivity === i}
                    className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs text-white font-medium disabled:opacity-60"
                    style={{ background: GRADIENT.solid }}
                  >
                    <CheckCircle size={13} />
                    {addingActivity === i
                      ? 'Adding…'
                      : `Add "${activity.title}" to ${targetTrip?.title || 'trip'}`}
                  </button>
                );
              })()}
          </div>
        ))}
        {streamingMessage && (
          <div className="flex justify-start">
            <div
              className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap text-neutral-800"
              style={{ background: COLORS.white, border: `1px solid ${COLORS.borderLight}` }}
            >
              {streamingMessage}
            </div>
          </div>
        )}
        {loading && !streamingMessage && (
          <div className="text-xs text-neutral-400 pl-1">Advisor is thinking…</div>
        )}
      </div>
      <div className="p-3 border-t flex gap-2" style={{ borderColor: COLORS.borderLight }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about a destination, theme, or dates…"
          className="flex-1 border rounded-full px-4 py-2 text-sm outline-none"
          style={{ borderColor: COLORS.borderDashed }}
        />
        <button
          onClick={send}
          disabled={loading}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: GRADIENT.solid }}
        >
          <Send size={15} color="white" />
        </button>
      </div>
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  const [tab, setTab] = useState<'explore' | 'plan' | 'advisor' | 'discovery'>('explore');
  const [editing, setEditing] = useState<Trip | null>(null);
  // Discoveries only get marked "promoted" once the reviewed draft trip
  // actually saves (see createMutation.onSuccess below) — never the moment
  // "Start a trip from these" is clicked. Otherwise canceling the editor
  // would leave discoveries pointing at a trip that was never created.
  const [pendingPromotedDiscoveries, setPendingPromotedDiscoveries] = useState<Discovery[] | null>(null);
  const queryClient = useQueryClient();

  const { data: trips = [], isLoading } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: async () => {
      const res = await fetch('/api/trips');
      if (!res.ok) throw new Error('Failed to load trips');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (trip: Trip) => {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trip),
      });
      if (!res.ok) throw new Error('Failed to create trip');
    },
    onSuccess: (_data, trip) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip saved!');
      setEditing(null);
      if (pendingPromotedDiscoveries) {
        const toPromote = pendingPromotedDiscoveries;
        setPendingPromotedDiscoveries(null);
        promoteDiscoveries(toPromote, trip.id)
          .then(() => queryClient.invalidateQueries({ queryKey: ['discoveries'] }))
          .catch((e) => console.error('Failed to mark discoveries promoted:', e));
      }
    },
    onError: (e) => {
      console.error(e);
      toast.error('Could not save trip — check the logs panel for details.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (trip: Trip) => {
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trip),
      });
      if (!res.ok) throw new Error('Failed to update trip');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip updated!');
      setEditing(null);
    },
    onError: (e) => {
      console.error(e);
      toast.error('Could not update trip — check the logs panel for details.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/trips/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete trip');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip deleted.');
    },
    onError: (e) => {
      console.error(e);
      toast.error('Could not delete trip.');
    },
  });

  const handleSave = (trip: Trip) => {
    const exists = trips.some((t) => t.id === trip.id);
    if (exists) {
      updateMutation.mutate(trip);
    } else {
      createMutation.mutate(trip);
    }
    // NOTE: setEditing(null) is now called inside onSuccess so editor stays open on error
  };

  const handleDelete = (id: string) => deleteMutation.mutate(id);

  const handleToggleStatus = (trip: Trip) =>
    updateMutation.mutate({ ...trip, status: trip.status === 'published' ? 'draft' : 'published' });

  // Advisor suggestions merge into an existing draft/published trip when
  // BOTH the destination and the exact dates already match one — otherwise
  // they create a new draft, same as before. Without a date on the
  // suggestion there's nothing to match on, so it always creates new.
  const findMatchingTrip = (suggestion: TripSuggestion): Trip | null => {
    if (!suggestion.destination || !suggestion.startDate || !suggestion.endDate) return null;
    const dest = suggestion.destination.trim().toLowerCase();
    return (
      trips.find(
        (t) =>
          t.destination.trim().toLowerCase() === dest &&
          t.startDate === suggestion.startDate &&
          t.endDate === suggestion.endDate
      ) || null
    );
  };

  const handleCreateFromAdvisor = (suggestion: TripSuggestion) => {
    const existing = findMatchingTrip(suggestion);

    if (existing) {
      const mergedNotes =
        existing.notes && suggestion.notes && !existing.notes.includes(suggestion.notes)
          ? `${existing.notes}\n\n${suggestion.notes}`
          : existing.notes || suggestion.notes || '';
      setEditing({ ...existing, notes: mergedNotes });
      setTab('plan');
      toast.success(`Matches "${existing.title}" — merged into that trip. Review and save!`);
      return;
    }

    const trip: Trip = {
      ...emptyTrip(),
      title: suggestion.title || '',
      destination: suggestion.destination || '',
      theme: suggestion.theme || THEMES[0].id,
      notes: suggestion.notes || '',
      startDate: suggestion.startDate || '',
      endDate: suggestion.endDate || '',
      capacity: suggestion.capacity || 8,
      priceFrom: suggestion.priceFrom || '',
      status: 'draft',
    };
    setEditing(trip);
    setTab('plan');
    toast.success('Trip loaded into editor — review and save!');
  };

  const handlePromoteToTrip = (draft: PromoteDraft, discoveries: Discovery[]) => {
    const trip: Trip = {
      ...emptyTrip(),
      destination: draft.destination,
      theme: draft.theme,
      sourceLinks: draft.sourceLinks,
      status: 'draft',
    };
    setPendingPromotedDiscoveries(discoveries);
    setEditing(trip);
    setTab('plan');
    toast.success('Trip pre-filled from your discoveries — review and save!');
  };

  const published = trips.filter((t) => t.status === 'published');

  return (
    <div
      style={{
        fontFamily: FONTS.body,
        background: COLORS.cloud,
        minHeight: '100vh',
      }}
    >
      <link rel="stylesheet" href={FONT_LINK} />
      <header
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={{
          borderColor: COLORS.borderLight,
          background: 'rgba(247,245,241,0.9)',
        }}
      >
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass size={20} style={{ color: COLORS.teal }} />
            <span
              style={{ fontFamily: FONTS.display, fontWeight: 700 }}
              className="text-lg"
            >
              <span style={{ color: '#023047' }}>On The Go</span>{' '}
              <span style={{ color: '#fb8500' }}>by Am</span>
            </span>
          </div>
          <nav className="flex gap-1 text-sm">
            {[
              { id: 'explore' as const, label: 'Explore' },
              { id: 'plan' as const, label: 'Plan' },
              { id: 'advisor' as const, label: 'Advisor' },
              { id: 'discovery' as const, label: 'Discovery' },
            ].map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className="px-3 py-1.5 rounded-full transition"
                style={{
                  background: tab === n.id ? COLORS.navy : 'transparent',
                  color: tab === n.id ? 'white' : COLORS.ink,
                }}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8">
        {tab === 'explore' && (
          <section>
            <div className="mb-6">
              <div
                className="text-xs uppercase tracking-[0.25em]"
                style={{ color: COLORS.terracotta, fontFamily: FONTS.mono }}
              >
                Small-group · Never more than 10
              </div>
              <h1
                className="text-3xl sm:text-4xl mt-1"
                style={{ fontFamily: FONTS.display, color: COLORS.ink }}
              >
                Trips worth clearing your calendar for
              </h1>
            </div>
            {isLoading ? (
              <p className="text-neutral-400 text-sm">Loading trips…</p>
            ) : published.length === 0 ? (
              <div
                className="rounded-2xl border border-dashed p-10 text-center"
                style={{ borderColor: COLORS.borderDashed }}
              >
                <p className="text-neutral-500">
                  No published trips yet — publish one from the Plan tab to see it here.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {published.map((t) => (
                  <TripCard
                    key={t.id}
                    trip={t}
                    editable
                    onEdit={setEditing}
                    onDelete={handleDelete}
                    onToggleStatus={handleToggleStatus}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'plan' && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <div
                  className="text-xs uppercase tracking-[0.25em]"
                  style={{ color: COLORS.terracotta, fontFamily: FONTS.mono }}
                >
                  Private · 2027 planning
                </div>
                <h1
                  className="text-3xl sm:text-4xl mt-1"
                  style={{ fontFamily: FONTS.display, color: COLORS.ink }}
                >
                  Your trip roster
                </h1>
              </div>
              <button
                onClick={() => setEditing(emptyTrip())}
                className="px-4 py-2.5 rounded-full text-white text-sm flex items-center gap-1.5"
                style={{ background: GRADIENT.solid }}
              >
                <Plus size={15} /> New trip
              </button>
            </div>
            {isLoading ? (
              <p className="text-neutral-400 text-sm">Loading…</p>
            ) : trips.length === 0 ? (
              <div
                className="rounded-2xl border border-dashed p-10 text-center"
                style={{ borderColor: COLORS.borderDashed }}
              >
                <p className="text-neutral-500">Nothing planned yet. Start your first 2027 trip.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {trips.map((t) => (
                  <TripCard
                    key={t.id}
                    trip={t}
                    editable
                    onEdit={setEditing}
                    onDelete={handleDelete}
                    onToggleStatus={handleToggleStatus}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* display:none instead of unmounting — Advisor's conversation state
            (messages, in-flight stream, pending trip suggestions) is local to
            the component, so conditionally unmounting it on tab switch was
            wiping the conversation every time the user stepped away. */}
        <section style={{ display: tab === 'advisor' ? 'block' : 'none' }}>
          <div className="mb-5">
            <div
              className="text-xs uppercase tracking-[0.25em]"
              style={{ color: COLORS.terracotta, fontFamily: FONTS.mono }}
            >
              AI-backed
            </div>
            <h1
              className="text-3xl sm:text-4xl mt-1"
              style={{ fontFamily: FONTS.display, color: COLORS.ink }}
            >
              Plan out loud
            </h1>
          </div>
          <Advisor trips={trips} onCreateTrip={handleCreateFromAdvisor} />
        </section>

        {tab === 'discovery' && <DiscoveryTab onPromoteToTrip={handlePromoteToTrip} />}
      </main>

      {editing && (
        <TripEditor trip={editing} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
