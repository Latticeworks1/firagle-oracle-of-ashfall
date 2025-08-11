import React, { useState, useEffect } from 'react';
import { eventBus } from '../../systems/eventBus';
import type { PlayerState, WeaponSchema, AnimationState } from '../../types';
import type { DebugData } from './PlayerDebugTracker';

interface PlayerDebuggerProps {
    debugData: DebugData;
    playerState: PlayerState;
    equippedWeapon: WeaponSchema;
    animationState: AnimationState;
    isVisible?: boolean;
}

const PlayerDebugger: React.FC<PlayerDebuggerProps> = ({
    debugData,
    playerState,
    equippedWeapon,
    animationState,
    isVisible = true
}) => {

    const [eventLog, setEventLog] = useState<string[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    // Track game events for debugging
    useEffect(() => {
        const addLogEntry = (eventName: string, data?: any) => {
            const timestamp = new Date().toLocaleTimeString();
            const entry = `${timestamp} - ${eventName}${data ? `: ${JSON.stringify(data)}` : ''}`;
            setEventLog(prev => [entry, ...prev.slice(0, 9)]); // Keep last 10 events
        };

        const handlers = [
            { event: 'PLAYER_POSITION_UPDATED', handler: (data: any) => addLogEntry('Position Update', { x: data.position.x.toFixed(2), y: data.position.y.toFixed(2), z: data.position.z.toFixed(2) }) },
            { event: 'PLAYER_TOOK_DAMAGE', handler: (data: any) => addLogEntry('Took Damage', { amount: data.amount }) },
            { event: 'WEAPON_FIRED', handler: (data: any) => addLogEntry('Weapon Fired', { type: data.type }) },
            { event: 'ENEMY_HIT', handler: (data: any) => addLogEntry('Enemy Hit', { damage: data.damage }) },
        ];

        handlers.forEach(({ event, handler }) => {
            eventBus.on(event, handler);
        });

        return () => {
            handlers.forEach(({ event, handler }) => {
                eventBus.off(event, handler);
            });
        };
    }, []);

    // Debug data now comes from props (passed from PlayerDebugTracker inside Canvas)

    if (!isVisible) return null;

    return (
        <div className="fixed top-4 right-4 bg-black bg-opacity-75 text-green-400 text-xs font-mono p-3 rounded-lg max-w-sm z-50 border border-green-800">
            <div className="flex justify-between items-center mb-2">
                <span className="text-green-300 font-bold">Player Debug</span>
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-green-500 hover:text-green-300 px-2 py-1 bg-green-900 rounded text-xs"
                >
                    {isExpanded ? '−' : '+'}
                </button>
            </div>
            
            {/* Always visible - critical spawn info */}
            <div className="space-y-1 mb-2 text-xs">
                <div className="text-yellow-400">
                    <strong>Position:</strong> ({debugData.position.x.toFixed(2)}, {debugData.position.y.toFixed(2)}, {debugData.position.z.toFixed(2)})
                </div>
                <div className="text-yellow-400">
                    <strong>Terrain H:</strong> {debugData.terrainHeight.toFixed(2)} | 
                    <strong> Above:</strong> {debugData.heightAboveTerrain.toFixed(2)} | 
                    <span className={debugData.isGrounded ? 'text-green-400' : 'text-red-400'}>
                        {debugData.isGrounded ? ' ✓ Grounded' : ' ✗ Airborne'}
                    </span>
                </div>
            </div>

            {isExpanded && (
                <>
                    {/* Player State */}
                    <div className="space-y-1 mb-3 text-xs border-t border-green-800 pt-2">
                        <div><strong>Health:</strong> {playerState.health}/{playerState.maxHealth}</div>
                        <div><strong>Shield:</strong> {playerState.shield}/{playerState.maxShield}</div>
                        <div><strong>Score:</strong> {playerState.score}</div>
                        <div className={playerState.isDead ? 'text-red-400' : 'text-green-400'}>
                            <strong>Status:</strong> {playerState.isDead ? 'DEAD' : 'ALIVE'}
                        </div>
                    </div>

                    {/* Physics */}
                    <div className="space-y-1 mb-3 text-xs border-t border-green-800 pt-2">
                        <div><strong>Velocity:</strong> ({debugData.velocity.x.toFixed(2)}, {debugData.velocity.y.toFixed(2)}, {debugData.velocity.z.toFixed(2)})</div>
                        <div><strong>Speed:</strong> {debugData.velocity.length().toFixed(2)} m/s</div>
                        <div><strong>Mass:</strong> {debugData.mass.toFixed(1)} kg</div>
                        <div><strong>Rotation Y:</strong> {(debugData.rotationY * 180 / Math.PI).toFixed(1)}°</div>
                    </div>

                    {/* Weapon */}
                    <div className="space-y-1 mb-3 text-xs border-t border-green-800 pt-2">
                        <div><strong>Weapon:</strong> {equippedWeapon.name}</div>
                        <div><strong>Type:</strong> {equippedWeapon.type}</div>
                        <div><strong>Model:</strong> {equippedWeapon.modelId}</div>
                        <div><strong>Animation:</strong> {AnimationState[animationState]}</div>
                    </div>

                    {/* Event Log */}
                    <div className="border-t border-green-800 pt-2">
                        <div className="text-green-300 font-bold mb-1">Recent Events:</div>
                        <div className="max-h-20 overflow-y-auto text-xs">
                            {eventLog.map((entry, i) => (
                                <div key={i} className="text-gray-300 truncate">{entry}</div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PlayerDebugger;