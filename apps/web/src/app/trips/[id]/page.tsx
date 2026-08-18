'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  MapPin,
  Calendar,
  Users,
  ArrowLeft,
  Clock,
  Copy,
  Check,
  Mail,
  Clipboard,
  X,
  Loader2,
  Link2,
  Globe,
  Lock,
  Pencil,
  Plus,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { toast, Toaster } from 'sonner';
import { COLORS, GRADIENT, FONTS, FONT_LINK, THEMES } from '@/utils/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d: string) {
  if (!d) return 'TBD';
  const parts = d.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return d;
  const [year, month, day] = parts;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

// Splits a "Day 1: ... Day 2: ..." itinerary blob into one row per day so
// the Highlights overview reads as a list, not a single wall of text.
function parseDayRows(notes: string): { day: number | null; text: string }[] {
  if (!notes) return [];
  if (/Day\s+\d+[\s]*[:\-–]/i.test(notes)) {
    const parts = notes
      .split(/(?=Day\s+\d+[\s]*[:\-–])/i)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.map((p) => {
      const m = p.match(/^Day\s+(\d+)[\s]*[:\-–]\s*(.*)$/is);
      if (m) return { day: Number(m[1]), text: m[2].trim() };
      return { day: null, text: p };
    });
  }
  return [{ day: null, text: notes }];
}

// Raw ISO (YYYY-MM-DD, optionally " HH:MM") -> DD-MM-YYYY for the few places
// that show the raw stored string rather than the pretty fmtDate() format.
function isoToDisplayDate(iso: string) {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (!m) return iso;
  const [, y, mo, d, rest] = m;
  return `${d}-${mo}-${y}${rest}`;
}

function themeInfo(id: string) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

// ---------- Unified timeline builder ----------
type TimelineEntry = {
  key: string;
  date: string;
  time: string;
  title: string;
  subtitle: string;
  location: string;
  source: 'stay' | 'transportation' | 'ticket' | 'activity';
  sourceId: string;
  badge?: string;
};

function buildUnifiedTimeline(
  stays: Stay[],
  transportation: Transportation[],
  tickets: Ticket[],
  activities: Activity[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  // Stays → check-in and check-out entries
  stays.forEach((s) => {
    if (s.checkInDate) {
      entries.push({
        key: `stay-in-${s.id}`,
        sourceId: s.id,
        date: s.checkInDate,
        time: '00:00',
        title: `Check-in: ${s.name || 'Accommodation'}`,
        subtitle: s.address || '',
        location: s.address || '',
        source: 'stay',
        badge: 'Stay',
      });
    }
    if (s.checkOutDate) {
      entries.push({
        key: `stay-out-${s.id}`,
        sourceId: s.id,
        date: s.checkOutDate,
        time: '23:59',
        title: `Check-out: ${s.name || 'Accommodation'}`,
        subtitle: s.address || '',
        location: s.address || '',
        source: 'stay',
        badge: 'Stay',
      });
    }
  });

  // Transportation → departure and arrival entries
  transportation.forEach((t) => {
    const depDate = t.departureTime
      ? t.departureTime.split(' ')[0] || t.departureTime.split('T')[0]
      : '';
    const depTime = t.departureTime ? t.departureTime.split(' ')[1] || '' : '';
    const arrDate = t.arrivalTime ? t.arrivalTime.split(' ')[0] || t.arrivalTime.split('T')[0] : '';
    const arrTime = t.arrivalTime ? t.arrivalTime.split(' ')[1] || '' : '';
    if (depDate) {
      entries.push({
        key: `transport-dep-${t.id}`,
        sourceId: t.id,
        date: depDate,
        time: depTime || '00:00',
        title: `${t.type || 'Flight'}: ${t.departureLocation} → ${t.arrivalLocation}`,
        subtitle: t.confirmationNumber ? `#${t.confirmationNumber}` : '',
        location: t.departureLocation || '',
        source: 'transportation',
        badge: t.type || 'Flight',
      });
    }
    if (arrDate && arrDate !== depDate) {
      entries.push({
        key: `transport-arr-${t.id}`,
        sourceId: t.id,
        date: arrDate,
        time: arrTime || '23:59',
        title: `Arrives: ${t.arrivalLocation}`,
        subtitle: `From ${t.departureLocation}`,
        location: t.arrivalLocation || '',
        source: 'transportation',
        badge: t.type || 'Flight',
      });
    }
  });

  // Tickets → one entry per ticket with a date
  tickets.forEach((tk) => {
    if (tk.date) {
      entries.push({
        key: `ticket-${tk.id}`,
        sourceId: tk.id,
        date: tk.date,
        time: tk.time || '12:00',
        title: tk.name || 'Event',
        subtitle: tk.location || '',
        location: tk.location || '',
        source: 'ticket',
        badge: 'Ticket',
      });
    }
  });

  // Activities → all entries (skip ones that are just ticket mirrors to avoid duplicates)
  const ticketIds = new Set(tickets.map((tk) => tk.id));
  activities.forEach((a) => {
    if (a.linkedTicketId && ticketIds.has(a.linkedTicketId)) return; // already shown via ticket
    entries.push({
      key: `activity-${a.id}`,
      sourceId: a.id,
      date: a.date || '',
      time: a.time || '12:00',
      title: a.title || 'Activity',
      subtitle: a.description || '',
      location: a.location || '',
      source: 'activity',
      badge: 'Activity',
    });
  });

  // Sort by date then time
  entries.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    if (a.time < b.time) return -1;
    if (a.time > b.time) return 1;
    return 0;
  });

  return entries;
}

// ---------- Types ----------
type Trip = {
  id: string;
  title: string;
  destination: string;
  theme: string;
  startDate: string;
  endDate: string;
  capacity: number;
  status: string;
  priceFrom: string;
  notes: string;
  tripEmail: string;
  affiliateLinks: { label: string; url: string }[];
};

type Weather = {
  temp_f: number;
  temp_c: number;
  condition: string;
  icon: string;
  localtime: string;
};

type Stay = {
  id: string;
  name: string;
  checkInDate: string;
  checkOutDate: string;
  address: string;
  confirmationNumber: string;
  notes: string;
};

type Transportation = {
  id: string;
  type: string;
  departureLocation: string;
  arrivalLocation: string;
  departureTime: string;
  arrivalTime: string;
  confirmationNumber: string;
  notes: string;
};

