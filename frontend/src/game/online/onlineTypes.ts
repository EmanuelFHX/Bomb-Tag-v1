export type OnlinePlayerSnapshot = {
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  aimX: number;
  aimY: number;
  alive: boolean;
  hasBomb: boolean;
  hasWeapon: boolean;
  actionSeq?: number;
  actionType?: "primary" | "parry";
  dashSeq?: number;
  dashX?: number;
  dashY?: number;
  updatedAt: number;
};

export type OnlineMatchPlayerState = {
  id: string;
  slotId?: string;
  name: string;
  color: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  aimX: number;
  aimY: number;
  alive: boolean;
  lives: number;
  hasBomb: boolean;
  hasWeapon: boolean;
  dashSeq?: number;
  dashX?: number;
  dashY?: number;
};

export type OnlineMatchBombState = {
  x: number;
  y: number;
  state: "HELD" | "OUTBOUND" | "RETURNING";
  ownerId: string;
  responsibleId: string;
  velocityX: number;
  velocityY: number;
  speedMultiplier: number;
  homingTargetId: string | null;
  visible: boolean;
  isParryFlaming?: boolean;
  breaksParry?: boolean;
};

export type OnlineArenaState = {
  aliveCount: number;
  shape: "rectangle" | "octagon";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OnlineShotState = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  rotation: number;
  color: number;
  velocityX: number;
  velocityY: number;
  remainingMs: number;
};

export type OnlineWeaponPickupState = {
  id: string;
  x: number;
  y: number;
};

export type OnlineJudgmentOrbState = {
  id: string;
  x: number;
  y: number;
};

export type OnlineMatchRoundState = {
  aliveCount: number;
  remainingMs: number;
  timerSeconds: number;
  resolving: boolean;
  matchOver: boolean;
  specialLivesRestored: boolean;
  winnerId: string | null;
};

export type OnlineMusicState = "none" | "match" | "final" | "judgment";

export type OnlineCombatEventDraft =
  | {
      type: "bombHit";
      x: number;
      y: number;
      color: number;
      variant: "direct" | "you" | "ricochet" | "return" | "perfect";
      isSpecial: boolean;
      nextOwnerId: string;
    }
  | {
      type: "weaponPickup";
      playerId: string;
    }
  | {
      type: "weaponShot";
      ownerId: string;
      shot: OnlineShotState;
    }
  | {
      type: "shotDamage";
      x: number;
      y: number;
      color: number;
      targetId: string;
      isHumanTarget: boolean;
    }
  | {
      type: "parry";
      x: number;
      y: number;
      color: number;
      playerId: string;
      perfect: boolean;
    }
  | {
      type: "explosion";
      x: number;
      y: number;
      color: number;
    }
  | {
      type: "finalTransition";
      aliveCount: number;
    }
  | {
      type: "judgmentTransition";
      defenderId: string;
      challengerId?: string;
    }
  | {
      type: "roundMessage";
      message: string;
      color: string;
      duration: number;
      key: "playersRemain" | "threePlayers" | "livesRestored" | "finalDuel" | "judgmentDefense" | "matchOver" | "";
    };

export type OnlineCombatEvent = OnlineCombatEventDraft & {
  id: string;
};

export type OnlineMatchState = {
  updatedAt: number;
  music: OnlineMusicState;
  events: OnlineCombatEvent[];
  players: OnlineMatchPlayerState[];
  bomb: OnlineMatchBombState;
  arena: OnlineArenaState;
  shots: OnlineShotState[];
  pickups?: OnlineWeaponPickupState[];
  judgmentOrbs?: OnlineJudgmentOrbState[];
  judgmentOrbCounts?: Record<string, number>;
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
