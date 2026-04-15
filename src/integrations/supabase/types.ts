Initialising login role...
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
          uses_documents_context: boolean
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
          uses_documents_context?: boolean
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
          uses_documents_context?: boolean
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "articles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          tenant_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          agent_id: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_streaming: boolean
          role: string
          tenant_id: string
          thinking: string | null
          thinking_duration: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          is_streaming?: boolean
          role: string
          tenant_id: string
          thinking?: string | null
          thinking_duration?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_streaming?: boolean
          role?: string
          tenant_id?: string
          thinking?: string | null
          thinking_duration?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
        Relationships: [
          {
            foreignKeyName: "client_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "document_chunks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          processing_error: string | null
          processing_status: string
          tenant_id: string
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
          processing_error?: string | null
          processing_status?: string
          tenant_id?: string
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
          processing_error?: string | null
          processing_status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_task_checks: {
        Row: {
          auto_detected: boolean
          checked_at: string | null
          created_at: string
          id: string
          is_checked: boolean
          task_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_detected?: boolean
          checked_at?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean
          task_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_detected?: boolean
          checked_at?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean
          task_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_task_checks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "implementation_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_task_checks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          trigger_type: string | null
          trigger_value: string | null
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
          trigger_type?: string | null
          trigger_value?: string | null
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
          trigger_type?: string | null
          trigger_value?: string | null
          updated_at?: string
          url?: string | null
          week_order?: number
          week_title?: string | null
        }
        Relationships: []
      }
      internal_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          key_name: string
          provider: string
          secret_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key_name: string
          provider?: string
          secret_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key_name?: string
          provider?: string
          secret_value?: string
          updated_at?: string
          updated_by?: string | null
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
      market_research_saved_posts: {
        Row: {
          caption: string | null
          created_at: string
          hashtags: string[]
          id: string
          media_url: string | null
          mentions: string[]
          metrics: Json
          platform: string
          post_id: string
          post_type: string
          post_url: string
          published_at: string | null
          tenant_id: string
          thumbnail_url: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          hashtags?: string[]
          id?: string
          media_url?: string | null
          mentions?: string[]
          metrics?: Json
          platform: string
          post_id: string
          post_type?: string
          post_url: string
          published_at?: string | null
          tenant_id: string
          thumbnail_url?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          hashtags?: string[]
          id?: string
          media_url?: string | null
          mentions?: string[]
          metrics?: Json
          platform?: string
          post_id?: string
          post_type?: string
          post_url?: string
          published_at?: string | null
          tenant_id?: string
          thumbnail_url?: string | null
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      monthly_data_submissions: {
        Row: {
          active_clients: number | null
          ad_spend: number | null
          booked_calls: number | null
          calls_showed: number | null
          confidence_score: number | null
          created_at: string
          id: string
          inbound_messages: number | null
          monthly_expenses: number | null
          monthly_recurring_revenue: number | null
          new_clients_signed: number | null
          offers_made: number | null
          period_month: number
          period_year: number
          posts_made: number | null
          reach: number | null
          strategy_calls: number | null
          tenant_id: string
          total_cash_collected: number | null
          total_followers: number | null
          total_new_revenue: number | null
          triage_calls: number | null
          updated_at: string
          user_id: string
          views: number | null
        }
        Insert: {
          active_clients?: number | null
          ad_spend?: number | null
          booked_calls?: number | null
          calls_showed?: number | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          inbound_messages?: number | null
          monthly_expenses?: number | null
          monthly_recurring_revenue?: number | null
          new_clients_signed?: number | null
          offers_made?: number | null
          period_month: number
          period_year: number
          posts_made?: number | null
          reach?: number | null
          strategy_calls?: number | null
          tenant_id?: string
          total_cash_collected?: number | null
          total_followers?: number | null
          total_new_revenue?: number | null
          triage_calls?: number | null
          updated_at?: string
          user_id: string
          views?: number | null
        }
        Update: {
          active_clients?: number | null
          ad_spend?: number | null
          booked_calls?: number | null
          calls_showed?: number | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          inbound_messages?: number | null
          monthly_expenses?: number | null
          monthly_recurring_revenue?: number | null
          new_clients_signed?: number | null
          offers_made?: number | null
          period_month?: number
          period_year?: number
          posts_made?: number | null
          reach?: number | null
          strategy_calls?: number | null
          tenant_id?: string
          total_cash_collected?: number | null
          total_followers?: number | null
          total_new_revenue?: number | null
          triage_calls?: number | null
          updated_at?: string
          user_id?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_data_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      new_deal_submissions: {
        Row: {
          cash_collected: number | null
          client_name: string
          created_at: string
          deal_date: string
          deal_value: number | null
          id: string
          notes: string | null
          offer_name: string | null
          payment_type: string
          source_channel: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_collected?: number | null
          client_name: string
          created_at?: string
          deal_date?: string
          deal_value?: number | null
          id?: string
          notes?: string | null
          offer_name?: string | null
          payment_type?: string
          source_channel?: string | null
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_collected?: number | null
          client_name?: string
          created_at?: string
          deal_date?: string
          deal_value?: number | null
          id?: string
          notes?: string | null
          offer_name?: string | null
          payment_type?: string
          source_channel?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "new_deal_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      system_documents: {
        Row: {
          applies_to_agents: string[]
          content: string
          created_at: string
          id: string
          is_active: boolean
          is_mandatory: boolean
          name: string
          updated_at: string
        }
        Insert: {
          applies_to_agents?: string[]
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          applies_to_agents?: string[]
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_mandatory?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      token_usage: {
        Row: {
          agent_id: string | null
          cost_usd: number
          created_at: string
          id: string
          input_tokens: number
          model_id: string
          output_tokens: number
          provider: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model_id: string
          output_tokens?: number
          provider?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model_id?: string
          output_tokens?: number
          provider?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feeds: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feeds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lesson_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          lesson_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string
          tenant_id?: string
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
          {
            foreignKeyName: "user_lesson_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_tenant_id: string | null
          full_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_tenant_id?: string | null
          full_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_tenant_id?: string | null
          full_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_default_tenant_id_fkey"
            columns: ["default_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          mercado?: string | null
          nicho?: string | null
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          mercado?: string | null
          nicho?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_wins_submissions: {
        Row: {
          blocker: string | null
          created_at: string
          id: string
          one_focus_this_week: string | null
          reference_date: string
          tenant_id: string
          top_win_1: string
          top_win_2: string | null
          top_win_3: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blocker?: string | null
          created_at?: string
          id?: string
          one_focus_this_week?: string | null
          reference_date?: string
          tenant_id?: string
          top_win_1: string
          top_win_2?: string | null
          top_win_3?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blocker?: string | null
          created_at?: string
          id?: string
          one_focus_this_week?: string | null
          reference_date?: string
          tenant_id?: string
          top_win_1?: string
          top_win_2?: string | null
          top_win_3?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_wins_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      current_user_can_access_tenant: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      current_user_can_manage_user_row: {
        Args: { _row_user_id: string; _tenant_id: string }
        Returns: boolean
      }
      get_default_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _roles: Database["public"]["Enums"]["tenant_role"][]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_global_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      search_documents: {
        Args: {
          filter_document_types?: string[]
          filter_tenant_id?: string
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
      tenant_role: "owner" | "admin" | "member" | "viewer"
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
      app_role: ["admin", "moderator", "user"],
      tenant_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const
A new version of Supabase CLI is available: v2.90.0 (currently installed v2.87.2)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
