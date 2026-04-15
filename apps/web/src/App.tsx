/**
 * App — Root component.
 *
 * Wraps everything in the GameProvider and lays out the two-panel UI:
 *   • Left:  poker table area (flex-1) with status bar, table, HUD, controls
 *   • Right: chat panel sidebar (w-96)
 */

import { Street } from '@poker/shared';
import { GameProvider, useGame } from './context/GameContext';
import { GameControls } from './components/controls/GameControls';
import { GameStatus } from './components/controls/GameStatus';
import { PlayerHUD } from './components/controls/PlayerHUD';
import ChatPanel from './components/chat/ChatPanel';

/* ------------------------------------------------------------------ */
/*  Inner layout (consumes GameContext)                                 */
/* ------------------------------------------------------------------ */

function GameLayout() {
  const {
    isConnected,
    gameState,
    isMyTurn,
    legalActions,
    sendAction,
    startGame,
    nextHand,
    isProcessing,
    gameStarted,
    handInProgress,
    handNumber,
    messages,
    sendChat,
  } = useGame();

  const myPlayer = gameState?.players.find(
    (p) => p.id === gameState.myPlayerId,
  );

  return (
    <div className="flex h-screen bg-poker-bg text-white">
      {/* ── Main poker table area ──────────────────────────────── */}
      <div className="flex flex-1 flex-col">
        {/* Status bar */}
        <GameStatus
          handNumber={handNumber}
          blinds={gameState?.blinds ?? { small: 10, big: 20 }}
          street={gameState?.street ?? Street.PREFLOP}
          gameStarted={gameStarted}
          handInProgress={handInProgress}
          onStartGame={startGame}
          onNextHand={nextHand}
        />

        {/* Table area — placeholder for PokerTable component */}
        <div className="relative flex flex-1 items-center justify-center">
          {!isConnected && (
            <div className="text-gray-500">Connecting to server…</div>
          )}
          {isConnected && !gameStarted && (
            <div className="text-lg text-gray-400">
              Press{' '}
              <span className="font-bold text-chip-green">Start Game</span> to
              begin
            </div>
          )}
        </div>

        {/* Player HUD (shown once we know which seat is ours) */}
        {myPlayer && (
          <div className="flex justify-center pb-20">
            <PlayerHUD
              chips={myPlayer.chips}
              holeCards={gameState?.myHoleCards ?? []}
              isDealer={myPlayer.isDealer}
              isSmallBlind={myPlayer.isSmallBlind}
              isBigBlind={myPlayer.isBigBlind}
            />
          </div>
        )}

        {/* Action controls (slides up when it's our turn) */}
        <GameControls
          legalActions={legalActions}
          potSize={gameState?.pot ?? 0}
          playerChips={myPlayer?.chips ?? 0}
          isMyTurn={isMyTurn}
          isProcessing={isProcessing}
          onAction={sendAction}
        />
      </div>

      {/* ── Chat sidebar ───────────────────────────────────────── */}
      <div className="w-96">
        <ChatPanel
          messages={messages}
          onSendMessage={sendChat}
          currentPlayerId={gameState?.myPlayerId ?? ''}
          disabled={!isConnected}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Root                                                               */
/* ------------------------------------------------------------------ */

export default function App() {
  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
}
