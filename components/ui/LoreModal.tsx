
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
        <div className="modal oracle-modal" role="dialog" aria-modal="true" onClick={handleClose}>
            <div className="modal__content oracle-content" onClick={(e) => e.stopPropagation()}>
                <div className="oracle-layout">
                    {/* Oracle Header */}
                    <div className="oracle-header">
                        <h2 className="oracle-title">THE ORACLE OF ASHFALL</h2>
                        <p className="oracle-subtitle">Seek knowledge from the ancient spirits of the volcanic realm</p>
                    </div>

                    {/* Oracle Response Section */}
                    <div className="oracle-section">
                        <h3 className="oracle-section-title">DIVINE WISDOM</h3>
                        <div className="oracle-response">
                            {isLoading ? (
                                <div className="oracle-loading">
                                    <div className="oracle-loading-text">The Oracle is consulting the spirits...</div>
                                    <div className="oracle-loading-dots">
                                        <div className="loading-spinner"></div>
                                        <div className="loading-spinner" style={{animationDelay: '-0.32s'}}></div>
                                        <div className="loading-spinner" style={{animationDelay: '-0.16s'}}></div>
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="oracle-error">
                                    <div className="oracle-error-title">The spirits are silent...</div>
                                    <div className="oracle-error-message">{error}</div>
                                </div>
                            ) : (
                                <div className="oracle-wisdom">
                                    {response}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Oracle Query Section */}
                    <div className="oracle-section">
                        <h3 className="oracle-section-title">YOUR QUESTION</h3>
                        <form onSubmit={handleSubmit} className="oracle-query-form">
                            <div className="oracle-input-container">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Ask about the world, the staff, the creatures, the ancient lore..."
                                    className="oracle-input"
                                    disabled={isLoading}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading || !query.trim()}
                                className="oracle-submit-btn"
                            >
                                {isLoading ? 'Communing with Spirits...' : 'Consult the Oracle'}
                            </button>
                        </form>
                    </div>
                </div>
                
                <button onClick={handleClose} className="modal__close">&times;</button>
            </div>
        </div>
    );
};

export default LoreModal;
