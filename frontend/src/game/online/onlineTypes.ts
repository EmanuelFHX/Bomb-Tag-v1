export type OnlinePlayerSnapshot = {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  alive: boolean;
  hasBomb: boolean;
  hasWeapon: boolean;
  updatedAt: number;
};

export type OnlineMatchPlayerState = {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  alive: boolean;
  lives: number;
  hasBomb: boolean;
  hasWeapon: boolean;
};

export type OnlineMatchBombState = {
  x: number;
  y: number;
  state: "HELD" | "OUTBOUND" | "RETURNING";
  ownerId: string;
  responsibleId: string;
  velocityX: number;
  velocityY: number;
  visible: boolean;
};

export type OnlineMatchRoundState = {
  aliveCount: number;
  remainingMs: number;
  timerSeconds: number;
  resolving: boolean;
  matchOver: boolean;
  winnerId: string | null;
};

export type OnlineMatchState = {
  updatedAt: number;
  players: OnlineMatchPlayerState[];
  bomb: OnlineMatchBombState;
  round: OnlineMatchRoundState;
};

export type OnlineRoomSnapshot = {
  code: string;
  createdAt: number;
  updatedAt: number;
  status: "waiting" | "playing" | "closed";
  hostId: string;
  players?: Record<string, OnlinePlayerSnapshot>;
  match?: OnlineMatchState;
};
