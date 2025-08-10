import * as THREE from 'three';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { NetworkMessage, NetworkPlayerState, GameRecord } from '../database/schema';
import { eventBus } from '../eventBus';

// ECS Entity types for multiplayer
export interface Entity {
  id: string;
  components: Set<string>;
  networkId?: string;
  ownerId?: string;
  authoritative?: boolean;
}

// Component interfaces
export interface Component {
  type: string;
  entityId: string;
}

export interface TransformComponent extends Component {
  type: 'transform';
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  velocity: THREE.Vector3;
  dirty: boolean;
  lastSync: number;
}

export interface NetworkComponent extends Component {
  type: 'network';
  networkId: string;
  ownerId: string;
  authoritative: boolean;
  lastUpdate: number;
  interpolationBuffer: NetworkState[];
}

export interface NetworkState {
  timestamp: number;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: THREE.Vector3;
  customData: Record<string, any>;
}

export interface PlayerComponent extends Component {
  type: 'player';
  playerId: string;
  username: string;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  team?: string;
  inputBuffer: PlayerInput[];
}

export interface PlayerInput {
  timestamp: number;
  sequenceId: number;
  keys: Record<string, boolean>;
  mouseMovement: { x: number; y: number };
  mouseButtons: Record<number, boolean>;
}

export interface WeaponComponent extends Component {
  type: 'weapon';
  equippedWeapon: string;
  animationState: string;
  lastFired: number;
  ammo: number;
  charging: boolean;
}

export interface ProjectileComponent extends Component {
  type: 'projectile';
  projectileType: string;
  damage: number;
  speed: number;
  lifespan: number;
  createdAt: number;
  ownerId: string;
}

// Multiplayer ECS Store
interface MultiplayerECSStore {
  // ECS Core
  entities: Map<string, Entity>;
  components: Map<string, Map<string, Component>>;
  
  // Networking
  isHost: boolean;
  playerId: string;
  gameId: string;
  connectedPlayers: Map<string, NetworkPlayerState>;
  networkTime: number;
  serverTime: number;
  latency: number;
  
  // Game State
  gameState: 'lobby' | 'starting' | 'playing' | 'paused' | 'ended';
  gameData: GameRecord | null;
  
  // Controllers
  playerController: PlayerController | null;
  networkController: NetworkController | null;
  
  // Actions
  createEntity: (components?: Component[]) => Entity;
  addComponent: <T extends Component>(entityId: string, component: T) => void;
  removeComponent: (entityId: string, componentType: string) => void;
  getComponent: <T extends Component>(entityId: string, componentType: string) => T | null;
  getEntitiesWith: (...componentTypes: string[]) => Entity[];
  
  // Networking Actions
  sendMessage: (message: NetworkMessage) => void;
  receiveMessage: (message: NetworkMessage) => void;
  syncEntity: (entityId: string) => void;
  
  // Game Actions
  setGameState: (state: 'lobby' | 'starting' | 'playing' | 'paused' | 'ended') => void;
  updatePlayerInput: (playerId: string, input: PlayerInput) => void;
}

