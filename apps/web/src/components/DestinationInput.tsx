'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { COLORS } from '@/utils/theme';

export function DestinationInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const fetchSuggestions = useCallback((input: string) => {
    clearTimeout(debounceRef.current);
    if (input.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?input=${encodeURIComponent(input)}`);
        const data = await res.json();
        const preds = (data.predictions || []).map((p: { description: string }) => p.description);
        setSuggestions(preds);
        setOpen(preds.length > 0);
      } catch {
        /* silently ignore */
      }
    }, 300);
  }, []);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          fetchSuggestions(e.target.value);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="e.g. Positano, Italy"
        className="w-full mt-1 border rounded-lg px-3 py-2 outline-none focus:ring-2"
        style={{ borderColor: COLORS.borderDashed }}
        autoComplete="off"
      />
      {open && (
        <div
          className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg overflow-hidden"
          style={{ borderColor: COLORS.borderMedium }}
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2 transition"
              style={{ color: COLORS.ink }}
              onMouseDown={() => {
                onChange(s);
                setQuery(s);
                setOpen(false);
              }}
            >
              <MapPin size={12} style={{ color: COLORS.terracotta, flexShrink: 0 }} />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
