export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const ARENA = {
  x: 64,
  y: 56,
  width: 1152,
  height: 608,
  wallThickness: 20
} as const;

export const PLAYER = {
  radius: 18,
  acceleration: 1400,
  drag: 0.86,
  maxSpeed: 310,
  dashSpeed: 760,
  dashDurationMs: 170,
  dashInvulnerabilityMs: 150,
  dashCooldownMs: 2400,
  dashCharges: 2
} as const;

export const BOMB = {
  radius: 12,
  heldOffset: 30,
  speed: 570,
  returnSpeed: 510,
  maxRicochetsBeforeReturn: 3,
  maxTravelMs: 920,
  returnTurnRate: 5.2,
  ownerCatchDistance: 34,
  transferCooldownMs: 180,
  timerSeconds: 10
} as const;

export const BOT = {
  count: 7,
  maxSpeed: 170,
  directionChangeMs: 900,
  evadeRadius: 105,
  evadeLookAheadMs: 820,
  interceptRadius: 130,
  throwRange: 760,
  throwDelayMs: 420
} as const;

export const ROUND_STAGES = [
  {
    minPlayers: 7,
    timerSeconds: 10,
    bombSpeedMultiplier: 1
  },
  {
    minPlayers: 5,
    timerSeconds: 8,
    bombSpeedMultiplier: 1.2
  },
  {
    minPlayers: 3,
    timerSeconds: 6,
    bombSpeedMultiplier: 1.5
  },
  {
    minPlayers: 2,
    timerSeconds: 4,
    bombSpeedMultiplier: 2
  }
] as const;
