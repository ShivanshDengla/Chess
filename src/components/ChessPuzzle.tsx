'use client';

import { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Square, Piece, Arrow } from 'react-chessboard/dist/chessboard/types';
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

type PaymentStatus = 'idle' | 'paying_continue' | 'paying_hint' | 'paying_answer';

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
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [hintSquare, setHintSquare] = useState<Square | null>(null);
  const [answerMove, setAnswerMove] = useState<{ from: Square; to: Square } | null>(null);
  const [isShowingAnswer, setIsShowingAnswer] = useState(false);
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
      setHintSquare(null);
      setAnswerMove(null);
      setIsShowingAnswer(false);
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

    if (square === moveFrom) {
      resetMoveState();
      return;
    }

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

    handleMove(moveFrom as Square, square);
    resetMoveState();
  };

  const handleCorrectMove = async () => {
    if (!currentPuzzle) return;

    setHintSquare(null);
    setAnswerMove(null);
    setIsShowingAnswer(false);

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
      setHintSquare(null);
      setAnswerMove(null);
      setIsShowingAnswer(false);
    }
  };

  const pollForPaymentConfirmation = (
    to: string,
    payload: MiniAppPaymentSuccessPayload,
    onSuccess: () => void,
    retries = 10
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const poll = async (retriesLeft: number) => {
        if (retriesLeft === 0) {
          setMessage('Payment confirmation timed out. Please try again.');
          return resolve();
        }

        try {
          const confirmRes = await fetch(`/api/confirm-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, payload }),
          });

          if (!confirmRes.ok) {
            throw new Error('Payment confirmation request failed');
          }

          const payment = await confirmRes.json();

          if (payment.status === 'mined') {
            onSuccess();
            return resolve();
          } else if (payment.status === 'pending') {
            setTimeout(() => poll(retriesLeft - 1), 2000);
          } else {
            setMessage('Payment confirmation failed. Please retry.');
            return resolve();
          }
        } catch (error) {
          console.error('An error occurred during payment confirmation:', error);
          setMessage('An unexpected error occurred during confirmation.');
          return reject(error);
        }
      };
      poll(retries);
    });
  };

  const handlePayment = async (
    amount: number,
    description: string,
    onSuccess: () => void,
    type: PaymentStatus
  ) => {
    if (paymentStatus !== 'idle') return;

    try {
      setPaymentStatus(type);
      setMessage('Initiating payment...');
      const res = await fetch('/api/initiate-payment', { method: 'POST' });
      const { id } = await res.json();

      const payload: PayCommandInput = {
        reference: id,
        to: '0xe303fffe0221d8f0c6897fec88f8524f7e719fc1',
        tokens: [
          {
            symbol: Tokens.WLD,
            token_amount: tokenToDecimals(amount, Tokens.WLD).toString(),
          },
        ],
        description,
      };

      if (!MiniKit.isInstalled()) {
        setMessage('MiniKit not installed. Please reload.');
        return;
      }

      const { finalPayload } = await MiniKit.commandsAsync.pay(payload);

      if (finalPayload.status == 'success') {
        setMessage('Processing payment...');
        await pollForPaymentConfirmation(
          payload.to,
          finalPayload as MiniAppPaymentSuccessPayload,
          onSuccess
        );
      } else {
        setMessage('Payment was not completed. Please retry.');
      }
    } catch (error) {
      console.error(`An error occurred during ${type} payment:`, error);
      setMessage('An unexpected error occurred. Please try again.');
    } finally {
      setPaymentStatus('idle');
    }
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

  const handleKeepGoing = async () => {
    handlePayment(
      0.5,
      'Payment to restart the puzzle',
      () => {
        setMessage('Payment successful! The puzzle has been reset.');
        retryPuzzle();
      },
      'paying_continue'
    );
  };

  const handleShowHint = async () => {
    if (!currentPuzzle) return;
    const solutionFrom = currentPuzzle.moves.split(';')[0].split('-')[0] as Square;
    handlePayment(
      0.1,
      'Payment for a hint',
      () => {
        setMessage('Payment successful! Here is your hint.');
        setHintSquare(solutionFrom);
      },
      'paying_hint'
    );
  };

  const handleShowAnswer = async () => {
    if (!currentPuzzle) return;
    const [from, to] = currentPuzzle.moves.split(';')[0].split('-') as [Square, Square];
    handlePayment(
      0.25,
      'Payment for the answer',
      () => {
        setMessage('Payment successful! Here is the answer.');
        setAnswerMove({ from, to });
        setIsShowingAnswer(true);
      },
      'paying_answer'
    );
  };

  const handleNextAfterAnswer = () => {
    handleCorrectMove();
  };

  if (allPuzzlesSolved) {
    return (
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold text-green-500">Congratulations!</h2>
        <p className="text-lg">You have solved all the puzzles.</p>
      </div>
    );
  }

  const getCustomSquareStyles = () => {
    const styles = { ...optionSquares };
    if (hintSquare) {
      styles[hintSquare] = { background: 'rgba(255, 255, 0, 0.4)' };
    }
    if (answerMove) {
      styles[answerMove.from] = { background: 'rgba(255, 255, 0, 0.4)' };
    }
    return styles;
  };

  const customArrows: Arrow[] = answerMove ? [[answerMove.from, answerMove.to]] : [];

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
          customSquareStyles={getCustomSquareStyles()}
          customArrows={customArrows}
        />
      </div>
      <p className={`text-lg font-semibold ${isSolved ? 'text-green-500' : 'text-red-500'}`}>
        {message}
      </p>

      {!isSolved && !isLost && (
        <div className="flex gap-4">
          <button
            onClick={handleShowHint}
            disabled={paymentStatus !== 'idle' || !!hintSquare}
            className="px-4 py-2 font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
          >
            {paymentStatus === 'paying_hint' ? 'Processing...' : 'Show Hint (0.1 WLD)'}
          </button>

          {isShowingAnswer ? (
            <button
              onClick={handleNextAfterAnswer}
              className="px-4 py-2 font-semibold text-white bg-purple-500 rounded-md hover:bg-purple-600"
            >
              Next Level
            </button>
          ) : (
            <button
              onClick={handleShowAnswer}
              disabled={paymentStatus !== 'idle' || !!answerMove}
              className="px-4 py-2 font-semibold text-white bg-purple-500 rounded-md hover:bg-purple-600 disabled:bg-gray-400"
            >
              {paymentStatus === 'paying_answer' ? 'Processing...' : 'Show Answer (0.25 WLD)'}
            </button>
          )}
        </div>
      )}

      {isLost && (
        <div className="flex gap-4">
          <button
            onClick={handleKeepGoing}
            disabled={paymentStatus !== 'idle'}
            className="px-4 py-2 font-semibold text-white bg-green-500 rounded-md hover:bg-green-600 disabled:bg-gray-400"
          >
            {paymentStatus === 'paying_continue' ? 'Processing...' : 'Keep Going (0.5 WLD)'}
          </button>
          <button
            onClick={handleRestart}
            disabled={paymentStatus !== 'idle'}
            className="px-4 py-2 font-semibold text-white bg-gray-500 rounded-md hover:bg-gray-600 disabled:bg-gray-400"
          >
            Restart
          </button>
        </div>
      )}
    </div>
  );
} 