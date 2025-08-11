import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { eventBus } from '../systems/eventBus';

export interface GameState {
  // Core game state
  gameMode: 'menu' | 'playing' | 'paused' | 'game_over' | 'loading';
  gameStartTime: number;
  gameEndTime: number | null;
  isInitialized: boolean;
  
  // Performance & Settings
  performanceLevel: 'low' | 'medium' | 'high';
  enableParticles: boolean;
  enableSounds: boolean;
  masterVolume: number;
  
  // UI State
  showUI: boolean;
  showInventory: boolean;
  showLoreModal: boolean;
  showGestureCanvas: boolean;
  currentLoreContent: string;
  
  // Touch/Input
  isTouchDevice: boolean;
  inputMode: 'keyboard_mouse' | 'touch' | 'gamepad';
}

interface GameActions {
  // Game flow
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  restartGame: () => void;
  
  // UI actions
  toggleUI: () => void;
  toggleInventory: () => void;
  showLore: (content: string) => void;
  hideLore: () => void;
  toggleGestureCanvas: () => void;
  
  // Settings
  setPerformanceLevel: (level: 'low' | 'medium' | 'high') => void;
  toggleParticles: () => void;
  toggleSounds: () => void;
  setVolume: (volume: number) => void;
  setInputMode: (mode: 'keyboard_mouse' | 'touch' | 'gamepad') => void;
  
  // System
  initialize: () => void;
  cleanup: () => void;
}

type GameStore = GameState & GameActions;

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    gameMode: 'menu',
    gameStartTime: 0,
    gameEndTime: null,
    isInitialized: false,
    
    performanceLevel: 'high',
    enableParticles: true,
    enableSounds: true,
    masterVolume: 0.7,
    
    showUI: true,
    showInventory: false,
    showLoreModal: false,
    showGestureCanvas: false,
    currentLoreContent: '',
    
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    inputMode: 'ontouchstart' in window || navigator.maxTouchPoints > 0 ? 'touch' : 'keyboard_mouse',
    
    // Game flow actions
    startGame: () => {
      set({ 
        gameMode: 'playing', 
        gameStartTime: Date.now(), 
        gameEndTime: null,
        showInventory: false,
        showLoreModal: false 
      });
      eventBus.dispatch('GAME_STARTED', {});
    },
    
    pauseGame: () => {
      const { gameMode } = get();
      if (gameMode === 'playing') {
        set({ gameMode: 'paused' });
        eventBus.dispatch('GAME_PAUSED', {});
      }
    },
    
    resumeGame: () => {
      const { gameMode } = get();
      if (gameMode === 'paused') {
        set({ gameMode: 'playing' });
        eventBus.dispatch('GAME_RESUMED', {});
      }
    },
    
    endGame: () => {
      set({ 
        gameMode: 'game_over', 
        gameEndTime: Date.now() 
      });
      eventBus.dispatch('GAME_ENDED', { 
        duration: Date.now() - get().gameStartTime 
      });
    },
    
    restartGame: () => {
      set({ 
        gameMode: 'loading',
        gameStartTime: 0,
        gameEndTime: null,
        showInventory: false,
        showLoreModal: false,
        showGestureCanvas: false 
      });
      
      // Brief loading delay then start
      setTimeout(() => {
        get().startGame();
      }, 500);
      
      eventBus.dispatch('GAME_RESTARTED', {});
    },
    
    // UI actions
    toggleUI: () => {
      set(state => ({ showUI: !state.showUI }));
    },
    
    toggleInventory: () => {
      set(state => ({ 
        showInventory: !state.showInventory,
        showLoreModal: false // Close lore when opening inventory
      }));
    },
    
    showLore: (content: string) => {
      set({ 
        showLoreModal: true, 
        currentLoreContent: content,
        showInventory: false // Close inventory when showing lore
      });
    },
    
    hideLore: () => {
      set({ showLoreModal: false, currentLoreContent: '' });
    },
    
    toggleGestureCanvas: () => {
      set(state => ({ showGestureCanvas: !state.showGestureCanvas }));
    },
    
    // Settings actions
    setPerformanceLevel: (level) => {
      set({ performanceLevel: level });
      eventBus.dispatch('PERFORMANCE_LEVEL_CHANGED', { level });
    },
    
    toggleParticles: () => {
      set(state => ({ enableParticles: !state.enableParticles }));
    },
    
    toggleSounds: () => {
      set(state => ({ enableSounds: !state.enableSounds }));
    },
    
    setVolume: (volume) => {
      set({ masterVolume: Math.max(0, Math.min(1, volume)) });
    },
    
    setInputMode: (mode) => {
      set({ inputMode: mode });
      eventBus.dispatch('INPUT_MODE_CHANGED', { mode });
    },
    
    // System actions
    initialize: () => {
      if (get().isInitialized) return;
      
      // Detect device capabilities
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const inputMode = isTouchDevice ? 'touch' : 'keyboard_mouse';
      
      // Set initial performance based on device
      let performanceLevel: 'low' | 'medium' | 'high' = 'high';
      if (navigator.hardwareConcurrency < 4) {
        performanceLevel = 'low';
      } else if (navigator.hardwareConcurrency < 8) {
        performanceLevel = 'medium';
      }
      
      set({ 
        isInitialized: true,
        isTouchDevice,
        inputMode,
        performanceLevel
      });
      
      eventBus.dispatch('GAME_INITIALIZED', { 
        isTouchDevice, 
        inputMode, 
        performanceLevel 
      });
    },
    
    cleanup: () => {
      set({ 
        gameMode: 'menu',
        gameStartTime: 0,
        gameEndTime: null,
        showInventory: false,
        showLoreModal: false,
        showGestureCanvas: false,
        currentLoreContent: ''
      });
      eventBus.dispatch('GAME_CLEANUP', {});
    }
  }))
);

// Selectors for optimized component subscriptions
export const selectGameMode = (state: GameStore) => state.gameMode;
export const selectIsPlaying = (state: GameStore) => state.gameMode === 'playing';
export const selectUIState = (state: GameStore) => ({
  showUI: state.showUI,
  showInventory: state.showInventory,
  showLoreModal: state.showLoreModal,
  showGestureCanvas: state.showGestureCanvas,
  currentLoreContent: state.currentLoreContent
});
export const selectSettings = (state: GameStore) => ({
  performanceLevel: state.performanceLevel,
  enableParticles: state.enableParticles,
  enableSounds: state.enableSounds,
  masterVolume: state.masterVolume
});
export const selectInputState = (state: GameStore) => ({
  isTouchDevice: state.isTouchDevice,
  inputMode: state.inputMode
});

// Auto-initialize on first import
useGameStore.getState().initialize();