export const useMultiplayerECS = create<MultiplayerECSStore>()(
  subscribeWithSelector((set, get) => ({
    // ECS Core
    entities: new Map(),
    components: new Map(),
    
    // Networking
    isHost: false,
    playerId: '',
    gameId: '',
    connectedPlayers: new Map(),
    networkTime: 0,
    serverTime: 0,
    latency: 0,
    
    // Game State
    gameState: 'lobby',
    gameData: null,
    
    // Controllers
    playerController: null,
    networkController: null,
    
    // ECS Actions
    createEntity: (components = []) => {
      const entity: Entity = {
        id: THREE.MathUtils.generateUUID(),
        components: new Set(),
      };
      
      set((state) => {
        const newEntities = new Map(state.entities);
        newEntities.set(entity.id, entity);
        return { entities: newEntities };
      });
      
      // Add initial components
      components.forEach(component => {
        get().addComponent(entity.id, component);
      });
      
      return entity;
    },

    addComponent: (entityId, component) => {
      set((state) => {
        const newComponents = new Map(state.components);
        const componentType = component.type;
        
        if (!newComponents.has(componentType)) {
          newComponents.set(componentType, new Map());
        }
        
        newComponents.get(componentType)!.set(entityId, { ...component, entityId });
        
        const newEntities = new Map(state.entities);
        const entity = newEntities.get(entityId);
        if (entity) {
          entity.components.add(componentType);
          newEntities.set(entityId, entity);
        }
        
        return { components: newComponents, entities: newEntities };
      });
    },

    removeComponent: (entityId, componentType) => {
      set((state) => {
        const newComponents = new Map(state.components);
        const componentMap = newComponents.get(componentType);
        if (componentMap) {
          componentMap.delete(entityId);
          if (componentMap.size === 0) {
            newComponents.delete(componentType);
          }
        }
        
        const newEntities = new Map(state.entities);
        const entity = newEntities.get(entityId);
        if (entity) {
          entity.components.delete(componentType);
          newEntities.set(entityId, entity);
        }
        
        return { components: newComponents, entities: newEntities };
      });
    },

    getComponent: (entityId, componentType) => {
      const componentMap = get().components.get(componentType);
      return componentMap?.get(entityId) || null;
    },

    getEntitiesWith: (...componentTypes) => {
      const entities = get().entities;
      const result: Entity[] = [];
      
      for (const [id, entity] of entities) {
        if (componentTypes.every(type => entity.components.has(type))) {
          result.push(entity);
        }
      }
      
      return result;
    },
    
    // Networking Actions
    sendMessage: (message) => {
      const networkController = get().networkController;
      if (networkController) {
        networkController.sendMessage(message);
      }
    },

    receiveMessage: (message) => {
      const networkController = get().networkController;
      if (networkController) {
        networkController.handleMessage(message);
      }
    },

    syncEntity: (entityId) => {
      const transform = get().getComponent<TransformComponent>(entityId, 'transform');
      const network = get().getComponent<NetworkComponent>(entityId, 'network');
      
      if (transform && network && network.authoritative) {
        const syncMessage: NetworkMessage = {
          type: 'player_update',
          data: {
            position: transform.position,
            rotation: transform.rotation,
            velocity: transform.velocity,
            health: 100, // Get from player component
            shield: 0,
            equippedWeapon: 'fire_staff',
            animationState: 'idle',
            timestamp: Date.now()
          }
        };
        
        get().sendMessage(syncMessage);
        transform.lastSync = Date.now();
        transform.dirty = false;
      }
    },

    // Game Actions
    setGameState: (state) => {
      set({ gameState: state });
      
      // Emit event for other systems
      eventBus.dispatch('GAME_STATE_CHANGED', { state });
    },

    updatePlayerInput: (playerId, input) => {
      const playerController = get().playerController;
      if (playerController) {
        playerController.processInput(input);
      }
    },
  }))
);

// Player Controller (follows Three.js + Rapier pattern)
export class PlayerController {
  private entityId: string;
  private ecsStore: any;
  private inputManager: InputManager;
  private movementController: MovementController;
  private weaponController: WeaponController;

  constructor(entityId: string, ecsStore: any) {
    this.entityId = entityId;
    this.ecsStore = ecsStore;
    this.inputManager = new InputManager();
    this.movementController = new MovementController(entityId, ecsStore);
    this.weaponController = new WeaponController(entityId, ecsStore);
  }

  update(deltaTime: number): void {
    const input = this.inputManager.getInput();
    
    // Update movement
    this.movementController.update(deltaTime, input);
    
    // Update weapon
    this.weaponController.update(deltaTime, input);
    
    // Mark transform as dirty for networking
    const transform = this.ecsStore.getComponent<TransformComponent>(this.entityId, 'transform');
    if (transform) {
      transform.dirty = true;
    }
  }

  processInput(input: PlayerInput): void {
    this.inputManager.addInput(input);
  }
}

// Input Manager (holds input state like Three.js tutorial)
export class InputManager {
  private currentInput: PlayerInput | null = null;
  private inputHistory: PlayerInput[] = [];
  private maxHistorySize = 60; // 1 second at 60fps

  addInput(input: PlayerInput): void {
    this.currentInput = input;
    this.inputHistory.push(input);
    
    if (this.inputHistory.length > this.maxHistorySize) {
      this.inputHistory.shift();
    }
  }

  getInput(): PlayerInput | null {
    return this.currentInput;
  }

  getInputHistory(): PlayerInput[] {
    return [...this.inputHistory];
  }

  isKeyPressed(key: string): boolean {
    return this.currentInput?.keys[key] || false;
  }

