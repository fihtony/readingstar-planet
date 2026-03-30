/**
 * Text processing utilities for document content.
 * Handles splitting text into lines/paragraphs for the reading view.
 */

import type { ReadingParagraphData } from "@/types";

interface RawParagraphBlock {
  leadingWhitespace: string;
  lines: string[];
}

export interface ParsedReadingContent {
  lines: string[];
  paragraphs: string[];
  paragraphStartIndices: number[];
  leadingWhitespaceByIndex: Record<number, string>;
  readingParagraphs: ReadingParagraphData[];
}

const CLAUSE_STARTERS = new Set([
  "i",
  "you",
  "we",
  "they",
  "he",
  "she",
  "it",
  "the",
  "a",
  "an",
  "this",
  "that",
  "these",
  "those",
  "my",
  "your",
  "our",
  "their",
  "his",
  "her",
]);

/**
 * Split text content into individual lines for line-by-line reading.
 * Preserves paragraph boundaries and handles edge cases.
 */
export function splitIntoLines(
  text: string,
  maxLineLength: number = 80
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Split on any newline (single or double)
  const rawLines = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      // Skip blank lines
      continue;
    }

    if (trimmed.length <= maxLineLength) {
      lines.push(trimmed);
    } else {
      const wrapped = wrapText(trimmed, maxLineLength);
      lines.push(...wrapped);
    }
  }

  return lines;
}

/**
 * Wrap a long text string into multiple lines at word boundaries.
 */
export function wrapText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxLength) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Parse raw document content into semantic reading segments while preserving
 * paragraph boundaries and the leading indentation of each paragraph.
 */
export function parseReadingContent(text: string): ParsedReadingContent {
  if (!text || text.trim().length === 0) {
    return {
      lines: [],
      paragraphs: [],
      paragraphStartIndices: [],
      leadingWhitespaceByIndex: {},
      readingParagraphs: [],
    };
  }

  const blocks = splitIntoParagraphBlocks(text);
  const lines: string[] = [];
  const paragraphs: string[] = [];
  const paragraphStartIndices: number[] = [];
  const leadingWhitespaceByIndex: Record<number, string> = {};
  const readingParagraphs: ReadingParagraphData[] = [];

  for (const block of blocks) {
    const normalizedParagraph = normalizeParagraphLines(block);
    if (!normalizedParagraph) {
      continue;
    }

    const segments = splitIntoSemanticSegments(normalizedParagraph);
    if (segments.length === 0) {
      continue;
    }

    const paragraphStartIndex = lines.length;
    paragraphStartIndices.push(paragraphStartIndex);
    leadingWhitespaceByIndex[paragraphStartIndex] = block.leadingWhitespace;
    paragraphs.push(normalizedParagraph);

    readingParagraphs.push({
      indent: block.leadingWhitespace,
      sentences: segments,
      globalStartIndex: paragraphStartIndex,
    });

    lines.push(...segments);
  }

  return {
    lines,
    paragraphs,
    paragraphStartIndices,
    leadingWhitespaceByIndex,
    readingParagraphs,
  };
}

/**
 * Split text into paragraphs.
 */
export function splitIntoParagraphs(text: string): string[] {
  return parseReadingContent(text).paragraphs;
}

/**
 * Split a paragraph into individual words for TTS word-tracking.
 */
export function splitIntoWords(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Count the total number of words in a text.
 */
export function countWords(text: string): number {
  return splitIntoWords(text).length;
}

/**
 * Sanitize text content to remove potentially harmful content.
 * Strips HTML tags and control characters but preserves readable text.
 */
export function sanitizeTextContent(text: string): string {
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Strip script tags and content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Strip style tags and content
    .replace(/<[^>]*>/g, "") // Strip remaining HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Strip control chars
    .replace(/\r\n?/g, "\n") // Normalize line endings
    .replace(/[ \t]+$/gm, "") // Trim trailing horizontal whitespace only
    .replace(/\n{3,}/g, "\n\n") // Avoid extremely large blank gaps
    .trimEnd();
}

function splitIntoParagraphBlocks(text: string): RawParagraphBlock[] {
  const sourceLines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: RawParagraphBlock[] = [];
  let current: RawParagraphBlock | null = null;

  const pushCurrent = () => {
    if (!current || current.lines.length === 0) {
      current = null;
      return;
    }

    blocks.push(current);
    current = null;
  };

  for (const rawLine of sourceLines) {
    if (rawLine.trim().length === 0) {
      pushCurrent();
      continue;
    }

    if (!current || shouldStartNewParagraph(rawLine, current)) {
      pushCurrent();
      current = {
        leadingWhitespace: getLeadingWhitespace(rawLine),
        lines: [rawLine],
      };
      continue;
    }

    current.lines.push(rawLine);
  }

  pushCurrent();
  return blocks;
}

function shouldStartNewParagraph(
  line: string,
  current: RawParagraphBlock
): boolean {
  const leadingWhitespace = getLeadingWhitespace(line);
  if (leadingWhitespace.length >= 2) {
    return true;
  }

  const firstLine = current.lines[0]?.trim() ?? "";
  const isHeadingLikeCurrent =
    current.lines.length === 1 &&
    getLeadingWhitespace(current.lines[0] ?? "").length === 0 &&
    firstLine.length > 0 &&
    firstLine.length <= 70 &&
    !/[.!?:;]$/.test(firstLine);
  const trimmedLine = line.trim();

  return (
    isHeadingLikeCurrent &&
    leadingWhitespace.length === 0 &&
    trimmedLine.length > 0 &&
    trimmedLine.length <= 70 &&
    !/[.!?:;]$/.test(trimmedLine)
  );
}

function normalizeParagraphLines(block: RawParagraphBlock): string {
  return block.lines
    .map((line, index) => {
      if (index === 0 && block.leadingWhitespace.length > 0) {
        return line.slice(block.leadingWhitespace.length).trim();
      }

      return line.trim();
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoSemanticSegments(paragraph: string): string[] {
  const sentenceCandidates = paragraph
    .match(/[^.!?]+(?:[.!?]+["')\]\u201C\u201D\u2018\u2019]*)?|.+$/g)
    ?.map((segment) => segment.trim())
    .filter(Boolean) ?? [];

  return sentenceCandidates.flatMap((sentence) => splitCommaClause(sentence));
}

function splitCommaClause(sentence: string): string[] {
  const firstCommaIndex = sentence.indexOf(",");
  if (firstCommaIndex === -1 || sentence.indexOf(",", firstCommaIndex + 1) !== -1) {
    return [sentence];
  }

  const left = sentence.slice(0, firstCommaIndex).trim();
  const right = sentence.slice(firstCommaIndex + 1).trim();
  if (!left || !right) {
    return [sentence];
  }

  const leftWords = splitIntoWords(left);
  const rightWords = splitIntoWords(right);
  const firstRightWord = sanitizeWord(rightWords[0]);
  const lastRightWord = sanitizeWord(rightWords[rightWords.length - 1]);

  if (
    leftWords.length < 4 ||
    rightWords.length < 5 ||
    !CLAUSE_STARTERS.has(firstRightWord) ||
    lastRightWord === "too"
  ) {
    return [sentence];
  }

  return [`${left},`, right];
}

function getLeadingWhitespace(line: string): string {
  const match = line.match(/^\s*/);
  return match?.[0] ?? "";
}

function sanitizeWord(word: string | undefined): string {
  return (word ?? "").replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "").toLowerCase();
}
