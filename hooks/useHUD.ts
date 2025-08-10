import { useState, useCallback, useMemo } from 'react';
import type { PlayerState, WeaponSchema, AnimationState } from '../types';

// Custom hook for HUD state management
export const useHUD = () => {
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isLoreModalOpen, setIsLoreModalOpen] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);

  const toggleInventory = useCallback(() => {
    setIsInventoryOpen(prev => !prev);
  }, []);

  const closeInventory = useCallback(() => {
    setIsInventoryOpen(false);
  }, []);

  const openInventory = useCallback(() => {
    setIsInventoryOpen(true);
  }, []);

  const toggleLoreModal = useCallback(() => {
    setIsLoreModalOpen(prev => !prev);
  }, []);

  const closeLoreModal = useCallback(() => {
    setIsLoreModalOpen(false);
  }, []);

  const openLoreModal = useCallback(() => {
    setIsLoreModalOpen(true);
  }, []);

  const toggleHUD = useCallback(() => {
    setHudVisible(prev => !prev);
  }, []);

  const hideHUD = useCallback(() => {
    setHudVisible(false);
  }, []);

  const showHUD = useCallback(() => {
    setHudVisible(true);
  }, []);

  return {
    // Inventory state
    isInventoryOpen,
    toggleInventory,
    closeInventory,
    openInventory,
    
    // Lore modal state
    isLoreModalOpen,
    toggleLoreModal,
    closeLoreModal,
    openLoreModal,
    
    // HUD visibility
    hudVisible,
    toggleHUD,
    hideHUD,
    showHUD
  };
};

// Hook for player state calculations and derived values
export const usePlayerState = (playerState: PlayerState) => {
  const healthPercentage = useMemo(() => 
    Math.max(0, (playerState.health / playerState.maxHealth) * 100), 
    [playerState.health, playerState.maxHealth]
  );

  const shieldPercentage = useMemo(() => 
    playerState.maxShield > 0 
      ? Math.max(0, (playerState.shield / playerState.maxShield) * 100)
      : 0,
    [playerState.shield, playerState.maxShield]
  );

  const isLowHealth = useMemo(() => 
    healthPercentage < 25, 
    [healthPercentage]
  );

  const isCriticalHealth = useMemo(() => 
    healthPercentage < 10, 
    [healthPercentage]
  );

  const hasShield = useMemo(() => 
    playerState.maxShield > 0, 
    [playerState.maxShield]
  );

  const formattedScore = useMemo(() => 
    playerState.score.toString().padStart(8, '0'), 
    [playerState.score]
  );

  return {
    healthPercentage,
    shieldPercentage,
    isLowHealth,
    isCriticalHealth,
    hasShield,
    formattedScore
  };
};

// Hook for weapon state and display logic
export const useWeaponState = (weapon: WeaponSchema) => {
  const weaponStats = useMemo(() => {
    const stats = weapon.stats;
    return {
      damage: stats.damage,
      chargeTime: stats.chargeDuration,
      // Type-specific stats
      splashDamage: 'splashDamage' in stats ? stats.splashDamage : undefined,
      splashRadius: 'splashRadius' in stats ? stats.splashRadius : undefined,
      projectileSpeed: 'projectileSpeed' in stats ? stats.projectileSpeed : undefined,
      maxChainTargets: 'maxChainTargets' in stats ? stats.maxChainTargets : undefined,
      chainRadius: 'chainRadius' in stats ? stats.chainRadius : undefined,
      damageFalloff: 'damageFalloff' in stats ? stats.damageFalloff : undefined
    };
  }, [weapon.stats]);

  const displayStats = useMemo(() => {
    const lines = [`DMG: ${weaponStats.damage}`];
    
    if (weaponStats.splashDamage && weaponStats.splashDamage > 0) {
      lines.push(`SPLASH: ${weaponStats.splashDamage}`);
    }
    
    if (weaponStats.maxChainTargets) {
      lines.push(`CHAIN: ${weaponStats.maxChainTargets}`);
    }
    
    return lines.join(' | ');
  }, [weaponStats]);

  return {
    weaponStats,
    displayStats
  };
};

// Hook for animation state display logic
export const useAnimationState = (state: AnimationState) => {
  const stateText = useMemo(() => 
    AnimationState[state]?.toUpperCase() || 'UNKNOWN', 
    [state]
  );

  const stateColor = useMemo(() => {
    switch (state) {
      case AnimationState.Charged: return 'charged';
      case AnimationState.Charging: return 'charging';
      case AnimationState.Discharging: return 'discharging';
      case AnimationState.Decay: return 'decay';
      case AnimationState.Idle:
      default: return 'idle';
    }
  }, [state]);

  const isActive = useMemo(() => 
    state !== AnimationState.Idle, 
    [state]
  );

  const isPowered = useMemo(() => 
    state === AnimationState.Charged || state === AnimationState.Discharging, 
    [state]
  );

  return {
    stateText,
    stateColor,
    isActive,
    isPowered
  };
};

// Hook for responsive HUD layout
export const useHUDLayout = () => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768 && window.innerWidth < 1024;
    }
    return false;
  });

  const updateLayout = useCallback(() => {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    }
  }, []);

  // Could add resize listener here if needed
  // useEffect(() => {
  //   window.addEventListener('resize', updateLayout);
  //   return () => window.removeEventListener('resize', updateLayout);
  // }, [updateLayout]);

  const layoutConfig = useMemo(() => ({
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    showFullControls: !isMobile,
    compactMode: isMobile,
    showTooltips: !isMobile
  }), [isMobile, isTablet]);

  return layoutConfig;
};