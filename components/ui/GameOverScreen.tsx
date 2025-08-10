
import React from 'react';

interface GameOverScreenProps {
    score: number;
    onRestart: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({ score, onRestart }) => {
    return (
        <div className="absolute inset-0 z-30 flex flex-col justify-center items-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <h2 className="text-5xl md:text-7xl font-bold text-red-600 mb-2 tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">YOU HAVE FALLEN</h2>
            <p className="text-xl md:text-2xl text-gray-300 mb-8">Final Score: <span className="font-bold text-yellow-400">{score}</span></p>
            <button
                onClick={onRestart}
                className="px-8 py-4 bg-yellow-500 text-gray-900 font-bold text-lg md:text-xl rounded-lg hover:bg-yellow-400 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-yellow-300 focus:ring-opacity-50 shadow-2xl"
            >
                RISE AGAIN
            </button>
            <style>{`
                .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </div>
    );
};

export default GameOverScreen;
