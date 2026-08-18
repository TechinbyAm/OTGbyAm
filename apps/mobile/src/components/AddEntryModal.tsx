import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import KeyboardAvoidingAnimatedView from '@/components/KeyboardAvoidingAnimatedView';
import { COLORS, FONTS, GRADIENT } from '@/utils/theme';
import {
  createActivity,
  createStay,
  createTicket,
  createTransportation,
  deleteActivity,
  deleteStay,
  deleteTicket,
  deleteTransportation,
  parseAttachment,
  parseConfirmationText,
  parseUrl,
  summarizeBookings,
  updateActivity,
  updateStay,
  updateTicket,
  updateTransportation,
  withDuplicateNote,
} from '@/utils/tripDetail';

type AddTab = 'url' | 'text' | 'manual';
type ManualType = 'stay' | 'transportation' | 'ticket' | 'activity';
export type EditEntry = { type: ManualType; id: string; data: any };

const MODAL_TABS: { id: AddTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'url', label: 'From URL', icon: 'globe-outline' },
  { id: 'text', label: 'Paste text', icon: 'clipboard-outline' },
  { id: 'manual', label: 'Manual', icon: 'create-outline' },
];

const MANUAL_TYPES: { id: ManualType; label: string }[] = [
  { id: 'stay', label: 'Stay' },
  { id: 'transportation', label: 'Flight / Transfer' },
  { id: 'ticket', label: 'Ticket / Tour' },
  { id: 'activity', label: 'Activity' },
];

