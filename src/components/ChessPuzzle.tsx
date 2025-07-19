'use client';

import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Square, Piece } from 'react-chessboard/dist/chessboard/types';
import { useSession } from 'next-auth/react';
import { getUserState, setUserState, UserState } from '@/lib/kv';
import { getPuzzleForLevel, Puzzle } from '@/lib/puzzles';
import { MiniKit, PayCommandInput, Tokens, tokenToDecimals } from '@worldcoin/minikit-js';

export function ChessPuzzle() {
  const { data: session } = useSession();
  const [userState, setUserStateClient] = useState<UserState>({
    level: 1,
    solvedPuzzleIds: [],
  });
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState('');
  const [message, setMessage] = useState('');
  const [isSolved, setIsSolved] = useState(false);
  const [isLost, setIsLost] = useState(false);
  const [allPuzzlesSolved, setAllPuzzlesSolved] = useState(false);

  useEffect(() => {
    MiniKit.install();
  }, []);

  useEffect(() => {
    const fetchUserProgress = async () => {
      if (session?.user?.walletAddress) {
        const state = await getUserState(session.user.walletAddress);
        setUserStateClient(state);
      }
    };
    fetchUserProgress();
  }, [session]);

  useEffect(() => {
    loadPuzzleForLevel();
  }, [userState.level]);

  const loadPuzzleForLevel = () => {
    const puzzle = getPuzzleForLevel(userState.level, userState.solvedPuzzleIds);
    if (puzzle) {
      setCurrentPuzzle(puzzle);
      const newGame = new Chess(puzzle.fen);
      setGame(newGame);
      setFen(newGame.fen());
      setMessage(puzzle.first);
      setIsSolved(false);
      setIsLost(false);
    } else {
      setAllPuzzlesSolved(true);
      setMessage('Congratulations! You have solved all the puzzles.');
    }
  };

  const onDrop = (sourceSquare: Square, targetSquare: Square, _piece: Piece): boolean => {
    if (isSolved || isLost || !currentPuzzle) return false;

    const solution = currentPuzzle.moves.split(';')[0].split('-');
    const from = solution[0];
    const to = solution[1];

    if (sourceSquare === from && targetSquare === to) {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({ from: sourceSquare, to: targetSquare });

      if (move) {
        setFen(gameCopy.fen());
        setMessage('Correct! Well done.');
        setIsSolved(true);
        handleCorrectMove();
        setTimeout(() => {
          handleNextPuzzle();
        }, 1500);
        return true;
      }
    }

    setMessage('Wrong move. You can pay to continue or restart the puzzle.');
    setIsLost(true);
    return false;
  };

  const handleCorrectMove = async () => {
    if (!currentPuzzle) return;

    const newState: UserState = {
      level: userState.level + 1,
      solvedPuzzleIds: [...userState.solvedPuzzleIds, currentPuzzle.problemid],
    };

    setUserStateClient(newState);
    if (session?.user?.walletAddress) {
      await setUserState(session.user.walletAddress, newState);
    }
  };

  const handleNextPuzzle = () => {
    loadPuzzleForLevel();
  };

  const handleKeepGoing = async () => {
    // Logic to pay and retry the same puzzle (level remains unchanged)
    const res = await fetch('/api/initiate-payment', {
      method: 'POST',
    });
    const { id } = await res.json();

    const payload: PayCommandInput = {
      reference: id,
      to: '0xe303fffe0221d8f0c6897fec88f8524f7e719fc1',
      tokens: [
        {
          symbol: Tokens.WLD,
          token_amount: tokenToDecimals(0.01, Tokens.WLD).toString(),
        },
      ],
      description: 'Payment to restart the puzzle',
    };

    if (!MiniKit.isInstalled()) {
      return;
    }

    const { finalPayload } = await MiniKit.commandsAsync.pay(payload);

    if (finalPayload.status == 'success') {
      const res = await fetch(`/api/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });
      const payment = await res.json();
      if (payment.success) {
        // Stay on the same level, just reset the board
        setIsLost(false);
        handleRestart();
      }
    }
  };

  const handleRestart = async () => {
    // Reset to level 1 if the user chooses not to pay
    const newState: UserState = {
      level: 1,
      solvedPuzzleIds: userState.solvedPuzzleIds, // Keep solved history
    };
    setUserStateClient(newState);
    if (session?.user?.walletAddress) {
      await setUserState(session.user.walletAddress, newState);
    }
    loadPuzzleForLevel();
  };

  if (allPuzzlesSolved) {
    return (
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold text-green-500">
          Congratulations!
        </h2>
        <p className="text-lg">You have solved all the puzzles.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-semibold">
        Level {userState.level} ({currentPuzzle?.type})
      </h2>
      <div className="w-full max-w-lg">
        <Chessboard position={fen} onPieceDrop={onDrop} />
      </div>
      <p className={`text-lg font-semibold ${isSolved ? 'text-green-500' : 'text-red-500'}`}>
        {message}
      </p>
      {isLost ? (
        <div className="flex gap-4">
          <button
            onClick={handleKeepGoing}
            className="px-4 py-2 font-semibold text-white bg-green-500 rounded-md hover:bg-green-600"
          >
            Keep Going (0.01 WLD)
          </button>
          <button
            onClick={handleRestart}
            className="px-4 py-2 font-semibold text-white bg-gray-500 rounded-md hover:bg-gray-600"
          >
            Restart
          </button>
        </div>
      ) : (
        <div className="flex gap-4">
          <button
            onClick={loadPuzzleForLevel}
            className="px-4 py-2 font-semibold text-white bg-gray-500 rounded-md hover:bg-gray-600"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
} 