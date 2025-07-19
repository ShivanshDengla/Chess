'use client';

import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Square, Piece } from 'react-chessboard/dist/chessboard/types';
import puzzles from '@/../public/Chess_Puzzles/puzzles.json';
import { useSession } from 'next-auth/react';
import { getUserPuzzleIndex, setUserPuzzleIndex } from '@/lib/kv';
import { MiniKit, PayCommandInput, Tokens, tokenToDecimals } from '@worldcoin/minikit-js';

export function ChessPuzzle() {
  const { data: session } = useSession();
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState('');
  const [message, setMessage] = useState('');
  const [isSolved, setIsSolved] = useState(false);
  const [isLost, setIsLost] = useState(false);

  useEffect(() => {
    MiniKit.install();
  }, []);

  useEffect(() => {
    const fetchUserProgress = async () => {
      if (session?.user?.walletAddress) {
        const userPuzzleIndex = await getUserPuzzleIndex(session.user.walletAddress);
        setCurrentPuzzleIndex(userPuzzleIndex);
      }
    };
    fetchUserProgress();
  }, [session]);

  useEffect(() => {
    loadPuzzle(currentPuzzleIndex);
  }, [currentPuzzleIndex]);

  const loadPuzzle = (index: number) => {
    const puzzle = puzzles.problems[index];
    const newGame = new Chess(puzzle.fen);
    setGame(newGame);
    setFen(newGame.fen());
    setMessage(puzzle.first);
    setIsSolved(false);
    setIsLost(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onDrop = (sourceSquare: Square, targetSquare: Square, _piece: Piece): boolean => {
    if (isSolved || isLost) return false;

    const puzzle = puzzles.problems[currentPuzzleIndex];
    const solution = puzzle.moves.split(';')[0].split('-');
    const from = solution[0];
    const to = solution[1];

    if (sourceSquare === from && targetSquare === to) {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({ from: sourceSquare, to: targetSquare });

      if (move) {
        setFen(gameCopy.fen());
        setMessage('Correct! Well done.');
        setIsSolved(true);

        const newPuzzleIndex = (currentPuzzleIndex + 1) % puzzles.problems.length;
        if (session?.user?.walletAddress) {
          setUserPuzzleIndex(session.user.walletAddress, newPuzzleIndex);
        }

        if (solution.length > 2) {
          setTimeout(() => {
            const opponentMove = { from: solution[2], to: solution[3] };
            gameCopy.move(opponentMove);
            setFen(gameCopy.fen());
            setMessage('Opponent moved. What is your next move?');
            setIsSolved(false);
          }, 1000);
        } else {
          setTimeout(() => {
            handleNextPuzzle();
          }, 1500);
        }
        return true;
      }
    }

    setMessage('Wrong move. You can pay to continue or restart the puzzle.');
    setIsLost(true);
    return false;
  };

  const handleNextPuzzle = () => {
    const newPuzzleIndex = (currentPuzzleIndex + 1) % puzzles.problems.length;
    setCurrentPuzzleIndex(newPuzzleIndex);
    if (session?.user?.walletAddress) {
      setUserPuzzleIndex(session.user.walletAddress, newPuzzleIndex);
    }
  };

  const handleKeepGoing = async () => {
    const res = await fetch('/api/initiate-payment', {
      method: 'POST',
    });
    const { id } = await res.json();

    const payload: PayCommandInput = {
      reference: id,
      to: '0xa057aA66d80ED8be066C8e4261c4b629130679d0',
      tokens: [
        {
          symbol: Tokens.WLD,
          token_amount: tokenToDecimals(0.5, Tokens.WLD).toString(),
        },
      ],
      description: 'Payment to continue to the next puzzle',
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
        handleNextPuzzle();
      }
    }
  };

  const handleRestart = () => {
    loadPuzzle(currentPuzzleIndex);
  };

  const puzzle = puzzles.problems[currentPuzzleIndex];

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-semibold">{puzzle?.type}</h2>
      <div className="w-full max-w-sm">
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
            Keep Going (0.5 WLD)
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
            onClick={() => loadPuzzle(currentPuzzleIndex)}
            className="px-4 py-2 font-semibold text-white bg-gray-500 rounded-md hover:bg-gray-600"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
} 