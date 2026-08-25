export type Language = "en" | "pt";

export type GameSettings = {
  language: Language;
  volume: number;
  debugMode: boolean;
};

const STORAGE_KEY = "bomb-tag-settings";

export const DEFAULT_SETTINGS: GameSettings = {
  language: "en",
  volume: 1,
  debugMode: false
};

export function loadSettings(): GameSettings {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const parsed = JSON.parse(saved) as Partial<GameSettings>;
    return {
      language: parsed.language === "pt" ? "pt" : "en",
      volume: typeof parsed.volume === "number" ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULT_SETTINGS.volume,
      debugMode: parsed.debugMode === true
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
