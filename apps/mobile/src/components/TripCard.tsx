import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, GRADIENT } from '@/utils/theme';
import { fmtDate, parseItinerary, themeInfo, type Trip } from '@/utils/trips';

export function TripCard({
  trip,
  editable,
  onEdit,
  onDelete,
  onToggleStatus,
  onPress,
}: {
  trip: Trip;
  editable?: boolean;
  onEdit?: (trip: Trip) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (trip: Trip) => void;
  onPress?: () => void;
}) {
  const t = themeInfo(trip.theme);
  const { subtitle, lines } = parseItinerary(trip.notes);

  return (
    <Pressable style={styles.card} onPress={onPress} disabled={!onPress}>
      <LinearGradient
        colors={GRADIENT.colors}
        start={GRADIENT.start}
        end={GRADIENT.end}
        style={styles.header}
      >
        <View style={styles.stamp}>
          <Text style={styles.stampIcon}>{t.icon}</Text>
          <Text style={styles.stampLabel}>{t.label.split(' ')[0]}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.themeLabel}>{t.label}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {trip.title || 'Untitled trip'}
          </Text>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={styles.destination} numberOfLines={1}>
              {trip.destination || 'Destination TBD'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.terracotta} />
            <Text style={styles.metaText}>
              {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}
            </Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="people-outline" size={14} color={COLORS.terracotta} />
            <Text style={styles.metaText}>Up to {trip.capacity || 10}</Text>
          </View>
        </View>

        {!!trip.priceFrom && <Text style={styles.price}>from ${trip.priceFrom}</Text>}

        {!!trip.notes && (
          <View style={styles.itinerary}>
            <Text style={styles.itineraryLabel}>ITINERARY</Text>
            {subtitle && <Text style={styles.itinerarySubtitle}>{subtitle}</Text>}
            {lines.map((line, i) => (
              <View key={i} style={styles.itineraryLine}>
                <View style={styles.itineraryBullet}>
                  <Text style={styles.itineraryBulletText}>{i + 1}</Text>
                </View>
                <Text style={styles.itineraryText} numberOfLines={2}>
                  {line}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Pressable
            onPress={() => onToggleStatus?.(trip)}
            disabled={!editable}
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  trip.status === 'published' ? 'rgba(44,95,90,0.1)' : 'rgba(196,98,42,0.1)',
              },
            ]}
          >
            {editable && (
              <Ionicons
                name={trip.status === 'published' ? 'globe-outline' : 'lock-closed-outline'}
                size={9}
                color={trip.status === 'published' ? COLORS.teal : COLORS.terracotta}
              />
            )}
            <Text
              style={[
                styles.statusText,
                { color: trip.status === 'published' ? COLORS.teal : COLORS.terracotta },
              ]}
            >
              {trip.status === 'published' ? 'PUBLISHED' : 'DRAFT'}
            </Text>
          </Pressable>
          {editable && (
            <View style={styles.actions}>
              <Pressable onPress={() => onEdit?.(trip)} style={styles.iconButton} hitSlop={8}>
                <Ionicons name="create-outline" size={16} color={COLORS.ink} />
              </Pressable>
              <Pressable onPress={() => onDelete?.(trip.id)} style={styles.iconButton} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={COLORS.terracotta} />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Pressable>
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
  header: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
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
  headerText: { flex: 1, gap: 2 },
  themeLabel: { fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,0.6)', fontFamily: FONTS.mono },
  title: { color: '#fff', fontSize: 18, fontFamily: FONTS.displayBold },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  destination: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: FONTS.body },
  body: { padding: 16, gap: 10 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { color: COLORS.ink, fontSize: 13, fontFamily: FONTS.body },
  price: { color: COLORS.teal, fontSize: 13, fontFamily: FONTS.mono },
  itinerary: { gap: 4 },
  itineraryLabel: { fontSize: 9, letterSpacing: 1.5, color: COLORS.gold, fontFamily: FONTS.mono },
  itinerarySubtitle: { fontSize: 12, color: COLORS.ink, fontFamily: FONTS.displayItalic },
  itineraryLine: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  itineraryBullet: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(44,95,90,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  itineraryBulletText: { fontSize: 9, fontFamily: FONTS.bodyBold, color: COLORS.teal },
  itineraryText: { flex: 1, fontSize: 12, color: '#4B5563', fontFamily: FONTS.body },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { fontSize: 10, letterSpacing: 1, fontFamily: FONTS.bodyBold },
  actions: { flexDirection: 'row', gap: 4 },
  iconButton: { padding: 6 },
});
