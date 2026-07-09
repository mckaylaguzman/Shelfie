import { useColorScheme } from '@/hooks/use-color-scheme';

/** Vintage cozy palette — cream, warm brown, dusty blue, olive, terracotta. */
export const palette = {
  light: {
    background: '#F2EFE6',
    card: '#FAF7F0',
    text: '#4A3F35',
    textSecondary: '#7A6455',
    border: '#B8C8D4',
    input: '#FAF7F0',
    placeholder: '#9A8778',
    primary: '#C17B5A',
    primaryPressed: '#A8664A',
    onPrimary: '#FAF7F0',
    star: '#C17B5A',
    starEmpty: '#D4DCE4',
    /** Section tags — dusty blue */
    pink: '#B8C8D4',
    /** Stats highlights — olive */
    mint: '#8B8768',
    danger: '#B85C4A',
    shadow: '#4A3F35',
    warmBrown: '#7A6455',
    dustyBlue: '#B8C8D4',
    olive: '#8B8768',
    terracotta: '#C17B5A',
  },
  dark: {
    background: '#2E2822',
    card: '#3A332C',
    text: '#F2EFE6',
    textSecondary: '#C4B5A5',
    border: '#6A7884',
    input: '#3A332C',
    placeholder: '#9A8778',
    primary: '#D4926F',
    primaryPressed: '#C17B5A',
    onPrimary: '#FAF7F0',
    star: '#D4926F',
    starEmpty: '#5A6670',
    pink: '#8A9AA8',
    mint: '#9A9678',
    danger: '#D47A6A',
    shadow: '#1A1510',
    warmBrown: '#C4B5A5',
    dustyBlue: '#8A9AA8',
    olive: '#9A9678',
    terracotta: '#D4926F',
  },
} as const;

export type ColorScheme = keyof typeof palette;
export type ThemeColors = (typeof palette)['light'] | (typeof palette)['dark'];

export const radii = {
  card: 20,
  button: 16,
  input: 14,
} as const;

export function getThemeColors(colorScheme: ColorScheme): ThemeColors {
  return palette[colorScheme];
}

export function useThemeColors(): ThemeColors {
  const colorScheme = (useColorScheme() ?? 'light') as ColorScheme;
  return getThemeColors(colorScheme);
}

export function cardShadow(colorScheme: ColorScheme) {
  return {
    shadowColor: palette[colorScheme].shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: colorScheme === 'light' ? 0.1 : 0.22,
    shadowRadius: 14,
    elevation: 3,
  };
}

export function fabShadow(colorScheme: ColorScheme) {
  return {
    shadowColor: palette[colorScheme].shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: colorScheme === 'light' ? 0.14 : 0.28,
    shadowRadius: 12,
    elevation: 5,
  };
}

export function cardStyle(colorScheme: ColorScheme) {
  return {
    backgroundColor: palette[colorScheme].card,
    borderRadius: radii.card,
    ...cardShadow(colorScheme),
  };
}
