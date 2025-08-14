import React from 'react';
import type { PlayerState, WeaponSchema } from '../../types';
import { WeaponType, AnimationState } from '../../types';
import { IS_TOUCH_DEVICE } from '../../constants';

interface GameHUDProps {
    playerState: PlayerState;
    equippedWeapon: WeaponSchema;
    animationState: AnimationState;
    onExport: () => void;
    onOpenLoreModal: () => void;
}

const BarDisplay: React.FC<{ value: number, maxValue: number, variant: string }> = ({ value, maxValue, variant }) => {
    const percentage = Math.max(0, (value / maxValue) * 100);
    return (
        <div className={`progress-bar progress-bar--${variant}`}>
            <div className="progress-bar__fill" style={{ width: `${percentage}%` }} />
            <div className="progress-bar__text">{value} / {maxValue}</div>
        </div>
    );
};

const WeaponStatsDisplay: React.FC<{ weapon: WeaponSchema }> = ({ weapon }) => {
    if (weapon.type === WeaponType.Projectile) {
        return (
            <>
                <div className="hud-stat-row">
                    <span className="hud-stat-label">Damage</span>
                    <span className="hud-stat-value">{weapon.stats.damage}</span>
                </div>
                <div className="hud-stat-row">
                    <span className="hud-stat-label">Splash</span>
                    <span className="hud-stat-value">{weapon.stats.splashDamage > 0 ? weapon.stats.splashDamage : 'N/A'}</span>
                </div>
            </>
        );
    }
    if (weapon.type === WeaponType.HitscanChain) {
        return (
            <>
                <div className="hud-stat-row">
                    <span className="hud-stat-label">Damage</span>
                    <span className="hud-stat-value">{weapon.stats.damage}</span>
                </div>
                <div className="hud-stat-row">
                    <span className="hud-stat-label">Chain</span>
                    <span className="hud-stat-value">{weapon.stats.maxChainTargets}</span>
                </div>
            </>
        );
    }
    return null;
}

const GameHUD: React.FC<GameHUDProps> = ({ playerState, equippedWeapon, animationState, onExport, onOpenLoreModal }) => {
    const stateText = AnimationState[animationState].toUpperCase();
    
    return (
        <>
            <div className="hud-container">
                {/* Vitals Panel - Left Side */}
                <div className="hud-vitals-panel">
                    <div className="hud-section">
                        <h3 className="hud-section-title">VITALITY</h3>
                        <div className="hud-stats-grid">
                            <div className="hud-stat-row">
                                <span className="hud-stat-label">Health</span>
                                <div className={`progress-bar progress-bar--health ${playerState.health < playerState.maxHealth * 0.3 ? 'progress-bar--critical' : ''}`}>
                                    <div className="progress-bar__fill" style={{width: `${(playerState.health / playerState.maxHealth) * 100}%`}}></div>
                                    <div className="progress-bar__text">{playerState.health} / {playerState.maxHealth}</div>
                                </div>
                            </div>
                            
                            {(playerState.shield > 0 || playerState.maxShield > 0) && (
                                <div className="hud-stat-row">
                                    <span className="hud-stat-label">Shield</span>
                                    <div className="progress-bar progress-bar--shield">
                                        <div className="progress-bar__fill" style={{width: `${(playerState.shield / playerState.maxShield) * 100}%`}}></div>
                                        <div className="progress-bar__text">{playerState.shield} / {playerState.maxShield}</div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="hud-stat-row hud-stat-row--score">
                                <span className="hud-stat-label">Score</span>
                                <span className="hud-stat-value hud-stat-value--score">
                                    {playerState.score.toString().padStart(8, '0')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Weapon Panel - Right Side */}
                <div className="hud-weapon-panel" key={equippedWeapon.id}>
                    <div className="hud-section">
                        <h3 className="hud-section-title">{equippedWeapon.name}</h3>
                        <div className="hud-stats-grid">
                            <WeaponStatsDisplay weapon={equippedWeapon} />
                            <div className="hud-stat-row hud-stat-row--status">
                                <span className="hud-stat-label">Status</span>
                                <span className={`hud-stat-value hud-weapon-status hud-weapon-status--${animationState === AnimationState.Charging ? 'charging' : animationState === AnimationState.Charged ? 'charged' : animationState === AnimationState.Discharging ? 'discharging' : 'idle'}`}>
                                    {stateText}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="crosshair">
                +
            </div>
        </>
    );
};

export default GameHUD;
