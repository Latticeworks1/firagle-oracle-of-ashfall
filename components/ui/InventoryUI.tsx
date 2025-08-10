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
    <div className="flex justify-between items-center text-sm py-1.5 border-b border-gray-700/50">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono text-orange-300">{value}</span>
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
        <div className="inventory-panel absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
            <div className="bg-gray-900/80 backdrop-blur-md rounded-lg shadow-2xl text-white w-full max-w-4xl h-[60vh] p-4 md:p-6 border border-yellow-500/30 animate-fade-in flex space-x-6" onClick={(e) => e.stopPropagation()}>
                
                {/* Weapon List */}
                <div className="w-1/3 border-r border-yellow-500/20 pr-6">
                    <h2 className="text-xl font-bold text-yellow-300 tracking-wider mb-4">ARMORY</h2>
                    <ul className="space-y-2 h-[calc(100%-40px)] overflow-y-auto custom-scrollbar">
                        {inventory.map(weapon => (
                            <li key={weapon.id}>
                                <button 
                                    onClick={() => handleSelectWeapon(weapon)}
                                    className={`w-full text-left p-3 rounded-md transition-colors text-lg ${selectedWeapon?.id === weapon.id ? 'bg-purple-800/60 ring-2 ring-purple-500' : 'bg-gray-800/50 hover:bg-gray-700/50'}`}
                                >
                                    {weapon.name}
                                    {equippedWeaponId === weapon.id && <span className="text-xs text-green-400 ml-2">[EQUIPPED]</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Selected Weapon Details */}
                <div className="w-2/3 flex flex-col">
                    {selectedWeapon ? (
                        <>
                            <h3 className="text-3xl font-bold text-orange-300 tracking-wide">{selectedWeapon.name}</h3>
                            <p className="text-gray-400 mt-2 mb-6 italic h-16">{selectedWeapon.description}</p>
                            
                            <div className="flex-grow mb-4">
                               <WeaponStatsDisplay weapon={selectedWeapon} />
                            </div>

                            <button
                                onClick={() => onEquip(selectedWeapon.id)}
                                disabled={equippedWeaponId === selectedWeapon.id}
                                className="w-full mt-auto px-4 py-3 bg-green-700 text-white font-bold text-lg rounded-md hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 transform active:scale-95 shadow-lg"
                            >
                                {equippedWeaponId === selectedWeapon.id ? 'EQUIPPED' : 'EQUIP WEAPON'}
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500">Select a weapon to view details.</p>
                        </div>
                    )}
                </div>
            </div>
             <style>{`
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #4a0072; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6a00a3; }
            `}</style>
        </div>
    );
};

export default InventoryUI;