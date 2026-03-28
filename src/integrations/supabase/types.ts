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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_prompts: {
        Row: {
          agent_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          recommended_model: string | null
          requires_documents: string[] | null
          system_prompt: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          recommended_model?: string | null
          requires_documents?: string[] | null
          system_prompt: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          recommended_model?: string | null
          requires_documents?: string[] | null
          system_prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          created_at: string
          feed_id: string
          id: string
          image: string | null
          link: string
          published_at: string | null
          source_name: string | null
          summary: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feed_id: string
          id?: string
          image?: string | null
          link: string
          published_at?: string | null
          source_name?: string | null
          summary?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          feed_id?: string
          id?: string
          image?: string | null
          link?: string
          published_at?: string | null
          source_name?: string | null
          summary?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "user_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      client_metrics: {
        Row: {
          active_clients: number | null
          ad_spend: number | null
          advertising_impressions_ig: number | null
          advertising_reach_ig: number | null
          avg_client_tenure_months: number | null
          churned_cancellation: number | null
          churned_end_of_contract: number | null
          clients_3_to_6_months: number | null
          clients_at_risk: number | null
          clients_over_6_months: number | null
          clients_under_3_months: number | null
          cpm: number | null
          created_at: string | null
          daily_ad_spend: number | null
          email_list_size: number | null
          expenses: number | null
          id: string
          long_form_channel_size: number | null
          long_form_monthly_audience: number | null
          monthly_recurring_revenue: number | null
          net_new_subscribers: number | null
          new_clients: number | null
          new_subscribers: number | null
          period_month: number
          period_year: number
          profit: number | null
          roas: number | null
          short_form_channel_size: number | null
          total_cash_collected: number | null
          total_new_revenue: number | null
          total_posts_made: number | null
          total_reach_ig_impressions_li: number | null
          total_videos_podcasts_made: number | null
          updated_at: string | null
          upsells_expansions: number | null
          user_id: string
          youtube_total_hours: number | null
          youtube_total_views: number | null
        }
        Insert: {
          active_clients?: number | null
          ad_spend?: number | null
          advertising_impressions_ig?: number | null
          advertising_reach_ig?: number | null
          avg_client_tenure_months?: number | null
          churned_cancellation?: number | null
          churned_end_of_contract?: number | null
          clients_3_to_6_months?: number | null
          clients_at_risk?: number | null
          clients_over_6_months?: number | null
          clients_under_3_months?: number | null
          cpm?: number | null
          created_at?: string | null
          daily_ad_spend?: number | null
          email_list_size?: number | null
          expenses?: number | null
          id?: string
          long_form_channel_size?: number | null
          long_form_monthly_audience?: number | null
          monthly_recurring_revenue?: number | null
          net_new_subscribers?: number | null
          new_clients?: number | null
          new_subscribers?: number | null
          period_month: number
          period_year: number
          profit?: number | null
          roas?: number | null
          short_form_channel_size?: number | null
          total_cash_collected?: number | null
          total_new_revenue?: number | null
          total_posts_made?: number | null
          total_reach_ig_impressions_li?: number | null
          total_videos_podcasts_made?: number | null
          updated_at?: string | null
          upsells_expansions?: number | null
          user_id: string
          youtube_total_hours?: number | null
          youtube_total_views?: number | null
        }
        Update: {
          active_clients?: number | null
          ad_spend?: number | null
          advertising_impressions_ig?: number | null
          advertising_reach_ig?: number | null
          avg_client_tenure_months?: number | null
          churned_cancellation?: number | null
          churned_end_of_contract?: number | null
          clients_3_to_6_months?: number | null
          clients_at_risk?: number | null
          clients_over_6_months?: number | null
          clients_under_3_months?: number | null
          cpm?: number | null
          created_at?: string | null
          daily_ad_spend?: number | null
          email_list_size?: number | null
          expenses?: number | null
          id?: string
          long_form_channel_size?: number | null
          long_form_monthly_audience?: number | null
          monthly_recurring_revenue?: number | null
          net_new_subscribers?: number | null
          new_clients?: number | null
          new_subscribers?: number | null
          period_month?: number
          period_year?: number
          profit?: number | null
          roas?: number | null
          short_form_channel_size?: number | null
          total_cash_collected?: number | null
          total_new_revenue?: number | null
          total_posts_made?: number | null
          total_reach_ig_impressions_li?: number | null
          total_videos_podcasts_made?: number | null
          updated_at?: string | null
          upsells_expansions?: number | null
          user_id?: string
          youtube_total_hours?: number | null
          youtube_total_views?: number | null
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          tokens: number | null
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          tokens?: number | null
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          agent_id: string | null
          content: string | null
          created_at: string
          description: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      implementation_tasks: {
        Row: {
          created_at: string
          id: string
          month_order: number
          month_title: string
          status: string
          tag_colors: string[] | null
          tags: string[] | null
          task_order: number
          task_title: string
          updated_at: string
          url: string | null
          week_order: number
          week_title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          month_order?: number
          month_title: string
          status?: string
          tag_colors?: string[] | null
          tags?: string[] | null
          task_order?: number
          task_title: string
          updated_at?: string
          url?: string | null
          week_order?: number
          week_title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          month_order?: number
          month_title?: string
          status?: string
          tag_colors?: string[] | null
          tags?: string[] | null
          task_order?: number
          task_title?: string
          updated_at?: string
          url?: string | null
          week_order?: number
          week_title?: string | null
        }
        Relationships: []
      }
      lesson_modules: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          order_index: number
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number
          title?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          created_at: string | null
          description: string | null
          duration: string | null
          id: string
          is_active: boolean | null
          loom_id: string
          module_id: string
          order_index: number
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          is_active?: boolean | null
          loom_id: string
          module_id: string
          order_index?: number
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          is_active?: boolean | null
          loom_id?: string
          module_id?: string
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "lesson_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisa_callbacks: {
        Row: {
          created_at: string
          id: string
          request_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          status?: string
        }
        Relationships: []
      }
      user_feeds: {
        Row: {
          created_at: string
          id: string
          name: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      user_lesson_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          id: string
          mercado: string | null
          nicho: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          mercado?: string | null
          nicho?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          mercado?: string | null
          nicho?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      search_documents: {
        Args: {
          filter_document_types?: string[]
          filter_user_id?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
