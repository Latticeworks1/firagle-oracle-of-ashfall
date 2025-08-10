
import React from 'react';
import { IS_TOUCH_DEVICE } from '../../constants';

const StartScreen: React.FC = () => {
    return (
        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center bg-black/60 cursor-pointer backdrop-blur-sm">
            <div className="text-center text-white p-8 rounded-lg pointer-events-none animate-fade-in">
                <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">The Firagle</h1>
                <p className="text-xl md:text-2xl text-orange-300 font-mono animate-pulse">
                    {IS_TOUCH_DEVICE ? 'Tap to Play' : 'Click to Play'}
                </p>
            </div>
            <style>{`
                .animate-fade-in { animation: fadeIn 1s ease-in-out forwards; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default StartScreen;
