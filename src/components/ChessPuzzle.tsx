'use client';

import { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Square, Piece } from 'react-chessboard/dist/chessboard/types';
import { useSession } from 'next-auth/react';
import { getUserState, setUserState, UserState } from '@/lib/kv';
import { getPuzzleForLevel, Puzzle } from '@/lib/puzzles';
import {
  MiniKit,
  PayCommandInput,
  Tokens,
  tokenToDecimals,
  MiniAppPaymentSuccessPayload,
} from '@worldcoin/minikit-js';

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
  const [moveFrom, setMoveFrom] = useState('');
  const [optionSquares, setOptionSquares] = useState({});
  const [isPaying, setIsPaying] = useState(false);

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

  const loadPuzzleForLevel = useCallback(() => {
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
  }, [userState.level, userState.solvedPuzzleIds]);

  useEffect(() => {
    loadPuzzleForLevel();
  }, [loadPuzzleForLevel]);

  const handleMove = (from: Square, to: Square): boolean => {
    if (isSolved || isLost || !currentPuzzle) return false;

    const solution = currentPuzzle.moves.split(';')[0].split('-');
    const solutionFrom = solution[0];
    const solutionTo = solution[1];

    const gameCopy = new Chess(game.fen());
    const move = gameCopy.move({ from, to, promotion: 'q' });

    if (move === null) {
      return false;
    }

    if (from === solutionFrom && to === solutionTo) {
      setGame(gameCopy);
      setFen(gameCopy.fen());
      setMessage('Correct! Well done.');
      setIsSolved(true);
      setTimeout(() => {
        handleCorrectMove();
      }, 1500);
      return true;
    }

    setMessage('Wrong move. You can pay to continue or restart the puzzle.');
    setIsLost(true);
    return false;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onDrop = (sourceSquare: Square, targetSquare: Square, _piece: Piece): boolean => {
    return handleMove(sourceSquare, targetSquare);
  };

  const onSquareClick = (square: Square) => {
    if (isSolved || isLost) {
      return;
    }

    function resetMoveState() {
      setMoveFrom('');
      setOptionSquares({});
    }

    // if no piece is selected, select one
    if (!moveFrom) {
      const moves = game.moves({ square, verbose: true });
      if (moves.length > 0) {
        setMoveFrom(square);
        const newOptions: { [key: string]: React.CSSProperties } = {};
        moves.forEach((move) => {
          newOptions[move.to] = {
            background: 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
            borderRadius: '50%',
          };
        });
        setOptionSquares(newOptions);
      }
      return;
    }

    // if a piece is selected, and we click it again, deselect it
    if (square === moveFrom) {
      resetMoveState();
      return;
    }

    // if we click another one of our own pieces, switch to that piece
    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      const moves = game.moves({ square, verbose: true });
      setMoveFrom(square);
      const newOptions: { [key: string]: React.CSSProperties } = {};
      moves.forEach((move) => {
        newOptions[move.to] = {
          background: 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
          borderRadius: '50%',
        };
      });
      setOptionSquares(newOptions);
      return;
    }

    // otherwise, it's a move
    handleMove(moveFrom as Square, square);
    resetMoveState();
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

  const retryPuzzle = () => {
    if (currentPuzzle) {
      const newGame = new Chess(currentPuzzle.fen);
      setGame(newGame);
      setFen(newGame.fen());
      setMessage(currentPuzzle.first);
      setIsSolved(false);
      setIsLost(false);
      setMoveFrom('');
      setOptionSquares({});
    }
  };

  const handleKeepGoing = async () => {
    if (isPaying) return;

    try {
      setIsPaying(true);
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
        const confirmRes = await fetch(`/api/confirm-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: payload.to,
            payload: finalPayload as MiniAppPaymentSuccessPayload,
          }),
        });
        const payment = await confirmRes.json();
        if (payment.success) {
          // Stay on the same level, just reset the board
          retryPuzzle();
        } else {
          setMessage('Payment confirmation failed. Please retry.');
        }
      } else {
        setMessage('Payment was not completed. Please retry.');
      }
    } finally {
      setIsPaying(false);
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
        <Chessboard
          position={fen}
          onPieceDrop={onDrop}
          onSquareClick={onSquareClick}
          customSquareStyles={optionSquares}
        />
      </div>
      <p className={`text-lg font-semibold ${isSolved ? 'text-green-500' : 'text-red-500'}`}>
        {message}
      </p>
      {isLost && (
        <div className="flex gap-4">
          <button
            onClick={handleKeepGoing}
            disabled={isPaying}
            className="px-4 py-2 font-semibold text-white bg-green-500 rounded-md hover:bg-green-600 disabled:bg-gray-400"
          >
            {isPaying ? 'Processing...' : 'Keep Going (0.01 WLD)'}
          </button>
          <button
            onClick={handleRestart}
            disabled={isPaying}
            className="px-4 py-2 font-semibold text-white bg-gray-500 rounded-md hover:bg-gray-600 disabled:bg-gray-400"
          >
            Restart
          </button>
        </div>
      )}
    </div>
  );
} 