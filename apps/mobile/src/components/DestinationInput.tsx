import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import fetchToWeb from '@/__create/fetch';
import { COLORS, FONTS } from '@/utils/theme';

export function DestinationInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchSuggestions = useCallback((input: string) => {
    clearTimeout(debounceRef.current);
    if (input.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchToWeb(`/api/places?input=${encodeURIComponent(input)}`);
        const data = await res.json();
        setSuggestions((data.predictions || []).map((p: { description: string }) => p.description));
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }, []);

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          onChange(t);
          fetchSuggestions(t);
        }}
        placeholder="e.g. Positano, Italy"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        autoCapitalize="words"
        autoCorrect={false}
      />
      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((s, i) => (
            <Pressable
              key={i}
              onPress={() => {
                onChange(s);
                setQuery(s);
                setSuggestions([]);
              }}
              style={styles.suggestionRow}
            >
              <Ionicons name="location-outline" size={13} color={COLORS.terracotta} />
              <Text style={styles.suggestionText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: 'rgba(20,33,61,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.ink,
    fontFamily: FONTS.body,
  },
  suggestions: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(20,33,61,0.15)',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20,33,61,0.06)',
  },
  suggestionText: { fontSize: 13, color: COLORS.ink, flex: 1, fontFamily: FONTS.body },
});
