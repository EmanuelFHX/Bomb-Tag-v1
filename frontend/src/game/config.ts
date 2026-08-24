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
  maxLives: 3,
  acceleration: 1500,
  drag: 0.84,
  maxSpeed: 320,
  dashSpeed: 840,
  dashDurationMs: 180,
  dashInvulnerabilityMs: 150,
  dashCooldownMs: 1800,
  normalDashCharges: 3,
  specialDashCharges: 2
} as const;

export const BOMB = {
  radius: 12,
  heldOffset: 30,
  speed: 620,
  returnSpeed: 565,
  maxRicochetsBeforeReturn: 3,
  maxTravelMs: 980,
  returnTurnRate: 4.6,
  ownerCatchDistance: 34,
  transferCooldownMs: 180,
  timerSeconds: 20
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

export const WEAPON = {
  pickupRadius: 15,
  spawnEveryMs: 7200,
  firstSpawnDelayMs: 3600,
  maxPickups: 2,
  shotSpeed: 780,
  shotRadius: 6,
  shotLifetimeMs: 900,
  shotCooldownMs: 850,
  pickupDetectRadius: 46,
  botSeekRadius: 440,
  botShootRange: 620
} as const;

export const ROUND_STAGES = [
  {
    minPlayers: 7,
    timerSeconds: 20,
    bombSpeedMultiplier: 1
  },
  {
    minPlayers: 5,
    timerSeconds: 18,
    bombSpeedMultiplier: 1.18
  },
  {
    minPlayers: 3,
    timerSeconds: 15,
    bombSpeedMultiplier: 1.45
  },
  {
    minPlayers: 2,
    timerSeconds: 12,
    bombSpeedMultiplier: 1.85
  }
] as const;
