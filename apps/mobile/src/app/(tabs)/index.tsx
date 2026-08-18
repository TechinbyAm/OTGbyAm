import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandHeader } from '@/components/BrandHeader';
import { TripCard } from '@/components/TripCard';
import { COLORS, FONTS } from '@/utils/theme';
import { fetchTrips } from '@/utils/trips';

export default function ExploreScreen() {
  const {
    data: trips = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({ queryKey: ['trips'], queryFn: fetchTrips });

  const published = trips.filter((t) => t.status === 'published');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BrandHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.teal} />
        }
      >
        <Text style={styles.eyebrow}>SMALL-GROUP · NEVER MORE THAN 10</Text>
        <Text style={styles.heading}>Trips worth clearing your calendar for</Text>

        {isLoading ? (
          <Text style={styles.muted}>Loading trips…</Text>
        ) : published.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.mutedCenter}>
              No published trips yet — publish one from the Plan tab to see it here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {published.map((t) => (
              <TripCard key={t.id} trip={t} onPress={() => router.push(`/trip/${t.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.cloud },
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: COLORS.terracotta, marginBottom: 4, fontFamily: FONTS.mono },
  heading: { fontSize: 26, color: COLORS.ink, marginBottom: 20, fontFamily: FONTS.display },
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
