import puzzlesData from '@/../public/Chess_Puzzles/puzzles.json';

export interface Puzzle {
  problemid: number;
  first: string;
  type: string;
  fen: string;
  moves: string;
}

export interface LeveledPuzzles {
  [level: number]: Puzzle[];
}

const LEVEL_MAP: { [key: string]: number } = {
  'Mate in One': 1,
  'Mate in Two': 2,
  'Mate in Three': 3,
};

function groupPuzzlesByLevel(): LeveledPuzzles {
  const grouped: LeveledPuzzles = {};
  puzzlesData.problems.forEach((puzzle) => {
    const level = LEVEL_MAP[puzzle.type];
    if (level) {
      if (!grouped[level]) {
        grouped[level] = [];
      }
      grouped[level].push(puzzle as Puzzle);
    }
  });
  return grouped;
}

export const leveledPuzzles = groupPuzzlesByLevel();

const puzzleTypeSequence = [
  // 3 mate in one, 1 mate in two
  1, 1, 1, 2,
  // 3 mate in one, 1 mate in three
  1, 1, 1, 3,
  // more mate in ones and a mix of twos
  1, 2, 1, 2, 1, 1, 2,
  // mix mate in three occasionally
  1, 1, 3, 1, 1, 2, 1,
];

export function getPuzzleForLevel(
  level: number,
  solvedPuzzleIds: number[] = []
): Puzzle | null {
  const puzzleType = puzzleTypeSequence[(level - 1) % puzzleTypeSequence.length];
  const puzzlesForType = leveledPuzzles[puzzleType];

  if (!puzzlesForType) {
    return null;
  }

  let availablePuzzles = puzzlesForType.filter(
    (p) => !solvedPuzzleIds.includes(p.problemid)
  );

  if (availablePuzzles.length === 0) {
    // Fallback to any puzzle of the required type if all have been solved
    availablePuzzles = puzzlesForType;
  }

  if (availablePuzzles.length === 0) {
    return null; // Should not happen if puzzles.json is not empty
  }

  const randomIndex = Math.floor(Math.random() * availablePuzzles.length);
  return availablePuzzles[randomIndex];
} 