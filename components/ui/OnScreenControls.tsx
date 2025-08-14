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
    
    return (
        <div 
            className="touch-controls"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div ref={lookAreaRef} className="absolute inset-0 w-full h-full"></div>

            <div ref={joystickRef} className="touch-joystick">
                <div ref={thumbstickRef} className="touch-joystick-thumb"></div>
            </div>

            <button
                onTouchStart={onDrawStart}
                onTouchEnd={onDrawEnd}
                className="touch-button touch-button--draw"
            >
                DRAW
            </button>

            <button
                onTouchStart={onFireStart}
                onTouchEnd={onFireEnd}
                className={`touch-button touch-button--fire ${isCharging ? 'touch-button--charging' : ''}`}
            >
                FIRE
            </button>
        </div>
    );
};

export default OnScreenControls;
