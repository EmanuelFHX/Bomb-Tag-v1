export type Language = "en" | "pt";

export type GameSettings = {
  language: Language;
  volume: number;
  debugMode: boolean;
  online: OnlineSettings;
};

export type OnlineRole = "host" | "guest";

export type OnlineSettings = {
  enabled: boolean;
  role: OnlineRole;
  roomCode: string;
  playerId: string;
};

const STORAGE_KEY = "bomb-tag-settings";

export const DEFAULT_SETTINGS: GameSettings = {
  language: "en",
  volume: 1,
  debugMode: false,
  online: {
    enabled: false,
    role: "host",
    roomCode: "",
    playerId: ""
  }
};

export function createPlayerId() {
  return crypto.randomUUID?.() ?? `player-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function loadSettings(): GameSettings {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return {
      ...DEFAULT_SETTINGS,
      online: {
        ...DEFAULT_SETTINGS.online,
        playerId: createPlayerId()
      }
    };
  }

  try {
    const parsed = JSON.parse(saved) as Partial<GameSettings>;
    return {
      language: parsed.language === "pt" ? "pt" : "en",
      volume: typeof parsed.volume === "number" ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULT_SETTINGS.volume,
      debugMode: parsed.debugMode === true,
      online: {
        enabled: parsed.online?.enabled === true,
        role: parsed.online?.role === "guest" ? "guest" : "host",
        roomCode: typeof parsed.online?.roomCode === "string" ? parsed.online.roomCode : "",
        playerId: typeof parsed.online?.playerId === "string" && parsed.online.playerId
          ? parsed.online.playerId
          : createPlayerId()
      }
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      online: {
        ...DEFAULT_SETTINGS.online,
        playerId: createPlayerId()
      }
    };
  }
}

export function saveSettings(settings: GameSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
