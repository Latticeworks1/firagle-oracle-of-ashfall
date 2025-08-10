export const IS_TOUCH_DEVICE = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// All measurements are converted from cm/mm to meters for Three.js units (1m = 1 unit)
const SCALE = 1;

// Overall Dimensions
export const STAFF_SHAFT_LENGTH = 1.626 * SCALE;
export const FERRULE_LENGTH = 0.120 * SCALE;
export const HEAD_ASSEMBLY_HEIGHT = 0.158 * SCALE;

// Shaft
export const SHAFT_RADIUS = (0.024 / 2) * SCALE;

// Grip
export const GRIP_LENGTH = 0.302 * SCALE;
export const GRIP_OFFSET_FROM_FERRULE = 0.120 * SCALE;

// Inlays
export const INLAY_COUNT = 8;
export const INLAY_TUBE_RADIUS = (0.006 / 2) * SCALE;
export const INLAY_HELIX_RADIUS = SHAFT_RADIUS * 1.01;
export const INLAY_HELIX_HEIGHT = STAFF_SHAFT_LENGTH - GRIP_LENGTH - GRIP_OFFSET_FROM_FERRULE - HEAD_ASSEMBLY_HEIGHT;
export const INLAY_HELIX_TURNS = 10;

// Head Assembly
export const ORB_DIAMETER = 0.0903 * SCALE;
export const RINGS_WIDTH = 0.0241 * SCALE;
export const RINGS_THICKNESS = 0.0038 * SCALE;

// Materials & Colors
export const COLOR_DARKSTEEL = '#222228';
export const COLOR_WYVERNHIDE = '#4a2c2a';
export const COLOR_GILDED = '#FFD700';
export const COLOR_INLAY_IDLE = '#ff4500'; // Fiery orange-red
export const COLOR_OBSIDIAN = '#100c1c';
export const COLOR_PROJECTILE = '#ff8c00'; // Dark Orange
export const COLOR_EMBER = '#ffae42'; // Mandarin orange for sparks

// Dynamic Properties (Animation)
export const RING_SPEED_IDLE = { outer: 0.087, middle: -0.052, inner: 0.087 }; // rad/s
export const RING_SPEED_CHARGED = { outer: 0.7, middle: -0.55, inner: 0.7 }; // rad/s
export const RING_SPEED_DISCHARGE = { outer: 1.57, middle: -1.57, inner: 1.57 }; // rad/s
export const RING_SPEED_DECAY = { outer: 0.174, middle: -0.174, inner: 0.174 }; // rad/s

export const INLAY_BRIGHTNESS_IDLE = 0.6;
export const INLAY_BRIGHTNESS_DISCHARGE_PEAK = 4.0;

// Timings - Now primarily defaults, specific timings are in weapon schemas
export const PROJECTILE_LIFESPAN = 3000; // ms

// Player
export const PLAYER_MAX_HEALTH = 100;
export const MOVEMENT_SPEED = 5;

// Enemies
export const ENEMY_MAX_COUNT = 15;
export const ENEMY_SPAWN_INTERVAL = 4000; // ms
export const ENEMY_MAX_HEALTH = 100;
export const ENEMY_SPEED = 1.5;
export const ENEMY_DAMAGE = 10;
export const ENEMY_ATTACK_COOLDOWN = 1000; // ms
export const ENEMY_ATTACK_RANGE = 1.8;
export const ENEMY_AGGRO_RANGE = 25;

// World
export const TERRAIN_WIDTH = 256;
export const TERRAIN_HEIGHT = 256;
export const TERRAIN_MAX_ALTITUDE = 25.0;
export const TERRAIN_SCALE = 1.5;
