'use client';

import { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import type { Square, Arrow } from 'react-chessboard/dist/chessboard/types';
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
import styles from './Button.module.css';

type PromotionPiece = 'q' | 'r' | 'b' | 'n';
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
  const [promotionMove, setPromotionMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
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
      setPromotionMove(null);
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

  const handleMove = (
    from: Square,
    to: Square,
    promotion?: PromotionPiece
  ): boolean => {
    if (isSolved || isLost || !currentPuzzle) return false;

    const solution = currentPuzzle.moves.split(';')[0].split('-');
    const solutionFrom = solution[0];
    const solutionTo = solution[1];

    const gameCopy = new Chess(game.fen());
    const move = gameCopy.move({ from, to, promotion });

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

  const onDrop = (sourceSquare: Square, targetSquare: Square): boolean => {
    const piece = game.get(sourceSquare);

    if (
      piece?.type === 'p' &&
      ((piece.color === 'w' && targetSquare.endsWith('8')) ||
        (piece.color === 'b' && targetSquare.endsWith('1')))
    ) {
      const moves = game.moves({ square: sourceSquare, verbose: true });
      if (moves.some((m) => m.to === targetSquare)) {
        setPromotionMove({ from: sourceSquare, to: targetSquare });
        return false;
      }
    }

    return handleMove(sourceSquare, targetSquare);
  };

  const onPieceDrop = (
    sourceSquare: Square,
    targetSquare: Square
  ): boolean => {
    return onDrop(sourceSquare, targetSquare);
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

    const moveResult = onDrop(moveFrom as Square, square);
    if (!moveResult && !promotionMove) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        const moves = game.moves({ square, verbose: true });
        setMoveFrom(square);
        const newOptions: { [key: string]: React.CSSProperties } = {};
        moves.forEach((move) => {
          newOptions[move.to] = {
            background:
              'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
            borderRadius: '50%',
          };
        });
        setOptionSquares(newOptions);
        return;
      }
    }

    resetMoveState();
  };

  const handleCorrectMove = async () => {
    if (!currentPuzzle) return;

    setPopup(null);
    setHintSquare(null);
    setAnswerMove(null);
    setIsShowingAnswer(false);
    setPromotionMove(null);

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
      setPromotionMove(null);
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
      <div className="font-nunito text-9xl font-bold text-black/10">
        {userState.level}
      </div>
      {popup && <Popup message={popup.message} status={popup.status} />}
      <div className="flex h-8 items-center justify-center">
        <h2 className="text-center text-xl font-semibold">
          {currentPuzzle?.type}
        </h2>
      </div>
      <div className="w-full max-w-lg">
        <Chessboard
          boardWidth={width ? Math.min(width - 32, 560) : 320}
          position={fen}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          customSquareStyles={getCustomSquareStyles()}
          customArrows={customArrows}
          promotionDialogVariant="vertical"
          onPromotionPieceSelect={(piece) => {
            if (promotionMove && piece) {
              handleMove(
                promotionMove.from,
                promotionMove.to,
                piece.toLowerCase().charAt(1) as PromotionPiece
              );
              setPromotionMove(null);
              return true;
            }
            return false;
          }}
          promotionToSquare={promotionMove?.to ?? null}
        />
      </div>
      <div className="flex h-10 items-center justify-center">
        <p
          className={`text-lg font-semibold ${
            message.startsWith('Correct')
              ? 'text-green-500'
              : message.startsWith('Wrong')
              ? 'text-red-500'
              : game.turn() === 'w'
              ? 'text-[#010101]'
              : 'text-[#010101]'
          }`}
        >
          {message}
        </p>
      </div>

      <div className="flex h-24 items-center justify-center">
        <div
          className={`${
            isLost ? 'hidden' : 'flex'
          } justify-center gap-4 ${isSolved ? 'invisible' : ''}`}
        >
          <button
            onClick={handleShowHint}
            disabled={paymentStatus !== 'idle' || !!hintSquare}
            className={styles.button}
          >
            {paymentStatus === 'paying_hint' ? (
              'Processing...'
            ) : (
              <div className="flex flex-col items-center">
                <span>Show Hint</span>
                <span className={styles.price}>0.1 WLD</span>
              </div>
            )}
          </button>

          {isShowingAnswer ? (
            <button
              onClick={handleNextAfterAnswer}
              className={styles.button}
            >
              Next Level
            </button>
          ) : (
            <button
              onClick={handleShowAnswer}
              disabled={paymentStatus !== 'idle' || !!answerMove}
              className={styles.button}
            >
              {paymentStatus === 'paying_answer' ? (
                'Processing...'
              ) : (
                <div className="flex flex-col items-center">
                  <span>Show Answer</span>
                  <span className={styles.price}>
                    0.25 WLD
                  </span>
                </div>
              )}
            </button>
          )}
        </div>

        {isLost && (
          <div className="flex justify-center gap-4">
            <button
              onClick={handleKeepGoing}
              disabled={paymentStatus !== 'idle'}
              className={styles.button}
            >
              {paymentStatus === 'paying_continue' ? (
                'Processing...'
              ) : (
                <div className="flex flex-col items-center">
                  <span>Revive</span>
                  <span className={styles.price}>0.5 WLD</span>
                </div>
              )}
            </button>
            <button
              onClick={handleRestart}
              disabled={paymentStatus !== 'idle'}
              className={styles.button}
            >
              Restart
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 