export function AddEntryModal({
  visible,
  tripId,
  editEntry,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  tripId: string;
  editEntry?: EditEntry | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEditing = !!editEntry;
  const [tab, setTab] = useState<AddTab>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [manualType, setManualType] = useState<ManualType>(editEntry?.type || 'stay');
  const [pending, setPending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [stayForm, setStayForm] = useState({
    name: '',
    checkInDate: '',
    checkOutDate: '',
    address: '',
    confirmationNumber: '',
    notes: '',
  });
  const [transportForm, setTransportForm] = useState({
    type: 'flight',
    departureLocation: '',
    arrivalLocation: '',
    departureTime: '',
    arrivalTime: '',
    confirmationNumber: '',
    notes: '',
  });
  const [ticketForm, setTicketForm] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
    confirmationNumber: '',
    notes: '',
  });
  const [activityForm, setActivityForm] = useState({
    date: '',
    time: '',
    title: '',
    description: '',
    location: '',
  });

  useEffect(() => {
    if (!editEntry) return;
    setTab('manual');
    setManualType(editEntry.type);
    if (editEntry.type === 'stay') {
      setStayForm({
        name: '',
        checkInDate: '',
        checkOutDate: '',
        address: '',
        confirmationNumber: '',
        notes: '',
        ...editEntry.data,
      });
    } else if (editEntry.type === 'transportation') {
      setTransportForm({
        type: 'flight',
        departureLocation: '',
        arrivalLocation: '',
        departureTime: '',
        arrivalTime: '',
        confirmationNumber: '',
        notes: '',
        ...editEntry.data,
      });
    } else if (editEntry.type === 'ticket') {
      setTicketForm({
        name: '',
        date: '',
        time: '',
        location: '',
        confirmationNumber: '',
        notes: '',
        ...editEntry.data,
      });
    } else {
      setActivityForm({ date: '', time: '', title: '', description: '', location: '', ...editEntry.data });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEntry?.id]);

  const reset = () => {
    setTab('url');
    setUrl('');
    setText('');
  };

  const pickAndUploadAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingAttachment(true);
    try {
      const fileBase64 =
        Platform.OS === 'web' && (asset as unknown as { file?: File }).file
          ? await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
              };
              reader.onerror = reject;
              reader.readAsDataURL((asset as unknown as { file: File }).file);
            })
          : await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      const mimeType = asset.mimeType || 'application/pdf';
      const data = await parseAttachment(tripId, fileBase64, mimeType);
      onSuccess();
      reset();
      onClose();
      Alert.alert('Parsed', withDuplicateNote(`Added from file: ${summarizeBookings(data.types)}`, data.duplicateCount));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not parse that file.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleSave = async () => {
    setPending(true);
    try {
      if (isEditing && editEntry) {
        if (editEntry.type === 'stay') await updateStay(tripId, editEntry.id, stayForm);
        else if (editEntry.type === 'transportation') await updateTransportation(tripId, editEntry.id, transportForm);
        else if (editEntry.type === 'ticket') await updateTicket(tripId, editEntry.id, ticketForm);
        else await updateActivity(tripId, editEntry.id, activityForm);
      } else if (tab === 'url') {
        const data = await parseUrl(tripId, url);
        Alert.alert('Parsed', withDuplicateNote(`Added from URL: ${summarizeBookings(data.types)}`, data.duplicateCount));
      } else if (tab === 'text') {
        const data = await parseConfirmationText(tripId, text);
        Alert.alert('Parsed', withDuplicateNote(`Added from text: ${summarizeBookings(data.types)}`, data.duplicateCount));
      } else if (manualType === 'stay') {
        await createStay(tripId, stayForm);
      } else if (manualType === 'transportation') {
        await createTransportation(tripId, transportForm);
      } else if (manualType === 'ticket') {
        await createTicket(tripId, ticketForm);
      } else {
        await createActivity(tripId, activityForm);
      }
      onSuccess();
      reset();
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  };

  const handleDelete = () => {
    if (!editEntry) return;
    Alert.alert('Delete this entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setPending(true);
          try {
            if (editEntry.type === 'stay') await deleteStay(tripId, editEntry.id);
            else if (editEntry.type === 'transportation') await deleteTransportation(tripId, editEntry.id);
            else if (editEntry.type === 'ticket') await deleteTicket(tripId, editEntry.id);
            else await deleteActivity(tripId, editEntry.id);
            onSuccess();
            onClose();
          } catch {
            Alert.alert('Error', 'Could not delete.');
          } finally {
            setPending(false);
          }
        },
      },
    ]);
  };

  const canSave =
    tab === 'url'
      ? url.trim().length > 0
      : tab === 'text'
        ? text.trim().length > 0
        : manualType === 'stay'
          ? stayForm.name.trim().length > 0
          : manualType === 'transportation'
            ? transportForm.departureLocation.trim().length > 0
            : manualType === 'ticket'
              ? ticketForm.name.trim().length > 0
              : activityForm.title.trim().length > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingAnimatedView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {isEditing
              ? `Edit ${MANUAL_TYPES.find((mt) => mt.id === editEntry!.type)?.label || 'entry'}`
              : 'Add to trip'}
          </Text>
          <Pressable
            onPress={() => {
              reset();
              onClose();
            }}
            style={styles.closeButton}
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color={COLORS.ink} />
          </Pressable>
        </View>

        {!isEditing && (
        <View style={styles.tabRow}>
          {MODAL_TABS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[styles.tabButton, tab === t.id && styles.tabButtonActive]}
            >
              <Ionicons name={t.icon} size={13} color={tab === t.id ? '#fff' : '#6B6B6B'} />
              <Text style={[styles.tabButtonText, tab === t.id && styles.tabButtonTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
        )}

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {tab === 'url' && (
            <View style={{ gap: 10 }}>
              <Text style={styles.hint}>
                Paste a booking URL — hotel page, flight confirmation, tour listing — Gemini will
                extract and save the details.
              </Text>
              <TextInput
                value={url}
                onChangeText={setUrl}
                placeholder="https://booking.com/..."
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                autoCapitalize="none"
                autoFocus
              />
            </View>
          )}

          {tab === 'text' && (
            <View style={{ gap: 10 }}>
              <Text style={styles.hint}>
                Paste the full text of a confirmation email, receipt, or itinerary. Gemini will
                parse it automatically.
              </Text>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Paste confirmation text here…"
                placeholderTextColor="#9CA3AF"
                style={[styles.input, styles.textarea]}
                multiline
              />
            </View>
          )}

          {tab === 'manual' && (
            <View style={{ gap: 14 }}>
              {!isEditing && (
                <>
                  <Pressable
                    style={styles.uploadBox}
                    onPress={pickAndUploadAttachment}
                    disabled={uploadingAttachment}
                  >
                    {uploadingAttachment ? (
                      <ActivityIndicator color={COLORS.teal} size="small" />
                    ) : (
                      <Ionicons name="add" size={15} color={COLORS.teal} />
                    )}
                    <Text style={styles.uploadBoxText}>
                      {uploadingAttachment ? 'Parsing file…' : 'Upload a confirmation PDF or photo'}
                    </Text>
                    <Text style={styles.uploadBoxHint}>
                      We'll detect whether it's a stay, flight, or ticket automatically
                    </Text>
                  </Pressable>

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or fill in the details</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <View style={styles.chipRow}>
                    {MANUAL_TYPES.map((mt) => {
                      const active = manualType === mt.id;
                      return (
                        <Pressable
                          key={mt.id}
                          onPress={() => setManualType(mt.id)}
                          style={[styles.typeChip, active && styles.typeChipActive]}
                        >
                          <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                            {mt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              {manualType === 'stay' && (
                <View style={{ gap: 10 }}>
                  <Field label="Hotel / property name *">
                    <TextInput
                      value={stayForm.name}
                      onChangeText={(v) => setStayForm((f) => ({ ...f, name: v }))}
                      placeholder="e.g. Villa Rosa"
                      placeholderTextColor="#9CA3AF"
                      style={styles.input}
                    />
                  </Field>
                  <View style={styles.row}>
                    <Field label="Check-in" style={styles.flex1}>
                      <DateTextInput
                        value={stayForm.checkInDate}
                        onChangeValue={(v) => setStayForm((f) => ({ ...f, checkInDate: v }))}
                        style={styles.input}
                      />
                    </Field>
                    <Field label="Check-out" style={styles.flex1}>
                      <DateTextInput
                        value={stayForm.checkOutDate}
                        onChangeValue={(v) => setStayForm((f) => ({ ...f, checkOutDate: v }))}
                        style={styles.input}
                      />
                    </Field>
                  </View>
                  <Field label="Address">
                    <TextInput
                      value={stayForm.address}
                      onChangeText={(v) => setStayForm((f) => ({ ...f, address: v }))}
                      placeholder="Street, city"
                      placeholderTextColor="#9CA3AF"
                      style={styles.input}
                    />
                  </Field>
                  <Field label="Confirmation #">
                    <TextInput
                      value={stayForm.confirmationNumber}
                      onChangeText={(v) => setStayForm((f) => ({ ...f, confirmationNumber: v }))}
                      style={styles.input}
                      placeholderTextColor="#9CA3AF"
                    />
                  </Field>
                  <Field label="Notes">
                    <TextInput
                      value={stayForm.notes}
                      onChangeText={(v) => setStayForm((f) => ({ ...f, notes: v }))}
                      style={[styles.input, styles.textareaSmall]}
                      multiline
                      placeholderTextColor="#9CA3AF"
                    />
                  </Field>
                </View>
              )}

              {manualType === 'transportation' && (
                <View style={{ gap: 10 }}>
                  <View style={styles.row}>
                    <Field label="From *" style={styles.flex1}>
                      <TextInput
                        value={transportForm.departureLocation}
                        onChangeText={(v) => setTransportForm((f) => ({ ...f, departureLocation: v }))}
                        placeholder="City or airport"
                        placeholderTextColor="#9CA3AF"
                        style={styles.input}
                      />
                    </Field>
                    <Field label="To" style={styles.flex1}>
                      <TextInput
                        value={transportForm.arrivalLocation}
                        onChangeText={(v) => setTransportForm((f) => ({ ...f, arrivalLocation: v }))}
                        placeholder="City or airport"
                        placeholderTextColor="#9CA3AF"
                        style={styles.input}
                      />
                    </Field>
                  </View>
                  <View style={styles.row}>
                    <Field label="Departs" style={styles.flex1}>
                      <DateTextInput
                        value={transportForm.departureTime}
                        onChangeValue={(v) => setTransportForm((f) => ({ ...f, departureTime: v }))}
                        placeholder="DD-MM-YYYY HH:MM"
                        style={styles.input}
                      />
                    </Field>
                    <Field label="Arrives" style={styles.flex1}>
                      <DateTextInput
                        value={transportForm.arrivalTime}
                        onChangeValue={(v) => setTransportForm((f) => ({ ...f, arrivalTime: v }))}
                        placeholder="DD-MM-YYYY HH:MM"
                        style={styles.input}
                      />
                    </Field>
                  </View>
                  <Field label="Confirmation #">
                    <TextInput
                      value={transportForm.confirmationNumber}
                      onChangeText={(v) => setTransportForm((f) => ({ ...f, confirmationNumber: v }))}
                      style={styles.input}
                      placeholderTextColor="#9CA3AF"
                    />
                  </Field>
                  <Field label="Notes">
                    <TextInput
                      value={transportForm.notes}
                      onChangeText={(v) => setTransportForm((f) => ({ ...f, notes: v }))}
                      style={[styles.input, styles.textareaSmall]}
                      multiline
                      placeholderTextColor="#9CA3AF"
                    />
                  </Field>
                </View>
              )}

              {manualType === 'ticket' && (
                <View style={{ gap: 10 }}>
                  <Field label="Name / event *">
                    <TextInput
                      value={ticketForm.name}
                      onChangeText={(v) => setTicketForm((f) => ({ ...f, name: v }))}
                      placeholder="e.g. Colosseum tour"
                      placeholderTextColor="#9CA3AF"
                      style={styles.input}
                    />
                  </Field>
                  <View style={styles.row}>
                    <Field label="Date" style={styles.flex1}>
                      <DateTextInput
                        value={ticketForm.date}
                        onChangeValue={(v) => setTicketForm((f) => ({ ...f, date: v }))}
                        style={styles.input}
                      />
                    </Field>
                    <Field label="Time" style={styles.flex1}>
                      <TextInput
                        value={ticketForm.time}
                        onChangeText={(v) => setTicketForm((f) => ({ ...f, time: v }))}
                        placeholder="HH:MM"
                        placeholderTextColor="#9CA3AF"
                        style={styles.input}
                      />
                    </Field>
                  </View>
                  <Field label="Location">
                    <TextInput
                      value={ticketForm.location}
                      onChangeText={(v) => setTicketForm((f) => ({ ...f, location: v }))}
                      style={styles.input}
                      placeholderTextColor="#9CA3AF"
                    />
                  </Field>
                  <Field label="Confirmation #">
                    <TextInput
                      value={ticketForm.confirmationNumber}
                      onChangeText={(v) => setTicketForm((f) => ({ ...f, confirmationNumber: v }))}
                      style={styles.input}
                      placeholderTextColor="#9CA3AF"
                    />
                  </Field>
                  <Field label="Notes">
                    <TextInput
                      value={ticketForm.notes}
                      onChangeText={(v) => setTicketForm((f) => ({ ...f, notes: v }))}
                      style={[styles.input, styles.textareaSmall]}
                      multiline
                      placeholderTextColor="#9CA3AF"
                    />
                  </Field>
                </View>
              )}

              {manualType === 'activity' && (
                <View style={{ gap: 10 }}>
                  <Field label="Title *">
                    <TextInput
                      value={activityForm.title}
                      onChangeText={(v) => setActivityForm((f) => ({ ...f, title: v }))}
                      placeholder="e.g. Morning hike"
                      placeholderTextColor="#9CA3AF"
                      style={styles.input}
                    />
                  </Field>
                  <View style={styles.row}>
                    <Field label="Date" style={styles.flex1}>
                      <DateTextInput
                        value={activityForm.date}
                        onChangeValue={(v) => setActivityForm((f) => ({ ...f, date: v }))}
                        style={styles.input}
                      />
                    </Field>
                    <Field label="Time" style={styles.flex1}>
                      <TextInput
                        value={activityForm.time}
                        onChangeText={(v) => setActivityForm((f) => ({ ...f, time: v }))}
                        placeholder="HH:MM"
                        placeholderTextColor="#9CA3AF"
                        style={styles.input}
                      />
                    </Field>
                  </View>
                  <Field label="Location">
                    <TextInput
                      value={activityForm.location}
                      onChangeText={(v) => setActivityForm((f) => ({ ...f, location: v }))}
                      style={styles.input}
                      placeholderTextColor="#9CA3AF"
                    />
                  </Field>
                  <Field label="Description">
                    <TextInput
                      value={activityForm.description}
                      onChangeText={(v) => setActivityForm((f) => ({ ...f, description: v }))}
                      style={[styles.input, styles.textareaSmall]}
                      multiline
                      placeholderTextColor="#9CA3AF"
                    />
                  </Field>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {isEditing && (
            <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={pending}>
              <Ionicons name="trash-outline" size={16} color={COLORS.terracotta} />
            </Pressable>
          )}
          <Pressable
            style={styles.cancelButton}
            onPress={() => {
              reset();
              onClose();
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.flex1} onPress={handleSave} disabled={!canSave || pending}>
            <LinearGradient
              colors={GRADIENT.colors}
              start={GRADIENT.start}
              end={GRADIENT.end}
              style={[styles.saveButton, (!canSave || pending) && styles.saveButtonDisabled]}
            >
              {pending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isEditing ? 'Save changes' : tab === 'url' ? 'Parse URL' : tab === 'text' ? 'Parse & Save' : 'Add'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingAnimatedView>
    </Modal>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
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
  },
  headerTitle: { fontSize: 20, color: COLORS.ink, fontFamily: FONTS.display },
  closeButton: { padding: 6, borderRadius: 999, backgroundColor: '#F3F4F6' },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 16 },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(20,33,61,0.05)',
  },
  tabButtonActive: { backgroundColor: COLORS.navy },
  tabButtonText: { fontSize: 11, color: '#6B6B6B', fontFamily: FONTS.bodyMedium },
  tabButtonTextActive: { color: '#fff' },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  hint: { fontSize: 13, color: '#6B7280', fontFamily: FONTS.body, lineHeight: 19 },
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
  textarea: { minHeight: 140, textAlignVertical: 'top', fontFamily: FONTS.mono, fontSize: 12 },
  textareaSmall: { minHeight: 60, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 11, letterSpacing: 0.5, color: '#6B7280', textTransform: 'uppercase', fontFamily: FONTS.mono },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(44,95,90,0.3)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
  },
  uploadBoxText: { fontSize: 13, color: COLORS.teal, fontFamily: FONTS.bodyMedium },
  uploadBoxHint: { fontSize: 11, color: '#9CA3AF', fontFamily: FONTS.body, textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(20,33,61,0.1)' },
  dividerText: { fontSize: 11, color: '#9CA3AF', fontFamily: FONTS.body },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: {
    borderWidth: 1,
    borderColor: 'rgba(20,33,61,0.15)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  typeChipActive: { borderColor: COLORS.teal, backgroundColor: 'rgba(44,95,90,0.08)' },
  typeChipText: { fontSize: 12, color: '#6B6B6B', fontFamily: FONTS.bodyMedium },
  typeChipTextActive: { color: COLORS.teal },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: 'rgba(196,98,42,0.3)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(20,33,61,0.2)',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 14, color: '#6B7280', fontFamily: FONTS.bodyMedium },
  saveButton: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontSize: 14, fontFamily: FONTS.bodyBold },
});
