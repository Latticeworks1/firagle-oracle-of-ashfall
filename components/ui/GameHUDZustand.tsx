import React from 'react';
import { 
  useGameStore, 
  usePlayerStore, 
  useWeaponStore,
  selectPlayerHealth,
  selectPlayerProgress,
  selectCurrentWeapon,
  selectCombatStats,
  selectUIState
} from '../../stores';

const GameHUDZustand: React.FC = () => {
  // Use selectors for optimized subscriptions
  const { showUI } = useGameStore(selectUIState);
  const { health, maxHealth, shield, maxShield, isDead } = usePlayerStore(selectPlayerHealth);
  const { score, level, experience } = usePlayerStore(selectPlayerProgress);
  const currentWeapon = useWeaponStore(selectCurrentWeapon);
  const combatStats = useWeaponStore(selectCombatStats);
  
  // Individual store actions
  const toggleInventory = useGameStore(state => state.toggleInventory);
  const showLore = useGameStore(state => state.showLore);
  const switchWeapon = useWeaponStore(state => state.switchWeapon);
  
  if (!showUI || isDead) return null;

  const healthPercentage = (health / maxHealth) * 100;
  const shieldPercentage = shield > 0 ? (shield / maxShield) * 100 : 0;
  const xpForNextLevel = level * 100; // Simple XP formula
  const xpPercentage = (experience / xpForNextLevel) * 100;

  return (
    <div className="game-hud">
      {/* Health and Shield Display */}
      <div className="hud-section health-section">
        <div className="health-bar-container">
          <div className="health-bar">
            <div 
              className="health-fill" 
              style={{ width: `${healthPercentage}%` }}
            />
            <span className="health-text">{health}/{maxHealth}</span>
          </div>
          {shield > 0 && (
            <div className="shield-bar">
              <div 
                className="shield-fill" 
                style={{ width: `${shieldPercentage}%` }}
              />
              <span className="shield-text">Shield: {shield}</span>
            </div>
          )}
        </div>
      </div>

      {/* Score and Level Display */}
      <div className="hud-section score-section">
        <div className="score-display">
          <span className="score-label">Score:</span>
          <span className="score-value">{score.toLocaleString()}</span>
        </div>
        <div className="level-display">
          <span className="level-label">Level {level}</span>
          <div className="xp-bar">
            <div 
              className="xp-fill" 
              style={{ width: `${xpPercentage}%` }}
            />
            <span className="xp-text">{experience}/{xpForNextLevel}</span>
          </div>
        </div>
      </div>

      {/* Weapon Display */}
      <div className="hud-section weapon-section">
        <div className="weapon-info">
          <h3 className="weapon-name">{currentWeapon.name}</h3>
          <div className="weapon-stats">
            <div className="stat">
              <span className="stat-label">Damage:</span>
              <span className="stat-value">{currentWeapon.stats.damage}</span>
            </div>
            {currentWeapon.type === 'projectile' && (
              <div className="stat">
                <span className="stat-label">Splash:</span>
                <span className="stat-value">{currentWeapon.stats.splashRadius}m</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Combat Statistics */}
      <div className="hud-section combat-stats">
        <h4>Combat Stats</h4>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Accuracy:</span>
            <span className="stat-value">{combatStats.accuracy.toFixed(1)}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Hits:</span>
            <span className="stat-value">{combatStats.totalHits}/{combatStats.totalShots}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Damage:</span>
            <span className="stat-value">{combatStats.totalDamage.toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Crits:</span>
            <span className="stat-value">{combatStats.criticalHits}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="hud-section action-buttons">
        <button 
          className="hud-button inventory-button"
          onClick={toggleInventory}
        >
          Inventory (I)
        </button>
        <button 
          className="hud-button lore-button"
          onClick={() => showLore('Welcome to the Oracle of Ashfall...')}
        >
          Oracle (O)
        </button>
        <button 
          className="hud-button weapon-switch-button"
          onClick={() => {
            // Cycle through weapons
            const weaponInventory = useWeaponStore.getState().weaponInventory;
            const currentIndex = weaponInventory.findIndex(w => w.id === currentWeapon.id);
            const nextIndex = (currentIndex + 1) % weaponInventory.length;
            switchWeapon(weaponInventory[nextIndex].id);
          }}
        >
          Switch Weapon (Tab)
        </button>
      </div>

      {/* Crosshair */}
      <div className="crosshair">
        <div className="crosshair-horizontal"></div>
        <div className="crosshair-vertical"></div>
      </div>
    </div>
  );
};

export default GameHUDZustand;