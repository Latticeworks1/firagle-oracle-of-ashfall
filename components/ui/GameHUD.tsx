import React from 'react';
import type { PlayerState, WeaponSchema } from '../../types';
import { WeaponType } from '../../types';

interface GameHUDProps {
    playerState: PlayerState;
    equippedWeapon: WeaponSchema;
}

const BarDisplay: React.FC<{ value: number, maxValue: number, colorClasses: string }> = ({ value, maxValue, colorClasses }) => {
    const percentage = Math.max(0, (value / maxValue) * 100);
    return (
        <div className="w-full h-full bg-black/50 overflow-hidden">
            <div
                className={`h-full ${colorClasses} transition-all duration-300 ease-out`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
};

const WeaponStatsDisplay: React.FC<{ weapon: WeaponSchema }> = ({ weapon }) => {
    if (weapon.type === WeaponType.Projectile) {
        return (
            <div className="font-mono text-sm text-gray-300 mt-1">
                DMG: {weapon.stats.damage} | SPLASH: {weapon.stats.splashDamage > 0 ? weapon.stats.splashDamage : 'N/A'}
            </div>
        );
    }
    if (weapon.type === WeaponType.HitscanChain) {
        return (
             <div className="font-mono text-sm text-gray-300 mt-1">
                DMG: {weapon.stats.damage} | CHAIN: {weapon.stats.maxChainTargets}
             </div>
        );
    }
    return null;
}

const GameHUD: React.FC<GameHUDProps> = ({ playerState, equippedWeapon }) => {
    return (
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none p-4 flex justify-between items-end text-white">

            {/* Left Side: Health & Score */}
            <div
                className="w-1/3 max-w-sm bg-black/40 p-3 rounded-tr-2xl rounded-bl-2xl backdrop-blur-sm border-t-2 border-l-2 border-orange-500/30 shadow-lg animate-slide-in-left"
            >
                <div className="flex items-center space-x-4">
                    <div className="w-40">
                         <div className="text-gray-400 text-xs font-bold tracking-widest">VITALITY</div>
                         <div className="relative w-full h-4 mt-1 border border-gray-600/80 rounded-sm">
                           <BarDisplay value={playerState.health} maxValue={playerState.maxHealth} colorClasses="bg-gradient-to-r from-red-500 to-red-400" />
                           <div className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-shadow">
                               {playerState.health} / {playerState.maxHealth}
                           </div>
                        </div>
                        { (playerState.shield > 0 || playerState.maxShield > 0) &&
                          <div className="relative w-full h-3 mt-1 border border-gray-600/80 rounded-sm">
                           <BarDisplay value={playerState.shield} maxValue={playerState.maxShield} colorClasses="bg-gradient-to-r from-blue-400 to-cyan-400" />
                           <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-shadow">
                               {playerState.shield} / {playerState.maxShield}
                           </div>
                          </div>
                        }
                    </div>
                    <div>
                         <div className="text-gray-400 text-xs font-bold tracking-widest">SCORE</div>
                         <div className="font-mono text-2xl text-yellow-300 tracking-tighter">
                            {playerState.score.toString().padStart(8, '0')}
                         </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Weapon Info */}
            <div
                className="w-1/3 max-w-sm bg-black/40 p-3 rounded-tl-2xl rounded-br-2xl backdrop-blur-sm border-t-2 border-r-2 border-purple-500/30 shadow-lg text-right animate-slide-in-right"
                key={equippedWeapon.id}
            >
                 <div className="text-gray-400 text-xs font-bold tracking-widest">EQUIPPED</div>
                 <div className="font-bold text-2xl text-orange-300 truncate" title={equippedWeapon.name}>
                    {equippedWeapon.name}
                 </div>
                 <WeaponStatsDisplay weapon={equippedWeapon} />
            </div>

            <style>{`
                .text-shadow {
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
                }
                .animate-slide-in-left {
                    animation: slideInFromLeft 0.5s ease-out forwards;
                }
                @keyframes slideInFromLeft {
                    from { opacity: 0; transform: translateX(-100%); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-slide-in-right {
                    animation: slideInFromRight 0.5s ease-out forwards;
                }
                @keyframes slideInFromRight {
                    from { opacity: 0; transform: translateX(100%); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};

export default GameHUD;
