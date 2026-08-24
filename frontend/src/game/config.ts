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
  count: 5,
  maxSpeed: 170,
  directionChangeMs: 900
} as const;

