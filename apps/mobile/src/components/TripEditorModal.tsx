import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DateTextInput } from '@/components/DateTextInput';
import { DestinationInput } from '@/components/DestinationInput';
import KeyboardAvoidingAnimatedView from '@/components/KeyboardAvoidingAnimatedView';
import { COLORS, FONTS, GRADIENT } from '@/utils/theme';
import { THEMES, type AffiliateLink, type Trip } from '@/utils/trips';

export function TripEditorModal({
  visible,
  trip,
  onSave,
  onClose,
}: {
  visible: boolean;
  trip: Trip | null;
  onSave: (trip: Trip) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Trip | null>(trip);

  useEffect(() => {
    setForm(trip);
  }, [trip]);

  if (!form) return null;

  const set = <K extends keyof Trip>(k: K, v: Trip[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const addLink = () => set('affiliateLinks', [...(form.affiliateLinks || []), { label: '', url: '' }]);
  const updateLink = (i: number, k: keyof AffiliateLink, v: string) => {
    const links = [...form.affiliateLinks];
    links[i] = { ...links[i], [k]: v };
    set('affiliateLinks', links);
  };
  const removeLink = (i: number) =>
    set(
      'affiliateLinks',
      form.affiliateLinks.filter((_, idx) => idx !== i)
    );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingAnimatedView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{trip?.title ? 'Edit trip' : 'New trip'}</Text>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
            <Ionicons name="close" size={20} color={COLORS.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>Trip title</Text>
            <TextInput
              value={form.title}
              onChangeText={(v) => set('title', v)}
              placeholder="e.g. Amalfi Golden Hour"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Destination</Text>
            <DestinationInput value={form.destination} onChange={(v) => set('destination', v)} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Theme</Text>
            <View style={styles.chipRow}>
              {THEMES.map((t) => {
                const active = form.theme === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => set('theme', t.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t.icon} {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Start date</Text>
              <DateTextInput
                value={form.startDate}
                onChangeValue={(v) => set('startDate', v)}
                style={styles.input}
              />
            </View>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>End date</Text>
              <DateTextInput
                value={form.endDate}
                onChangeValue={(v) => set('endDate', v)}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Capacity (max 10)</Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => set('capacity', Math.max(1, (form.capacity || 1) - 1))}
                  style={styles.stepperButton}
                >
                  <Ionicons name="remove" size={16} color={COLORS.ink} />
                </Pressable>
                <Text style={styles.stepperValue}>{form.capacity}</Text>
                <Pressable
                  onPress={() => set('capacity', Math.min(10, (form.capacity || 1) + 1))}
                  style={styles.stepperButton}
                >
                  <Ionicons name="add" size={16} color={COLORS.ink} />
                </Pressable>
              </View>
            </View>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Price from ($)</Text>
              <TextInput
                value={form.priceFrom}
                onChangeText={(v) => set('priceFrom', v)}
                placeholder="2400"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => set('status', 'draft')}
                style={[
                  styles.statusButton,
                  { borderColor: COLORS.terracotta },
                  form.status === 'draft' && { backgroundColor: 'rgba(196,98,42,0.1)' },
                ]}
              >
                <Ionicons name="lock-closed-outline" size={13} color={COLORS.terracotta} />
                <Text style={[styles.statusButtonText, { color: COLORS.terracotta }]}>
                  Draft (private)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => set('status', 'published')}
                style={[
                  styles.statusButton,
                  { borderColor: COLORS.teal },
                  form.status === 'published' && { backgroundColor: 'rgba(44,95,90,0.1)' },
                ]}
              >
                <Ionicons name="globe-outline" size={13} color={COLORS.teal} />
                <Text style={[styles.statusButtonText, { color: COLORS.teal }]}>Published</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notes / itinerary sketch</Text>
            <TextInput
              value={form.notes}
              onChangeText={(v) => set('notes', v)}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textarea]}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.linksHeader}>
              <Text style={styles.label}>Affiliate links</Text>
              <Pressable onPress={addLink} style={styles.addLinkButton} hitSlop={8}>
                <Ionicons name="add" size={13} color={COLORS.teal} />
                <Text style={styles.addLinkText}>Add link</Text>
              </Pressable>
            </View>
            <View style={{ gap: 8 }}>
              {(form.affiliateLinks || []).map((l, i) => (
                <View key={i} style={styles.linkRow}>
                  <TextInput
                    value={l.label}
                    onChangeText={(v) => updateLink(i, 'label', v)}
                    placeholder="Label"
                    placeholderTextColor="#9CA3AF"
                    style={[styles.input, styles.linkLabelInput]}
                  />
                  <TextInput
                    value={l.url}
                    onChangeText={(v) => updateLink(i, 'url', v)}
                    placeholder="https://..."
                    placeholderTextColor="#9CA3AF"
                    style={[styles.input, styles.flex1]}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => removeLink(i)} style={styles.removeLinkButton} hitSlop={8}>
                    <Ionicons name="close" size={14} color={COLORS.terracotta} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={() => onSave(form)}>
            <LinearGradient
              colors={GRADIENT.colors}
              start={GRADIENT.start}
              end={GRADIENT.end}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>Save trip</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingAnimatedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 20, color: COLORS.ink, fontFamily: FONTS.display },
  closeButton: { padding: 6, borderRadius: 999, backgroundColor: '#F3F4F6' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  field: { gap: 6 },
  label: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#6B7280',
    textTransform: 'uppercase',
    fontFamily: FONTS.mono,
  },
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
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(20,33,61,0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  chipText: { fontSize: 12, color: COLORS.ink, fontFamily: FONTS.body },
  chipTextActive: { color: '#fff' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(20,33,61,0.2)',
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  stepperButton: { padding: 8 },
  stepperValue: { fontSize: 14, color: COLORS.ink, fontFamily: FONTS.bodyBold },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
  },
  statusButtonText: { fontSize: 13, fontFamily: FONTS.bodyMedium },
  linksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addLinkButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addLinkText: { fontSize: 12, color: COLORS.teal, fontFamily: FONTS.body },
  linkRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  linkLabelInput: { width: '32%' },
  removeLinkButton: { padding: 6 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: COLORS.border },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontFamily: FONTS.bodyBold },
});
