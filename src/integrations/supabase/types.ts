export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      daily_logs: {
        Row: {
          brief_sent_at: string | null
          closeout_at: string | null
          created_at: string
          id: string
          log_date: string
          score: number | null
          summary: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          brief_sent_at?: string | null
          closeout_at?: string | null
          created_at?: string
          id?: string
          log_date: string
          score?: number | null
          summary?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          brief_sent_at?: string | null
          closeout_at?: string | null
          created_at?: string
          id?: string
          log_date?: string
          score?: number | null
          summary?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          applied_at: string | null
          closed_at: string | null
          closed_reason: string | null
          company: string
          created_at: string
          deleted_at: string | null
          id: string
          job_url: string | null
          location: string | null
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          priority: Database["public"]["Enums"]["priority"]
          role_title: string
          source: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          company: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          job_url?: string | null
          location?: string | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority"]
          role_title: string
          source?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          company?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          job_url?: string | null
          location?: string | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["priority"]
          role_title?: string
          source?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nudges: {
        Row: {
          delivery_status: string | null
          id: string
          kind: string | null
          response: string | null
          response_at: string | null
          sent_at: string | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          delivery_status?: string | null
          id?: string
          kind?: string | null
          response?: string | null
          response_at?: string | null
          sent_at?: string | null
          task_id?: string | null
          user_id: string
        }
        Update: {
          delivery_status?: string | null
          id?: string
          kind?: string | null
          response?: string | null
          response_at?: string | null
          sent_at?: string | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudges_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          ask: string | null
          company: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          last_contacted_at: string | null
          linkedin_url: string | null
          name: string
          next_follow_up_at: string | null
          notes: string | null
          phone: string | null
          priority: Database["public"]["Enums"]["priority"]
          related_job_id: string | null
          relationship_strength: number | null
          relationship_type: Database["public"]["Enums"]["relationship_type"]
          role_title: string | null
          status: Database["public"]["Enums"]["person_status"]
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ask?: string | null
          company?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          linkedin_url?: string | null
          name: string
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["priority"]
          related_job_id?: string | null
          relationship_strength?: number | null
          relationship_type?: Database["public"]["Enums"]["relationship_type"]
          role_title?: string | null
          status?: Database["public"]["Enums"]["person_status"]
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ask?: string | null
          company?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          linkedin_url?: string | null
          name?: string
          next_follow_up_at?: string | null
          notes?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["priority"]
          related_job_id?: string | null
          relationship_strength?: number | null
          relationship_type?: Database["public"]["Enums"]["relationship_type"]
          role_title?: string | null
          status?: Database["public"]["Enums"]["person_status"]
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          telegram_chat_id: number | null
          telegram_user_id: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          telegram_chat_id?: number | null
          telegram_user_id?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          telegram_chat_id?: number | null
          telegram_user_id?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      raw_inputs: {
        Row: {
          content: string
          created_at: string
          id: string
          parsed_json: Json | null
          parser_version: string | null
          source: Database["public"]["Enums"]["task_source"]
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parsed_json?: Json | null
          parser_version?: string | null
          source: Database["public"]["Enums"]["task_source"]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parsed_json?: Json | null
          parser_version?: string | null
          source?: Database["public"]["Enums"]["task_source"]
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          evening_time: string
          midday_time: string
          morning_time: string
          preferences: Json
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          evening_time?: string
          midday_time?: string
          morning_time?: string
          preferences?: Json
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          evening_time?: string
          midday_time?: string
          morning_time?: string
          preferences?: Json
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: Database["public"]["Enums"]["task_category"]
          completed_at: string | null
          created_at: string
          delay_count: number
          deleted_at: string | null
          description: string | null
          due_at: string | null
          id: string
          idempotency_key: string | null
          killed_at: string | null
          killed_reason: string | null
          last_delayed_at: string | null
          parent_task_id: string | null
          position: number | null
          priority: Database["public"]["Enums"]["priority"]
          raw_input_id: string | null
          related_job_id: string | null
          related_person_id: string | null
          snoozed_until: string | null
          source: Database["public"]["Enums"]["task_source"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["task_category"]
          completed_at?: string | null
          created_at?: string
          delay_count?: number
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          idempotency_key?: string | null
          killed_at?: string | null
          killed_reason?: string | null
          last_delayed_at?: string | null
          parent_task_id?: string | null
          position?: number | null
          priority?: Database["public"]["Enums"]["priority"]
          raw_input_id?: string | null
          related_job_id?: string | null
          related_person_id?: string | null
          snoozed_until?: string | null
          source?: Database["public"]["Enums"]["task_source"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["task_category"]
          completed_at?: string | null
          created_at?: string
          delay_count?: number
          deleted_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          idempotency_key?: string | null
          killed_at?: string | null
          killed_reason?: string | null
          last_delayed_at?: string | null
          parent_task_id?: string | null
          position?: number | null
          priority?: Database["public"]["Enums"]["priority"]
          raw_input_id?: string | null
          related_job_id?: string | null
          related_person_id?: string | null
          snoozed_until?: string | null
          source?: Database["public"]["Enums"]["task_source"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_raw_input_id_fkey"
            columns: ["raw_input_id"]
            isOneToOne: false
            referencedRelation: "raw_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_related_person_id_fkey"
            columns: ["related_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      job_status:
        | "lead"
        | "applied"
        | "screening"
        | "interview"
        | "offer"
        | "rejected"
        | "withdrawn"
      person_status:
        | "to_contact"
        | "contacted"
        | "replied"
        | "meeting_booked"
        | "follow_up_due"
        | "waiting"
        | "dormant"
        | "closed"
      priority: "high" | "medium" | "low"
      relationship_type:
        | "recruiter"
        | "hiring_manager"
        | "referral"
        | "alumni"
        | "friend"
        | "investor"
        | "operator"
        | "other"
      task_category:
        | "job_application"
        | "networking"
        | "follow_up"
        | "meeting"
        | "interview_prep"
        | "admin"
        | "personal"
      task_source: "manual" | "telegram" | "ai_parser" | "recurring"
      task_status: "to_do" | "in_progress" | "waiting" | "done" | "killed"
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
  public: {
    Enums: {
      job_status: [
        "lead",
        "applied",
        "screening",
        "interview",
        "offer",
        "rejected",
        "withdrawn",
      ],
      person_status: [
        "to_contact",
        "contacted",
        "replied",
        "meeting_booked",
        "follow_up_due",
        "waiting",
        "dormant",
        "closed",
      ],
      priority: ["high", "medium", "low"],
      relationship_type: [
        "recruiter",
        "hiring_manager",
        "referral",
        "alumni",
        "friend",
        "investor",
        "operator",
        "other",
      ],
      task_category: [
        "job_application",
        "networking",
        "follow_up",
        "meeting",
        "interview_prep",
        "admin",
        "personal",
      ],
      task_source: ["manual", "telegram", "ai_parser", "recurring"],
      task_status: ["to_do", "in_progress", "waiting", "done", "killed"],
    },
  },
} as const
