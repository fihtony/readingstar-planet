export type UserRole = "admin" | "user";
export type UserStatus = "active" | "inactive" | "deleted" | "pending_verification";
export type AvatarSource = "google" | "custom";
export type Locale = "en" | "zh";
export type FileType = "pdf" | "txt";
export type FocusMode = "single-line" | "sliding-window" | "karaoke";
export type ReadingTheme = "flashlight" | "magnifier" | "magic-wand";
export type FontFamily = "opendyslexic" | "system";
export type AchievementType = "streak" | "effort" | "milestone";
export type DeviceType = "desktop" | "tablet" | "mobile" | "bot" | "unknown";
export type RegistrationPolicy = "open" | "invite-only";

export interface User {
  id: string;
  googleId: string | null;
  email: string;
  name: string;
  nickname: string;
  avatarUrl: string;
  avatarSource: AvatarSource;
  personalNote: string;
  role: UserRole;
  status: UserStatus;
  adminNotes: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AuthSession {
  id: string;
  userId: string;
  ipAddress: string | null;
  rawUserAgent: string;
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  deviceType: DeviceType;
  deviceModel: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface UserActivityLog {
  id: string;
  userId: string;
  action: string;
  detail: string;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: string;
  createdAt: string;
}

export interface UserReadingStats {
  id: string;
  userId: string;
  documentId: string;
  readCount: number;
  totalTimeSec: number;
  timedSessionCount: number;
  firstReadAt: string | null;
  lastReadAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Safe user info for /api/auth/me (no admin_notes, personal_note for non-owner) */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  nickname: string;
  avatarUrl: string;
  role: UserRole;
  status: UserStatus;
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
  locale: Locale;
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