type Ticket = {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  confirmationNumber: string;
  notes: string;
};

type Activity = {
  id: string;
  date: string;
  time: string;
  title: string;
  description: string;
  location: string;
  linkedTicketId: string | null;
};

// ---------- StampBadge ----------
function StampBadge({ theme }: { theme: string }) {
  const t = themeInfo(theme);
  return (
    <div
      className="shrink-0 rounded-full border-2 w-14 h-14 sm:w-20 sm:h-20 flex flex-col items-center justify-center text-center select-none"
      style={{
        borderColor: COLORS.gold,
        borderStyle: 'dashed',
        color: COLORS.gold,
        background: COLORS.goldTint,
      }}
    >
      <span className="text-base sm:text-xl">{t.icon}</span>
      <span
        className="text-[7px] sm:text-[8px] tracking-widest uppercase mt-0.5"
        style={{ fontFamily: FONTS.mono }}
      >
        {t.label.split(' ')[0]}
      </span>
    </div>
  );
}

// ---------- CopyButton ----------
function CopyButton({ text, light }: { text: string; light?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-lg transition shrink-0"
      style={{
        background: copied
          ? COLORS.successTint
          : light
            ? COLORS.whiteTint10
            : COLORS.tealTint08,
      }}
      title="Copy"
    >
      {copied ? (
        <Check size={13} color="#4ade80" />
      ) : (
        <Copy size={13} color={light ? COLORS.whiteTint70 : COLORS.teal} />
      )}
    </button>
  );
}

// ---------- ConfBadge ----------
function ConfBadge({ number }: { number: string }) {
  if (!number) return null;
  return (
    <span
      className="text-xs px-2 py-1 rounded-lg inline-block"
      style={{
        fontFamily: FONTS.mono,
        background: COLORS.tealTint07,
        color: COLORS.teal,
      }}
    >
      #{number}
    </span>
  );
}

// ---------- EmptyState ----------
function EmptyState({ message, hint }: { message: string; hint: string }) {
  return (
    <div
      className="rounded-2xl border border-dashed p-12 text-center"
      style={{ borderColor: COLORS.borderMedium }}
    >
      <p className="text-neutral-600 font-medium">{message}</p>
      <p className="text-neutral-400 text-sm mt-1 max-w-sm mx-auto">{hint}</p>
    </div>
  );
}

