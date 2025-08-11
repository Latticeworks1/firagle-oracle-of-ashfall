import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../systems/database/PuterDatabase';
import type { GameRecord, PlayerRecord } from '../../systems/database/schema';
import { useMultiplayerECS } from '../../systems/multiplayer/MultiplayerECS';
import './MultiplayerLobby.css';

declare global {
  interface Window {
    puter: any;
  }
}

interface LobbyState {
  isSignedIn: boolean;
  playerData: any | null;
  games: GameRecord[];
  loading: boolean;
  status: string;
}

const MultiplayerLobby: React.FC = () => {
  const [state, setState] = useState<LobbyState>({
    isSignedIn: false,
    playerData: null,
    games: [],
    loading: true,
    status: 'Checking authentication...'
  });

  const [formData, setFormData] = useState({
    gameName: '',
    mapName: 'Ashfall',
    maxPlayers: 4
  });

  const { setGameState, gameState } = useMultiplayerECS();

  const updateStatus = useCallback((message: string) => {
    setState(prev => ({ ...prev, status: message }));
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      if (!window.puter) {
        updateStatus('Puter not available. Please refresh the page.');
        return;
      }

      const isSignedIn = await window.puter.auth.isSignedIn();
      if (isSignedIn) {
        const playerData = await window.puter.auth.getUser();
        setState(prev => ({
          ...prev,
          isSignedIn: true,
          playerData,
          loading: false,
          status: `Welcome, ${playerData.username}!`
        }));
        await loadGames();
      } else {
        setState(prev => ({
          ...prev,
          isSignedIn: false,
          loading: false,
          status: 'Please sign in to continue.'
        }));
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      updateStatus('Authentication error. Please try again.');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [updateStatus]);

  const signIn = useCallback(async () => {
    try {
      updateStatus('Signing in...');
      await window.puter.auth.signIn();
      await checkAuth();
    } catch (error) {
      console.error('Sign in failed:', error);
      updateStatus('Sign in failed. Please try again.');
    }
  }, [checkAuth, updateStatus]);

  const loadGames = useCallback(async () => {
    try {
      updateStatus('Loading available games...');
      const result = await db.findActiveGames();
      
      if (result.success) {
        const games = result.data || [];
        setState(prev => ({ ...prev, games }));
        
        if (games.length === 0) {
          updateStatus('No games available. Create one to get started!');
        } else {
          updateStatus(`Found ${games.length} available game(s). Select one to join!`);
        }
      } else {
        updateStatus('Failed to load games. Please try refreshing.');
      }
    } catch (error) {
      console.error('Failed to load games:', error);
      updateStatus('Failed to load games. Please try refreshing.');
    }
  }, [updateStatus]);

  const createGame = useCallback(async () => {
    if (!formData.gameName.trim()) {
      updateStatus('Please enter a game name.');
      return;
    }

    if (!state.playerData) {
      updateStatus('Player data not available.');
      return;
    }

    try {
      updateStatus('Creating game...');
      
      const gameData: Omit<GameRecord, 'id'> = {
        name: formData.gameName.trim(),
        hostId: state.playerData.id,
        mapId: 'ashfall_default',
        gameMode: 'deathmatch',
        maxPlayers: formData.maxPlayers,
        currentPlayers: 1,
        status: 'waiting',
        settings: {
          timeLimit: 10,
          scoreLimit: 100,
          friendlyFire: false,
          respawnDelay: 3,
          allowSpectators: true,
          difficulty: 'normal',
          customRules: {}
        },
        players: [{
          playerId: state.playerData.id,
          username: state.playerData.username,
          isHost: true,
          joinedAt: new Date().toISOString(),
          status: 'waiting'
        }],
        createdAt: new Date().toISOString()
      };

      const result = await db.createGameSession(gameData);
      if (result.success) {
        updateStatus(`Game "${formData.gameName}" created successfully! Starting game...`);
        setGameState('starting');
        
        // Navigate to game after short delay
        setTimeout(() => {
          window.location.href = '/'; // Navigate to main game
        }, 2000);
      } else {
        updateStatus(`Failed to create game: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to create game:', error);
      updateStatus('Failed to create game. Please try again.');
    }
  }, [formData, state.playerData, updateStatus, setGameState]);

  const joinGame = useCallback(async (gameId: string) => {
    if (!state.playerData) {
      updateStatus('Player data not available.');
      return;
    }

    try {
      updateStatus('Joining game...');
      
      const result = await db.joinGame(gameId, state.playerData.id, state.playerData.username);
      if (result.success) {
        updateStatus(`Joined game! Starting...`);
        setGameState('starting');
        
        // Navigate to game after short delay
        setTimeout(() => {
          window.location.href = '/'; // Navigate to main game
        }, 1500);
      } else {
        updateStatus(`Failed to join game: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to join game:', error);
      updateStatus('Failed to join game. Please try again.');
    }
  }, [state.playerData, updateStatus, setGameState]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (state.loading) {
    return (
      <div className="lobby-container">
        <h1 className="title">FIRAGLE MULTIPLAYER</h1>
        <div className="loading-section">
          <div className="loading-spinner" />
          <p>{state.status}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-container">
      <h1 className="title">FIRAGLE MULTIPLAYER</h1>
      
      <div className="section auth-section">
        <h2>Player Authentication</h2>
        {state.isSignedIn ? (
          <div className="auth-status">Welcome, {state.playerData?.username}!</div>
        ) : (
          <div>
            <div className="auth-status">Not signed in</div>
            <button className="button" onClick={signIn}>
              Sign In with Puter
            </button>
          </div>
        )}
      </div>

      {state.isSignedIn && (
        <div className="section lobby-section">
          <h2>Game Lobby</h2>
          
          <div className="create-game-section">
            <h3>Create New Game</h3>
            <div className="form-group">
              <input
                type="text"
                className="input"
                placeholder="Enter game name..."
                value={formData.gameName}
                onChange={(e) => handleInputChange('gameName', e.target.value)}
                maxLength={50}
                onKeyPress={(e) => e.key === 'Enter' && createGame()}
              />
              <input
                type="text"
                className="input"
                placeholder="Map name"
                value={formData.mapName}
                onChange={(e) => handleInputChange('mapName', e.target.value)}
              />
              <div className="max-players-group">
                <label>Max Players:</label>
                <input
                  type="number"
                  className="input small-input"
                  min={2}
                  max={8}
                  value={formData.maxPlayers}
                  onChange={(e) => handleInputChange('maxPlayers', parseInt(e.target.value) || 4)}
                />
              </div>
              <button className="button primary" onClick={createGame}>
                Create Game
              </button>
            </div>
          </div>

          <div className="join-game-section">
            <h3>Join Existing Game</h3>
            <div className="game-list">
              {state.games.length === 0 ? (
                <div className="no-games">No games available</div>
              ) : (
                state.games.map(game => (
                  <div key={game.id} className="game-item">
                    <div className="game-info">
                      <strong>{game.name}</strong>
                      <div className="game-details">
                        Map: {game.mapId} | Players: {game.currentPlayers}/{game.maxPlayers} | Host: {game.players.find(p => p.isHost)?.username}
                      </div>
                    </div>
                    <button 
                      className="button secondary" 
                      onClick={() => joinGame(game.id)}
                      disabled={game.currentPlayers >= game.maxPlayers}
                    >
                      {game.currentPlayers >= game.maxPlayers ? 'Full' : 'Join'}
                    </button>
                  </div>
                ))
              )}
            </div>
            <button className="button secondary" onClick={loadGames}>
              Refresh Games
            </button>
          </div>
        </div>
      )}

      <div className="status-section">
        <div className="status">{state.status}</div>
      </div>
    </div>
  );
};

export default MultiplayerLobby;