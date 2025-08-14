import React, { useState } from 'react';
import type { WeaponSchema, ProjectileWeaponSchema, ChainWeaponSchema } from '../../types';
import { WeaponType } from '../../types';

interface InventoryUIProps {
    isOpen: boolean;
    onClose: () => void;
    inventory: WeaponSchema[];
    equippedWeaponId: string;
    onEquip: (weaponId: string) => void;
}

const StatRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="inventory-stat-row">
        <span className="inventory-stat-label">{label}</span>
        <span className="inventory-stat-value">{value}</span>
    </div>
);

const WeaponStatsDisplay: React.FC<{ weapon: WeaponSchema }> = ({ weapon }) => {
    const { stats } = weapon;
    return (
        <>
            <StatRow label="Damage" value={stats.damage} />
            {weapon.type === WeaponType.Projectile && (
                <>
                    <StatRow label="Splash Damage" value={(stats as ProjectileWeaponSchema['stats']).splashDamage} />
                    <StatRow label="Splash Radius" value={`${(stats as ProjectileWeaponSchema['stats']).splashRadius}m`} />
                    <StatRow label="Projectile Speed" value={(stats as ProjectileWeaponSchema['stats']).projectileSpeed} />
                </>
            )}
            {weapon.type === WeaponType.HitscanChain && (
                 <>
                    <StatRow label="Max Targets" value={(stats as ChainWeaponSchema['stats']).maxChainTargets} />
                    <StatRow label="Chain Radius" value={`${(stats as ChainWeaponSchema['stats']).chainRadius}m`} />
                    <StatRow label="Damage Falloff" value={`${(stats as ChainWeaponSchema['stats']).damageFalloff * 100}%`} />
                 </>
            )}
            <StatRow label="Charge Time" value={`${stats.chargeDuration}ms`} />
        </>
    );
}


const InventoryUI: React.FC<InventoryUIProps> = ({ isOpen, onClose, inventory, equippedWeaponId, onEquip }) => {
    const [selectedWeapon, setSelectedWeapon] = useState<WeaponSchema | null>(
        inventory.find(w => w.id === equippedWeaponId) || inventory[0] || null
    );

    if (!isOpen) return null;

    const handleSelectWeapon = (weapon: WeaponSchema) => {
        setSelectedWeapon(weapon);
    };

    return (
        <div className="modal inventory-modal" role="dialog" aria-modal="true" onClick={onClose}>
            <div className="modal__content inventory-content" onClick={(e) => e.stopPropagation()}>
                
                {/* Weapon List */}
                <div className="inventory-sidebar">
                    <h2 className="heading">ARMORY</h2>
                    <ul className="inventory-weapon-list">
                        {inventory.map(weapon => (
                            <li key={weapon.id}>
                                <button 
                                    onClick={() => handleSelectWeapon(weapon)}
                                    className={`inventory-weapon-btn ${selectedWeapon?.id === weapon.id ? 'inventory-weapon-btn--selected' : ''}`}
                                >
                                    {weapon.name}
                                    {equippedWeaponId === weapon.id && <span className="inventory-equipped-tag">[EQUIPPED]</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Selected Weapon Details */}
                <div className="inventory-details">
                    {selectedWeapon ? (
                        <>
                            <h3 className="inventory-weapon-title">{selectedWeapon.name}</h3>
                            <p className="inventory-weapon-description">{selectedWeapon.description}</p>
                            
                            <div className="inventory-stats">
                               <WeaponStatsDisplay weapon={selectedWeapon} />
                            </div>

                            <button
                                onClick={() => onEquip(selectedWeapon.id)}
                                disabled={equippedWeaponId === selectedWeapon.id}
                                className={`btn btn--primary inventory-equip-btn ${equippedWeaponId === selectedWeapon.id ? 'btn--disabled' : ''}`}
                            >
                                {equippedWeaponId === selectedWeapon.id ? 'EQUIPPED' : 'EQUIP WEAPON'}
                            </button>
                        </>
                    ) : (
                        <div className="inventory-no-selection">
                            <p>Select a weapon to view details.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InventoryUI;