// ---------- Booking parse result summary ----------
// Parsers now return { count, types } since one document can hold multiple
// bookings (e.g. a flight + a hotel + activities) instead of just one.
function summarizeBookings(types: string[]): string {
  const labels: Record<string, string> = { stay: 'stay', transportation: 'transportation', ticket: 'ticket' };
  const counts: Record<string, number> = {};
  types.forEach((t) => {
    counts[t] = (counts[t] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([type, n]) => `${n} ${labels[type] || type}${n > 1 ? 's' : ''}`)
    .join(', ');
}

// Appends a note when the parser skipped items already in the trip (matched
// by confirmation number, or by name/route + date) so silent skips are visible.
function withDuplicateNote(base: string, duplicateCount: number): string {
  if (!duplicateCount) return base;
  return `${base} (${duplicateCount} already in this trip, skipped)`;
}

// ---------- AddEntryModal ----------
type AddTab = 'url' | 'text' | 'manual';
type ManualType = 'stay' | 'transportation' | 'ticket' | 'activity';

type EditEntry = { type: ManualType; id: string; data: any };

function AddEntryModal({
  tripId,
  editEntry,
  onClose,
  onSuccess,
}: {
  tripId: string;
  editEntry?: EditEntry | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditing = !!editEntry;
  const [tab, setTab] = useState<AddTab>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [manualType, setManualType] = useState<ManualType>(editEntry?.type || 'stay');

  // Manual form state
  const [stayForm, setStayForm] = useState({
    name: '',
    checkInDate: '',
    checkOutDate: '',
    address: '',
    confirmationNumber: '',
    notes: '',
  });
  const [transportForm, setTransportForm] = useState({
    type: 'flight',
    departureLocation: '',
    arrivalLocation: '',
    departureTime: '',
    arrivalTime: '',
    confirmationNumber: '',
    notes: '',
  });
  const [ticketForm, setTicketForm] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
    confirmationNumber: '',
    notes: '',
  });
  const [activityForm, setActivityForm] = useState({
    date: '',
    time: '',
    title: '',
    description: '',
    location: '',
  });

  useEffect(() => {
    if (!editEntry) return;
    setTab('manual');
    setManualType(editEntry.type);
    if (editEntry.type === 'stay') {
      setStayForm({
        name: '',
        checkInDate: '',
        checkOutDate: '',
        address: '',
        confirmationNumber: '',
        notes: '',
        ...editEntry.data,
      });
    } else if (editEntry.type === 'transportation') {
      setTransportForm({
        type: 'flight',
        departureLocation: '',
        arrivalLocation: '',
        departureTime: '',
        arrivalTime: '',
        confirmationNumber: '',
        notes: '',
        ...editEntry.data,
      });
    } else if (editEntry.type === 'ticket') {
      setTicketForm({
        name: '',
        date: '',
        time: '',
        location: '',
        confirmationNumber: '',
        notes: '',
        ...editEntry.data,
      });
    } else {
      setActivityForm({ date: '', time: '', title: '', description: '', location: '', ...editEntry.data });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEntry?.id]);

  const urlMutation = useMutation({
    mutationFn: async (input: string) => {
      const res = await fetch(`/api/trips/${tripId}/parse-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: input }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(withDuplicateNote(`Added from URL: ${summarizeBookings(data.types)}`, data.duplicateCount));
      onSuccess();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not parse that URL.'),
  });

  const attachmentMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // reader.result is "data:<mime>;base64,<data>" — strip the prefix
          const result = reader.result as string;
          resolve(result.slice(result.indexOf(',') + 1));
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/trips/${tripId}/parse-attachment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64, mimeType: file.type }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(withDuplicateNote(`Added from file: ${summarizeBookings(data.types)}`, data.duplicateCount));
      onSuccess();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not parse that file.'),
  });

  const textMutation = useMutation({
    mutationFn: async (input: string) => {
      const res = await fetch(`/api/trips/${tripId}/parse-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });
      if (!res.ok) throw new Error('Parsing failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(withDuplicateNote(`Added from text: ${summarizeBookings(data.types)}`, data.duplicateCount));
      onSuccess();
      onClose();
    },
    onError: () => toast.error('Could not parse that text. Try pasting more of the confirmation.'),
  });

  const stayMutation = useMutation({
    mutationFn: async () => {
      const editing = editEntry?.type === 'stay';
      const id = editing ? editEntry!.id : `stay_${crypto.randomUUID()}`;
      const res = await fetch(`/api/trips/${tripId}/stays${editing ? `/${id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? stayForm : { id, ...stayForm }),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => {
      toast.success(editEntry?.type === 'stay' ? 'Stay updated!' : 'Stay added!');
      onSuccess();
      onClose();
    },
    onError: () => toast.error('Could not save stay.'),
  });

  const transportMutation = useMutation({
    mutationFn: async () => {
      const editing = editEntry?.type === 'transportation';
      const id = editing ? editEntry!.id : `transport_${crypto.randomUUID()}`;
      const res = await fetch(`/api/trips/${tripId}/transportation${editing ? `/${id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? transportForm : { id, ...transportForm }),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => {
      toast.success(editEntry?.type === 'transportation' ? 'Transportation updated!' : 'Transportation added!');
      onSuccess();
      onClose();
    },
    onError: () => toast.error('Could not save transportation.'),
  });

  const ticketMutation = useMutation({
    mutationFn: async () => {
      const editing = editEntry?.type === 'ticket';
      const id = editing ? editEntry!.id : `ticket_${crypto.randomUUID()}`;
      const res = await fetch(`/api/trips/${tripId}/tickets${editing ? `/${id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? ticketForm : { id, ...ticketForm }),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => {
      toast.success(editEntry?.type === 'ticket' ? 'Ticket updated!' : 'Ticket added!');
      onSuccess();
      onClose();
    },
    onError: () => toast.error('Could not save ticket.'),
  });

  const activityMutation = useMutation({
    mutationFn: async () => {
      const editing = editEntry?.type === 'activity';
      const id = editing ? editEntry!.id : `activity_${crypto.randomUUID()}`;
      const res = await fetch(`/api/trips/${tripId}/activities${editing ? `/${id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? activityForm : { id, ...activityForm, linkedTicketId: null }),
      });
      if (!res.ok) throw new Error('Failed to save');
    },
    onSuccess: () => {
      toast.success(editEntry?.type === 'activity' ? 'Activity updated!' : 'Activity added!');
      onSuccess();
      onClose();
    },
    onError: () => toast.error('Could not save activity.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editEntry) return;
      const path =
        editEntry.type === 'stay'
          ? 'stays'
          : editEntry.type === 'transportation'
            ? 'transportation'
            : editEntry.type === 'ticket'
              ? 'tickets'
              : 'activities';
      const res = await fetch(`/api/trips/${tripId}/${path}/${editEntry.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast.success('Deleted.');
      onSuccess();
      onClose();
    },
    onError: () => toast.error('Could not delete.'),
  });

  const isPending =
    urlMutation.isPending ||
    textMutation.isPending ||
    attachmentMutation.isPending ||
    stayMutation.isPending ||
    transportMutation.isPending ||
    ticketMutation.isPending ||
    activityMutation.isPending ||
    deleteMutation.isPending;

  const inputCls =
    'w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-teal-500';
  const inputStyle = { borderColor: COLORS.borderDashed };
  const labelCls = 'text-xs uppercase tracking-wide text-neutral-500';

  const handleSave = () => {
    if (tab === 'url') {
      urlMutation.mutate(url);
      return;
    }
    if (tab === 'text') {
      textMutation.mutate(text);
      return;
    }
    if (manualType === 'stay') stayMutation.mutate();
    else if (manualType === 'transportation') transportMutation.mutate();
    else if (manualType === 'ticket') ticketMutation.mutate();
    else activityMutation.mutate();
  };

  const canSave =
    tab === 'url'
      ? url.trim().length > 0
      : tab === 'text'
        ? text.trim().length > 0
        : manualType === 'stay'
          ? stayForm.name.trim().length > 0
          : manualType === 'transportation'
            ? transportForm.departureLocation.trim().length > 0
            : manualType === 'ticket'
              ? ticketForm.name.trim().length > 0
              : activityForm.title.trim().length > 0;

  const MODAL_TABS: { id: AddTab; label: string; icon: React.ReactNode }[] = [
    { id: 'url', label: 'From URL', icon: <Globe size={13} /> },
    { id: 'text', label: 'Paste text', icon: <Clipboard size={13} /> },
    { id: 'manual', label: 'Manual', icon: <Pencil size={13} /> },
  ];

  const MANUAL_TYPES: { id: ManualType; label: string }[] = [
    { id: 'stay', label: 'Stay' },
    { id: 'transportation', label: 'Flight / Transfer' },
    { id: 'ticket', label: 'Ticket / Tour' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-6">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h3
            style={{ fontFamily: FONTS.display }}
            className="text-xl text-neutral-900"
          >
            {isEditing
              ? `Edit ${MANUAL_TYPES.find((mt) => mt.id === editEntry!.type)?.label || 'entry'}`
              : 'Add to trip'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        {!isEditing && (
          <div className="flex gap-1 px-6 mb-5">
            {MODAL_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition"
                style={{
                  background: tab === t.id ? COLORS.navy : COLORS.borderFaint,
                  color: tab === t.id ? 'white' : COLORS.gray,
                }}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="px-6 pb-6">
          {/* URL tab */}
          {tab === 'url' && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-500">
                Paste a booking URL — hotel page, flight confirmation, tour listing — Gemini will
                extract and save the details.
              </p>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://booking.com/..."
                className={inputCls}
                style={inputStyle}
                autoFocus
              />
            </div>
          )}

          {/* Text tab */}
          {tab === 'text' && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-500">
                Paste the full text of a confirmation email, receipt, or itinerary. Gemini will
                parse it automatically.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste confirmation text here…"
                rows={8}
                className={`${inputCls} resize-none`}
                style={{ ...inputStyle, fontFamily: FONTS.mono, fontSize: '12px' }}
              />
            </div>
          )}

          {/* Manual tab */}
          {tab === 'manual' && (
            <div className="space-y-4">
              {!isEditing && (
                <>
                  {/* Attachment upload — parses a PDF/photo confirmation via Gemini and
                      auto-detects the type, same as the URL/text tabs. Bypasses the form below. */}
                  <div
                    className="rounded-xl border border-dashed p-4 text-center"
                    style={{ borderColor: COLORS.tealTint30 }}
                  >
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        disabled={attachmentMutation.isPending}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) attachmentMutation.mutate(file);
                          e.target.value = '';
                        }}
                      />
                      <span className="text-sm font-medium flex items-center justify-center gap-2" style={{ color: COLORS.teal }}>
                        {attachmentMutation.isPending ? (
                          <>
                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            Parsing file…
                          </>
                        ) : (
                          <>
                            <Plus size={14} /> Upload a confirmation PDF or photo
                          </>
                        )}
                      </span>
                      <span className="text-xs text-neutral-400 block mt-1">
                        We'll detect whether it's a stay, flight, or ticket automatically
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: COLORS.borderLight }} />
                    <span className="text-xs text-neutral-400">or fill in the details</span>
                    <div className="flex-1 h-px" style={{ background: COLORS.borderLight }} />
                  </div>

                  {/* Type selector */}
                  <div className="flex gap-1.5 flex-wrap">
                    {MANUAL_TYPES.map((mt) => (
                      <button
                        key={mt.id}
                        onClick={() => setManualType(mt.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition"
                        style={{
                          borderColor: manualType === mt.id ? COLORS.teal : COLORS.borderMedium,
                          background: manualType === mt.id ? COLORS.tealTint08 : 'transparent',
                          color: manualType === mt.id ? COLORS.teal : COLORS.gray,
                        }}
                      >
                        {mt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Stay form */}
              {manualType === 'stay' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Hotel / property name *</label>
                    <input
                      value={stayForm.name}
                      onChange={(e) => setStayForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="e.g. Villa Rosa"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Check-in</label>
                      <input
                        type="date"
                        value={stayForm.checkInDate}
                        onChange={(e) =>
                          setStayForm((f) => ({ ...f, checkInDate: e.target.value }))
                        }
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Check-out</label>
                      <input
                        type="date"
                        value={stayForm.checkOutDate}
                        onChange={(e) =>
                          setStayForm((f) => ({ ...f, checkOutDate: e.target.value }))
                        }
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Address</label>
                    <input
                      value={stayForm.address}
                      onChange={(e) => setStayForm((f) => ({ ...f, address: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="Street, city"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Confirmation #</label>
                    <input
                      value={stayForm.confirmationNumber}
                      onChange={(e) =>
                        setStayForm((f) => ({ ...f, confirmationNumber: e.target.value }))
                      }
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea
                      value={stayForm.notes}
                      onChange={(e) => setStayForm((f) => ({ ...f, notes: e.target.value }))}
                      className={`${inputCls} resize-none`}
                      style={inputStyle}
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* Transportation form */}
              {manualType === 'transportation' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Type</label>
                    <select
                      value={transportForm.type}
                      onChange={(e) => setTransportForm((f) => ({ ...f, type: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                    >
                      {['flight', 'train', 'bus', 'ferry', 'transfer', 'rental'].map((t) => (
                        <option key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>From *</label>
                      <input
                        value={transportForm.departureLocation}
                        onChange={(e) =>
                          setTransportForm((f) => ({ ...f, departureLocation: e.target.value }))
                        }
                        className={inputCls}
                        style={inputStyle}
                        placeholder="City or airport"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>To</label>
                      <input
                        value={transportForm.arrivalLocation}
                        onChange={(e) =>
                          setTransportForm((f) => ({ ...f, arrivalLocation: e.target.value }))
                        }
                        className={inputCls}
                        style={inputStyle}
                        placeholder="City or airport"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Departs</label>
                      <input
                        type="datetime-local"
                        value={transportForm.departureTime}
                        onChange={(e) =>
                          setTransportForm((f) => ({ ...f, departureTime: e.target.value }))
                        }
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Arrives</label>
                      <input
                        type="datetime-local"
                        value={transportForm.arrivalTime}
                        onChange={(e) =>
                          setTransportForm((f) => ({ ...f, arrivalTime: e.target.value }))
                        }
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Confirmation #</label>
                    <input
                      value={transportForm.confirmationNumber}
                      onChange={(e) =>
                        setTransportForm((f) => ({ ...f, confirmationNumber: e.target.value }))
                      }
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea
                      value={transportForm.notes}
                      onChange={(e) => setTransportForm((f) => ({ ...f, notes: e.target.value }))}
                      className={`${inputCls} resize-none`}
                      style={inputStyle}
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* Ticket form */}
              {manualType === 'ticket' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Name / event *</label>
                    <input
                      value={ticketForm.name}
                      onChange={(e) => setTicketForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="e.g. Colosseum tour"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Date</label>
                      <input
                        type="date"
                        value={ticketForm.date}
                        onChange={(e) => setTicketForm((f) => ({ ...f, date: e.target.value }))}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Time</label>
                      <input
                        type="time"
                        value={ticketForm.time}
                        onChange={(e) => setTicketForm((f) => ({ ...f, time: e.target.value }))}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Location</label>
                    <input
                      value={ticketForm.location}
                      onChange={(e) => setTicketForm((f) => ({ ...f, location: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Confirmation #</label>
                    <input
                      value={ticketForm.confirmationNumber}
                      onChange={(e) =>
                        setTicketForm((f) => ({ ...f, confirmationNumber: e.target.value }))
                      }
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea
                      value={ticketForm.notes}
                      onChange={(e) => setTicketForm((f) => ({ ...f, notes: e.target.value }))}
                      className={`${inputCls} resize-none`}
                      style={inputStyle}
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* Activity form */}
              {manualType === 'activity' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Title *</label>
                    <input
                      value={activityForm.title}
                      onChange={(e) => setActivityForm((f) => ({ ...f, title: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                      placeholder="e.g. Morning hike"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Date</label>
                      <input
                        type="date"
                        value={activityForm.date}
                        onChange={(e) => setActivityForm((f) => ({ ...f, date: e.target.value }))}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Time</label>
                      <input
                        type="time"
                        value={activityForm.time}
                        onChange={(e) => setActivityForm((f) => ({ ...f, time: e.target.value }))}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Location</label>
                    <input
                      value={activityForm.location}
                      onChange={(e) => setActivityForm((f) => ({ ...f, location: e.target.value }))}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea
                      value={activityForm.description}
                      onChange={(e) =>
                        setActivityForm((f) => ({ ...f, description: e.target.value }))
                      }
                      className={`${inputCls} resize-none`}
                      style={inputStyle}
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-5">
            {isEditing && (
              <button
                onClick={() => {
                  if (window.confirm('Delete this entry? This cannot be undone.')) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={isPending}
                className="py-2.5 px-4 rounded-xl border text-sm disabled:opacity-50"
                style={{ borderColor: COLORS.terracottaTint30, color: COLORS.terracotta }}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border text-sm text-neutral-600"
              style={{ borderColor: COLORS.borderDashed }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || isPending}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: GRADIENT.solid }}
            >
              {isPending ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…
                </>
              ) : isEditing ? (
                <>
                  <CheckCircle size={14} /> Save changes
                </>
              ) : tab === 'url' ? (
                <>
                  <Globe size={14} /> Parse URL
                </>
              ) : tab === 'text' ? (
                <>
                  <Clipboard size={14} /> Parse & Save
                </>
              ) : (
                <>
                  <Plus size={14} /> Add
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

// ---------- AddButton ----------
function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-full border transition hover:bg-teal-50"
      style={{ borderColor: COLORS.tealTint30, color: COLORS.teal }}
    >
      <Plus size={12} /> Add
    </button>
  );
}

// ---------- EntryActions ----------
function EntryActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-1 shrink-0">
      <button onClick={onEdit} className="p-1.5 rounded-full hover:bg-neutral-100 transition">
        <Pencil size={13} style={{ color: COLORS.ink }} />
      </button>
      <button onClick={onDelete} className="p-1.5 rounded-full hover:bg-neutral-100 transition">
        <Trash2 size={13} style={{ color: COLORS.terracotta }} />
      </button>
    </div>
  );
}

// ---------- Main ----------
export default function TripDetailPage() {
  const params = useParams();
  const tripId = params?.id as string;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    'highlights' | 'stay' | 'transportation' | 'activities' | 'tickets'
  >('highlights');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditEntry | null>(null);

  const { data: trip, isLoading: tripLoading } = useQuery<Trip>({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error('Failed to load trip');
      return res.json();
    },
    enabled: !!tripId,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!trip) return;
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...trip, status: trip.status === 'published' ? 'draft' : 'published' }),
      });
      if (!res.ok) throw new Error('Failed to update trip');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success(trip?.status === 'published' ? 'Trip unpublished.' : 'Trip published!');
    },
    onError: () => toast.error('Could not update trip status.'),
  });

  const { data: weather } = useQuery<Weather | null>({
    queryKey: ['weather', trip?.destination],
    queryFn: async () => {
      if (!trip?.destination) return null;
      const res = await fetch(`/api/weather?location=${encodeURIComponent(trip.destination)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!trip?.destination,
    refetchInterval: 600000,
  });

  const { data: stays = [] } = useQuery<Stay[]>({
    queryKey: ['stays', tripId],
    queryFn: async () => {
      const r = await fetch(`/api/trips/${tripId}/stays`);
      return r.ok ? r.json() : [];
    },
    enabled: !!tripId,
  });

  const { data: transportation = [] } = useQuery<Transportation[]>({
    queryKey: ['transportation', tripId],
    queryFn: async () => {
      const r = await fetch(`/api/trips/${tripId}/transportation`);
      return r.ok ? r.json() : [];
    },
    enabled: !!tripId,
  });

  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ['tickets', tripId],
    queryFn: async () => {
      const r = await fetch(`/api/trips/${tripId}/tickets`);
      return r.ok ? r.json() : [];
    },
    enabled: !!tripId,
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ['activities', tripId],
    queryFn: async () => {
      const r = await fetch(`/api/trips/${tripId}/activities`);
      return r.ok ? r.json() : [];
    },
    enabled: !!tripId,
  });

  // Build unified timeline from all data sources
  const unifiedTimeline = buildUnifiedTimeline(stays, transportation, tickets, activities);

  const invalidateAll = useCallback(() => {
    ['stays', 'transportation', 'tickets', 'activities'].forEach((k) =>
      queryClient.invalidateQueries({ queryKey: [k, tripId] })
    );
  }, [queryClient, tripId]);

  // Quick delete straight from a tab's list (no modal) — used by the trash
  // icon on each entry card.
  const deleteEntryDirect = useCallback(
    async (path: 'stays' | 'transportation' | 'tickets' | 'activities', entryId: string) => {
      try {
        const res = await fetch(`/api/trips/${tripId}/${path}/${entryId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        invalidateAll();
        toast.success('Deleted.');
      } catch {
        toast.error('Could not delete.');
      }
    },
    [tripId, invalidateAll]
  );

  if (tripLoading || !trip) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: COLORS.cloud, fontFamily: FONTS.body }}
      >
        <link rel="stylesheet" href={FONT_LINK} />
        <p className="text-neutral-400">Loading trip…</p>
      </div>
    );
  }

  const themeLabel = themeInfo(trip.theme).label;
  // Trip-specific inbound email — format: tripId@postmark-inbound-domain
  const tripEmail = trip.tripEmail || `${tripId}@inbound.yourdomain.com`;

  const TABS = [
    { id: 'highlights' as const, label: 'Highlights' },
    { id: 'stay' as const, label: 'Stay' },
    { id: 'transportation' as const, label: 'Transport' },
    { id: 'activities' as const, label: 'Activities' },
    { id: 'tickets' as const, label: 'Tickets' },
  ];

  return (
    <div style={{ fontFamily: FONTS.body, background: COLORS.cloud, minHeight: '100vh' }}>
      <link rel="stylesheet" href={FONT_LINK} />
      <Toaster position="top-right" richColors />

      {/* ───── HEADER ───── */}
      <div
        className="relative overflow-hidden"
        style={{ background: GRADIENT.header }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-5 pt-6 pb-16">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-5 transition"
          >
            <ArrowLeft size={15} /> Back to trips
          </Link>
          <div className="flex items-start gap-3 sm:gap-4">
            <StampBadge theme={trip.theme} />
            <div className="flex-1 min-w-0">
              <div
                className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-0.5"
                style={{ fontFamily: FONTS.mono }}
              >
                {themeLabel}
              </div>
              <h1
                className="text-white text-2xl sm:text-4xl leading-tight"
                style={{ fontFamily: FONTS.display, fontWeight: 600 }}
              >
                {trip.title || 'Untitled trip'}
              </h1>
              <div className="flex items-center gap-1.5 text-white/70 text-sm mt-1.5">
                <MapPin size={13} />
                <span>{trip.destination || 'Destination TBD'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-white/50 text-xs mt-2">
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  Up to {trip.capacity}
                </span>
                {trip.priceFrom && (
                  <span style={{ fontFamily: FONTS.mono, color: COLORS.gold }}>
                    from ${trip.priceFrom}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Weather pill — responsive, destination local time from WeatherAPI */}
        {weather && (
          <div
            className="absolute bottom-4 right-3 sm:right-6 rounded-2xl flex items-center"
            style={{
              background: COLORS.whiteTint12,
              border: `1px solid ${COLORS.whiteTint18}`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            {/* Mobile: compact pill */}
            <div className="flex items-center gap-1.5 px-3 py-2 sm:hidden">
              <img src={weather.icon} alt="" className="w-6 h-6" />
              <span
                className="text-white text-sm font-semibold"
                style={{ fontFamily: FONTS.mono }}
              >
                {Math.round(weather.temp_f)}°F
              </span>
              {weather.localtime && (
                <span
                  className="text-white/50 text-xs flex items-center gap-0.5"
                  style={{ fontFamily: FONTS.mono }}
                >
                  <Clock size={10} />
                  {weather.localtime}
                </span>
              )}
            </div>
            {/* Desktop: expanded */}
            <div className="hidden sm:flex items-center gap-3 px-4 py-3">
              <img src={weather.icon} alt={weather.condition} className="w-10 h-10" />
              <div>
                <div
                  className="text-white text-xl font-semibold leading-none"
                  style={{ fontFamily: FONTS.mono }}
                >
                  {Math.round(weather.temp_f)}°F
                </div>
                <div className="text-white/50 text-[11px] mt-0.5">{weather.condition}</div>
              </div>
              {weather.localtime && (
                <div
                  className="pl-3 flex items-center gap-1 text-white/40 text-xs"
                  style={{
                    borderLeft: `1px solid ${COLORS.whiteTint15}`,
                    fontFamily: FONTS.mono,
                  }}
                >
                  <Clock size={11} />
                  {weather.localtime}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ───── TABS ───── */}
      <div
        className="sticky top-0 z-10 border-b overflow-x-auto scrollbar-none"
        style={{ borderColor: COLORS.borderLight, background: COLORS.white }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-5 flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-3 sm:px-5 py-3.5 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap"
              style={{
                borderColor: activeTab === tab.id ? COLORS.teal : 'transparent',
                color: activeTab === tab.id ? COLORS.teal : COLORS.gray,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ───── CONTENT ───── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-5 py-6 sm:py-8">
        {/* HIGHLIGHTS */}
        {activeTab === 'highlights' && (
          <div className="space-y-5">
            {/* Itinerary overview */}
            {trip.notes && (
              <div
                className="rounded-2xl border p-5 sm:p-6"
                style={{ borderColor: COLORS.border, background: COLORS.white }}
              >
                <div
                  className="text-[9px] uppercase tracking-widest mb-3"
                  style={{ fontFamily: FONTS.mono, color: COLORS.gold }}
                >
                  Overview
                </div>
                <div>
                  {parseDayRows(trip.notes).map((row, i, arr) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 py-2.5"
                      style={{
                        borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.borderFaint06}` : 'none',
                      }}
                    >
                      {row.day !== null && (
                        <div
                          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                          style={{ background: COLORS.tealTint, color: COLORS.teal }}
                        >
                          {row.day}
                        </div>
                      )}
                      <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">
                        {row.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Dates', value: `${fmtDate(trip.startDate)} – ${fmtDate(trip.endDate)}` },
                { label: 'Capacity', value: `Up to ${trip.capacity}` },
                { label: 'From', value: trip.priceFrom ? `$${trip.priceFrom}` : '—' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border p-4"
                  style={{ borderColor: COLORS.borderLight, background: COLORS.white }}
                >
                  <div
                    className="text-[9px] uppercase tracking-widest text-neutral-400"
                    style={{ fontFamily: FONTS.mono }}
                  >
                    {s.label}
                  </div>
                  <div className="text-sm font-medium mt-1" style={{ color: COLORS.ink }}>
                    {s.value}
                  </div>
                </div>
              ))}
              <button
                onClick={() => toggleStatusMutation.mutate()}
                disabled={toggleStatusMutation.isPending}
                className="rounded-xl border p-4 text-left transition hover:opacity-80 disabled:opacity-50"
                style={{
                  borderColor:
                    trip.status === 'published' ? COLORS.tealTint30 : COLORS.terracottaTint30,
                  background:
                    trip.status === 'published' ? COLORS.tealTint05 : COLORS.terracottaTint05,
                }}
              >
                <div
                  className="text-[9px] uppercase tracking-widest text-neutral-400"
                  style={{ fontFamily: FONTS.mono }}
                >
                  Status
                </div>
                <div
                  className="text-sm font-medium mt-1 flex items-center gap-1.5"
                  style={{ color: trip.status === 'published' ? COLORS.teal : COLORS.terracotta }}
                >
                  {trip.status === 'published' ? <Globe size={13} /> : <Lock size={13} />}
                  {trip.status === 'published' ? 'Published' : 'Draft'}
                  <span className="text-xs text-neutral-400 font-normal ml-0.5">
                    · tap to {trip.status === 'published' ? 'unpublish' : 'publish'}
                  </span>
                </div>
              </button>
            </div>

            {/* Affiliate links */}
            {trip.affiliateLinks?.length > 0 && (
              <div
                className="rounded-2xl border p-5"
                style={{ borderColor: COLORS.border, background: COLORS.white }}
              >
                <div
                  className="text-[9px] uppercase tracking-widest mb-3 flex items-center gap-1.5"
                  style={{ fontFamily: FONTS.mono, color: COLORS.gold }}
                >
                  <Link2 size={10} /> Links
                </div>
                <div className="flex flex-wrap gap-2">
                  {trip.affiliateLinks.map((l, i) => (
                    <a
                      key={i}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded-full border flex items-center gap-1 hover:bg-neutral-50 transition"
                      style={{ borderColor: COLORS.gold, color: COLORS.goldDark }}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Trip inbox — email forwarding */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: GRADIENT.headerAlt }}
            >
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Mail size={14} style={{ color: COLORS.gold }} />
                  <span
                    className="text-[9px] uppercase tracking-widest text-white/50"
                    style={{ fontFamily: FONTS.mono }}
                  >
                    Trip Inbox
                  </span>
                </div>
                <h3
                  className="text-white text-lg mb-3"
                  style={{ fontFamily: FONTS.display }}
                >
                  Forward confirmations here
                </h3>
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-4"
                  style={{ background: COLORS.shadowMedium }}
                >
                  <span
                    className="flex-1 text-white text-xs sm:text-sm truncate"
                    style={{ fontFamily: FONTS.mono }}
                  >
                    {tripEmail}
                  </span>
                  <CopyButton text={tripEmail} light />
                </div>
                <div className="space-y-1.5 text-white/50 text-xs">
                  <p>
                    ✦ Hotel confirmation → <span className="text-white/80">Stay</span> tab
                  </p>
                  <p>
                    ✦ Flight or transfer → <span className="text-white/80">Transport</span> tab
                  </p>
                  <p>
                    ✦ Tour or event → <span className="text-white/80">Tickets</span> +{' '}
                    <span className="text-white/80">Activities</span>
                  </p>
                </div>
              </div>
              <div
                className="px-5 sm:px-6 py-3"
                style={{
                  borderTop: `1px solid ${COLORS.whiteTint08}`,
                  background: COLORS.shadowLight,
                }}
              >
                <p
                  className="text-white/30 text-[10px]"
                  style={{ fontFamily: FONTS.mono }}
                >
                  Postmark webhook → /api/postmark-inbound
                </p>
              </div>
            </div>

            {/* Manual paste */}
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full rounded-2xl border-2 border-dashed py-4 text-sm font-medium flex items-center justify-center gap-2 hover:bg-white transition"
              style={{ borderColor: COLORS.tealTint25, color: COLORS.teal }}
            >
              <Plus size={15} /> Add stays, flights, tickets or activities
            </button>
          </div>
        )}

        {/* STAY */}
        {activeTab === 'stay' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-2xl"
                style={{ fontFamily: FONTS.display, color: COLORS.ink }}
              >
                Accommodations
              </h2>
              <AddButton onClick={() => setShowAddModal(true)} />
            </div>
            {stays.length === 0 ? (
              <EmptyState
                message="No stays yet."
                hint={`Forward hotel confirmations to ${tripEmail} or paste one manually.`}
              />
            ) : (
              <div className="space-y-4">
                {stays.map((stay) => (
                  <div
                    key={stay.id}
                    className="rounded-2xl border p-5"
                    style={{ borderColor: COLORS.border, background: COLORS.white }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className="text-lg font-semibold"
                        style={{ fontFamily: FONTS.display, color: COLORS.ink }}
                      >
                        {stay.name || 'Unnamed stay'}
                      </h3>
                      <EntryActions
                        onEdit={() => setEditingEntry({ type: 'stay', id: stay.id, data: stay })}
                        onDelete={() => {
                          if (window.confirm('Delete this stay?')) deleteEntryDirect('stays', stay.id);
                        }}
                      />
                    </div>
                    {stay.address && (
                      <p className="text-sm text-neutral-500 mt-1 flex items-center gap-1">
                        <MapPin size={11} />
                        {stay.address}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-neutral-600 mt-3">
                      <span>
                        <span className="text-neutral-400 text-xs uppercase tracking-wide mr-1">
                          Check-in
                        </span>
                        {fmtDate(stay.checkInDate)}
                      </span>
                      <span>
                        <span className="text-neutral-400 text-xs uppercase tracking-wide mr-1">
                          Check-out
                        </span>
                        {fmtDate(stay.checkOutDate)}
                      </span>
                    </div>
                    {stay.confirmationNumber && (
                      <div className="mt-3">
                        <ConfBadge number={stay.confirmationNumber} />
                      </div>
                    )}
                    {stay.notes && <p className="text-sm text-neutral-600 mt-3">{stay.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TRANSPORTATION */}
        {activeTab === 'transportation' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-2xl"
                style={{ fontFamily: FONTS.display, color: COLORS.ink }}
              >
                Flights & Transfers
              </h2>
              <AddButton onClick={() => setShowAddModal(true)} />
            </div>
            {transportation.length === 0 ? (
              <EmptyState
                message="No transportation yet."
                hint={`Forward flight or transfer confirmations to ${tripEmail} or paste one manually.`}
              />
            ) : (
              <div className="space-y-4">
                {transportation.map((leg) => (
                  <div
                    key={leg.id}
                    className="rounded-2xl border p-5"
                    style={{ borderColor: COLORS.border, background: COLORS.white }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full"
                        style={{
                          fontFamily: FONTS.mono,
                          background: COLORS.tealTint,
                          color: COLORS.teal,
                        }}
                      >
                        {leg.type || 'Flight'}
                      </span>
                      <EntryActions
                        onEdit={() => setEditingEntry({ type: 'transportation', id: leg.id, data: leg })}
                        onDelete={() => {
                          if (window.confirm('Delete this transportation?')) {
                            deleteEntryDirect('transportation', leg.id);
                          }
                        }}
                      />
                    </div>
                    <div
                      className="flex items-center gap-3 text-lg font-medium mt-3"
                      style={{ fontFamily: FONTS.display, color: COLORS.ink }}
                    >
                      <span>{leg.departureLocation || '—'}</span>
                      <span className="text-neutral-300 text-2xl">→</span>
                      <span>{leg.arrivalLocation || '—'}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-neutral-600 mt-2">
                      <span>
                        <span className="text-neutral-400 text-xs uppercase tracking-wide mr-1">
                          Departs
                        </span>
                        {isoToDisplayDate(leg.departureTime)}
                      </span>
                      <span>
                        <span className="text-neutral-400 text-xs uppercase tracking-wide mr-1">
                          Arrives
                        </span>
                        {isoToDisplayDate(leg.arrivalTime)}
                      </span>
                    </div>
                    {leg.confirmationNumber && (
                      <div className="mt-3">
                        <ConfBadge number={leg.confirmationNumber} />
                      </div>
                    )}
                    {leg.notes && <p className="text-sm text-neutral-600 mt-3">{leg.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVITIES */}
        {activeTab === 'activities' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-2xl"
                style={{ fontFamily: FONTS.display, color: COLORS.ink }}
              >
                Day-by-Day Itinerary
              </h2>
              <AddButton onClick={() => setShowAddModal(true)} />
            </div>
            {unifiedTimeline.length === 0 ? (
              <EmptyState
                message="No itinerary yet."
                hint="Add stays, flights, tickets, or activities — everything with a date surfaces here in chronological order."
              />
            ) : (
              <div
                className="relative pl-5 border-l-2"
                style={{ borderColor: COLORS.tealTint20 }}
              >
                {unifiedTimeline.map((entry, idx) => {
                  const prevEntry = idx > 0 ? unifiedTimeline[idx - 1] : null;
                  const showDate = !prevEntry || entry.date !== prevEntry.date;
                  const sourceBg: Record<string, string> = {
                    stay: COLORS.tealTint,
                    transportation: COLORS.navyTint,
                    ticket: COLORS.goldTint12,
                    activity: COLORS.terracottaTint,
                  };
                  const sourceColor: Record<string, string> = {
                    stay: COLORS.teal,
                    transportation: COLORS.navy,
                    ticket: COLORS.goldDark,
                    activity: COLORS.terracotta,
                  };
                  return (
                    <div key={entry.key} className="mb-4">
                      {showDate && (
                        <div
                          className="text-[10px] uppercase tracking-widest mb-2 -ml-5 pl-3 flex items-center gap-2"
                          style={{ fontFamily: FONTS.mono, color: COLORS.terracotta }}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: COLORS.terracotta }}
                          />
                          {fmtDate(entry.date)}
                        </div>
                      )}
                      <div
                        className="rounded-2xl border p-4"
                        style={{ borderColor: COLORS.border, background: COLORS.white }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            {entry.badge && (
                              <span
                                className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0"
                                style={{
                                  fontFamily: FONTS.mono,
                                  background: sourceBg[entry.source],
                                  color: sourceColor[entry.source],
                                }}
                              >
                                {entry.badge}
                              </span>
                            )}
                            <h3 className="text-sm font-semibold" style={{ color: COLORS.ink }}>
                              {entry.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {entry.time &&
                              entry.time !== '00:00' &&
                              entry.time !== '12:00' &&
                              entry.time !== '23:59' && (
                                <span
                                  className="text-xs"
                                  style={{ fontFamily: FONTS.mono, color: COLORS.gray }}
                                >
                                  {entry.time}
                                </span>
                              )}
                            <EntryActions
                              onEdit={() => {
                                const source =
                                  entry.source === 'stay'
                                    ? stays.find((s) => s.id === entry.sourceId)
                                    : entry.source === 'transportation'
                                      ? transportation.find((t) => t.id === entry.sourceId)
                                      : entry.source === 'ticket'
                                        ? tickets.find((tk) => tk.id === entry.sourceId)
                                        : activities.find((a) => a.id === entry.sourceId);
                                if (source) {
                                  setEditingEntry({ type: entry.source, id: entry.sourceId, data: source });
                                }
                              }}
                              onDelete={() => {
                                if (!window.confirm('Delete this entry?')) return;
                                const path =
                                  entry.source === 'stay'
                                    ? 'stays'
                                    : entry.source === 'transportation'
                                      ? 'transportation'
                                      : entry.source === 'ticket'
                                        ? 'tickets'
                                        : 'activities';
                                deleteEntryDirect(path, entry.sourceId);
                              }}
                            />
                          </div>
                        </div>
                        {entry.subtitle && (
                          <p className="text-xs text-neutral-500 mt-1">{entry.subtitle}</p>
                        )}
                        {entry.location && entry.location !== entry.subtitle && (
                          <p className="text-xs text-neutral-400 mt-1.5 flex items-center gap-1">
                            <MapPin size={10} />
                            {entry.location}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TICKETS */}
        {activeTab === 'tickets' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-2xl"
                style={{ fontFamily: FONTS.display, color: COLORS.ink }}
              >
                Tours & Reservations
              </h2>
              <AddButton onClick={() => setShowAddModal(true)} />
            </div>
            {tickets.length === 0 ? (
              <EmptyState
                message="No tickets yet."
                hint={`Forward booking confirmations to ${tripEmail} or paste one manually.`}
              />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-2xl border p-5"
                    style={{ borderColor: COLORS.border, background: COLORS.white }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className="text-base font-semibold"
                        style={{ fontFamily: FONTS.display, color: COLORS.ink }}
                      >
                        {ticket.name || 'Unnamed ticket'}
                      </h3>
                      <EntryActions
                        onEdit={() => setEditingEntry({ type: 'ticket', id: ticket.id, data: ticket })}
                        onDelete={() => {
                          if (window.confirm('Delete this ticket?')) deleteEntryDirect('tickets', ticket.id);
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-neutral-600 mt-2">
                      {ticket.date && <span>{fmtDate(ticket.date)}</span>}
                      {ticket.time && (
                        <span style={{ fontFamily: FONTS.mono }}>{ticket.time}</span>
                      )}
                    </div>
                    {ticket.location && (
                      <p className="text-xs text-neutral-500 mt-2 flex items-center gap-1">
                        <MapPin size={11} />
                        {ticket.location}
                      </p>
                    )}
                    {ticket.confirmationNumber && (
                      <div className="mt-3">
                        <ConfBadge number={ticket.confirmationNumber} />
                      </div>
                    )}
                    {ticket.notes && (
                      <p className="text-sm text-neutral-600 mt-3">{ticket.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {(showAddModal || editingEntry) && (
        <AddEntryModal
          tripId={tripId}
          editEntry={editingEntry}
          onClose={() => {
            setShowAddModal(false);
            setEditingEntry(null);
          }}
          onSuccess={invalidateAll}
        />
      )}
      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