  getMouseMovement(): { x: number; y: number } {
    return this.currentInput?.mouseMovement || { x: 0, y: 0 };
  }
}

// Movement Controller (handles physics like Three.js tutorial)
export class MovementController {
  private entityId: string;
  private ecsStore: any;
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private acceleration: THREE.Vector3 = new THREE.Vector3();

  constructor(entityId: string, ecsStore: any) {
    this.entityId = entityId;
    this.ecsStore = ecsStore;
  }

  update(deltaTime: number, input: PlayerInput | null): void {
    if (!input) return;

    const transform = this.ecsStore.getComponent<TransformComponent>(this.entityId, 'transform');
    if (!transform) return;

    // Reset acceleration
    this.acceleration.set(0, 0, 0);

    // Movement input
    const moveSpeed = 10;
    if (input.keys['w'] || input.keys['W']) this.acceleration.z -= moveSpeed;
    if (input.keys['s'] || input.keys['S']) this.acceleration.z += moveSpeed;
    if (input.keys['a'] || input.keys['A']) this.acceleration.x -= moveSpeed;
    if (input.keys['d'] || input.keys['D']) this.acceleration.x += moveSpeed;

    // Apply acceleration
    this.velocity.add(this.acceleration.clone().multiplyScalar(deltaTime));

    // Apply friction
    this.velocity.multiplyScalar(0.9);

    // Update position
    transform.position.add(this.velocity.clone().multiplyScalar(deltaTime));
    transform.velocity.copy(this.velocity);

    // Mouse look
    if (input.mouseMovement.x !== 0 || input.mouseMovement.y !== 0) {
      transform.rotation.y -= input.mouseMovement.x * 0.002;
      transform.rotation.x -= input.mouseMovement.y * 0.002;
      transform.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, transform.rotation.x));
    }
  }
}

// Weapon Controller (integrates with existing spell system)
export class WeaponController {
  private entityId: string;
  private ecsStore: any;
  private chargingStart: number = 0;

  constructor(entityId: string, ecsStore: any) {
    this.entityId = entityId;
    this.ecsStore = ecsStore;
  }

  update(deltaTime: number, input: PlayerInput | null): void {
    if (!input) return;

    const weapon = this.ecsStore.getComponent<WeaponComponent>(this.entityId, 'weapon');
    if (!weapon) return;

    // Handle weapon input
    const isCharging = input.mouseButtons[0] || false;
    const shouldFire = !isCharging && weapon.charging;

    if (isCharging && !weapon.charging) {
      // Start charging
      weapon.charging = true;
      weapon.animationState = 'charging';
      this.chargingStart = Date.now();
      
      eventBus.dispatch('WEAPON_CHARGE_START', { entityId: this.entityId });
    } else if (shouldFire) {
      // Fire weapon
      this.fireWeapon(weapon);
      weapon.charging = false;
      weapon.animationState = 'firing';
      weapon.lastFired = Date.now();
      
      eventBus.dispatch('WEAPON_FIRED', { 
        entityId: this.entityId, 
        weaponType: weapon.equippedWeapon,
        chargeTime: Date.now() - this.chargingStart
      });
    } else if (!isCharging && weapon.charging) {
      // Stop charging without firing
      weapon.charging = false;
      weapon.animationState = 'idle';
    }
  }

  private fireWeapon(weapon: WeaponComponent): void {
    const transform = this.ecsStore.getComponent<TransformComponent>(this.entityId, 'transform');
    if (!transform) return;

    // Create projectile entity
    const projectileEntity = this.ecsStore.createEntity([
      {
        type: 'transform',
        position: transform.position.clone(),
        rotation: transform.rotation.clone(),
        scale: new THREE.Vector3(1, 1, 1),
        velocity: new THREE.Vector3(0, 0, -weapon.projectileSpeed || 20),
        dirty: true,
        lastSync: 0
      } as TransformComponent,
      {
        type: 'projectile',
        projectileType: weapon.equippedWeapon,
        damage: 50,
        speed: 20,
        lifespan: 5000,
        createdAt: Date.now(),
        ownerId: this.entityId
      } as ProjectileComponent,
      {
        type: 'network',
        networkId: THREE.MathUtils.generateUUID(),
        ownerId: this.entityId,
        authoritative: true,
        lastUpdate: Date.now(),
        interpolationBuffer: []
      } as NetworkComponent
    ]);
  }
}

