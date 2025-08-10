import * as THREE from 'three';

// Core database schema for multiplayer Firagle
export interface DatabaseSchema {
  players: PlayerRecord;
  games: GameRecord;
  maps: MapRecord;
  sessions: SessionRecord;
  leaderboards: LeaderboardRecord;
}

// Player management
export interface PlayerRecord {
  id: string;
  username: string;
  email?: string;
  puterUserId: string;
  createdAt: string;
  lastLogin: string;
  stats: PlayerStats;
  preferences: PlayerPreferences;
  inventory: PlayerInventory;
}

export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  totalKills: number;
  totalDeaths: number;
  totalDamageDealt: number;
  totalScore: number;
  bestScore: number;
  playtimeMinutes: number;
  achievementsUnlocked: string[];
}

export interface PlayerPreferences {
  mouseSensitivity: number;
  soundVolume: number;
  musicVolume: number;
  graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
  keybindings: Record<string, string>;
  uiScale: number;
}

export interface PlayerInventory {
  weapons: WeaponItem[];
  spells: SpellItem[];
  cosmetics: CosmeticItem[];
  materials: MaterialItem[];
}

export interface WeaponItem {
  id: string;
  weaponId: string;
  level: number;
  upgrades: string[];
  acquiredAt: string;
}

export interface SpellItem {
  id: string;
  spellId: string;
  masteryLevel: number;
  customizations: Record<string, any>;
  acquiredAt: string;
}

export interface CosmeticItem {
  id: string;
  type: 'staff_skin' | 'player_avatar' | 'sigil_effect' | 'particle_trail';
  itemId: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  acquiredAt: string;
}

export interface MaterialItem {
  materialId: string;
  quantity: number;
  lastUpdated: string;
}

// Game session management
export interface GameRecord {
  id: string;
  name: string;
  hostId: string;
  mapId: string;
  gameMode: 'deathmatch' | 'team_deathmatch' | 'king_of_hill' | 'capture_flag' | 'survival';
  maxPlayers: number;
  currentPlayers: number;
  status: 'waiting' | 'starting' | 'in_progress' | 'finished';
  settings: GameSettings;
  players: GamePlayer[];
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  results?: GameResults;
}

export interface GameSettings {
  timeLimit: number; // minutes
  scoreLimit: number;
  friendlyFire: boolean;
  respawnDelay: number; // seconds
  allowSpectators: boolean;
  difficulty: 'easy' | 'normal' | 'hard' | 'nightmare';
  customRules: Record<string, any>;
}

export interface GamePlayer {
  playerId: string;
  username: string;
  team?: 'red' | 'blue';
  isHost: boolean;
  joinedAt: string;
  status: 'waiting' | 'ready' | 'playing' | 'disconnected' | 'finished';
  position?: THREE.Vector3;
  health?: number;
  score?: number;
  kills?: number;
  deaths?: number;
}

export interface GameResults {
  winner?: string; // playerId or team
  finalScores: Record<string, number>;
  statistics: Record<string, PlayerMatchStats>;
  duration: number; // seconds
  completedAt: string;
}

export interface PlayerMatchStats {
  playerId: string;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  damageTaken: number;
  spellsCast: number;
  accuracy: number;
  survivalTime: number;
  score: number;
}

// Map and world management
export interface MapRecord {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  version: string;
  maxPlayers: number;
  recommendedGameModes: string[];
  terrain: TerrainData;
  assets: AssetPlacement[];
  spawnPoints: SpawnPoint[];
  objectives: MapObjective[];
  environment: EnvironmentSettings;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  downloads: number;
  rating: number;
  tags: string[];
}

export interface TerrainData {
  heightmap: string; // base64 or file path
  size: { width: number; height: number };
  scale: { x: number; y: number; z: number };
  materials: TerrainMaterial[];
  collision: CollisionData;
}

export interface TerrainMaterial {
  id: string;
  texture: string;
  normalMap?: string;
  roughnessMap?: string;
  scale: number;
  blendMode: string;
}

export interface CollisionData {
  meshes: CollisionMesh[];
  areas: CollisionArea[];
}

export interface CollisionMesh {
  id: string;
  geometry: string; // serialized geometry
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  material: string;
}

export interface CollisionArea {
  id: string;
  type: 'trigger' | 'damage' | 'teleport' | 'spawn';
  geometry: 'box' | 'sphere' | 'cylinder';
  position: THREE.Vector3;
  size: THREE.Vector3;
  properties: Record<string, any>;
}

export interface AssetPlacement {
  id: string;
  assetId: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  properties: Record<string, any>;
  interactions: AssetInteraction[];
}

export interface AssetInteraction {
  type: 'pickup' | 'destructible' | 'trigger' | 'teleport';
  radius: number;
  cooldown: number;
  effects: string[];
  conditions: Record<string, any>;
}

