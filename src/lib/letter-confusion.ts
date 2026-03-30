/**
 * Letter confusion detection and annotation for dyslexic readers.
 *
 * Common confusable letter pairs: b/d, p/q, m/w, n/u
 * Each letter in a pair gets a unique, consistent color to aid distinction.
 */

export interface ConfusableLetterInfo {
  letter: string;
  colorClass: string;
  colorHex: string;
  mnemonic: string;
  pair: string;
}

/**
 * Map of confusable letters to their visual aids.
 */
export const CONFUSABLE_LETTERS: Record<string, ConfusableLetterInfo> = {
  b: {
    letter: "b",
    colorClass: "letter-b",
    colorHex: "#4A90D9",
    mnemonic: "bat and ball — stick first, then ball 🏏⚾",
    pair: "d",
  },
  d: {
    letter: "d",
    colorClass: "letter-d",
    colorHex: "#FF8C42",
    mnemonic: "drum and stick — drum first, then stick 🥁",
    pair: "b",
  },
  p: {
    letter: "p",
    colorClass: "letter-p",
    colorHex: "#9B8EC2",
    mnemonic: "pointer down — stick points down ⬇️",
    pair: "q",
  },
  q: {
    letter: "q",
    colorClass: "letter-q",
    colorHex: "#7BC950",
    mnemonic: "queen's tail — tail flips right 👑",
    pair: "p",
  },
};

/** All confusable letter characters */
export const CONFUSABLE_CHARS = Object.keys(CONFUSABLE_LETTERS);

/**
 * Check if a character is a confusable letter.
 */
export function isConfusableLetter(char: string): boolean {
  return char.length === 1 && char.toLowerCase() in CONFUSABLE_LETTERS;
}

/**
 * Get the visual aid info for a confusable letter.
 */
export function getLetterInfo(
  char: string
): ConfusableLetterInfo | null {
  const lower = char.toLowerCase();
  return CONFUSABLE_LETTERS[lower] ?? null;
}

/**
 * Annotate text by wrapping confusable letters in <span> elements
 * with appropriate color classes.
 *
 * Returns an array of segments, each either plain text or an annotated letter.
 */
export interface TextSegment {
  text: string;
  isConfusable: boolean;
  letterInfo: ConfusableLetterInfo | null;
}

export function annotateText(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let plainBuffer = "";

  for (const char of text) {
    const lower = char.toLowerCase();
    if (lower in CONFUSABLE_LETTERS) {
      // Flush plain text buffer
      if (plainBuffer) {
        segments.push({
          text: plainBuffer,
          isConfusable: false,
          letterInfo: null,
        });
        plainBuffer = "";
      }
      segments.push({
        text: char,
        isConfusable: true,
        letterInfo: CONFUSABLE_LETTERS[lower],
      });
    } else {
      plainBuffer += char;
    }
  }

  // Flush remaining plain text
  if (plainBuffer) {
    segments.push({
      text: plainBuffer,
      isConfusable: false,
      letterInfo: null,
    });
  }

  return segments;
}

/**
 * Count occurrences of a specific confusable letter in text (case-insensitive).
 * Used for the "Letter Detective" game.
 */
export function countLetter(text: string, letter: string): number {
  if (!text || !letter || letter.length !== 1) return 0;
  const lower = letter.toLowerCase();
  let count = 0;
  for (const char of text) {
    if (char.toLowerCase() === lower) count++;
  }
  return count;
}

/**
 * Find all positions (0-based indices) of a specific letter in text.
 * Used for the "Letter Detective" game to verify answers.
 */
export function findLetterPositions(
  text: string,
  letter: string
): number[] {
  if (!text || !letter || letter.length !== 1) return [];
  const lower = letter.toLowerCase();
  const positions: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i].toLowerCase() === lower) {
      positions.push(i);
    }
  }
  return positions;
}
