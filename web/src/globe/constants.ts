export const RADIUS = 1, SEA_LEVEL = 0.992, LAND_BASE = 1.0, RELIEF = 0.045, MOUNTAIN_BONUS = 0.015,
  LIFT = 0.0015, CAM_MIN = 1.12, CAM_MAX = 4.0, CLOSE = 1.8;

// B8: the structure and town layers re-read the world at most this often (seconds). At the top gear the
// world changes many times a frame; ten reads a second still shows every year.
export const WORLD_SYNC_S = 0.1;
