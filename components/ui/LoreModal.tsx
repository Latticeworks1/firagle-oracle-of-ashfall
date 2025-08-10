
import React, { useState } from 'react';

interface LoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAsk: (query: string) => void;
    response: string;
    isLoading: boolean;
    error: string;
}

const LoreModal: React.FC<LoreModalProps> = ({ isOpen, onClose, onAsk, response, isLoading, error }) => {
    const [query, setQuery] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        onAsk(query);
    };

    const handleClose = () => {
        setQuery('');
        onClose();
    };

    return (
        <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={handleClose}>
            <div className="bg-gray-900/80 backdrop-blur-md rounded-lg shadow-2xl text-white w-full max-w-2xl p-4 md:p-6 border border-yellow-500/30 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 border-b border-yellow-500/20 pb-3">
                    <h2 className="text-xl md:text-2xl font-bold text-yellow-300 tracking-wider">The Oracle of Ashfall</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white text-4xl leading-none font-thin">&times;</button>
                </div>
                <div className="mb-4 h-40 md:h-48 overflow-y-auto p-3 bg-black/40 rounded-md border border-gray-700 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex items-center space-x-3">
                                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                    ) : error ? (
                        <p className="text-red-400 text-center my-4">{error}</p>
                    ) : (
                        <p className="whitespace-pre-wrap text-gray-200 leading-relaxed">{response}</p>
                    )}
                </div>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ask about the world, the staff, the creatures..."
                        className="w-full p-3 bg-gray-800 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white placeholder-gray-500 transition-colors"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !query.trim()}
                        className="mt-4 w-full px-4 py-3 bg-purple-700 text-white font-bold rounded-md hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 transform active:scale-95 shadow-lg"
                    >
                        {isLoading ? 'Asking...' : 'Consult the Oracle'}
                    </button>
                </form>
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

export default LoreModal;
