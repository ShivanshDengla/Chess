'use client';

import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Square, Piece } from 'react-chessboard/dist/chessboard/types';
import puzzles from '@/../public/Chess_Puzzles/puzzles.json';

export function ChessPuzzle() {
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState('');
  const [message, setMessage] = useState('');
  const [isSolved, setIsSolved] = useState(false);

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
  };

  const onDrop = (sourceSquare: Square, targetSquare: Square, piece: Piece): boolean => {
    if (isSolved) return false; // Don't allow moves after puzzle is solved

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

        // Optional: automatically play opponent's move for multi-move puzzles
        if (solution.length > 2) {
          setTimeout(() => {
            const opponentMove = { from: solution[2], to: solution[3] };
            gameCopy.move(opponentMove);
            setFen(gameCopy.fen());
            setMessage('Opponent moved. What is your next move?');
            setIsSolved(false); // Allow next move
          }, 1000);
        } else {
          // Single-move puzzle solved, move to next puzzle after a delay
          setTimeout(() => {
            handleNextPuzzle();
          }, 1500);
        }
        return true;
      }
    }

    setMessage('Wrong move, try again.');
    // Don't update the board, move is invalid
    return false;
  };

  const handleNextPuzzle = () => {
    setCurrentPuzzleIndex((prevIndex) => (prevIndex + 1) % puzzles.problems.length);
  };

  const puzzle = puzzles.problems[currentPuzzleIndex];

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-semibold">{puzzle.type}</h2>
      <div className="w-full max-w-sm">
        <Chessboard position={fen} onPieceDrop={onDrop} />
      </div>
      <p className={`text-lg font-semibold ${isSolved ? 'text-green-500' : 'text-red-500'}`}>
        {message}
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => loadPuzzle(currentPuzzleIndex)}
          className="px-4 py-2 font-semibold text-white bg-gray-500 rounded-md hover:bg-gray-600"
        >
          Reset
        </button>
        <button
          onClick={handleNextPuzzle}
          className="px-4 py-2 font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600"
        >
          Next Puzzle
        </button>
      </div>
    </div>
  );
} 