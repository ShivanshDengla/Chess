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
import { Popup } from './Popup';

type PaymentStatus = 'idle' | 'paying_continue' | 'paying_hint' | 'paying_answer';
type PopupStatus = 'processing' | 'success' | 'error';

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
  const [popup, setPopup] = useState<{ message: string; status: PopupStatus } | null>(
    null
  );
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
      setPopup({ message: 'Congratulations!', status: 'success' });
    }
  }, [userState.level, userState.solvedPuzzleIds]);

  useEffect(() => {
    loadPuzzleForLevel();
  }, [loadPuzzleForLevel]);

  const closePopupAfterDelay = (delay = 2000) => {
    setTimeout(() => setPopup(null), delay);
  };

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

    setMessage('Wrong move.');
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

    setPopup(null);
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
      setPopup(null);
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
          setPopup({
            message: 'Payment confirmation timed out.',
            status: 'error',
          });
          closePopupAfterDelay();
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
            setPopup({ message: 'Payment failed.', status: 'error' });
            closePopupAfterDelay();
            return resolve();
          }
        } catch (error) {
          console.error('An error occurred during payment confirmation:', error);
          setPopup({
            message: 'An unexpected error occurred.',
            status: 'error',
          });
          closePopupAfterDelay();
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
      setPopup({ message: 'Initiating payment...', status: 'processing' });
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
        setPopup({ message: 'MiniKit not installed.', status: 'error' });
        closePopupAfterDelay();
        return;
      }

      const { finalPayload } = await MiniKit.commandsAsync.pay(payload);

      if (finalPayload.status == 'success') {
        setPopup({ message: 'Processing payment...', status: 'processing' });
        await pollForPaymentConfirmation(
          payload.to,
          finalPayload as MiniAppPaymentSuccessPayload,
          onSuccess
        );
      } else {
        setPopup({ message: 'Payment was not completed.', status: 'error' });
        closePopupAfterDelay();
      }
    } catch (error) {
      console.error(`An error occurred during ${type} payment:`, error);
      setPopup({ message: 'An unexpected error occurred.', status: 'error' });
      closePopupAfterDelay();
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
        setPopup({ message: 'Payment successful!', status: 'success' });
        closePopupAfterDelay();
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
        setPopup({ message: 'Hint unlocked!', status: 'success' });
        closePopupAfterDelay();
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
        setPopup({ message: 'Answer revealed!', status: 'success' });
        closePopupAfterDelay();
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
      {popup && <Popup message={popup.message} status={popup.status} />}
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
      <p
        className={`text-lg font-semibold ${
          isLost ? 'text-red-500' : 'text-green-500'
        }`}
      >
        {message}
      </p>

      <div className="h-24">
        {!isSolved && !isLost && (
          <div className="flex justify-center gap-4">
            <button
              onClick={handleShowHint}
              disabled={paymentStatus !== 'idle' || !!hintSquare}
              className="relative rounded-[40px] bg-black px-6 py-3 font-bold text-white shadow-[0_5px_#444] transition-all duration-150 ease-in-out hover:translate-y-0.5 hover:shadow-[0_4px_#444] active:translate-y-[5px] active:shadow-none disabled:translate-y-0 disabled:bg-gray-400 disabled:text-gray-500 disabled:shadow-none"
            >
              {paymentStatus === 'paying_hint' ? (
                'Processing...'
              ) : (
                <div className="flex flex-col items-center">
                  <span>Show Hint</span>
                  <span className="text-sm font-bold text-amber-400">0.1 WLD</span>
                </div>
              )}
            </button>

            {isShowingAnswer ? (
              <button
                onClick={handleNextAfterAnswer}
                className="relative rounded-[40px] bg-black px-6 py-3 font-bold text-white shadow-[0_5px_#444] transition-all duration-150 ease-in-out hover:translate-y-0.5 hover:shadow-[0_4px_#444] active:translate-y-[5px] active:shadow-none"
              >
                Next Level
              </button>
            ) : (
              <button
                onClick={handleShowAnswer}
                disabled={paymentStatus !== 'idle' || !!answerMove}
                className="relative rounded-[40px] bg-black px-6 py-3 font-bold text-white shadow-[0_5px_#444] transition-all duration-150 ease-in-out hover:translate-y-0.5 hover:shadow-[0_4px_#444] active:translate-y-[5px] active:shadow-none disabled:translate-y-0 disabled:bg-gray-400 disabled:text-gray-500 disabled:shadow-none"
              >
                {paymentStatus === 'paying_answer' ? (
                  'Processing...'
                ) : (
                  <div className="flex flex-col items-center">
                    <span>Show Answer</span>
                    <span className="text-sm font-bold text-amber-400">
                      0.25 WLD
                    </span>
                  </div>
                )}
              </button>
            )}
          </div>
        )}

        {isLost && (
          <div className="flex justify-center gap-4">
            <button
              onClick={handleKeepGoing}
              disabled={paymentStatus !== 'idle'}
              className="relative rounded-[40px] bg-black px-6 py-3 font-bold text-white shadow-[0_5px_#444] transition-all duration-150 ease-in-out hover:translate-y-0.5 hover:shadow-[0_4px_#444] active:translate-y-[5px] active:shadow-none disabled:translate-y-0 disabled:bg-gray-400 disabled:text-gray-500 disabled:shadow-none"
            >
              {paymentStatus === 'paying_continue' ? (
                'Processing...'
              ) : (
                <div className="flex flex-col items-center">
                  <span>Revive</span>
                  <span className="text-sm font-bold text-amber-400">0.5 WLD</span>
                </div>
              )}
            </button>
            <button
              onClick={handleRestart}
              disabled={paymentStatus !== 'idle'}
              className="relative rounded-[40px] bg-black px-6 py-3 font-bold text-white shadow-[0_5px_#444] transition-all duration-150 ease-in-out hover:translate-y-0.5 hover:shadow-[0_4px_#444] active:translate-y-[5px] active:shadow-none disabled:translate-y-0 disabled:bg-gray-400 disabled:text-gray-500 disabled:shadow-none"
            >
              Restart
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 