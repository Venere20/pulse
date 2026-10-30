export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  success: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  info: string;
  overlay: string;
}

export const darkPalette: Palette = {
  bg: '#141118',
  surface: '#29222F',
  surfaceAlt: '#342A3B',
  border: '#473948',

  text: '#F6EFF4',
  textMuted: '#C4B6C4',
  textFaint: '#A99AAB',

  primary: '#E99BB0',
  onPrimary: '#281823',
  primarySoft: '#473044',

  success: '#4ADE80',
  danger: '#FF7B86',
  dangerSoft: '#43262F',
  warning: '#FBBF24',
  info: '#8EADFF',

  overlay: 'rgba(10, 7, 14, 0.72)',
};

export const lightPalette: Palette = {
  bg: '#FBF8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F4EEF2',
  border: '#E5DCE3',
  text: '#1C1722',
  textMuted: '#585162',
  textFaint: '#7A7385',
  primary: '#D81B5C',
  onPrimary: '#FFFFFF',
  primarySoft: '#FFE3EC',
  success: '#15803D',
  danger: '#C62828',
  dangerSoft: '#FDE8E8',
  warning: '#B45309',
  info: '#1D4ED8',
  overlay: 'rgba(20,10,25,0.45)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 22, xl: 28, pill: 999 } as const;

// Dimensioni testo: minimo 14 (12 solo per le etichette della tab bar, sempre accompagnate da icona)
export const font = {
  tab: 12,
  caption: 14,
  body: 16,
  title: 18,
  h2: 24,
  h1: 30,
  display: 44,
} as const;

// Colori per distinguere gli incontri nel calendario
export const visitColors = ['#FF4D85', '#7C9CFF', '#2DD4BF', '#FBBF24', '#C084FC', '#FB923C'];

export const MIN_TOUCH = 44;
