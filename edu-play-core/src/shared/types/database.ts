export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          category: string | null
          config_data: Json | null
          config_schema_version: number | null
          created_at: string | null
          created_by: string | null
          default_lang: string
          default_theme: string | null
          description: string | null
          difficulty: string | null
          estimated_duration: number | null
          id: string
          is_published: boolean | null
          question_count: number | null
          skills: string[] | null
          status: string
          subject: string | null
          tags: string[] | null
          target_age_max: number | null
          target_age_min: number | null
          template: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          visibility_scope: string
        }
        Insert: {
          category?: string | null
          config_data?: Json | null
          config_schema_version?: number | null
          created_at?: string | null
          created_by?: string | null
          default_lang?: string
          default_theme?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_duration?: number | null
          id?: string
          is_published?: boolean | null
          question_count?: number | null
          skills?: string[] | null
          status?: string
          subject?: string | null
          tags?: string[] | null
          target_age_max?: number | null
          target_age_min?: number | null
          template: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          visibility_scope?: string
        }
        Update: {
          category?: string | null
          config_data?: Json | null
          config_schema_version?: number | null
          created_at?: string | null
          created_by?: string | null
          default_lang?: string
          default_theme?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_duration?: number | null
          id?: string
          is_published?: boolean | null
          question_count?: number | null
          skills?: string[] | null
          status?: string
          subject?: string | null
          tags?: string[] | null
          target_age_max?: number | null
          target_age_min?: number | null
          template?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          visibility_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_days: {
        Row: {
          active_day: string
          student_id: string
        }
        Insert: {
          active_day: string
          student_id: string
        }
        Update: {
          active_day?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_days_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_instances: {
        Row: {
          assigned_to: string
          class_id: string | null
          config: Json
          created_at: string
          created_by: string
          id: string
          result_summary: Json | null
          source_learning_path_step_id: string | null
          type_id: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          class_id?: string | null
          config?: Json
          created_at?: string
          created_by: string
          id?: string
          result_summary?: Json | null
          source_learning_path_step_id?: string | null
          type_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          class_id?: string | null
          config?: Json
          created_at?: string
          created_by?: string
          id?: string
          result_summary?: Json | null
          source_learning_path_step_id?: string | null
          type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_instances_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_instances_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_instances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_instances_source_learning_path_step_id_fkey"
            columns: ["source_learning_path_step_id"]
            isOneToOne: false
            referencedRelation: "learning_path_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_play_sessions: {
        Row: {
          activity_id: string
          completed: boolean
          elapsed_seconds: number
          id: string
          sequence: number
          student_id: string
          version_id: string | null
        }
        Insert: {
          activity_id: string
          completed?: boolean
          elapsed_seconds?: number
          id: string
          sequence?: number
          student_id: string
          version_id?: string | null
        }
        Update: {
          activity_id?: string
          completed?: boolean
          elapsed_seconds?: number
          id?: string
          sequence?: number
          student_id?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_play_sessions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_play_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_play_sessions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "activity_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_preview_sessions: {
        Row: {
          activity_id: string
          config_data: Json
          created_at: string
          created_by: string
          expires_at: string
          id: string
          type_id: string
          updated_at: string
        }
        Insert: {
          activity_id: string
          config_data: Json
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          type_id: string
          updated_at?: string
        }
        Update: {
          activity_id?: string
          config_data?: Json
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_preview_sessions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_preview_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_preview_sessions_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["type_id"]
          },
        ]
      }
      activity_progress: {
        Row: {
          activity_id: string
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          data: Json | null
          id: string
          last_played_at: string | null
          last_version_id: string | null
          score: number | null
          status: string | null
          student_id: string
          time_spent: number | null
          updated_at: string | null
        }
        Insert: {
          activity_id: string
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          last_played_at?: string | null
          last_version_id?: string | null
          score?: number | null
          status?: string | null
          student_id: string
          time_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          activity_id?: string
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          last_played_at?: string | null
          last_version_id?: string | null
          score?: number | null
          status?: string | null
          student_id?: string
          time_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_progress_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_progress_last_version_id_fkey"
            columns: ["last_version_id"]
            isOneToOne: false
            referencedRelation: "activity_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_resources: {
        Row: {
          activity_id: string
          created_at: string
          created_by: string | null
          id: string
          resource_type: string
          sort_order: number
          title: string
          updated_at: string
          url: string
          version_id: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          resource_type?: string
          sort_order: number
          title: string
          updated_at?: string
          url: string
          version_id?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          resource_type?: string
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_resources_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_resources_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "activity_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_submission_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          id: string
          response: Json
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submission_id: string
          submitted_at: string | null
          teacher_feedback: string | null
          updated_at: string
        }
        Insert: {
          attempt_number: number
          created_at?: string
          id?: string
          response?: Json
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_id: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          id?: string
          response?: Json
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submission_id?: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_submission_attempts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submission_attempts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "activity_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_submission_family_shares: {
        Row: {
          attempt_id: string
          created_at: string
          family_comment: string | null
          submission_id: string
          updated_at: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          family_comment?: string | null
          submission_id: string
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          family_comment?: string | null
          submission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_submission_family_shares_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "activity_submission_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submission_family_shares_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "activity_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_submissions: {
        Row: {
          activity_id: string
          assignment_id: string
          created_at: string
          id: string
          latest_attempt_id: string | null
          latest_attempt_number: number
          latest_response: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
          submitted_at: string | null
          teacher_feedback: string | null
          updated_at: string
          version_id: string
        }
        Insert: {
          activity_id: string
          assignment_id: string
          created_at?: string
          id?: string
          latest_attempt_id?: string | null
          latest_attempt_number?: number
          latest_response?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          updated_at?: string
          version_id: string
        }
        Update: {
          activity_id?: string
          assignment_id?: string
          created_at?: string
          id?: string
          latest_attempt_id?: string | null
          latest_attempt_number?: number
          latest_response?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_submissions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submissions_latest_attempt_id_fkey"
            columns: ["latest_attempt_id"]
            isOneToOne: false
            referencedRelation: "activity_submission_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_submissions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "activity_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_types: {
        Row: {
          authoring_mode: string
          category: string
          config_schema: Json
          created_at: string
          display_name: string
          is_auto_scored: boolean
          produces_submission: boolean
          renderer_key: string
          renderer_kind: string
          supports_review: boolean
          type_id: string
          updated_at: string
          version: number
        }
        Insert: {
          authoring_mode?: string
          category: string
          config_schema: Json
          created_at?: string
          display_name: string
          is_auto_scored?: boolean
          produces_submission?: boolean
          renderer_key: string
          renderer_kind?: string
          supports_review?: boolean
          type_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          authoring_mode?: string
          category?: string
          config_schema?: Json
          created_at?: string
          display_name?: string
          is_auto_scored?: boolean
          produces_submission?: boolean
          renderer_key?: string
          renderer_kind?: string
          supports_review?: boolean
          type_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      activity_versions: {
        Row: {
          activity_id: string
          activity_type_id: string
          config_data: Json
          config_schema_version: number
          id: string
          published_at: string
          published_by_user_id: string | null
          version_number: number
        }
        Insert: {
          activity_id: string
          activity_type_id: string
          config_data: Json
          config_schema_version: number
          id?: string
          published_at?: string
          published_by_user_id?: string | null
          version_number: number
        }
        Update: {
          activity_id?: string
          activity_type_id?: string
          config_data?: Json
          config_schema_version?: number
          id?: string
          published_at?: string
          published_by_user_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_versions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_versions_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["type_id"]
          },
          {
            foreignKeyName: "activity_versions_published_by_user_id_fkey"
            columns: ["published_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          activity_id: string
          class_id: string | null
          created_at: string | null
          due_date: string | null
          id: string
          is_mandatory: boolean | null
          student_id: string | null
          teacher_id: string
          updated_at: string | null
          version_id: string
        }
        Insert: {
          activity_id: string
          class_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          is_mandatory?: boolean | null
          student_id?: string | null
          teacher_id: string
          updated_at?: string | null
          version_id: string
        }
        Update: {
          activity_id?: string
          class_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          is_mandatory?: boolean | null
          student_id?: string | null
          teacher_id?: string
          updated_at?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "activity_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          actor_role: string
          artifact_id: string
          artifact_table: string
          created_at: string | null
          id: string
          new_state: Json | null
          previous_state: Json | null
        }
        Insert: {
          action: string
          actor_id: string
          actor_role: string
          artifact_id: string
          artifact_table?: string
          created_at?: string | null
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string
          actor_role?: string
          artifact_id?: string
          artifact_table?: string
          created_at?: string | null
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string | null
          changed_at: string
          changed_by: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string | null
          resource_id_text: string | null
          table_name: string
          visibility: string | null
        }
        Insert: {
          action?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id?: string | null
          resource_id_text?: string | null
          table_name: string
          visibility?: string | null
        }
        Update: {
          action?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string | null
          resource_id_text?: string | null
          table_name?: string
          visibility?: string | null
        }
        Relationships: []
      }
      auth_rate_limit_events: {
        Row: {
          created_at: string
          id: string
          identifier: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      child_artifacts: {
        Row: {
          artifact_type: string
          class_id: string | null
          created_at: string | null
          id: string
          metadata: Json
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          student_id: string
          title: string | null
          updated_at: string | null
          visibility: Database["public"]["Enums"]["visibility_status"]
        }
        Insert: {
          artifact_type: string
          class_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path: string
          student_id: string
          title?: string | null
          updated_at?: string | null
          visibility?: Database["public"]["Enums"]["visibility_status"]
        }
        Update: {
          artifact_type?: string
          class_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string
          student_id?: string
          title?: string | null
          updated_at?: string | null
          visibility?: Database["public"]["Enums"]["visibility_status"]
        }
        Relationships: [
          {
            foreignKeyName: "child_artifacts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_artifacts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_artifacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string | null
          description: string | null
          grade_level: string | null
          id: string
          is_active: boolean | null
          name: string
          school_year: string | null
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          grade_level?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          school_year?: string | null
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          grade_level?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          school_year?: string | null
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          reason: string | null
          requested_at: string
          scheduled_deletion_at: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          requested_at?: string
          scheduled_deletion_at?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          requested_at?: string
          scheduled_deletion_at?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_events: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          flag_name: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          flag_name: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          flag_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flag_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_flag_events_flag_name_fkey"
            columns: ["flag_name"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["name"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          name: string
          targeting: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          name: string
          targeting?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          name?: string
          targeting?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_assignments: {
        Row: {
          assigned_by: string
          class_id: string | null
          created_at: string
          due_date: string | null
          id: string
          path_id: string
          student_id: string | null
        }
        Insert: {
          assigned_by: string
          class_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          path_id: string
          student_id?: string | null
        }
        Update: {
          assigned_by?: string
          class_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          path_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_assignments_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_steps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          path_id: string
          step_order: number
          target_activity_config: Json
          target_activity_type: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          path_id: string
          step_order: number
          target_activity_config?: Json
          target_activity_type?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          path_id?: string
          step_order?: number
          target_activity_config?: Json
          target_activity_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_steps_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          age_max: number | null
          age_min: number | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          owner_kind: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          owner_kind?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          owner_kind?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_paths_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_children: {
        Row: {
          created_at: string | null
          id: string
          linked_at: string | null
          linked_via_code: string | null
          parent_id: string
          relationship_type: string
          status: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          linked_at?: string | null
          linked_via_code?: string | null
          parent_id: string
          relationship_type?: string
          status?: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          linked_at?: string | null
          linked_via_code?: string | null
          parent_id?: string
          relationship_type?: string
          status?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_parent_children_invite_code"
            columns: ["linked_via_code"]
            isOneToOne: false
            referencedRelation: "parent_invite_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_children_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_invite_codes: {
        Row: {
          code_hash: string
          created_at: string | null
          expires_at: string
          id: string
          is_revoked: boolean | null
          student_id: string
          teacher_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string | null
          expires_at: string
          id?: string
          is_revoked?: boolean | null
          student_id: string
          teacher_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          is_revoked?: boolean | null
          student_id?: string
          teacher_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_invite_codes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_invite_codes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_notification_preferences: {
        Row: {
          achievement: boolean | null
          assignment_completed: boolean | null
          assignment_due: boolean | null
          created_at: string | null
          digest_frequency: string | null
          email_notifications: boolean | null
          game_completed: boolean | null
          id: string
          milestone: boolean | null
          parent_id: string
          push_notifications: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string | null
          weekly_summary: boolean | null
        }
        Insert: {
          achievement?: boolean | null
          assignment_completed?: boolean | null
          assignment_due?: boolean | null
          created_at?: string | null
          digest_frequency?: string | null
          email_notifications?: boolean | null
          game_completed?: boolean | null
          id?: string
          milestone?: boolean | null
          parent_id: string
          push_notifications?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string | null
          weekly_summary?: boolean | null
        }
        Update: {
          achievement?: boolean | null
          assignment_completed?: boolean | null
          assignment_due?: boolean | null
          created_at?: string | null
          digest_frequency?: string | null
          email_notifications?: boolean | null
          game_completed?: boolean | null
          id?: string
          milestone?: boolean | null
          parent_id?: string
          push_notifications?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string | null
          weekly_summary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_notification_preferences_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          message: string
          parent_id: string
          read_at: string | null
          student_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message: string
          parent_id: string
          read_at?: string | null
          student_id: string
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string
          parent_id?: string
          read_at?: string | null
          student_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_notifications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      profile_preferences: {
        Row: {
          created_at: string
          profile_id: string
          reduced_motion: boolean
          sound_enabled: boolean
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          reduced_motion?: boolean
          sound_enabled?: boolean
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          reduced_motion?: boolean
          sound_enabled?: boolean
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string
          full_name: string
          id: string
          preferred_language: string
          role: string
          status: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email: string
          full_name: string
          id: string
          preferred_language?: string
          role: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string
          full_name?: string
          id?: string
          preferred_language?: string
          role?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      student_path_progress: {
        Row: {
          completed_at: string | null
          current_step_id: string | null
          id: string
          last_completed_step_id: string | null
          path_id: string
          started_at: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          current_step_id?: string | null
          id?: string
          last_completed_step_id?: string | null
          path_id: string
          started_at?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          current_step_id?: string | null
          id?: string
          last_completed_step_id?: string | null
          path_id?: string
          started_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_path_progress_current_step_fkey"
            columns: ["current_step_id", "path_id"]
            isOneToOne: false
            referencedRelation: "learning_path_steps"
            referencedColumns: ["id", "path_id"]
          },
          {
            foreignKeyName: "student_path_progress_last_completed_step_fkey"
            columns: ["last_completed_step_id", "path_id"]
            isOneToOne: false
            referencedRelation: "learning_path_steps"
            referencedColumns: ["id", "path_id"]
          },
          {
            foreignKeyName: "student_path_progress_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_path_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          avatar_url: string | null
          class_id: string | null
          consents: Json
          created_at: string | null
          id: string
          parent_id: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          class_id?: string | null
          consents?: Json
          created_at?: string | null
          id: string
          parent_id?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          class_id?: string | null
          consents?: Json
          created_at?: string | null
          id?: string
          parent_id?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activity_version_shares_with_family: {
        Args: { p_version_id: string }
        Returns: boolean
      }
      advance_learning_path_progress: {
        Args: {
          p_completed_step_id: string
          p_path_id: string
          p_student_id: string
        }
        Returns: undefined
      }
      append_learning_path_step: {
        Args: {
          p_activity_type: string
          p_config?: Json
          p_description?: string
          p_path_id: string
          p_title: string
        }
        Returns: {
          created_at: string
          description: string | null
          id: string
          kind: string
          path_id: string
          step_order: number
          target_activity_config: Json
          target_activity_type: string | null
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "learning_path_steps"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      archive_teacher_activity_atomically: {
        Args: { p_activity_id: string; p_actor_id: string }
        Returns: Json
      }
      change_artifact_visibility: {
        Args: { p_artifact_id: string; p_visibility: string }
        Returns: {
          artifact: Json
          became_family_visible: boolean
        }[]
      }
      create_activity_version_atomically: {
        Args: {
          p_activity_id: string
          p_activity_type_id: string
          p_actor_id: string
          p_config_data: Json
          p_config_schema_version: number
        }
        Returns: Json
      }
      duplicate_teacher_activity_atomically: {
        Args: { p_activity_id: string; p_actor_id: string }
        Returns: Json
      }
      execute_pending_deletions: { Args: never; Returns: number }
      get_latest_activity_version_number: {
        Args: { p_activity_id: string }
        Returns: number
      }
      get_parent_child_ids: { Args: { parent_uid: string }; Returns: string[] }
      get_parent_student_class_ids: {
        Args: { parent_uuid: string }
        Returns: string[]
      }
      get_parent_student_ids: {
        Args: { parent_uuid: string }
        Returns: string[]
      }
      get_student_classmates: {
        Args: { p_student_id: string }
        Returns: {
          id: string
        }[]
      }
      get_teacher_class_ids: {
        Args: { teacher_uuid: string }
        Returns: string[]
      }
      get_teacher_student_ids: {
        Args: { teacher_uuid: string }
        Returns: string[]
      }
      is_activity_published: {
        Args: { p_activity_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      make_teacher_activity_ready_atomically: {
        Args: {
          p_activity_id: string
          p_activity_type_id: string
          p_actor_id: string
          p_before_config_schema_version: number
          p_before_is_published: boolean
          p_before_status: string
          p_config_data: Json
          p_config_schema_version: number
        }
        Returns: Json
      }
      notify_linked_parents: {
        Args: {
          p_data?: Json
          p_message: string
          p_student_id: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      override_learning_path_progress: {
        Args: {
          p_current_step_id?: string
          p_path_id: string
          p_status: string
          p_student_id: string
        }
        Returns: {
          completed_at: string | null
          current_step_id: string | null
          id: string
          last_completed_step_id: string | null
          path_id: string
          started_at: string | null
          status: string
          student_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "student_path_progress"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      publish_activity_atomically: {
        Args: {
          p_activity_id: string
          p_activity_type_id: string
          p_actor_id: string
          p_before_config_schema_version: number
          p_before_is_published: boolean
          p_before_status: string
          p_config_data: Json
          p_config_schema_version: number
        }
        Returns: Json
      }
      publish_learning_path: {
        Args: { p_path_id: string }
        Returns: {
          age_max: number | null
          age_min: number | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          owner_kind: string
          status: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "learning_paths"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      record_activity_play_session: {
        Args: {
          p_activity_id: string
          p_data?: Json
          p_elapsed_seconds: number
          p_score?: number
          p_sequence: number
          p_session_id: string
          p_status: string
          p_student_id: string
          p_version_id?: string
        }
        Returns: {
          activity_id: string
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          data: Json | null
          id: string
          last_played_at: string | null
          last_version_id: string | null
          score: number | null
          status: string | null
          student_id: string
          time_spent: number | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "activity_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_activity_submission: {
        Args: {
          p_activity_id: string
          p_assignment_id: string
          p_intent?: string
          p_response?: Json
          p_version_id: string
        }
        Returns: {
          activity_id: string
          assignment_id: string
          created_at: string
          id: string
          latest_attempt_id: string | null
          latest_attempt_number: number
          latest_response: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
          submitted_at: string | null
          teacher_feedback: string | null
          updated_at: string
          version_id: string
        }
        SetofOptions: {
          from: "*"
          to: "activity_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reorder_learning_path_steps: {
        Args: { p_ordered_step_ids: string[]; p_path_id: string }
        Returns: {
          id: string
          step_order: number
        }[]
      }
      restore_teacher_activity_atomically: {
        Args: { p_activity_id: string; p_actor_id: string }
        Returns: Json
      }
      revert_activity_atomically: {
        Args: {
          p_activity_id: string
          p_activity_type_id: string
          p_actor_id: string
          p_before_config_schema_version: number
          p_before_is_published: boolean
          p_before_status: string
          p_config_data: Json
          p_config_schema_version: number
        }
        Returns: Json
      }
      review_activity_submission: {
        Args: {
          p_decision: string
          p_family_comment?: string
          p_submission_id: string
          p_teacher_feedback?: string
        }
        Returns: {
          activity_id: string
          assignment_id: string
          created_at: string
          id: string
          latest_attempt_id: string | null
          latest_attempt_number: number
          latest_response: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
          submitted_at: string | null
          teacher_feedback: string | null
          updated_at: string
          version_id: string
        }
        SetofOptions: {
          from: "*"
          to: "activity_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_teacher_activity_draft: {
        Args: { p_activity_id?: string; p_draft: Json }
        Returns: string
      }
      set_child_consent: {
        Args: { p_child_id: string; p_consent_key: string; p_value: boolean }
        Returns: undefined
      }
      should_notify_parent: {
        Args: { p_notification_type: string; p_parent_id: string }
        Returns: boolean
      }
      student_can_access_assignment: {
        Args: { p_assignment_id: string; p_student_id: string }
        Returns: boolean
      }
      teacher_can_review_submission: {
        Args: { p_submission_id: string; p_teacher_id: string }
        Returns: boolean
      }
      teacher_owns_assignment_target: {
        Args: { p_class_id: string; p_student_id: string; p_teacher_id: string }
        Returns: boolean
      }
    }
    Enums: {
      content_visibility:
        | "draft"
        | "internal_teacher_only"
        | "family_visible"
        | "archived"
      visibility_status:
        | "draft"
        | "internal_teacher_only"
        | "family_visible"
        | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      content_visibility: [
        "draft",
        "internal_teacher_only",
        "family_visible",
        "archived",
      ],
      visibility_status: [
        "draft",
        "internal_teacher_only",
        "family_visible",
        "archived",
      ],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

