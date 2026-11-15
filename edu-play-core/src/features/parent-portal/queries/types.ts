/** A child linked to the parent with basic student info */
export interface LinkedChildResult {
  /** Student ID */
  id: string;
  /** Student display name (username) */
  name: string;
  /** Student avatar URL (can be null) */
  avatarUrl: string | null;
  /** How the parent is related to the child */
  relationshipType: string;
  /** ISO timestamp when the link was created */
  linkedAt: string;
}

/** Aggregated progress summary for a single student */
export interface ProgressSummary {
  /** Count of distinct games the student has played */
  totalGamesPlayed: number;
  /** Count of games with status 'completed' */
  completedGames: number;
  /** Count of games with status 'in_progress' */
  inProgressGames: number;
  /** Average score across completed, scored Activities (rounded to 1 decimal) */
  averageScore: number;
  /** Total play time in minutes */
  totalPlayTime: number;
  /** ISO timestamp of the most recent activity, or null if none */
  lastActivityAt: string | null;
}

/** Discriminated union: a single feed entry can be game progress or a published artifact. */
export type ActivityItemKind = 'activity_progress' | 'artifact';

/** A feed entry for a student playing a game. */
export interface GameProgressActivityItem {
  kind: 'activity_progress';
  /** Student ID */
  studentId: string;
  /** Student display name */
  studentName: string;
  /** Student avatar URL (can be null) */
  studentAvatar: string | null;
  /** Game ID */
  gameId: string;
  /** Game display title */
  gameTitle: string;
  /** Game category (can be null) */
  gameCategory: string | null;
  /** ISO timestamp of when the activity occurred */
  timestamp: string;
  /** Score achieved (can be null if not scored) */
  score: number | null;
  /** Current status of the game progress */
  status: string;
}

/** A feed entry for a teacher-published, family-visible artifact. */
export interface ArtifactActivityItem {
  kind: 'artifact';
  /** Student ID the artifact belongs to */
  studentId: string;
  /** Student display name */
  studentName: string;
  /** Student avatar URL (can be null) */
  studentAvatar: string | null;
  /** Artifact ID (used to derive thumbnails / signed URLs) */
  artifactId: string;
  /** Artifact title supplied at upload (nullable) */
  artifactTitle: string | null;
  /** Artifact media type */
  artifactType: 'drawing' | 'photo' | 'audio' | 'video' | 'other';
  /** Storage path for the artifact (used by signed-URL helper) */
  storagePath: string;
  /**
   * Short-lived signed URL for image-type artifacts (drawing/photo). Null
   * for non-image types or when storage signing fails - the UI falls back
   * to a media-type icon.
   */
  thumbnailUrl: string | null;
  /** ISO timestamp of when the artifact was published (reviewed_at) */
  timestamp: string;
}

/** Discriminated-union feed entry. Use `kind` to render game vs. artifact card. */
export type ActivityItem = GameProgressActivityItem | ArtifactActivityItem;
