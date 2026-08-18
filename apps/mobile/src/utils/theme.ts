export const COLORS = {
  ink: '#14213D',
  cloud: '#F7F5F1',
  teal: '#2C5F5A',
  navy: '#07325f',
  gold: '#C9A227',
  terracotta: '#C4622A',
  border: 'rgba(20,33,61,0.12)',
};

// Matches the web app's `linear-gradient(135deg, #2C5F5A 0%, #07325f 60%)`.
// react-native-linear-gradient expresses angle as start/end coordinate pairs
// rather than degrees; these approximate a 135deg diagonal.
export const GRADIENT = {
  colors: [COLORS.teal, COLORS.navy] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export const FONTS = {
  display: 'PlayfairDisplay_600SemiBold',
  displayBold: 'PlayfairDisplay_700Bold',
  displayItalic: 'PlayfairDisplay_500Medium_Italic',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
};
