import React, { useRef, useCallback } from 'react';
import { AnimationState } from '../../types';

interface OnScreenControlsProps {
    onMove: (vec: { x: number; y: number }) => void;
    onLook: (vec: { dx: number; dy: number }) => void;
    onFireStart: () => void;
    onFireEnd: () => void;
    onDrawStart: () => void;
    onDrawEnd: () => void;
    animationState: AnimationState;
}

const OnScreenControls: React.FC<OnScreenControlsProps> = ({ onMove, onLook, onFireStart, onFireEnd, onDrawStart, onDrawEnd, animationState }) => {
    const joystickRef = useRef<HTMLDivElement>(null);
    const thumbstickRef = useRef<HTMLDivElement>(null);
    const lookAreaRef = useRef<HTMLDivElement>(null);

    const touchState = useRef({
        move: { id: -1, start: { x: 0, y: 0 } },
        look: { id: -1, last: { x: 0, y: 0 } },
    }).current;
    
    const joystickRadius = 64;

    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        e.preventDefault();
        for (const touch of Array.from(e.changedTouches)) {
            const target = touch.target as HTMLElement;

            if (joystickRef.current?.contains(target) && touchState.move.id === -1) {
                touchState.move.id = touch.identifier;
                const rect = joystickRef.current.getBoundingClientRect();
                touchState.move.start = { x: rect.left + joystickRadius, y: rect.top + joystickRadius };
            } 
            else if (lookAreaRef.current?.contains(target) && touchState.look.id === -1) {
                if ((target as HTMLElement).closest('button')) return;
                touchState.look.id = touch.identifier;
                touchState.look.last = { x: touch.clientX, y: touch.clientY };
            }
        }
    }, [touchState, joystickRadius]);

    const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        e.preventDefault();
        let lookDelta = { dx: 0, dy: 0 };

        for (const touch of Array.from(e.changedTouches)) {
            if (touch.identifier === touchState.move.id) {
                const dx = touch.clientX - touchState.move.start.x;
                const dy = touch.clientY - touchState.move.start.y;
                const dist = Math.min(Math.sqrt(dx * dx + dy * dy), joystickRadius);
                const angle = Math.atan2(dy, dx);
                
                const moveX = Math.cos(angle) * dist / joystickRadius;
                const moveY = Math.sin(angle) * dist / joystickRadius;
                
                onMove({ x: -moveX, y: moveY });

                if (thumbstickRef.current) {
                    thumbstickRef.current.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
                }
            } else if (touch.identifier === touchState.look.id) {
                lookDelta.dx += touch.clientX - touchState.look.last.x;
                lookDelta.dy += touch.clientY - touchState.look.last.y;
                touchState.look.last = { x: touch.clientX, y: touch.clientY };
            }
        }
        
        if (lookDelta.dx !== 0 || lookDelta.dy !== 0) {
            onLook(lookDelta);
        }
    }, [touchState, onMove, onLook, joystickRadius]);

    const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        e.preventDefault();
        for (const touch of Array.from(e.changedTouches)) {
            if (touch.identifier === touchState.move.id) {
                touchState.move.id = -1;
                onMove({ x: 0, y: 0 });
                if (thumbstickRef.current) {
                    thumbstickRef.current.style.transform = `translate(0px, 0px)`;
                }
            }
            if (touch.identifier === touchState.look.id) {
                touchState.look.id = -1;
            }
        }
    }, [touchState, onMove]);

    const isCharging = animationState === AnimationState.Charging || animationState === AnimationState.Charged;
    const fireButtonClasses = [
        "absolute right-6 bottom-6 w-24 h-24 rounded-full text-white font-bold text-lg tracking-wider transition-all duration-200 shadow-lg active:scale-95",
        "bg-red-800/60 border-2 border-red-500/80 backdrop-blur-sm",
        isCharging ? "animate-pulse-strong ring-4 ring-orange-400" : ""
    ].join(" ");
    
    return (
        <div 
            className="absolute inset-0 z-20"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div ref={lookAreaRef} className="absolute inset-0 w-full h-full"></div>

            <div
                ref={joystickRef}
                className="absolute left-6 bottom-6 w-32 h-32 bg-black/30 rounded-full border-2 border-gray-500/50 flex items-center justify-center pointer-events-auto"
            >
                <div 
                    ref={thumbstickRef}
                    className="w-16 h-16 bg-gray-400/50 rounded-full border-2 border-gray-300/60 transition-transform duration-75 pointer-events-none"
                ></div>
            </div>

             <button
                onTouchStart={onDrawStart}
                onTouchEnd={onDrawEnd}
                className="absolute left-[calc(24px+128px+24px)] bottom-14 w-20 h-20 rounded-full text-white font-bold tracking-wider transition-all duration-200 shadow-lg active:scale-95 bg-purple-800/60 border-2 border-purple-500/80 backdrop-blur-sm"
                style={{ WebkitTapHighlightColor: 'transparent' }}
            >
                DRAW
            </button>


            <button
                onTouchStart={onFireStart}
                onTouchEnd={onFireEnd}
                className={fireButtonClasses}
                style={{ WebkitTapHighlightColor: 'transparent' }}
            >
                FIRE
            </button>
            <style>{`
                .animate-pulse-strong {
                    animation: pulse-strong 1.5s infinite;
                }
                @keyframes pulse-strong {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.7);
                    }
                    50% {
                        transform: scale(1.05);
                        box-shadow: 0 0 10px 15px rgba(251, 146, 60, 0);
                    }
                }
            `}</style>
        </div>
    );
};

export default OnScreenControls;