export interface SpawnPoint {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  type: 'player' | 'enemy' | 'item' | 'objective';
  team?: 'red' | 'blue' | 'neutral';
  priority: number;
  conditions: Record<string, any>;
}

export interface MapObjective {
  id: string;
  type: 'capture_point' | 'flag' | 'artifact' | 'boss' | 'survival_zone';
  position: THREE.Vector3;
  radius: number;
  captureTime: number;
  rewards: Record<string, any>;
  requirements: Record<string, any>;
}

export interface EnvironmentSettings {
  lighting: LightingSettings;
  weather: WeatherSettings;
  audio: AudioSettings;
  effects: EnvironmentEffect[];
}

export interface LightingSettings {
  ambientColor: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPosition: THREE.Vector3;
  shadows: boolean;
  fog: FogSettings;
}

export interface FogSettings {
  enabled: boolean;
  color: string;
  near: number;
  far: number;
  density: number;
}

export interface WeatherSettings {
  type: 'clear' | 'rain' | 'snow' | 'storm' | 'sandstorm' | 'volcanic';
  intensity: number;
  windSpeed: number;
  windDirection: THREE.Vector3;
  effects: WeatherEffect[];
}

export interface WeatherEffect {
  type: 'particles' | 'sound' | 'visual' | 'gameplay';
  properties: Record<string, any>;
}

export interface AudioSettings {
  ambientSounds: AmbientSound[];
  reverb: ReverbSettings;
  acoustics: AcousticZone[];
}

export interface AmbientSound {
  id: string;
  file: string;
  volume: number;
  loop: boolean;
  position?: THREE.Vector3;
  radius?: number;
  conditions: Record<string, any>;
}

export interface ReverbSettings {
  enabled: boolean;
  type: 'cave' | 'hall' | 'room' | 'outdoor';
  intensity: number;
}

export interface AcousticZone {
  id: string;
  position: THREE.Vector3;
  radius: number;
  reverbType: string;
  dampening: number;
}

export interface EnvironmentEffect {
  id: string;
  type: 'particles' | 'post_processing' | 'animation' | 'physics';
  properties: Record<string, any>;
  triggers: EffectTrigger[];
}

export interface EffectTrigger {
  type: 'time' | 'player_proximity' | 'event' | 'condition';
  properties: Record<string, any>;
}

// Session and networking
export interface SessionRecord {
  id: string;
  gameId: string;
  playerId: string;
  socketId: string;
  status: 'connecting' | 'connected' | 'in_game' | 'disconnected';
  joinedAt: string;
  lastPing: string;
  connectionInfo: ConnectionInfo;
  playerState: NetworkPlayerState;
}

export interface ConnectionInfo {
  ip: string;
  userAgent: string;
  latency: number;
  bandwidth: number;
  region: string;
}

export interface NetworkPlayerState {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: THREE.Vector3;
  health: number;
  shield: number;
  equippedWeapon: string;
  animationState: string;
  timestamp: number;
}

// Leaderboards and achievements
export interface LeaderboardRecord {
  id: string;
  type: 'global' | 'weekly' | 'monthly' | 'seasonal';
  category: 'score' | 'kills' | 'wins' | 'playtime' | 'achievements';
  entries: LeaderboardEntry[];
  lastUpdated: string;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  value: number;
  additionalData: Record<string, any>;
}

// Utility types for database operations
export type DatabaseOperation = 
  | { type: 'create'; table: keyof DatabaseSchema; data: any }
  | { type: 'read'; table: keyof DatabaseSchema; id: string }
  | { type: 'update'; table: keyof DatabaseSchema; id: string; data: Partial<any> }
  | { type: 'delete'; table: keyof DatabaseSchema; id: string }
  | { type: 'query'; table: keyof DatabaseSchema; conditions: Record<string, any> };

export interface DatabaseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Network message types for real-time updates
export type NetworkMessage = 
  | { type: 'player_join'; data: GamePlayer }
  | { type: 'player_leave'; data: { playerId: string } }
  | { type: 'player_update'; data: NetworkPlayerState }
  | { type: 'game_start'; data: { gameId: string; timestamp: number } }
  | { type: 'game_end'; data: GameResults }
  | { type: 'weapon_fired'; data: any }
  | { type: 'player_hit'; data: any }
  | { type: 'chat_message'; data: { playerId: string; message: string; timestamp: number } }
  | { type: 'sync_request'; data: { timestamp: number } }
  | { type: 'sync_response'; data: { gameState: any; timestamp: number } };

// Configuration for database connections
export interface DatabaseConfig {
  puterIntegration: {
    useFilesystem: boolean;
    baseDirectory: string;
    cacheTimeout: number;
  };
  localCache: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };
  networking: {
    syncInterval: number;
    retryAttempts: number;
    timeout: number;
  };
}