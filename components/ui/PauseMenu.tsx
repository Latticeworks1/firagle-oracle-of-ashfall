import React from 'react';
import { IS_TOUCH_DEVICE } from '../../constants';

interface PauseMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: () => void;
    onOpenLoreModal: () => void;
    onOpenInventory: () => void;
    onOpenProfile: () => void;
    onReturnToMainMenu?: () => void;
}

const PauseMenu: React.FC<PauseMenuProps> = ({ 
    isOpen, 
    onClose, 
    onExport, 
    onOpenLoreModal, 
    onOpenInventory, 
    onOpenProfile,
    onReturnToMainMenu 
}) => {
    if (!isOpen) return null;

    const handleMenuAction = (action: () => void) => {
        action();
        onClose(); // Close pause menu after action
    };

    return (
        <div className="modal pause-modal" role="dialog" aria-modal="true">
            <div className="modal__content pause-content">
                <div className="pause-layout">
                    {/* Left Sidebar - Actions */}
                    <div className="pause-sidebar">
                        <h2 className="pause-main-title">GAME PAUSED</h2>
                        
                        <div className="pause-section">
                            <h3 className="pause-section-title">QUICK ACTIONS</h3>
                            <div className="pause-action-list">
                                <button 
                                    onClick={onClose} 
                                    className="pause-action-btn pause-action-btn--primary"
                                >
                                    Resume Game
                                </button>
                                
                                <button 
                                    onClick={() => handleMenuAction(onOpenInventory)} 
                                    className="pause-action-btn pause-action-btn--magic"
                                >
                                    Armory / Inventory
                                </button>
                                
                                <button 
                                    onClick={() => handleMenuAction(onOpenProfile)} 
                                    className="pause-action-btn pause-action-btn--info"
                                >
                                    Player Profile
                                </button>
                                
                                <button 
                                    onClick={() => handleMenuAction(onOpenLoreModal)} 
                                    className="pause-action-btn pause-action-btn--magic"
                                >
                                    Oracle of Ashfall
                                </button>
                                
                                {!IS_TOUCH_DEVICE && (
                                    <button 
                                        onClick={() => handleMenuAction(onExport)} 
                                        className="pause-action-btn pause-action-btn--info"
                                    >
                                        Export Weapon Data
                                    </button>
                                )}
                                
                                {onReturnToMainMenu && (
                                    <button 
                                        onClick={onReturnToMainMenu} 
                                        className="pause-action-btn pause-action-btn--danger"
                                    >
                                        Exit to Main Menu
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Controls */}
                    <div className="pause-details">
                        <div className="pause-section">
                            <h3 className="pause-section-title">CONTROLS</h3>
                            <div className="pause-controls-grid">
                                {IS_TOUCH_DEVICE ? (
                                    <>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">Left Joystick</span>
                                            <span className="pause-control-desc">Move Character</span>
                                        </div>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">Drag Screen</span>
                                            <span className="pause-control-desc">Look Around</span>
                                        </div>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">Fire Button</span>
                                            <span className="pause-control-desc">Charge/Release Weapon</span>
                                        </div>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">Draw Button</span>
                                            <span className="pause-control-desc">Cast Gesture Spells</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">WASD</span>
                                            <span className="pause-control-desc">Move Character</span>
                                        </div>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">Mouse</span>
                                            <span className="pause-control-desc">Look Around</span>
                                        </div>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">Click & Hold</span>
                                            <span className="pause-control-desc">Charge Weapon</span>
                                        </div>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">Right Click + Drag</span>
                                            <span className="pause-control-desc">Draw Gesture Spells</span>
                                        </div>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">Space</span>
                                            <span className="pause-control-desc">Jump</span>
                                        </div>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">I</span>
                                            <span className="pause-control-desc">Toggle Inventory</span>
                                        </div>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">T</span>
                                            <span className="pause-control-desc">Open Oracle</span>
                                        </div>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">P</span>
                                            <span className="pause-control-desc">Player Profile</span>
                                        </div>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">ESC</span>
                                            <span className="pause-control-desc">Pause Menu</span>
                                        </div>
                                        <div className="pause-control-row">
                                            <span className="pause-control-key">Tab</span>
                                            <span className="pause-control-desc">Debug Info</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                
                <button onClick={onClose} className="modal__close">&times;</button>
            </div>
        </div>
    );
};

export default PauseMenu;