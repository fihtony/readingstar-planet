export type UserRole = "child" | "parent" | "educator";
export type Locale = "en" | "zh";
export type FileType = "pdf" | "txt";
export type FocusMode = "single-line" | "sliding-window" | "karaoke";
export type ReadingTheme = "flashlight" | "magnifier" | "magic-wand";
export type FontFamily = "opendyslexic" | "system";
export type AchievementType = "streak" | "effort" | "milestone";

export interface User {
  id: string;
  nickname: string;
  avatar: string;
  role: UserRole;
  locale: Locale;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  originalFilename: string;
  fileType: FileType;
  fileSize: number;
  uploadedBy: string;
  groupId: string | null;
  groupPosition: number;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
  readCount: number;
}

export interface DocumentGroup {
  id: string;
  userId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingSession {
  id: string;
  userId: string;
  documentId: string;
  startedAt: string;
  endedAt: string | null;
  focusMode: FocusMode;
  letterHelperEnabled: boolean;
  ttsUsed: boolean;
  linesRead: number;
}

export interface ReadingProgress {
  id: string;
  userId: string;
  documentId: string;
  currentLine: number;
  totalLines: number;
  updatedAt: string;
}

export interface Achievement {
  id: string;
  userId: string;
  type: AchievementType;
  name: string;
  earnedAt: string;
  metadata: Record<string, unknown>;
}

export interface UserSettings {
  userId: string;
  fontFamily: FontFamily;
  fontSize: number;
  lineSpacing: number;
  maskOpacity: number;
  ttsSpeed: number;
  ttsPitch: number;
  ttsVoice: string;
  dailyTimeLimit: number;
  theme: ReadingTheme;
  updatedAt: string;
}

export interface LetterConfusionConfig {
  enabled: boolean;
  /** Map of letter to CSS class name for color coding */
  colorMap: Record<string, string>;
  /** Show fun visual mnemonics for letters */
  showMnemonics: boolean;
  /** Intensity level: high shows all helpers, low shows only colors */
  intensity: "high" | "medium" | "low";
}

export interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentWordIndex: number;
  speed: number;
  utterance: SpeechSynthesisUtterance | null;
}

export interface ReadingFocusState {
  mode: FocusMode;
  currentLine: number;
  totalLines: number;
  maskOpacity: number;
  theme: ReadingTheme;
}

/** Paragraph data for paragraph-based rendering */
export interface ReadingParagraphData {
  indent: string;
  sentences: string[];
  globalStartIndex: number;
}

/** Parsed document with lines ready for reading view */
export interface ParsedDocument {
  id: string;
  title: string;
  lines: string[];
  paragraphs: string[];
  paragraphStartIndices: number[];
  leadingWhitespaceByIndex: Record<number, string>;
  readingParagraphs: ReadingParagraphData[];
}

/** File upload validation result */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  fileType?: FileType;
}
