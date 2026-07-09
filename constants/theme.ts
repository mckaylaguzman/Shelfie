/**
 * Navigation and hook-facing color tokens derived from the app palette.
 */

import { Platform } from 'react-native';

import { palette } from '@/utils/theme';

export const Colors = {
  light: {
    text: palette.light.text,
    textSecondary: palette.light.textSecondary,
    background: palette.light.background,
    card: palette.light.card,
    tint: palette.light.primary,
    icon: palette.light.textSecondary,
    tabIconDefault: palette.light.textSecondary,
    tabIconSelected: palette.light.primary,
    primary: palette.light.primary,
    link: palette.light.primary,
  },
  dark: {
    text: palette.dark.text,
    textSecondary: palette.dark.textSecondary,
    background: palette.dark.background,
    card: palette.dark.card,
    tint: palette.dark.primary,
    icon: palette.dark.textSecondary,
    tabIconDefault: palette.dark.textSecondary,
    tabIconSelected: palette.dark.primary,
    primary: palette.dark.primary,
    link: palette.dark.primary,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const navigationTheme = {
  light: {
    background: palette.light.background,
    card: palette.light.card,
    text: palette.light.text,
    border: palette.light.border,
    primary: palette.light.primary,
  },
  dark: {
    background: palette.dark.background,
    card: palette.dark.card,
    text: palette.dark.text,
    border: palette.dark.border,
    primary: palette.dark.primary,
  },
};
