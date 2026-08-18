import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddEntryModal, type EditEntry } from '@/components/AddEntryModal';
import { isoToDisplayDate } from '@/utils/dateFormat';
import { COLORS, FONTS, GRADIENT } from '@/utils/theme';
import { fmtDate, themeInfo, updateTrip } from '@/utils/trips';
import {
  buildUnifiedTimeline,
  deleteActivity,
  deleteStay,
  deleteTicket,
  deleteTransportation,
  fetchActivities,
  fetchStays,
  fetchTickets,
  fetchTransportation,
  fetchTripDetail,
  fetchWeather,
} from '@/utils/tripDetail';

type TabId = 'highlights' | 'stay' | 'transportation' | 'activities' | 'tickets';
const TABS: { id: TabId; label: string }[] = [
  { id: 'highlights', label: 'Highlights' },
  { id: 'stay', label: 'Stay' },
  { id: 'transportation', label: 'Transport' },
  { id: 'activities', label: 'Activities' },
  { id: 'tickets', label: 'Tickets' },
];

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
      const m = p.match(/^Day\s+(\d+)[\s]*[:\-–]\s*([\s\S]*)$/i);
      if (m) return { day: Number(m[1]), text: m[2].trim() };
      return { day: null, text: p };
    });
  }
  return [{ day: null, text: notes }];
}

function StampBadge({ theme }: { theme: string }) {
  const t = themeInfo(theme);
  return (
    <View style={styles.stamp}>
      <Text style={styles.stampIcon}>{t.icon}</Text>
      <Text style={styles.stampLabel}>{t.label.split(' ')[0]}</Text>
    </View>
  );
}

function ConfBadge({ number }: { number: string }) {
  if (!number) return null;
  return (
    <View style={styles.confBadge}>
      <Text style={styles.confBadgeText}>#{number}</Text>
    </View>
  );
}

function EmptyState({ message, hint }: { message: string; hint: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyMessage}>{message}</Text>
      <Text style={styles.emptyHint}>{hint}</Text>
    </View>
  );
}

function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.addButton} onPress={onPress}>
      <Ionicons name="add" size={13} color={COLORS.teal} />
      <Text style={styles.addButtonText}>Add</Text>
    </Pressable>
  );
}

function EntryActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.entryActions}>
      <Pressable onPress={onEdit} hitSlop={8} style={styles.entryActionButton}>
        <Ionicons name="create-outline" size={15} color={COLORS.ink} />
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8} style={styles.entryActionButton}>
        <Ionicons name="trash-outline" size={15} color={COLORS.terracotta} />
      </Pressable>
    </View>
  );
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = id as string;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('highlights');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditEntry | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => fetchTripDetail(tripId),
    enabled: !!tripId,
  });

  const { data: weather } = useQuery({
    queryKey: ['weather', trip?.destination],
    queryFn: () => fetchWeather(trip!.destination),
    enabled: !!trip?.destination,
    refetchInterval: 600000,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      if (!trip) return;
      await updateTrip({ ...trip, status: trip.status === 'published' ? 'draft' : 'published' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: () => Alert.alert('Error', 'Could not update trip status.'),
  });

  const { data: stays = [] } = useQuery({
    queryKey: ['stays', tripId],
    queryFn: () => fetchStays(tripId),
    enabled: !!tripId,
  });
  const { data: transportation = [] } = useQuery({
    queryKey: ['transportation', tripId],
    queryFn: () => fetchTransportation(tripId),
    enabled: !!tripId,
  });
  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets', tripId],
    queryFn: () => fetchTickets(tripId),
    enabled: !!tripId,
  });
  const { data: activities = [] } = useQuery({
    queryKey: ['activities', tripId],
    queryFn: () => fetchActivities(tripId),
    enabled: !!tripId,
  });

  const unifiedTimeline = buildUnifiedTimeline(stays, transportation, tickets, activities);

  const invalidateAll = useCallback(() => {
    ['stays', 'transportation', 'tickets', 'activities'].forEach((k) =>
      queryClient.invalidateQueries({ queryKey: [k, tripId] })
    );
  }, [queryClient, tripId]);

  const deleteEntryDirect = useCallback(
    (type: EditEntry['type'], entryId: string) => {
      Alert.alert('Delete this entry?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (type === 'stay') await deleteStay(tripId, entryId);
              else if (type === 'transportation') await deleteTransportation(tripId, entryId);
              else if (type === 'ticket') await deleteTicket(tripId, entryId);
              else await deleteActivity(tripId, entryId);
              invalidateAll();
            } catch {
              Alert.alert('Error', 'Could not delete.');
            }
          },
        },
      ]);
    },
    [tripId, invalidateAll]
  );

  const copyEmail = async (email: string) => {
    await Clipboard.setStringAsync(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (tripLoading || !trip) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.muted}>Loading trip…</Text>
      </SafeAreaView>
    );
  }

  const themeLabel = themeInfo(trip.theme).label;
  const tripEmail = trip.tripEmail || `${tripId}@inbound.yourdomain.com`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={GRADIENT.colors} start={GRADIENT.start} end={GRADIENT.end} style={styles.hero}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={15} color="rgba(255,255,255,0.7)" />
            <Text style={styles.backText}>Back to trips</Text>
          </Pressable>
          <View style={styles.heroRow}>
            <StampBadge theme={trip.theme} />
            <View style={styles.flex1}>
              <Text style={styles.heroTheme}>{themeLabel}</Text>
              <Text style={styles.heroTitle}>{trip.title || 'Untitled trip'}</Text>
              <View style={styles.row}>
                <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.7)" />
                <Text style={styles.heroDestination}>{trip.destination || 'Destination TBD'}</Text>
              </View>
              <View style={styles.heroMetaRow}>
                <View style={styles.row}>
                  <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.heroMeta}>
                    {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Ionicons name="people-outline" size={11} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.heroMeta}>Up to {trip.capacity}</Text>
                </View>
                {!!trip.priceFrom && <Text style={styles.heroPrice}>from ${trip.priceFrom}</Text>}
              </View>
            </View>
          </View>

          {weather && (
            <View style={styles.weatherPillRow}>
              <View style={styles.weatherPill}>
                <Image source={{ uri: weather.icon }} style={styles.weatherIcon} />
                <Text style={styles.weatherTemp}>{Math.round(weather.temp_f)}°F</Text>
                {!!weather.localtime && (
                  <View style={styles.row}>
                    <Ionicons name="time-outline" size={10} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.weatherTime}>{weather.localtime}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </LinearGradient>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
          {TABS.map((t) => (
            <Pressable key={t.id} onPress={() => setActiveTab(t.id)} style={styles.tabItem}>
              <Text style={[styles.tabLabel, activeTab === t.id && styles.tabLabelActive]}>{t.label}</Text>
              {activeTab === t.id && <View style={styles.tabIndicator} />}
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.content}>
          {activeTab === 'highlights' && (
            <View style={{ gap: 16 }}>
              {!!trip.notes && (
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>OVERVIEW</Text>
                  {parseDayRows(trip.notes).map((row, i, arr) => (
                    <View
                      key={i}
                      style={[
                        styles.overviewRow,
                        i < arr.length - 1 && styles.overviewRowDivider,
                      ]}
                    >
                      {row.day !== null && (
                        <View style={styles.overviewDayBadge}>
                          <Text style={styles.overviewDayBadgeText}>{row.day}</Text>
                        </View>
                      )}
                      <Text style={styles.overviewText}>{row.text}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.statsGrid}>
                {[
                  { label: 'Dates', value: `${fmtDate(trip.startDate)} – ${fmtDate(trip.endDate)}` },
                  { label: 'Capacity', value: `Up to ${trip.capacity}` },
                  { label: 'From', value: trip.priceFrom ? `$${trip.priceFrom}` : '—' },
                ].map((s) => (
                  <View key={s.label} style={styles.statCard}>
                    <Text style={styles.statLabel}>{s.label}</Text>
                    <Text style={styles.statValue}>{s.value}</Text>
                  </View>
                ))}
                <Pressable
                  onPress={() => toggleStatusMutation.mutate()}
                  disabled={toggleStatusMutation.isPending}
                  style={[
                    styles.statCard,
                    {
                      borderColor:
                        trip.status === 'published' ? 'rgba(44,95,90,0.3)' : 'rgba(196,98,42,0.3)',
                      backgroundColor:
                        trip.status === 'published' ? 'rgba(44,95,90,0.05)' : 'rgba(196,98,42,0.05)',
                    },
                  ]}
                >
                  <Text style={styles.statLabel}>Status</Text>
                  <View style={styles.statusToggleRow}>
                    <Ionicons
                      name={trip.status === 'published' ? 'globe-outline' : 'lock-closed-outline'}
                      size={12}
                      color={trip.status === 'published' ? COLORS.teal : COLORS.terracotta}
                    />
                    <Text
                      style={[
                        styles.statValue,
                        { color: trip.status === 'published' ? COLORS.teal : COLORS.terracotta },
                      ]}
                    >
                      {trip.status === 'published' ? 'Published' : 'Draft'}
                    </Text>
                  </View>
                  <Text style={styles.statusToggleHint}>
                    tap to {trip.status === 'published' ? 'unpublish' : 'publish'}
                  </Text>
                </Pressable>
              </View>

              {trip.affiliateLinks?.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.rowGap}>
                    <Ionicons name="link-outline" size={11} color={COLORS.gold} />
                    <Text style={styles.cardLabel}>LINKS</Text>
                  </View>
                  <View style={styles.linksWrap}>
                    {trip.affiliateLinks.map((l, i) => (
                      <View key={i} style={styles.linkPill}>
                        <Text style={styles.linkPillText}>{l.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <LinearGradient colors={GRADIENT.colors} start={GRADIENT.start} end={GRADIENT.end} style={styles.inboxCard}>
                <View style={styles.rowGap}>
                  <Ionicons name="mail-outline" size={13} color={COLORS.gold} />
                  <Text style={styles.inboxLabel}>TRIP INBOX</Text>
                </View>
                <Text style={styles.inboxTitle}>Forward confirmations here</Text>
                <Pressable style={styles.inboxEmailRow} onPress={() => copyEmail(tripEmail)}>
                  <Text style={styles.inboxEmail} numberOfLines={1}>
                    {tripEmail}
                  </Text>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color="rgba(255,255,255,0.8)" />
                </Pressable>
                <Text style={styles.inboxHint}>✦ Hotel confirmation → Stay tab</Text>
                <Text style={styles.inboxHint}>✦ Flight or transfer → Transport tab</Text>
                <Text style={styles.inboxHint}>✦ Tour or event → Tickets + Activities</Text>
              </LinearGradient>

              <Pressable style={styles.addStripButton} onPress={() => setShowAddModal(true)}>
                <Ionicons name="add" size={15} color={COLORS.teal} />
                <Text style={styles.addStripText}>Add stays, flights, tickets or activities</Text>
              </Pressable>
            </View>
          )}

          {activeTab === 'stay' && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Accommodations</Text>
                <AddButton onPress={() => setShowAddModal(true)} />
              </View>
              {stays.length === 0 ? (
                <EmptyState
                  message="No stays yet."
                  hint={`Forward hotel confirmations to ${tripEmail} or paste one manually.`}
                />
              ) : (
                <View style={{ gap: 12 }}>
                  {stays.map((stay) => (
                    <View key={stay.id} style={styles.card}>
                      <View style={styles.entryHeaderRow}>
                        <Text style={[styles.entryTitle, styles.flex1]}>{stay.name || 'Unnamed stay'}</Text>
                        <EntryActions
                          onEdit={() => setEditingEntry({ type: 'stay', id: stay.id, data: stay })}
                          onDelete={() => deleteEntryDirect('stay', stay.id)}
                        />
                      </View>
                      {!!stay.address && (
                        <View style={styles.rowGap}>
                          <Ionicons name="location-outline" size={11} color="#9CA3AF" />
                          <Text style={styles.entrySubtext}>{stay.address}</Text>
                        </View>
                      )}
                      <View style={styles.entryMetaRow}>
                        <Text style={styles.entryMetaText}>
                          <Text style={styles.entryMetaLabel}>Check-in </Text>
                          {fmtDate(stay.checkInDate)}
                        </Text>
                        <Text style={styles.entryMetaText}>
                          <Text style={styles.entryMetaLabel}>Check-out </Text>
                          {fmtDate(stay.checkOutDate)}
                        </Text>
                      </View>
                      <ConfBadge number={stay.confirmationNumber} />
                      {!!stay.notes && <Text style={styles.entryNotes}>{stay.notes}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'transportation' && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Flights & Transfers</Text>
                <AddButton onPress={() => setShowAddModal(true)} />
              </View>
              {transportation.length === 0 ? (
                <EmptyState
                  message="No transportation yet."
                  hint={`Forward flight or transfer confirmations to ${tripEmail} or paste one manually.`}
                />
              ) : (
                <View style={{ gap: 12 }}>
                  {transportation.map((leg) => (
                    <View key={leg.id} style={styles.card}>
                      <View style={styles.entryHeaderRow}>
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>{leg.type || 'Flight'}</Text>
                        </View>
                        <EntryActions
                          onEdit={() => setEditingEntry({ type: 'transportation', id: leg.id, data: leg })}
                          onDelete={() => deleteEntryDirect('transportation', leg.id)}
                        />
                      </View>
                      <View style={styles.legRow}>
                        <Text style={styles.legText}>{leg.departureLocation || '—'}</Text>
                        <Text style={styles.legArrow}>→</Text>
                        <Text style={styles.legText}>{leg.arrivalLocation || '—'}</Text>
                      </View>
                      <View style={styles.entryMetaRow}>
                        <Text style={styles.entryMetaText}>
                          <Text style={styles.entryMetaLabel}>Departs </Text>
                          {isoToDisplayDate(leg.departureTime)}
                        </Text>
                        <Text style={styles.entryMetaText}>
                          <Text style={styles.entryMetaLabel}>Arrives </Text>
                          {isoToDisplayDate(leg.arrivalTime)}
                        </Text>
                      </View>
                      <ConfBadge number={leg.confirmationNumber} />
                      {!!leg.notes && <Text style={styles.entryNotes}>{leg.notes}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'activities' && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Day-by-Day Itinerary</Text>
                <AddButton onPress={() => setShowAddModal(true)} />
              </View>
              {unifiedTimeline.length === 0 ? (
                <EmptyState
                  message="No itinerary yet."
                  hint="Add stays, flights, tickets, or activities — everything with a date surfaces here in chronological order."
                />
              ) : (
                <View style={styles.timeline}>
                  {unifiedTimeline.map((entry, idx) => {
                    const prev = idx > 0 ? unifiedTimeline[idx - 1] : null;
                    const showDate = !prev || entry.date !== prev.date;
                    return (
                      <View key={entry.key} style={{ marginBottom: 14 }}>
                        {showDate && (
                          <View style={styles.timelineDateRow}>
                            <View style={styles.timelineDot} />
                            <Text style={styles.timelineDate}>{fmtDate(entry.date)}</Text>
                          </View>
                        )}
                        <View style={styles.timelineCard}>
                          <View style={styles.timelineCardHeader}>
                            <View style={styles.timelineBadgeRow}>
                              {!!entry.badge && (
                                <View style={styles.timelineBadge}>
                                  <Text style={styles.timelineBadgeText}>{entry.badge}</Text>
                                </View>
                              )}
                              <Text style={styles.timelineTitle} numberOfLines={2}>
                                {entry.title}
                              </Text>
                            </View>
                            <View style={styles.row}>
                              {!!entry.time && !['00:00', '12:00', '23:59'].includes(entry.time) && (
                                <Text style={styles.timelineTime}>{entry.time}</Text>
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
                                onDelete={() => deleteEntryDirect(entry.source, entry.sourceId)}
                              />
                            </View>
                          </View>
                          {!!entry.subtitle && <Text style={styles.entrySubtext}>{entry.subtitle}</Text>}
                          {!!entry.location && entry.location !== entry.subtitle && (
                            <View style={styles.rowGap}>
                              <Ionicons name="location-outline" size={10} color="#9CA3AF" />
                              <Text style={styles.timelineLocation}>{entry.location}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {activeTab === 'tickets' && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Tours & Reservations</Text>
                <AddButton onPress={() => setShowAddModal(true)} />
              </View>
              {tickets.length === 0 ? (
                <EmptyState
                  message="No tickets yet."
                  hint={`Forward booking confirmations to ${tripEmail} or paste one manually.`}
                />
              ) : (
                <View style={{ gap: 12 }}>
                  {tickets.map((ticket) => (
                    <View key={ticket.id} style={styles.card}>
                      <View style={styles.entryHeaderRow}>
                        <Text style={[styles.entryTitle, styles.flex1]}>{ticket.name || 'Unnamed ticket'}</Text>
                        <EntryActions
                          onEdit={() => setEditingEntry({ type: 'ticket', id: ticket.id, data: ticket })}
                          onDelete={() => deleteEntryDirect('ticket', ticket.id)}
                        />
                      </View>
                      <View style={styles.entryMetaRow}>
                        {!!ticket.date && <Text style={styles.entryMetaText}>{fmtDate(ticket.date)}</Text>}
                        {!!ticket.time && <Text style={styles.entryMetaText}>{ticket.time}</Text>}
                      </View>
                      {!!ticket.location && (
                        <View style={styles.rowGap}>
                          <Ionicons name="location-outline" size={11} color="#9CA3AF" />
                          <Text style={styles.entrySubtext}>{ticket.location}</Text>
                        </View>
                      )}
                      <ConfBadge number={ticket.confirmationNumber} />
                      {!!ticket.notes && <Text style={styles.entryNotes}>{ticket.notes}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <AddEntryModal
        visible={showAddModal || !!editingEntry}
        tripId={tripId}
        editEntry={editingEntry}
        onClose={() => {
          setShowAddModal(false);
          setEditingEntry(null);
        }}
        onSuccess={invalidateAll}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.cloud },
  loadingContainer: { flex: 1, backgroundColor: COLORS.cloud, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#9CA3AF', fontSize: 13, fontFamily: FONTS.body },
  flex1: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },

  hero: { padding: 20, paddingTop: 8, paddingBottom: 20 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: FONTS.body },
  heroRow: { flexDirection: 'row', gap: 14 },
  heroTheme: { color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 2, fontFamily: FONTS.mono, marginBottom: 2 },
  heroTitle: { color: '#fff', fontSize: 24, fontFamily: FONTS.displayBold, marginBottom: 4 },
  heroDestination: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: FONTS.body },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  heroMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: FONTS.body },
  heroPrice: { color: COLORS.gold, fontSize: 11, fontFamily: FONTS.mono },

  stamp: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,162,39,0.08)',
  },
  stampIcon: { fontSize: 16, color: COLORS.gold },
  stampLabel: { fontSize: 8, letterSpacing: 1, color: COLORS.gold, marginTop: 2, fontFamily: FONTS.mono },

  // Sits in normal flow (not absolutely positioned) so it can never overlap
  // heroMetaRow when that row wraps to a second line on longer trip data —
  // it just pushes below instead. alignSelf:'flex-end' keeps the bottom-right
  // placement from the design.
  weatherPillRow: { marginTop: 14, alignItems: 'flex-end' },
  weatherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  weatherIcon: { width: 22, height: 22 },
  weatherTemp: { color: '#fff', fontSize: 14, fontFamily: FONTS.monoMedium },
  weatherTime: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: FONTS.mono },

  tabBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabItem: { paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' },
  tabLabel: { fontSize: 13, color: '#6B6B6B', fontFamily: FONTS.bodyMedium },
  tabLabelActive: { color: COLORS.teal },
  tabIndicator: { height: 2, backgroundColor: COLORS.teal, width: '100%', marginTop: 8, borderRadius: 1 },

  content: { padding: 20, gap: 16 },

  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff',
  },
  cardLabel: { fontSize: 9, letterSpacing: 1.5, color: COLORS.gold, fontFamily: FONTS.mono, marginBottom: 8 },
  overviewText: { fontSize: 13, color: '#4B5563', lineHeight: 20, fontFamily: FONTS.body, flex: 1 },
  overviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 },
  overviewRowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(20,33,61,0.06)' },
  overviewDayBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(44,95,90,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewDayBadgeText: { fontSize: 11, fontFamily: FONTS.bodyBold, color: COLORS.teal },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  statLabel: { fontSize: 9, letterSpacing: 1.5, color: '#9CA3AF', fontFamily: FONTS.mono },
  statValue: { fontSize: 13, color: COLORS.ink, fontFamily: FONTS.bodyMedium, marginTop: 4 },
  statusToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statusToggleHint: { fontSize: 9, color: '#9CA3AF', fontFamily: FONTS.body, marginTop: 2 },

  linksWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkPill: {
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  linkPillText: { fontSize: 12, color: '#8a6c1a', fontFamily: FONTS.body },

  inboxCard: { borderRadius: 16, padding: 18 },
  inboxLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, letterSpacing: 1.5, fontFamily: FONTS.mono },
  inboxTitle: { color: '#fff', fontSize: 17, fontFamily: FONTS.display, marginTop: 6, marginBottom: 12 },
  inboxEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  inboxEmail: { flex: 1, color: '#fff', fontSize: 12, fontFamily: FONTS.mono },
  inboxHint: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: FONTS.body, marginTop: 3 },

  addStripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(44,95,90,0.3)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  addStripText: { color: COLORS.teal, fontSize: 13, fontFamily: FONTS.bodyMedium },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 20, color: COLORS.ink, fontFamily: FONTS.display },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(44,95,90,0.3)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addButtonText: { fontSize: 11, color: COLORS.teal, fontFamily: FONTS.bodyMedium },

  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(20,33,61,0.15)',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  emptyMessage: { color: '#374151', fontSize: 13, fontFamily: FONTS.bodyMedium },
  emptyHint: { color: '#9CA3AF', fontSize: 12, textAlign: 'center', marginTop: 4, fontFamily: FONTS.body },

  entryTitle: { fontSize: 15, color: COLORS.ink, fontFamily: FONTS.display, marginBottom: 6 },
  entryHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  entryActions: { flexDirection: 'row', gap: 4 },
  entryActionButton: { padding: 4 },
  entrySubtext: { fontSize: 12, color: '#6B7280', fontFamily: FONTS.body },
  entryMetaRow: { flexDirection: 'row', gap: 16, marginTop: 8, marginBottom: 8 },
  entryMetaText: { fontSize: 12, color: '#4B5563', fontFamily: FONTS.body },
  entryMetaLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', fontFamily: FONTS.mono },
  entryNotes: { fontSize: 12, color: '#4B5563', marginTop: 8, fontFamily: FONTS.body },

  confBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(44,95,90,0.07)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confBadgeText: { fontSize: 11, color: COLORS.teal, fontFamily: FONTS.mono },

  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(44,95,90,0.1)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  typeBadgeText: { fontSize: 9, letterSpacing: 1, color: COLORS.teal, fontFamily: FONTS.mono, textTransform: 'uppercase' },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  legText: { fontSize: 16, color: COLORS.ink, fontFamily: FONTS.display },
  legArrow: { fontSize: 18, color: '#D1D5DB' },

  timeline: { borderLeftWidth: 2, borderLeftColor: 'rgba(44,95,90,0.2)', paddingLeft: 16 },
  timelineDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginLeft: -21 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.terracotta },
  timelineDate: { fontSize: 10, letterSpacing: 1.5, color: COLORS.terracotta, fontFamily: FONTS.mono, textTransform: 'uppercase' },
  timelineCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 12, backgroundColor: '#fff' },
  timelineCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  timelineBadgeRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  timelineBadge: { backgroundColor: 'rgba(44,95,90,0.1)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  timelineBadgeText: { fontSize: 9, color: COLORS.teal, fontFamily: FONTS.mono, textTransform: 'uppercase' },
  timelineTitle: { fontSize: 13, color: COLORS.ink, fontFamily: FONTS.bodyBold, flexShrink: 1 },
  timelineTime: { fontSize: 11, color: '#6B6B6B', fontFamily: FONTS.mono },
  timelineLocation: { fontSize: 11, color: '#9CA3AF', fontFamily: FONTS.body },
});
