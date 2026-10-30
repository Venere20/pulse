import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Palette, darkPalette, spacing, radius, font } from './tokens';

interface ThemeValue {
  c: Palette;
  isDark: boolean;
  s: typeof spacing;
  r: typeof radius;
  f: typeof font;
}

const ThemeContext = createContext<ThemeValue>({
  c: darkPalette,
  isDark: true,
  s: spacing,
  r: radius,
  f: font,
});

// Il redesign usa il tema scuro del riferimento su tutte le piattaforme.
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isDark = true;
  const value = useMemo<ThemeValue>(
    () => ({ c: darkPalette, isDark, s: spacing, r: radius, f: font }),
    [isDark]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

/** Crea StyleSheet dipendenti dal tema, ricalcolati solo al cambio di tema. */
export function useStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (t: ThemeValue) => T
): T {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
}
