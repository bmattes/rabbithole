// mobile/lib/theme.ts

export const colors = {
  // Backgrounds
  bg: '#f9f9f7',
  bgCard: '#ffffff',
  bgCardAlt: '#f3f3f1',
  bgInput: '#f3f3f1',

  // Borders
  border: '#e5e5e5',
  borderStrong: '#d0d0d0',

  // Text
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textInverse: '#ffffff',

  // Brand
  accent: '#7c3aed',
  accentLight: '#ede9fe',
  accentMuted: '#7c3aed22',

  // Difficulty
  easy: '#22c55e',
  easyBg: '#f0fdf4',
  medium: '#d97706',
  mediumBg: '#fffbeb',
  hard: '#dc2626',
  hardBg: '#fef2f2',

  // Status
  success: '#22c55e',
  warning: '#d97706',
  error: '#dc2626',

  // Tab bar
  tabBar: '#ffffff',
  tabBorder: '#e5e5e5',
  tabActive: '#7c3aed',
  tabInactive: '#999999',
}

export const typography = {
  titleLg: { fontSize: 32, fontWeight: '800' as const, color: colors.textPrimary, letterSpacing: -0.5 },
  titleMd: { fontSize: 24, fontWeight: '800' as const, color: colors.textPrimary },
  titleSm: { fontSize: 18, fontWeight: '700' as const, color: colors.textPrimary },
  bodyLg: { fontSize: 16, color: colors.textPrimary },
  bodyMd: { fontSize: 14, color: colors.textPrimary },
  bodySm: { fontSize: 13, color: colors.textSecondary },
  label: { fontSize: 11, fontWeight: '700' as const, color: colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  mono: { fontSize: 13, fontFamily: 'monospace', color: colors.textSecondary },
}

export const layout = {
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  cardSm: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
}
