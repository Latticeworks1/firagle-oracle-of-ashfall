import type { 
  DatabaseSchema, 
  DatabaseOperation, 
  DatabaseResponse, 
  DatabaseConfig,
  PlayerRecord,
  GameRecord,
  MapRecord,
  SessionRecord,
  LeaderboardRecord
} from './schema';

declare global {
  interface Window {
    puter: any;
  }
}

export class PuterDatabase {
  private config: DatabaseConfig;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private isInitialized: boolean = false;

  constructor(config?: Partial<DatabaseConfig>) {
    this.config = {
      puterIntegration: {
        useFilesystem: true,
        baseDirectory: '/firagle-db',
        cacheTimeout: 30000 // 30 seconds
      },
      localCache: {
        enabled: true,
        maxSize: 1000,
        ttl: 60000 // 1 minute
      },
      networking: {
        syncInterval: 1000,
        retryAttempts: 3,
        timeout: 5000
      },
      ...config
    };

    this.cache = new Map();
    this.init();
  }

  private async init() {
    try {
      if (typeof window === 'undefined' || !window.puter) {
        throw new Error('Puter not available');
      }

      // Create base directory structure
      const dirs = ['players', 'games', 'maps', 'sessions', 'leaderboards'];
      for (const dir of dirs) {
        try {
          await window.puter.fs.mkdir(`${this.config.puterIntegration.baseDirectory}/${dir}`);
        } catch (e) {
          // Directory might already exist
        }
      }

      this.isInitialized = true;
      console.log('PuterDatabase initialized');
    } catch (error) {
      console.error('Failed to initialize PuterDatabase:', error);
      throw error;
    }
  }