// Network Controller (handles Socket.io communication)
export class NetworkController {
  private socket: any = null; // Socket.io instance
  private ecsStore: any;
  private messageQueue: NetworkMessage[] = [];

  constructor(ecsStore: any) {
    this.ecsStore = ecsStore;
  }

  connect(gameId: string, playerId: string): void {
    // This would connect to Socket.io server
    console.log(`Connecting to game ${gameId} as player ${playerId}`);
    
    // Simulate connection for now
    setTimeout(() => {
      this.ecsStore.sendMessage({
        type: 'player_join',
        data: { playerId, gameId, timestamp: Date.now() }
      });
    }, 1000);
  }

  sendMessage(message: NetworkMessage): void {
    if (this.socket) {
      this.socket.emit('game_message', message);
    } else {
      // Queue messages if not connected
      this.messageQueue.push(message);
    }
  }

  handleMessage(message: NetworkMessage): void {
    switch (message.type) {
      case 'player_update':
        this.handlePlayerUpdate(message.data as NetworkPlayerState);
        break;
      case 'weapon_fired':
        this.handleWeaponFired(message.data);
        break;
      case 'player_join':
        this.handlePlayerJoin(message.data);
        break;
      // ... other message types
    }
  }

  private handlePlayerUpdate(playerState: NetworkPlayerState): void {
    // Find player entity and update transform with interpolation
    const playerEntities = this.ecsStore.getEntitiesWith('player', 'network');
    const playerEntity = playerEntities.find(e => {
      const player = this.ecsStore.getComponent<PlayerComponent>(e.id, 'player');
      return player?.playerId === playerState.playerId;
    });

    if (playerEntity) {
      const network = this.ecsStore.getComponent<NetworkComponent>(playerEntity.id, 'network');
      if (network) {
        network.interpolationBuffer.push({
          timestamp: playerState.timestamp,
          position: playerState.position,
          rotation: playerState.rotation,
          velocity: playerState.velocity,
          customData: {}
        });

        // Keep buffer size manageable
        if (network.interpolationBuffer.length > 10) {
          network.interpolationBuffer.shift();
        }
      }
    }
  }

  private handleWeaponFired(data: any): void {
    eventBus.dispatch('REMOTE_WEAPON_FIRED', data);
  }

  private handlePlayerJoin(data: any): void {
    // Create new player entity for remote player
    const playerEntity = this.ecsStore.createEntity([
      {
        type: 'transform',
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Euler(0, 0, 0),
        scale: new THREE.Vector3(1, 1, 1),
        velocity: new THREE.Vector3(0, 0, 0),
        dirty: false,
        lastSync: 0
      } as TransformComponent,
      {
        type: 'player',
        playerId: data.playerId,
        username: data.username || 'Unknown',
        health: 100,
        maxHealth: 100,
        shield: 0,
        maxShield: 0,
        score: 0,
        inputBuffer: []
      } as PlayerComponent,
      {
        type: 'network',
        networkId: data.playerId,
        ownerId: data.playerId,
        authoritative: false,
        lastUpdate: Date.now(),
        interpolationBuffer: []
      } as NetworkComponent
    ]);

    eventBus.dispatch('REMOTE_PLAYER_JOINED', { entityId: playerEntity.id, data });
  }
}

// Main ECS System update loop
export class MultiplayerECSSystem {
  private ecsStore: any;
  private systems: System[] = [];
  private lastUpdate: number = 0;
  private networkSyncTimer: number = 0;

  constructor() {
    this.ecsStore = useMultiplayerECS.getState();
    this.setupSystems();
  }

  private setupSystems(): void {
    this.systems = [
      new MovementSystem(this.ecsStore),
      new NetworkSyncSystem(this.ecsStore),
      new ProjectileSystem(this.ecsStore),
      new InterpolationSystem(this.ecsStore)
    ];
  }

  update(deltaTime: number): void {
    const now = Date.now();
    
    // Update all systems
    for (const system of this.systems) {
      system.update(deltaTime, now);
    }

    // Network sync at regular intervals (20fps for networking)
    this.networkSyncTimer += deltaTime;
    if (this.networkSyncTimer >= 50) { // 50ms = 20fps
      this.syncNetworkedEntities();
      this.networkSyncTimer = 0;
    }

    this.lastUpdate = now;
  }

