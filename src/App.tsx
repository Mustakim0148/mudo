/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HomeScreen } from './components/screens/HomeScreen';
import { OfflineSetupScreen } from './components/screens/OfflineSetupScreen';
import { QuickMatchScreen } from './components/screens/QuickMatchScreen';
import { MatchmakingScreen } from './components/screens/MatchmakingScreen';
import { FriendlyHubScreen } from './components/screens/FriendlyHubScreen';
import { CreateRoomScreen } from './components/screens/CreateRoomScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { JoinRoomScreen } from './components/screens/JoinRoomScreen';
import { AISetupScreen } from './components/screens/AISetupScreen';
import { GameBoardScreen } from './components/screens/GameBoardScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { HowToPlayScreen } from './components/screens/HowToPlayScreen';
import {
  AIDifficulty,
  GameMode,
  GameState,
  PlayerColor,
  RoomState,
} from './types/ludo';
import { createInitialGameState } from './utils/ludoEngine';
import { sounds } from './utils/soundEffects';

type ScreenType =
  | 'home'
  | 'offline_setup'
  | 'quick_match_setup'
  | 'matchmaking'
  | 'friendly_hub'
  | 'create_room'
  | 'lobby'
  | 'join_room'
  | 'ai_setup'
  | 'board'
  | 'settings'
  | 'how_to_play';