  // Core CRUD operations
  async create<T extends keyof DatabaseSchema>(
    table: T, 
    id: string, 
    data: DatabaseSchema[T]
  ): Promise<DatabaseResponse<DatabaseSchema[T]>> {
    try {
      if (!this.isInitialized) await this.init();

      const filePath = `${this.config.puterIntegration.baseDirectory}/${table}/${id}.json`;
      const recordData = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await window.puter.fs.write(filePath, JSON.stringify(recordData, null, 2));
      
      // Update cache
      this.setCache(`${table}:${id}`, recordData);

      return {
        success: true,
        data: recordData as DatabaseSchema[T],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create ${table} record: ${error}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async read<T extends keyof DatabaseSchema>(
    table: T, 
    id: string
  ): Promise<DatabaseResponse<DatabaseSchema[T]>> {
    try {
      if (!this.isInitialized) await this.init();

      // Check cache first
      const cached = this.getCache(`${table}:${id}`);
      if (cached) {
        return {
          success: true,
          data: cached,
          timestamp: new Date().toISOString()
        };
      }

      const filePath = `${this.config.puterIntegration.baseDirectory}/${table}/${id}.json`;
      const content = await window.puter.fs.read(filePath);
      const data = JSON.parse(content);

      // Update cache
      this.setCache(`${table}:${id}`, data);

      return {
        success: true,
        data: data as DatabaseSchema[T],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read ${table} record: ${error}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async update<T extends keyof DatabaseSchema>(
    table: T, 
    id: string, 
    updates: Partial<DatabaseSchema[T]>
  ): Promise<DatabaseResponse<DatabaseSchema[T]>> {
    try {
      if (!this.isInitialized) await this.init();

      const existing = await this.read(table, id);
      if (!existing.success) {
        return existing;
      }

      const updatedData = {
        ...existing.data,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const filePath = `${this.config.puterIntegration.baseDirectory}/${table}/${id}.json`;
      await window.puter.fs.write(filePath, JSON.stringify(updatedData, null, 2));

      // Update cache
      this.setCache(`${table}:${id}`, updatedData);

      return {
        success: true,
        data: updatedData as DatabaseSchema[T],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update ${table} record: ${error}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async delete<T extends keyof DatabaseSchema>(
    table: T, 
    id: string
  ): Promise<DatabaseResponse<boolean>> {
    try {
      if (!this.isInitialized) await this.init();

      const filePath = `${this.config.puterIntegration.baseDirectory}/${table}/${id}.json`;
      await window.puter.fs.delete(filePath);

      // Remove from cache
      this.cache.delete(`${table}:${id}`);

      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete ${table} record: ${error}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async query<T extends keyof DatabaseSchema>(
    table: T, 
    conditions: Partial<DatabaseSchema[T]> = {},
    options: { limit?: number; offset?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}
  ): Promise<DatabaseResponse<DatabaseSchema[T][]>> {
    try {
      if (!this.isInitialized) await this.init();

      const dirPath = `${this.config.puterIntegration.baseDirectory}/${table}`;
      const files = await window.puter.fs.readdir(dirPath);
      const results: DatabaseSchema[T][] = [];

      for (const file of files) {
        if (file.name.endsWith('.json')) {
          try {
            const content = await window.puter.fs.read(`${dirPath}/${file.name}`);
            const data = JSON.parse(content);

            // Apply conditions
            if (this.matchesConditions(data, conditions)) {
              results.push(data);
            }
          } catch (e) {
            console.warn(`Failed to read file ${file.name}:`, e);
          }
        }
      }

      // Apply sorting
      if (options.sortBy) {
        results.sort((a, b) => {
          const aVal = (a as any)[options.sortBy!];
          const bVal = (b as any)[options.sortBy!];
          const order = options.sortOrder === 'desc' ? -1 : 1;
          
          if (aVal < bVal) return -1 * order;
          if (aVal > bVal) return 1 * order;
          return 0;
        });
      }

      // Apply pagination
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : results.length;
      const paginatedResults = results.slice(start, end);

      return {
        success: true,
        data: paginatedResults,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to query ${table} records: ${error}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Specialized methods for common operations
  async findPlayer(username: string): Promise<DatabaseResponse<PlayerRecord>> {
    const result = await this.query('players', { username } as any);
    if (result.success && result.data && result.data.length > 0) {
      return {
        success: true,
        data: result.data[0] as PlayerRecord,
        timestamp: result.timestamp
      };
    }
    return {
      success: false,
      error: 'Player not found',
      timestamp: new Date().toISOString()
    };
  }

  async findActiveGames(): Promise<DatabaseResponse<GameRecord[]>> {
    return this.query('games', { status: 'waiting' } as any);
  }

  async getPlayerGames(playerId: string): Promise<DatabaseResponse<GameRecord[]>> {
    const allGames = await this.query('games');
    if (!allGames.success) return allGames;

    const playerGames = allGames.data?.filter(game => 
      (game as GameRecord).players.some(p => p.playerId === playerId)
    ) || [];

    return {
      success: true,
      data: playerGames as GameRecord[],
      timestamp: new Date().toISOString()
    };
  }

  async createGameSession(gameData: Omit<GameRecord, 'id'>): Promise<DatabaseResponse<GameRecord>> {
    const id = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.create('games', id, { ...gameData, id } as GameRecord);
  }

  async joinGame(gameId: string, playerId: string, username: string): Promise<DatabaseResponse<GameRecord>> {
    const game = await this.read('games', gameId);
    if (!game.success) return game;

    const gameData = game.data as GameRecord;
    
    if (gameData.currentPlayers >= gameData.maxPlayers) {
      return {
        success: false,
        error: 'Game is full',
        timestamp: new Date().toISOString()
      };
    }

    if (gameData.players.some(p => p.playerId === playerId)) {
      return {
        success: false,
        error: 'Player already in game',
        timestamp: new Date().toISOString()
      };
    }

    const updatedGame = {
      ...gameData,
      currentPlayers: gameData.currentPlayers + 1,
      players: [
        ...gameData.players,
        {
          playerId,
          username,
          isHost: false,
          joinedAt: new Date().toISOString(),
          status: 'waiting' as const
        }
      ]
    };

    return this.update('games', gameId, updatedGame);
  }

  // Cache management
  private setCache(key: string, data: any): void {
    if (!this.config.localCache.enabled) return;

    // Clean old entries if cache is full
    if (this.cache.size >= this.config.localCache.maxSize) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.config.localCache.ttl
    });
  }

  private getCache(key: string): any | null {
    if (!this.config.localCache.enabled) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private matchesConditions(data: any, conditions: any): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      if (data[key] !== value) {
        return false;
      }
    }
    return true;
  }

  // Utility methods
  async backup(): Promise<DatabaseResponse<string>> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `/firagle-backups/backup-${timestamp}`;
      
      await window.puter.fs.mkdir('/firagle-backups', { recursive: true });
      await window.puter.fs.copy(this.config.puterIntegration.baseDirectory, backupPath);

      return {
        success: true,
        data: backupPath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: `Backup failed: ${error}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async getStats(): Promise<DatabaseResponse<any>> {
    try {
      const stats = {
        players: 0,
        games: 0,
        activeSessions: 0,
        cacheHitRate: 0
      };

      // Count records
      for (const table of ['players', 'games', 'sessions']) {
        const result = await this.query(table as keyof DatabaseSchema);
        if (result.success) {
          stats[table as keyof typeof stats] = result.data?.length || 0;
        }
      }

      // Calculate cache stats
      const totalRequests = this.cache.size;
      const cacheHits = Array.from(this.cache.values()).filter(
        item => Date.now() - item.timestamp < item.ttl
      ).length;
      
      stats.cacheHitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get stats: ${error}`,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Global database instance
export const db = new PuterDatabase();