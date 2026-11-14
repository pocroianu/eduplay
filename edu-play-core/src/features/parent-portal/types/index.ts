// Parent Portal Types
import type { Database } from '@/shared/types/database';

// Database table types
export type ParentChild = Database['public']['Tables']['parent_children']['Row'];
export type ParentChildInsert = Database['public']['Tables']['parent_children']['Insert'];
export type ParentChildUpdate = Database['public']['Tables']['parent_children']['Update'];

export type ParentInviteCode = Database['public']['Tables']['parent_invite_codes']['Row'];
export type ParentInviteCodeInsert = Database['public']['Tables']['parent_invite_codes']['Insert'];

export type ParentNotification = Database['public']['Tables']['parent_notifications']['Row'];
export type ParentNotificationInsert = Database['public']['Tables']['parent_notifications']['Insert'];
export type ParentNotificationUpdate = Database['public']['Tables']['parent_notifications']['Update'];

export type ParentNotificationPreferences = Database['public']['Tables']['parent_notification_preferences']['Row'];
export type ParentNotificationPreferencesUpdate = Database['public']['Tables']['parent_notification_preferences']['Update'];

// Relationship types
export type RelationshipType = 'mother' | 'father' | 'guardian' | 'other';

// Notification types
export type NotificationType =
  | 'game_completed'
  | 'milestone'
  | 'weekly_summary'
  | 'achievement'
  | 'assignment_due'
  | 'assignment_completed'
  | 'artifact_published';

// Linked child with student info (for queries)
export interface LinkedChild {
  id: string;
  parent_id: string;
  student_id: string;
  relationship_type: RelationshipType;
  linked_at: string;
  status: 'active' | 'revoked';
  student?: {
    id: string;
    username: string;
    avatar_url?: string;
    class_id?: string;
  };
}

// Child progress summary (for dashboard)
export interface ChildProgressSummary {
  student_id: string;
  student_name: string;
  avatar_url?: string;
  total_games: number;
  completed_games: number;
  in_progress_games: number;
  total_time_spent: number;
  average_score: number;
  recent_activity: Array<{
    game_id: string;
    game_title: string;
    score?: number;
    completed_at?: string;
  }>;
}

// Notification with student info
export interface NotificationWithStudent extends ParentNotification {
  student?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
}