export default function App() {
  const [screen, setScreen] = useState<ScreenType>('home');
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('Player');
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(sounds.getMuted());

  // Active session parameters
  const [activeRoom, setActiveRoom] = useState<RoomState | null>(null);
  const [activeGameState, setActiveGameState] = useState<GameState | null>(null);
  const [matchmakingTarget, setMatchmakingTarget] = useState<2 | 4>(2);

  // Initialize or restore unique per-tab player identity:
  // window.name survives page refresh (allowing reconnects) while remaining empty on Duplicate Tab / New Tab
  useEffect(() => {
    let tabKey = window.name && window.name.startsWith('MUDO_TAB_') ? window.name : '';
    if (!tabKey) {
      tabKey = `MUDO_TAB_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      window.name = tabKey;
    }

    let storedId = sessionStorage.getItem(`${tabKey}_pid`);
    if (!storedId) {
      storedId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem(`${tabKey}_pid`, storedId);
    }
    setPlayerId(storedId);

    const storedName = sessionStorage.getItem(`${tabKey}_pname`) || localStorage.getItem('mudo_player_name');
    if (storedName) {
      setPlayerName(storedName);
    }
  }, []);

  const handleToggleSound = () => {
    const nextMuted = !isSoundMuted;
    setIsSoundMuted(nextMuted);
    sounds.setMuted(nextMuted);
  };

  // Launch Offline Match
  const handleStartOfflineGame = (
    playerCount: 2 | 3 | 4,
    playerNames: string[]
  ) => {
    const initialState = createInitialGameState('offline', playerCount, {
      playerNames,
    });
    setActiveGameState(initialState);
    setScreen('board');
  };

  // Launch AI Match
  const handleStartAIGame = (
    playerCount: 2 | 3 | 4,
    humanColor: PlayerColor,
    difficulty: AIDifficulty,
    pName: string
  ) => {
    localStorage.setItem('mudo_player_name', pName);
    setPlayerName(pName);

    const initialState = createInitialGameState('ai', playerCount, {
      humanColor,
      aiDifficulty: difficulty,
      playerNames: [pName],
    });
    setActiveGameState(initialState);
    setScreen('board');
  };

  // Quick Match: Open matchmaking queue
  const handleStartMatchmaking = (targetCount: 2 | 4, pName: string) => {
    if (window.name && window.name.startsWith('MUDO_TAB_')) {
      sessionStorage.setItem(`${window.name}_pname`, pName);
    }
    localStorage.setItem('mudo_player_name', pName);
    setPlayerName(pName);
    setMatchmakingTarget(targetCount);
    setScreen('matchmaking');
  };

  // Quick Match found: load game state from backend
  const handleMatchFound = useCallback(async (gameId: string) => {
    try {
      const res = await fetch(`/api/game/${gameId}`);
      if (res.ok) {
        const state: GameState = await res.json();
        setActiveGameState(state);
        setScreen('board');
      }
    } catch {
      // Fallback
    }
  }, []);

  // Friendly Mode: Room Created
  const handleRoomCreated = (room: RoomState, pId: string) => {
    if (window.name && window.name.startsWith('MUDO_TAB_')) {
      sessionStorage.setItem(`${window.name}_pid`, pId);
    }
    setPlayerId(pId);
    setActiveRoom(room);
    setScreen('lobby');
  };

  // Friendly Mode: Room Joined
  const handleRoomJoined = (room: RoomState, pId: string) => {
    if (window.name && window.name.startsWith('MUDO_TAB_')) {
      sessionStorage.setItem(`${window.name}_pid`, pId);
    }
    setPlayerId(pId);
    setActiveRoom(room);
    setScreen('lobby');
  };

  // Friendly Mode: Room Full & Game Ready
  const handleGameReady = useCallback(async (gameId: string) => {
    try {
      const res = await fetch(`/api/game/${gameId}`);
      if (res.ok) {
        const state: GameState = await res.json();
        setActiveGameState(state);
        setScreen('board');
      }
    } catch {}
  }, []);

  // Select Mode Router from Home Screen
  const handleSelectMode = (mode: GameMode) => {
    if (mode === 'offline') {
      setScreen('offline_setup');
    } else if (mode === 'quick_match') {
      setScreen('quick_match_setup');
    } else if (mode === 'friendly') {
      setScreen('friendly_hub');
    } else if (mode === 'ai') {
      setScreen('ai_setup');
    }
  };

  return (
    <div className="min-h-screen bg-[#060b17] text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Top Bar (Only visible on menu and setup screens, hidden during active gameplay) */}
      {screen !== 'board' && (
        <Navbar
          currentScreen={screen}
          onNavigate={(s) => setScreen(s as ScreenType)}
          isSoundMuted={isSoundMuted}
          onToggleSound={handleToggleSound}
        />
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col justify-center">
        {screen === 'home' && (
          <HomeScreen
            onSelectMode={handleSelectMode}
            onNavigate={(s) => setScreen(s as ScreenType)}
          />
        )}

        {screen === 'offline_setup' && (
          <OfflineSetupScreen
            onStartOfflineGame={handleStartOfflineGame}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'quick_match_setup' && (
          <QuickMatchScreen
            defaultPlayerName={playerName}
            onStartMatchmaking={handleStartMatchmaking}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'matchmaking' && (
          <MatchmakingScreen
            playerId={playerId}
            playerName={playerName}
            targetCount={matchmakingTarget}
            onMatchFound={handleMatchFound}
            onCancel={() => setScreen('quick_match_setup')}
          />
        )}

        {screen === 'friendly_hub' && (
          <FriendlyHubScreen
            onCreateRoom={() => setScreen('create_room')}
            onJoinRoom={() => setScreen('join_room')}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'create_room' && (
          <CreateRoomScreen
            defaultPlayerName={playerName}
            playerId={playerId}
            onRoomCreated={handleRoomCreated}
            onBack={() => setScreen('friendly_hub')}
          />
        )}

        {screen === 'join_room' && (
          <JoinRoomScreen
            defaultPlayerName={playerName}
            playerId={playerId}
            onRoomJoined={handleRoomJoined}
            onBack={() => setScreen('friendly_hub')}
          />
        )}

        {screen === 'lobby' && activeRoom && (
          <LobbyScreen
            initialRoom={activeRoom}
            playerId={playerId}
            onGameReady={handleGameReady}
            onLeaveRoom={() => {
              setActiveRoom(null);
              setScreen('friendly_hub');
            }}
          />
        )}

        {screen === 'ai_setup' && (
          <AISetupScreen
            defaultPlayerName={playerName}
            onStartAIGame={handleStartAIGame}
            onBack={() => setScreen('home')}
          />
        )}

        {screen === 'board' && activeGameState && (
          <GameBoardScreen
            initialGameState={activeGameState}
            playerId={playerId}
            onHome={() => {
              setActiveRoom(null);
              setActiveGameState(null);
              setScreen('home');
            }}
            onReturnToOnlineMenu={() => {
              const mode = activeGameState.mode;
              setActiveRoom(null);
              setActiveGameState(null);
              if (mode === 'quick_match') {
                setScreen('quick_match_setup');
              } else if (mode === 'friendly') {
                setScreen('friendly_hub');
              } else {
                setScreen('home');
              }
            }}
            onHowToPlay={() => setScreen('how_to_play')}
            isSoundMuted={isSoundMuted}
            onToggleSound={handleToggleSound}
          />
        )}

        {screen === 'settings' && (
          <SettingsScreen
            onBack={() => setScreen('home')}
            isSoundMuted={isSoundMuted}
            onToggleSound={handleToggleSound}
          />
        )}

        {screen === 'how_to_play' && (
          <HowToPlayScreen
            onBack={() => setScreen('home')}
            onPlayNow={() => setScreen('home')}
          />
        )}
      </main>
    </div>
  );
}
