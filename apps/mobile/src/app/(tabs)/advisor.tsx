import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import fetchToWeb from '@/__create/fetch';
import { BrandHeader } from '@/components/BrandHeader';
import KeyboardAvoidingAnimatedView from '@/components/KeyboardAvoidingAnimatedView';
import { COLORS, FONTS, GRADIENT } from '@/utils/theme';
import { createActivity } from '@/utils/tripDetail';
import { usePendingTripStore } from '@/utils/tripStore';
import { emptyTrip, fetchTrips, type Trip, type TripSuggestion } from '@/utils/trips';
import useHandleStreamResponse from '@/utils/useHandleStreamResponse';

type Message = { role: 'user' | 'assistant'; content: string };

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
      return { display, trip: null, activity: JSON.parse(message.slice(activityIdx + activityMarker.length).trim()) };
    } catch {
      return { display, trip: null, activity: null };
    }
  }

  if (tripIdx !== -1) {
    const display = message.slice(0, tripIdx).trim();
    try {
      return { display, trip: JSON.parse(message.slice(tripIdx + tripMarker.length).trim()), activity: null };
    } catch {
      return { display, trip: null, activity: null };
    }
  }

  return { display: message, trip: null, activity: null };
}

export default function AdvisorScreen() {
  const { data: trips = [] } = useQuery({ queryKey: ['trips'], queryFn: fetchTrips });
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
  const listRef = useRef<FlatList>(null);
  const setPendingTrip = usePendingTripStore((s) => s.setTrip);
  const queryClient = useQueryClient();

  const handleAddActivity = async (index: number, activity: ActivitySuggestion) => {
    setAddingActivity(index);
    try {
      await createActivity(activity.tripId, {
        date: activity.date,
        time: activity.time,
        title: activity.title,
        description: activity.description,
        location: activity.location,
      });
      queryClient.invalidateQueries({ queryKey: ['activities', activity.tripId] });
      setPendingActivities((pa) => {
        const n = { ...pa };
        delete n[index];
        return n;
      });
    } catch {
      Alert.alert('Error', 'Could not add that activity.');
    } finally {
      setAddingActivity(null);
    }
  };

  // Merge into an existing draft/published trip when BOTH destination and
  // exact dates already match one — otherwise create new, same as web.
  const findMatchingTrip = useCallback(
    (suggestion: TripSuggestion): Trip | null => {
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
    },
    [trips]
  );

  const handleFinish = useCallback((message: string) => {
    const { display, trip, activity } = parseAdvisorMessage(message);
    setMessages((prev) => {
      const newIdx = prev.length;
      if (trip) setPendingTrips((pt) => ({ ...pt, [newIdx]: trip }));
      if (activity) setPendingActivities((pa) => ({ ...pa, [newIdx]: activity }));
      return [...prev, { role: 'assistant', content: display }];
    });
    setStreamingMessage('');
    setLoading(false);
  }, []);

  const handleStreamResponse = useHandleStreamResponse({
    onChunk: setStreamingMessage,
    onFinish: handleFinish,
  });

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetchToWeb('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          trips,
        }),
      });
      if (!res.ok) throw new Error(`Advisor error ${res.status}`);
      await handleStreamResponse(res);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong reaching the advisor. Try again in a moment.' },
      ]);
      setLoading(false);
    }
  }, [input, messages, loading, trips, handleStreamResponse]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, streamingMessage]);

  const allMessages = streamingMessage
    ? [...messages, { role: 'assistant' as const, content: streamingMessage }]
    : messages;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BrandHeader />
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>AI-BACKED</Text>
        <Text style={styles.heading}>Plan out loud</Text>
      </View>

      <KeyboardAvoidingAnimatedView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.chatHeader}>
          <Ionicons name="sparkles-outline" size={16} color={COLORS.gold} />
          <Text style={styles.chatHeaderText}>Travel Advisor</Text>
        </View>

        <FlatList
          ref={listRef}
          data={allMessages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item, index }) => (
            <View style={[styles.messageWrap, item.role === 'user' ? styles.alignEnd : styles.alignStart]}>
              {item.role === 'user' ? (
                <LinearGradient
                  colors={GRADIENT.colors}
                  start={GRADIENT.start}
                  end={GRADIENT.end}
                  style={styles.bubble}
                >
                  <Text style={styles.bubbleTextUser}>{item.content}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.bubble, styles.bubbleAssistant]}>
                  <Text style={styles.bubbleTextAssistant}>{item.content}</Text>
                </View>
              )}
              {pendingTrips[index] && (
                <Pressable
                  onPress={() => {
                    const suggestion = pendingTrips[index];
                    const existing = findMatchingTrip(suggestion);
                    if (existing) {
                      const mergedNotes =
                        existing.notes && suggestion.notes && !existing.notes.includes(suggestion.notes)
                          ? `${existing.notes}\n\n${suggestion.notes}`
                          : existing.notes || suggestion.notes || '';
                      setPendingTrip({ ...existing, notes: mergedNotes });
                    } else {
                      setPendingTrip({
                        ...emptyTrip(),
                        title: suggestion.title || '',
                        destination: suggestion.destination || '',
                        theme: suggestion.theme || 'coastal-reset',
                        notes: suggestion.notes || '',
                        startDate: suggestion.startDate || '',
                        endDate: suggestion.endDate || '',
                        capacity: suggestion.capacity || 8,
                        priceFrom: suggestion.priceFrom || '',
                        status: 'draft',
                      });
                    }
                    setPendingTrips((pt) => {
                      const n = { ...pt };
                      delete n[index];
                      return n;
                    });
                    router.push('/(tabs)/plan');
                  }}
                >
                  <LinearGradient
                    colors={GRADIENT.colors}
                    start={GRADIENT.start}
                    end={GRADIENT.end}
                    style={styles.saveButton}
                  >
                    <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                    <Text style={styles.saveButtonText}>
                      Save "{pendingTrips[index].title || 'this trip'}" to Plan
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}
              {pendingActivities[index] &&
                (() => {
                  const activity = pendingActivities[index];
                  const targetTrip = trips.find((t) => t.id === activity.tripId);
                  return (
                    <Pressable
                      onPress={() => handleAddActivity(index, activity)}
                      disabled={addingActivity === index}
                    >
                      <LinearGradient
                        colors={GRADIENT.colors}
                        start={GRADIENT.start}
                        end={GRADIENT.end}
                        style={[styles.saveButton, addingActivity === index && { opacity: 0.6 }]}
                      >
                        <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                        <Text style={styles.saveButtonText}>
                          {addingActivity === index
                            ? 'Adding…'
                            : `Add "${activity.title}" to ${targetTrip?.title || 'trip'}`}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  );
                })()}
            </View>
          )}
          ListFooterComponent={
            loading && !streamingMessage ? <Text style={styles.thinking}>Advisor is thinking…</Text> : null
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={send}
            placeholder="Ask about a destination, theme, or dates…"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            returnKeyType="send"
          />
          <Pressable onPress={send} disabled={loading}>
            <LinearGradient colors={GRADIENT.colors} start={GRADIENT.start} end={GRADIENT.end} style={styles.sendButton}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={16} color="#fff" />}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingAnimatedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.cloud },
  headerBlock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: COLORS.terracotta, marginBottom: 4, fontFamily: FONTS.mono },
  heading: { fontSize: 26, color: COLORS.ink, fontFamily: FONTS.display },
  chatContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.navy,
  },
  chatHeaderText: { color: '#fff', fontSize: 14, fontFamily: FONTS.display },
  messagesList: { padding: 16, gap: 12, flexGrow: 1, backgroundColor: '#FBFAF7' },
  messageWrap: { gap: 8, marginBottom: 8 },
  alignEnd: { alignItems: 'flex-end' },
  alignStart: { alignItems: 'flex-start' },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleAssistant: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border },
  bubbleTextUser: { color: '#fff', fontSize: 14, fontFamily: FONTS.body },
  bubbleTextAssistant: { color: '#1F2937', fontSize: 14, fontFamily: FONTS.body },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  saveButtonText: { color: '#fff', fontSize: 12, fontFamily: FONTS.bodyBold },
  thinking: { fontSize: 12, color: '#9CA3AF', paddingLeft: 4, fontFamily: FONTS.body },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(20,33,61,0.2)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.ink,
    fontFamily: FONTS.body,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
