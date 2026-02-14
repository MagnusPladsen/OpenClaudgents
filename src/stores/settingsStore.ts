import { create } from "zustand";
import { applyTheme, initTheme } from "../lib/theme";

interface SettingsState {
  theme: string;
  fontSize: number;
  notificationsEnabled: boolean;
  setTheme: (themeId: string) => void;
  setFontSize: (size: number) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  loadSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "tokyo-night",
  fontSize: 14,
  notificationsEnabled: true,

  setTheme: (themeId) => {
    applyTheme(themeId);
    set({ theme: themeId });
  },

  setFontSize: (size) => {
    document.documentElement.style.fontSize = `${size}px`;
    localStorage.setItem("openclaudgents-fontSize", String(size));
    set({ fontSize: size });
  },

  setNotificationsEnabled: (enabled) => {
    localStorage.setItem("openclaudgents-notifications", String(enabled));
    set({ notificationsEnabled: enabled });
  },

  loadSettings: () => {
    const theme = initTheme();
    const fontSize = Number(localStorage.getItem("openclaudgents-fontSize")) || 14;
    const notifications = localStorage.getItem("openclaudgents-notifications") !== "false";

    document.documentElement.style.fontSize = `${fontSize}px`;

    set({
      theme,
      fontSize,
      notificationsEnabled: notifications,
    });
  },
}));
