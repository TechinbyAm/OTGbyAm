import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { FONTS } from '@/utils/theme';

export function BrandHeader() {
  return (
    <View style={styles.row}>
      <Ionicons name="compass-outline" size={18} color="#023047" />
      <Text style={styles.text}>
        <Text style={styles.navy}>On The Go</Text> <Text style={styles.orange}>by Am</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10 },
  text: { fontSize: 16, fontFamily: FONTS.displayBold },
  navy: { color: '#023047' },
  orange: { color: '#fb8500' },
});
