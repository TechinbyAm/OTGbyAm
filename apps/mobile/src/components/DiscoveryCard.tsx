import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, GRADIENT } from '@/utils/theme';
import { themeInfo } from '@/utils/trips';
import { sourceBadge, type Discovery } from '@/utils/discoveries';

// Photo-free, deliberately — real scraped/synced imagery would clash with
// the app's curated brand aesthetic (decided during the design review for
// the web version of this same feature). Same gradient header + theme-glyph
// stamp TripCard already uses, no image ever rendered.
export function DiscoveryCard({
  discovery,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  discovery: Discovery;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = themeInfo(discovery.themeGuess);
  const isUnthemed = !discovery.themeGuess;

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <LinearGradient
        colors={GRADIENT.colors}
        start={GRADIENT.start}
        end={GRADIENT.end}
        style={styles.header}
      >
        <View style={styles.stamp}>
          <Text style={styles.stampIcon}>{isUnthemed ? '?' : t.icon}</Text>
        </View>
        <Text style={styles.themeLabel}>{isUnthemed ? 'Unthemed' : t.label}</Text>

        {/* Selection checkbox — no native RN checkbox exists, so this is a
            Pressable with real checkbox accessibility semantics (matches the
            web version's real <input type="checkbox">, just RN's own
            equivalent mechanism). */}
        <Pressable
          onPress={onToggleSelect}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel="Select discovery"
          style={styles.selectBox}
        >
          <View style={[styles.selectCircle, selected && styles.selectCircleChecked]}>
            {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
        </Pressable>

        <View style={styles.sourceBadge}>
          <Text style={styles.sourceBadgeText}>{sourceBadge(discovery)}</Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {discovery.title || discovery.destination}
          </Text>
          <View style={styles.actions}>
            <Pressable onPress={onEdit} style={styles.iconButton} hitSlop={8}>
              <Ionicons name="create-outline" size={15} color={COLORS.ink} />
            </Pressable>
            <Pressable onPress={onDelete} style={styles.iconButton} hitSlop={8}>
              <Ionicons name="trash-outline" size={15} color={COLORS.terracotta} />
            </Pressable>
          </View>
        </View>
        <Text style={styles.note} numberOfLines={2}>
          {discovery.notes || (discovery.sourceUrl ? '' : 'Added manually — no source link')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: COLORS.teal,
  },
  header: {
    height: 76,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stamp: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampIcon: { fontSize: 14, color: '#fff' },
  themeLabel: {
    flex: 1,
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: FONTS.mono,
    textTransform: 'uppercase',
  },
  selectBox: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(20,33,61,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleChecked: {
    borderWidth: 0,
    backgroundColor: COLORS.teal,
  },
  sourceBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(247,245,241,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceBadgeText: { fontSize: 9, fontFamily: FONTS.mono, color: COLORS.ink },
  body: { padding: 14, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 15, color: COLORS.ink, fontFamily: FONTS.displayBold },
  actions: { flexDirection: 'row', gap: 6, marginTop: 1 },
  iconButton: { padding: 2 },
  note: { fontSize: 12, color: '#6B7280', fontFamily: FONTS.body, fontStyle: 'italic', lineHeight: 16 },
});
