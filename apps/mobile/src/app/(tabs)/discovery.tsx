import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandHeader } from '@/components/BrandHeader';
import { DiscoveryCard } from '@/components/DiscoveryCard';
import { DiscoveryIntakeModal, type ModalState } from '@/components/DiscoveryIntakeModal';
import { COLORS, FONTS, GRADIENT } from '@/utils/theme';
import {
  createDiscovery,
  deleteDiscovery,
  detectPlatform,
  fetchDiscoveries,
  updateDiscovery,
  type Discovery,
} from '@/utils/discoveries';
import { THEMES } from '@/utils/trips';

export default function DiscoveryScreen() {
  const queryClient = useQueryClient();
  const {
    data: discoveries = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({ queryKey: ['discoveries'], queryFn: fetchDiscoveries });

  const [themeFilter, setThemeFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState | null>(null);
  const [pasteValue, setPasteValue] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['discoveries'] });

  const createMutation = useMutation({
    mutationFn: createDiscovery,
    onSuccess: () => {
      invalidate();
      setModal(null);
      setPasteValue('');
    },
    onError: (e: Error) => Alert.alert('Error', e.message || 'Could not save discovery.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: Parameters<typeof updateDiscovery>[1] & { id: string }) =>
      updateDiscovery(id, payload),
    onSuccess: () => {
      invalidate();
      setModal(null);
    },
    onError: (e: Error) => Alert.alert('Error', e.message || 'Could not update discovery.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDiscovery,
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'Could not remove discovery.'),
  });

  const handleDelete = (id: string) => {
    Alert.alert('Remove this?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const handleSave = (destination: string, notes: string) => {
    if (!modal) return;
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
      createMutation.mutate({ sourceUrl: modal.sourceUrl, platform: modal.platform, destination, notes });
    }
  };

  const handlePasteAdd = () => {
    const url = pasteValue.trim();
    if (!url) return;
    setModal({ mode: 'create', sourceUrl: url, platform: detectPlatform(url) });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const destinationCount = grouped.length;
  const saving = modal?.mode === 'edit' ? updateMutation.isPending : createMutation.isPending;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BrandHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.teal} />
        }
      >
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>
            {discoveries.length} SAVE{discoveries.length === 1 ? '' : 'S'}
            {destinationCount > 0 ? ` · ${destinationCount} DESTINATION${destinationCount === 1 ? '' : 'S'}` : ''}
          </Text>
          <Text style={styles.heading}>Everything that's caught your eye</Text>
        </View>

        <View style={styles.intakeRow}>
          <View style={styles.pasteBox}>
            <Ionicons name="link-outline" size={14} color="#6B7280" />
            <TextInput
              value={pasteValue}
              onChangeText={setPasteValue}
              onSubmitEditing={handlePasteAdd}
              placeholder="Paste a link — IG, TikTok, Pinterest, anywhere"
              placeholderTextColor="#9CA3AF"
              style={styles.pasteInput}
              autoCapitalize="none"
            />
            <Pressable onPress={handlePasteAdd}>
              <LinearGradient colors={GRADIENT.colors} start={GRADIENT.start} end={GRADIENT.end} style={styles.addBtn}>
                <Text style={styles.addBtnText}>Add</Text>
              </LinearGradient>
            </Pressable>
          </View>
          <Pressable
            onPress={() => setModal({ mode: 'create', sourceUrl: '', platform: 'manual' })}
            style={styles.quickAddBtn}
          >
            <Text style={styles.quickAddText}>+ Quick add</Text>
          </Pressable>
        </View>

        {discoveries.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <Pressable
              onPress={() => setThemeFilter('all')}
              style={[styles.chip, themeFilter === 'all' && styles.chipActive]}
            >
              <Text style={[styles.chipText, themeFilter === 'all' && styles.chipTextActive]}>All themes</Text>
            </Pressable>
            {THEMES.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setThemeFilter(t.id)}
                style={[styles.chip, themeFilter === t.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, themeFilter === t.id && styles.chipTextActive]}>
                  {t.icon} {t.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : discoveries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyBody}>
              Paste a link from anywhere you found inspiration — Instagram, TikTok, Pinterest, or just type
              it in.
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyBody}>Nothing saved under this theme yet.</Text>
          </View>
        ) : (
          grouped.map(([destination, items]) => (
            <View key={destination} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupDest}>{destination}</Text>
                <Text style={styles.groupCount}>
                  {items.length} save{items.length === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={styles.grid}>
                {items.map((d) => (
                  <DiscoveryCard
                    key={d.id}
                    discovery={d}
                    selected={selected.has(d.id)}
                    onToggleSelect={() => toggleSelect(d.id)}
                    onEdit={() => setModal({ mode: 'edit', discovery: d })}
                    onDelete={() => handleDelete(d.id)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {selected.size > 0 && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkCount}>{selected.size} selected</Text>
          <Pressable onPress={() => Alert.alert('Coming soon', 'Promote to trip is coming soon.')}>
            <LinearGradient colors={GRADIENT.colors} start={GRADIENT.start} end={GRADIENT.end} style={styles.bulkCta}>
              <Text style={styles.bulkCtaText}>Start a trip from these</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      <DiscoveryIntakeModal state={modal} onSave={handleSave} onClose={() => setModal(null)} saving={saving} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.cloud },
  content: { padding: 20, paddingBottom: 40 },
  headerBlock: { marginBottom: 16 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: COLORS.terracotta, marginBottom: 4, fontFamily: FONTS.mono },
  heading: { fontSize: 24, color: COLORS.ink, fontFamily: FONTS.display },
  intakeRow: { gap: 8, marginBottom: 14 },
  pasteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(20,33,61,0.15)',
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
  },
  pasteInput: { flex: 1, fontSize: 13, color: COLORS.ink, fontFamily: FONTS.body },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  addBtnText: { color: '#fff', fontSize: 12, fontFamily: FONTS.bodyBold },
  quickAddBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(20,33,61,0.15)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  quickAddText: { fontSize: 13, color: COLORS.ink, fontFamily: FONTS.bodyBold },
  chipRow: { marginBottom: 18 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(20,33,61,0.15)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  chipText: { fontSize: 12, color: '#6B7280', fontFamily: FONTS.body },
  chipTextActive: { color: '#fff' },
  muted: { color: '#9CA3AF', fontSize: 13, fontFamily: FONTS.body },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(20,33,61,0.2)',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    backgroundColor: COLORS.cloud,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontFamily: FONTS.displayItalic, color: COLORS.ink },
  emptyBody: { color: '#6B7280', fontSize: 13, textAlign: 'center', fontFamily: FONTS.body, lineHeight: 18 },
  group: { marginBottom: 22 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: 'rgba(20,33,61,0.15)',
  },
  groupDest: { fontSize: 11, letterSpacing: 1.5, color: COLORS.ink, fontFamily: FONTS.mono, textTransform: 'uppercase' },
  groupCount: { fontSize: 10, color: COLORS.terracotta, fontFamily: FONTS.mono },
  grid: { gap: 14 },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: COLORS.ink,
  },
  bulkCount: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: FONTS.mono },
  bulkCta: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  bulkCtaText: { color: '#fff', fontSize: 13, fontFamily: FONTS.bodyBold },
});
