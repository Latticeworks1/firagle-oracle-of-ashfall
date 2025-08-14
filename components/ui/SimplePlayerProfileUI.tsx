import React from 'react';

interface SimplePlayerProfileUIProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Simple Player Profile UI - Replaces complex cloud-dependent profile system
 * 
 * Shows basic offline game statistics without cloud integration
 */
const SimplePlayerProfileUI: React.FC<SimplePlayerProfileUIProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    
    return (
        <div className="modal profile-modal">
            <div className="modal__content profile-content">
                <div className="profile-layout">
                    {/* Profile Header */}
                    <div className="profile-header">
                        <h2 className="profile-title">PLAYER PROFILE</h2>
                        <p className="profile-subtitle">Your journey through the volcanic realm</p>
                    </div>

                    <div className="profile-sections-grid">
                        {/* Left Column - Game Status */}
                        <div className="profile-column">
                            <div className="profile-section">
                                <h3 className="profile-section-title">GAME STATUS</h3>
                                <div className="profile-stats-grid">
                                    <div className="profile-stat-row">
                                        <span className="profile-stat-label">Game Mode</span>
                                        <span className="profile-stat-value">Local Play</span>
                                    </div>
                                    <div className="profile-stat-row">
                                        <span className="profile-stat-label">Difficulty</span>
                                        <span className="profile-stat-value">Normal</span>
                                    </div>
                                    <div className="profile-stat-row">
                                        <span className="profile-stat-label">Current Location</span>
                                        <span className="profile-stat-value">Volcanic Crater</span>
                                    </div>
                                    <div className="profile-stat-row">
                                        <span className="profile-stat-label">Staff Wielded</span>
                                        <span className="profile-stat-value">Firagle</span>
                                    </div>
                                </div>
                            </div>

                            <div className="profile-section">
                                <h3 className="profile-section-title">CAPABILITIES</h3>
                                <div className="profile-abilities">
                                    <div className="profile-ability">
                                        <span className="profile-ability-name">Fire Nova</span>
                                        <span className="profile-ability-type">Gesture Spell</span>
                                    </div>
                                    <div className="profile-ability">
                                        <span className="profile-ability-name">Protective Ward</span>
                                        <span className="profile-ability-type">Gesture Spell</span>
                                    </div>
                                    <div className="profile-ability">
                                        <span className="profile-ability-name">Projectile Magic</span>
                                        <span className="profile-ability-type">Charged Attack</span>
                                    </div>
                                    <div className="profile-ability">
                                        <span className="profile-ability-name">Chain Lightning</span>
                                        <span className="profile-ability-type">Weapon Skill</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - About & Controls */}
                        <div className="profile-column">
                            <div className="profile-section">
                                <h3 className="profile-section-title">ABOUT THE REALM</h3>
                                <div className="profile-lore">
                                    <p>
                                        In the volcanic realm of Ashfall, you wield the ancient staff Firagle
                                        against the encroaching rock monsters that emerge from the molten depths.
                                        Master both charged projectile magic and gesture-based spells to survive
                                        the endless siege.
                                    </p>
                                    <p>
                                        The Oracle of Ashfall holds the secrets of this realm - consult the
                                        ancient wisdom to uncover the mysteries of your magical abilities
                                        and the creatures you face.
                                    </p>
                                </div>
                            </div>

                            <div className="profile-section">
                                <h3 className="profile-section-title">QUICK REFERENCE</h3>
                                <div className="profile-controls-compact">
                                    <div className="profile-control-row">
                                        <span className="profile-control-key">WASD</span>
                                        <span className="profile-control-desc">Movement</span>
                                    </div>
                                    <div className="profile-control-row">
                                        <span className="profile-control-key">Mouse</span>
                                        <span className="profile-control-desc">Look Around</span>
                                    </div>
                                    <div className="profile-control-row">
                                        <span className="profile-control-key">Click & Hold</span>
                                        <span className="profile-control-desc">Charge Magic</span>
                                    </div>
                                    <div className="profile-control-row">
                                        <span className="profile-control-key">Right Click + Drag</span>
                                        <span className="profile-control-desc">Cast Gestures</span>
                                    </div>
                                    <div className="profile-control-row">
                                        <span className="profile-control-key">I</span>
                                        <span className="profile-control-desc">Armory</span>
                                    </div>
                                    <div className="profile-control-row">
                                        <span className="profile-control-key">T</span>
                                        <span className="profile-control-desc">Oracle</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <button onClick={onClose} className="modal__close">&times;</button>
            </div>
        </div>
    );
};

export default SimplePlayerProfileUI;