import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, DarkColors, ThemeColors } from '../theme/tokens';
import { getPreference, setPreference } from '../services/preferences';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  isDark: false,
  colors: Colors,
  setMode: async () => {},
  toggleTheme: async () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    getPreference('darkMode').then((val) => {
      if (val === true) setModeState('dark');
      else if (val === false) setModeState('light');
    });
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? DarkColors : Colors;

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await setPreference('darkMode', newMode === 'dark');
  };

  const toggleTheme = async () => {
    const next = isDark ? 'light' : 'dark';
    await setMode(next);
  };

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
