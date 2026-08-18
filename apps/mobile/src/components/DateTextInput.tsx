import { useEffect, useState } from 'react';
import { TextInput, type StyleProp, type TextStyle } from 'react-native';
import { displayToIsoDate, isoToDisplayDate } from '@/utils/dateFormat';

// A plain-text date field that displays/accepts DD-MM-YYYY (optionally with
// a trailing " HH:MM" for datetime fields) while the value it reports back
// stays ISO (YYYY-MM-DD[ HH:MM]) — the format every other date field, sort,
// and API call in the app expects.
export function DateTextInput({
  value,
  onChangeValue,
  placeholder = 'DD-MM-YYYY',
  style,
  placeholderTextColor = '#9CA3AF',
}: {
  value: string;
  onChangeValue: (iso: string) => void;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  placeholderTextColor?: string;
}) {
  const [display, setDisplay] = useState(() => isoToDisplayDate(value));

  useEffect(() => {
    setDisplay(isoToDisplayDate(value));
  }, [value]);

  return (
    <TextInput
      value={display}
      onChangeText={(text) => {
        setDisplay(text);
        const iso = displayToIsoDate(text);
        if (iso) onChangeValue(iso);
      }}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      style={style}
    />
  );
}
