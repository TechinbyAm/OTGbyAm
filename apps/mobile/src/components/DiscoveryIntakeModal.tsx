import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DestinationInput } from '@/components/DestinationInput';
import KeyboardAvoidingAnimatedView from '@/components/KeyboardAvoidingAnimatedView';
import { COLORS, FONTS, GRADIENT } from '@/utils/theme';
import type { Discovery } from '@/utils/discoveries';

export type ModalState =
  | { mode: 'create'; sourceUrl: string; platform: string }
  | { mode: 'edit'; discovery: Discovery };

export function DiscoveryIntakeModal({
  state,
  onSave,
  onClose,
  saving,
}: {
  state: ModalState | null;
  onSave: (destination: string, notes: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!state) return;
    if (state.mode === 'edit') {
      setDestination(state.discovery.destination);
      setNotes(state.discovery.notes);
    } else {
      setDestination('');
      setNotes('');
    }
  }, [state]);

  const isEdit = state?.mode === 'edit';
  const sourceUrl = state ? (state.mode === 'edit' ? state.discovery.sourceUrl : state.sourceUrl) : '';

  return (
    <Modal visible={!!state} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingAnimatedView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {isEdit ? 'Edit discovery' : sourceUrl ? 'Save this' : 'Quick add'}
          </Text>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
            <Ionicons name="close" size={20} color={COLORS.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!!sourceUrl && (
            <View style={styles.sourceBox}>
              <Text style={styles.sourceText} numberOfLines={2}>
                {sourceUrl}
              </Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Destination</Text>
            <DestinationInput value={destination} onChange={setDestination} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Why I saved this</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="One line is plenty"
              placeholderTextColor="#9CA3AF"
              style={styles.textarea}
              multiline
              numberOfLines={2}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => onSave(destination, notes)}
            disabled={saving || !destination.trim()}
            style={{ opacity: saving || !destination.trim() ? 0.5 : 1 }}
          >
            <LinearGradient
              colors={GRADIENT.colors}
              start={GRADIENT.start}
              end={GRADIENT.end}
              style={styles.saveButton}
            >
              <Text style={styles.saveText}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingAnimatedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, color: COLORS.ink, fontFamily: FONTS.display },
  closeButton: { padding: 4 },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
  sourceBox: {
    backgroundColor: COLORS.cloud,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sourceText: { fontSize: 11, color: '#6B7280', fontFamily: FONTS.mono },
  field: { gap: 4 },
  label: { fontSize: 13, fontFamily: FONTS.bodyBold, color: COLORS.ink },
  textarea: {
    borderWidth: 1,
    borderColor: 'rgba(20,33,61,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.ink,
    fontFamily: FONTS.body,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelButton: { paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
  cancelText: { fontSize: 14, color: COLORS.ink, fontFamily: FONTS.bodyBold },
  saveButton: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 999 },
  saveText: { color: '#fff', fontSize: 14, fontFamily: FONTS.bodyBold },
});
