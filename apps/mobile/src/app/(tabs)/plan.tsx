import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandHeader } from '@/components/BrandHeader';
import { TripCard } from '@/components/TripCard';
import { TripEditorModal } from '@/components/TripEditorModal';
import { COLORS, FONTS, GRADIENT } from '@/utils/theme';
import { promoteDiscoveries, type Discovery } from '@/utils/discoveries';
import { usePendingTripStore } from '@/utils/tripStore';
import { createTrip, deleteTrip, emptyTrip, fetchTrips, updateTrip, type Trip } from '@/utils/trips';

export default function PlanScreen() {
  const queryClient = useQueryClient();
  const {
    data: trips = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({ queryKey: ['trips'], queryFn: fetchTrips });
  const [editing, setEditing] = useState<Trip | null>(null);
  const [pendingPromotedDiscoveries, setPendingPromotedDiscoveries] = useState<Discovery[] | null>(null);

  const pendingSuggestion = usePendingTripStore((s) => s.trip);
  const pendingPromoting = usePendingTripStore((s) => s.promotingDiscoveries);
  const clearPending = usePendingTripStore((s) => s.clear);

  useEffect(() => {
    if (pendingSuggestion) {
      setEditing(pendingSuggestion);
      if (pendingPromoting) setPendingPromotedDiscoveries(pendingPromoting);
      clearPending();
    }
  }, [pendingSuggestion, pendingPromoting, clearPending]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['trips'] });

  const createMutation = useMutation({
    mutationFn: createTrip,
    onSuccess: (_data, trip) => {
      invalidate();
      setEditing(null);
      if (pendingPromotedDiscoveries) {
        const discoveries = pendingPromotedDiscoveries;
        setPendingPromotedDiscoveries(null);
        promoteDiscoveries(discoveries, trip.id).then(() =>
          queryClient.invalidateQueries({ queryKey: ['discoveries'] })
        );
      }
    },
    onError: () => Alert.alert('Error', 'Could not save trip.'),
  });
  const updateMutation = useMutation({
    mutationFn: updateTrip,
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
    onError: () => Alert.alert('Error', 'Could not update trip.'),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteTrip,
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Could not delete trip.'),
  });

  const handleSave = (trip: Trip) => {
    const exists = trips.some((t) => t.id === trip.id);
    if (exists) updateMutation.mutate(trip);
    else createMutation.mutate(trip);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete trip?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const handleToggleStatus = (trip: Trip) =>
    updateMutation.mutate({ ...trip, status: trip.status === 'published' ? 'draft' : 'published' });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BrandHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.teal} />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>PRIVATE · 2027 PLANNING</Text>
            <Text style={styles.heading}>Your trip roster</Text>
          </View>
          <Pressable onPress={() => setEditing(emptyTrip())}>
            <LinearGradient
              colors={GRADIENT.colors}
              start={GRADIENT.start}
              end={GRADIENT.end}
              style={styles.newButton}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.newButtonText}>New trip</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : trips.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.mutedCenter}>Nothing planned yet. Start your first 2027 trip.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {trips.map((t) => (
              <TripCard
                key={t.id}
                trip={t}
                editable
                onEdit={setEditing}
                onDelete={handleDelete}
                onToggleStatus={handleToggleStatus}
                onPress={() => router.push(`/trip/${t.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <TripEditorModal
        visible={!!editing}
        trip={editing}
        onSave={handleSave}
        onClose={() => setEditing(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.cloud },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20, gap: 12 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: COLORS.terracotta, marginBottom: 4, fontFamily: FONTS.mono },
  heading: { fontSize: 26, color: COLORS.ink, fontFamily: FONTS.display },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  newButtonText: { color: '#fff', fontSize: 13, fontFamily: FONTS.bodyBold },
  muted: { color: '#9CA3AF', fontSize: 13, fontFamily: FONTS.body },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(20,33,61,0.2)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  mutedCenter: { color: '#6B7280', fontSize: 13, textAlign: 'center', fontFamily: FONTS.body },
  list: { gap: 16 },
});