  private syncNetworkedEntities(): void {
    const networkedEntities = this.ecsStore.getEntitiesWith('transform', 'network');
    
    for (const entity of networkedEntities) {
      const transform = this.ecsStore.getComponent<TransformComponent>(entity.id, 'transform');
      const network = this.ecsStore.getComponent<NetworkComponent>(entity.id, 'network');
      
      if (transform && network && transform.dirty && network.authoritative) {
        this.ecsStore.syncEntity(entity.id);
      }
    }
  }
}

// Base System interface
export interface System {
  update(deltaTime: number, timestamp: number): void;
}

// Movement System
export class MovementSystem implements System {
  constructor(private ecsStore: any) {}

  update(deltaTime: number): void {
    const entities = this.ecsStore.getEntitiesWith('transform', 'player');
    
    for (const entity of entities) {
      const player = this.ecsStore.getComponent<PlayerComponent>(entity.id, 'player');
      const transform = this.ecsStore.getComponent<TransformComponent>(entity.id, 'transform');
      
      if (player && transform && player.inputBuffer.length > 0) {
        // Process input buffer
        const input = player.inputBuffer.shift()!;
        // Apply movement logic here
        transform.dirty = true;
      }
    }
  }
}

// Network Sync System
export class NetworkSyncSystem implements System {
  constructor(private ecsStore: any) {}

  update(deltaTime: number): void {
    // Handle network synchronization
    // This would typically send/receive network updates
  }
}

// Projectile System
export class ProjectileSystem implements System {
  constructor(private ecsStore: any) {}

  update(deltaTime: number, timestamp: number): void {
    const projectiles = this.ecsStore.getEntitiesWith('transform', 'projectile');
    
    for (const entity of projectiles) {
      const transform = this.ecsStore.getComponent<TransformComponent>(entity.id, 'transform');
      const projectile = this.ecsStore.getComponent<ProjectileComponent>(entity.id, 'projectile');
      
      if (transform && projectile) {
        // Update projectile position
        const direction = new THREE.Vector3(0, 0, -1).applyEuler(transform.rotation);
        transform.velocity.copy(direction.multiplyScalar(projectile.speed));
        transform.position.add(transform.velocity.clone().multiplyScalar(deltaTime / 1000));
        transform.dirty = true;
        
        // Check lifespan
        if (timestamp - projectile.createdAt > projectile.lifespan) {
          // Remove expired projectile
          // This would typically involve cleaning up the entity
          eventBus.dispatch('PROJECTILE_EXPIRED', { entityId: entity.id });
        }
      }
    }
  }
}

// Interpolation System (for smooth remote player movement)
export class InterpolationSystem implements System {
  constructor(private ecsStore: any) {}

  update(deltaTime: number, timestamp: number): void {
    const remoteEntities = this.ecsStore.getEntitiesWith('transform', 'network').filter(entity => {
      const network = this.ecsStore.getComponent<NetworkComponent>(entity.id, 'network');
      return network && !network.authoritative && network.interpolationBuffer.length >= 2;
    });

    for (const entity of remoteEntities) {
      const transform = this.ecsStore.getComponent<TransformComponent>(entity.id, 'transform');
      const network = this.ecsStore.getComponent<NetworkComponent>(entity.id, 'network');
      
      if (transform && network) {
        // Interpolate between buffered states
        const buffer = network.interpolationBuffer;
        const targetTime = timestamp - 100; // 100ms lag compensation
        
        let fromState = buffer[0];
        let toState = buffer[1];
        
        for (let i = 0; i < buffer.length - 1; i++) {
          if (buffer[i].timestamp <= targetTime && buffer[i + 1].timestamp >= targetTime) {
            fromState = buffer[i];
            toState = buffer[i + 1];
            break;
          }
        }
        
        if (fromState && toState && fromState !== toState) {
          const alpha = (targetTime - fromState.timestamp) / (toState.timestamp - fromState.timestamp);
          
          transform.position.lerpVectors(fromState.position, toState.position, alpha);
          transform.rotation.x = THREE.MathUtils.lerp(fromState.rotation.x, toState.rotation.x, alpha);
          transform.rotation.y = THREE.MathUtils.lerp(fromState.rotation.y, toState.rotation.y, alpha);
          transform.rotation.z = THREE.MathUtils.lerp(fromState.rotation.z, toState.rotation.z, alpha);
        }
      }
    }
  }
}

// Global ECS instance
export const multiplayerECS = new MultiplayerECSSystem();