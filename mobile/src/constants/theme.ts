import { TextStyle } from 'react-native';

/**
 * Layali design tokens. Dark lounge surfaces, crimson for the one primary action on a screen,
 * gold for amounts and selection. All text colours meet WCAG AA on the card surface.
 */
export const COLORS = {
  // Surfaces (darkest → raised)
  bgPrimary: '#0b0d12',
  bgSecondary: '#10131a',
  bgCard: '#151a24',
  bgSurface: '#1b2130',
  bgInput: '#0f1219',
  bgCardOccupied: '#1d1a12',

  // Borders
  borderSubtle: '#222938',
  borderDefault: '#2d3546',
  borderStrong: '#3a4458',

  // Brand
  primary: '#b3141d', // crimson — primary action only
  primaryHover: '#c81e27',
  primaryPressed: '#8f1017',
  onPrimary: '#ffffff',
  gold: '#d9b44a', // amounts, selection, active tab
  goldSubtle: 'rgba(217, 180, 74, 0.14)',

  // Stations
  kitchen: '#34d399',
  kitchenBg: 'rgba(52, 211, 153, 0.14)',
  bar: '#38bdf8',
  barBg: 'rgba(56, 189, 248, 0.14)',
  shisha: '#fbbf24',
  shishaBg: 'rgba(251, 191, 36, 0.14)',

  // Feedback
  success: '#34d399',
  successBg: 'rgba(52, 211, 153, 0.14)',
  warning: '#fbbf24',
  warningBg: 'rgba(251, 191, 36, 0.14)',
  danger: '#f87171',
  dangerStrong: '#b91c1c',
  dangerBg: 'rgba(248, 113, 113, 0.12)',
  info: '#38bdf8',
  infoBg: 'rgba(56, 189, 248, 0.14)',

  // Table states: free is quiet, in use is gold
  vacant: '#34d399',
  vacantBg: 'rgba(52, 211, 153, 0.14)',
  occupied: '#d9b44a',
  occupiedBg: 'rgba(217, 180, 74, 0.14)',
  billPrinted: '#38bdf8',
  billPrintedBg: 'rgba(56, 189, 248, 0.14)',

  // Text (contrast on bgCard: primary 15:1, secondary 9:1, muted 5.6:1)
  textPrimary: '#f4f6fa',
  textSecondary: '#b8c1d1',
  textMuted: '#8b95a8',
  textDim: '#6b7487', // disabled only
};

/** Spacing scale (4-pt grid) */
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
/** @deprecated use SPACE */
export const SPACING = SPACE;

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 };
/** @deprecated use RADIUS */
export const RADII = RADIUS;

/** Minimum touch target and comfortable primary button height */
export const TOUCH = { min: 48, large: 56 };

/** Type scale. Nothing smaller than 12 (badges); body copy is 15. */
export const TYPE: Record<'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'label' | 'caption' | 'badge', TextStyle> = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  badge: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
};

/** Station colour pair for badges and accents */
export function stationColors(station: string): { fg: string; bg: string; short: string } {
  if (station === 'Kitchen') return { fg: COLORS.kitchen, bg: COLORS.kitchenBg, short: 'Kitchen' };
  if (station === 'Beverage Counter') return { fg: COLORS.bar, bg: COLORS.barBg, short: 'Bar' };
  return { fg: COLORS.shisha, bg: COLORS.shishaBg, short: 'Shisha' };
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Owner / Admin',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  CAPTAIN: 'Captain',
  KITCHEN_CHEF: 'Kitchen',
  SHISHA_MASTER: 'Shisha Master',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** Example address shown as a placeholder only — never used as a default */
export const SERVER_URL_PLACEHOLDER = 'http://192.168.1.50:3001';
