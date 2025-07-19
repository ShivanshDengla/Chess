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
import { useWindowSize } from '@/hooks/useWindowSize';

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
  const { width } = useWindowSize();

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
    console.log('--- Step 1: `handleKeepGoing` initiated ---');

    try {
      setIsPaying(true);
      setMessage('Initiating payment...');
      console.log(
        '--- Step 2: Fetching payment reference from /api/initiate-payment ---'
      );
      const res = await fetch('/api/initiate-payment', {
        method: 'POST',
      });
      const { id } = await res.json();
      console.log('--- Step 3: Received reference ID:', id, '---');

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
      console.log(
        '--- Step 4: Constructed payment payload for MiniKit ---',
        payload
      );

      if (!MiniKit.isInstalled()) {
        setMessage('MiniKit not installed. Please reload.');
        console.error('--- MiniKit not installed ---');
        return;
      }

      console.log('--- Step 5: Calling MiniKit.commandsAsync.pay ---');
      const { finalPayload } = await MiniKit.commandsAsync.pay(payload);
      console.log(
        '--- Step 6: Received finalPayload from MiniKit ---',
        finalPayload
      );

      if (finalPayload.status == 'success') {
        setMessage('Processing payment...');
        console.log(
          '--- Step 7: Payment submitted successfully. Starting polling for confirmation. ---'
        );
        await pollForPaymentConfirmation(
          payload.to,
          finalPayload as MiniAppPaymentSuccessPayload
        );
      } else {
        setMessage('Payment was not completed. Please retry.');
        console.error(
          '--- Step 7: Payment failed or was cancelled in World App. ---',
          finalPayload
        );
      }
    } catch (error) {
      console.error('--- An error occurred during handleKeepGoing ---', error);
      setMessage('An unexpected error occurred. Please try again.');
    } finally {
      console.log(
        '--- Final Step: `handleKeepGoing` finished. Resetting `isPaying`. ---'
      );
      setIsPaying(false);
    }
  };

  const pollForPaymentConfirmation = (
    to: string,
    payload: MiniAppPaymentSuccessPayload,
    retries = 10 // e.g., 10 retries, 2 seconds apart for a total of 20 seconds
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const poll = async (retriesLeft: number) => {
        console.log(
          `--- Polling attempt #${
            11 - retriesLeft
          }/10 for transaction ${payload.transaction_id} ---`
        );

        if (retriesLeft === 0) {
          setMessage('Payment confirmation timed out. Please try again.');
          console.error('--- Polling failed: Maximum retries reached. ---');
          return resolve();
        }

        try {
          const confirmRes = await fetch(`/api/confirm-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, payload }),
          });
          console.log(
            '--- Polling: Sent request to /api/confirm-payment ---'
          );

          if (!confirmRes.ok) {
            console.error(
              '--- Polling: /api/confirm-payment request failed ---',
              confirmRes
            );
            throw new Error('Payment confirmation request failed');
          }

          const payment = await confirmRes.json();
          console.log(
            '--- Polling: Received response from /api/confirm-payment ---',
            payment
          );

          if (payment.status === 'mined') {
            setMessage('Payment successful! The puzzle has been reset.');
            console.log('--- Polling SUCCESS: Transaction mined! ---');
            retryPuzzle();
            return resolve();
          } else if (payment.status === 'pending') {
            console.log(
              '--- Polling: Transaction is pending. Retrying in 2 seconds... ---'
            );
            setTimeout(() => poll(retriesLeft - 1), 2000);
          } else {
            setMessage('Payment confirmation failed. Please retry.');
            console.error(
              '--- Polling FAILED: Transaction status is',
              payment.status,
              '---'
            );
            return resolve();
          }
        } catch (error) {
          console.error(
            '--- An error occurred during pollForPaymentConfirmation ---',
            error
          );
          setMessage('An unexpected error occurred during confirmation.');
          return reject(error);
        }
      };
      poll(retries);
    });
  };

  const handleRestart = async () => {
    if (userState.level === 1) {
      // If already on level 1, just get a new puzzle for this level
      retryPuzzle();
      return;
    }

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
          boardWidth={width ? Math.min(width - 32, 560) : 320}
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