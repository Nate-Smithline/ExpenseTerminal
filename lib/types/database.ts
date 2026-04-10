export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          email_opt_in: boolean;
          notification_email_updates: boolean;
          notification_group: boolean;
          onboarding_progress: Json | null;
          terms_accepted_at: string | null;
          password_changed_at: string | null;
          active_org_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          email_opt_in?: boolean;
          notification_email_updates?: boolean;
          notification_group?: boolean;
          onboarding_progress?: Json | null;
          terms_accepted_at?: string | null;
          password_changed_at?: string | null;
          active_org_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      orgs: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
          accounts_page_visibility: string;
          icon_emoji: string | null;
          icon_image_url: string | null;
        };
        Insert: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
          accounts_page_visibility?: string;
          icon_emoji?: string | null;
          icon_image_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["orgs"]["Insert"]>;
      };
      org_memberships: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["org_memberships"]["Insert"]>;
      };
      org_pending_invites: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          invited_by: string | null;
          created_at: string;
          last_sent_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          invited_by?: string | null;
          created_at?: string;
          last_sent_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["org_pending_invites"]["Insert"]>;
      };
      org_member_join_notify_queue: {
        Row: {
          id: string;
          org_id: string;
          member_user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          member_user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["org_member_join_notify_queue"]["Insert"]>;
      };
      email_verifications: {
        Row: {
          id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_verifications"]["Insert"]>;
      };
      password_reset_tokens: {
        Row: {
          id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["password_reset_tokens"]["Insert"]>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          vendor: string;
          description: string | null;
          amount: string;
          category: string | null;
          schedule_c_line: string | null;
          ai_confidence: number | null;
          ai_reasoning: string | null;
          ai_suggestions: Json | null;
          status: "pending" | "completed" | "personal" | "auto_sorted";
          business_purpose: string | null;
          quick_label: string | null;
          notes: string | null;
          vendor_normalized: string | null;
          auto_sort_rule_id: string | null;
          deduction_percent: number | null;
          is_meal: boolean | null;
          is_travel: boolean | null;
          tax_year: number;
          source: string | null;
          transaction_type: "expense" | "income" | null;
          eligible_for_ai: boolean;
          data_source_id: string | null;
          data_feed_external_id: string | null;
          custom_fields: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          vendor: string;
          description?: string | null;
          amount: string;
          category?: string | null;
          schedule_c_line?: string | null;
          ai_confidence?: number | null;
          ai_reasoning?: string | null;
          ai_suggestions?: Json | null;
          status?: "pending" | "completed" | "personal" | "auto_sorted";
          business_purpose?: string | null;
          quick_label?: string | null;
          notes?: string | null;
          vendor_normalized?: string | null;
          auto_sort_rule_id?: string | null;
          deduction_percent?: number | null;
          is_meal?: boolean | null;
          is_travel?: boolean | null;
          tax_year: number;
          source?: string | null;
          transaction_type?: "expense" | "income" | null;
          eligible_for_ai?: boolean;
          data_source_id?: string | null;
          data_feed_external_id?: string | null;
          custom_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
      };
      auto_sort_rules: {
        Row: {
          id: string;
          user_id: string;
          vendor_pattern: string;
          quick_label: string;
          business_purpose: string | null;
          category: string | null;
          name: string | null;
          enabled: boolean;
          conditions: Json;
          action: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vendor_pattern: string;
          quick_label: string;
          business_purpose?: string | null;
          category?: string | null;
          name?: string | null;
          enabled?: boolean;
          conditions?: Json;
          action?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["auto_sort_rules"]["Insert"]>;
      };
      vendor_patterns: {
        Row: {
          id: string;
          user_id: string;
          vendor_normalized: string;
          category: string | null;
          schedule_c_line: string | null;
          deduction_percent: number | null;
          quick_labels: Json | null;
          confidence: number | null;
          times_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vendor_normalized: string;
          category?: string | null;
          schedule_c_line?: string | null;
          deduction_percent?: number | null;
          quick_labels?: Json | null;
          confidence?: number | null;
          times_used?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vendor_patterns"]["Insert"]>;
      };
      deductions: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          tax_year: number;
          amount: string;
          tax_savings: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          tax_year: number;
          amount: string;
          tax_savings: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deductions"]["Insert"]>;
      };
      data_sources: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          name: string;
          account_type: string;
          institution: string | null;
          source_type: string;
          stripe_account_id: string | null;
          financial_connections_account_id: string | null;
          connected_at: string | null;
          last_successful_sync_at: string | null;
          last_failed_sync_at: string | null;
          last_error_summary: string | null;
          last_upload_at: string | null;
          transaction_count: number;
          stripe_sync_start_date: string | null;
          plaid_access_token: string | null;
          plaid_item_id: string | null;
          plaid_account_id: string | null;
          plaid_cursor: string | null;
          plaid_institution_id: string | null;
          plaid_balance_current: number | string | null;
          plaid_balance_available: number | string | null;
          plaid_balance_limit: number | string | null;
          plaid_balance_iso_currency_code: string | null;
          plaid_balance_as_of: string | null;
          manual_balance: number | string | null;
          manual_balance_iso_currency_code: string | null;
          balance_class: string | null;
          include_in_net_worth: boolean;
          balance_value_preference: string | null;
          brand_color_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          name: string;
          account_type: string;
          institution?: string | null;
          source_type?: string;
          stripe_account_id?: string | null;
          financial_connections_account_id?: string | null;
          connected_at?: string | null;
          last_successful_sync_at?: string | null;
          last_failed_sync_at?: string | null;
          last_error_summary?: string | null;
          last_upload_at?: string | null;
          transaction_count?: number;
          stripe_sync_start_date?: string | null;
          plaid_access_token?: string | null;
          plaid_item_id?: string | null;
          plaid_account_id?: string | null;
          plaid_cursor?: string | null;
          plaid_institution_id?: string | null;
          plaid_balance_current?: number | string | null;
          plaid_balance_available?: number | string | null;
          plaid_balance_limit?: number | string | null;
          plaid_balance_iso_currency_code?: string | null;
          plaid_balance_as_of?: string | null;
          manual_balance?: number | string | null;
          manual_balance_iso_currency_code?: string | null;
          balance_class?: string | null;
          include_in_net_worth?: boolean;
          balance_value_preference?: string | null;
          brand_color_id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["data_sources"]["Insert"]>;
      };
      org_settings: {
        Row: {
          id: string;
          user_id: string;
          business_name: string | null;
          ein: string | null;
          business_address: string | null;
          business_address_line1: string | null;
          business_address_line2: string | null;
          business_city: string | null;
          business_state: string | null;
          business_zip: string | null;
          filing_type: string | null;
          personal_filing_status: string | null;
          business_industry: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          business_name?: string | null;
          ein?: string | null;
          business_address?: string | null;
          business_address_line1?: string | null;
          business_address_line2?: string | null;
          business_city?: string | null;
          business_state?: string | null;
          business_zip?: string | null;
          filing_type?: string | null;
          personal_filing_status?: string | null;
          business_industry?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["org_settings"]["Insert"]>;
      };
      tax_year_settings: {
        Row: {
          id: string;
          user_id: string;
          tax_year: number;
          tax_rate: string;
          expected_income_range: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tax_year: number;
          tax_rate: string;
          expected_income_range?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tax_year_settings"]["Insert"]>;
      };
      notification_preferences: {
        Row: {
          user_id: string;
          type: "count_based" | "interval_based";
          value: string;
          last_notified_at: string | null;
          last_counter_reset_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          type: "count_based" | "interval_based";
          value: string;
          last_notified_at?: string | null;
          last_counter_reset_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_preferences"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_product_id: string | null;
          stripe_price_id: string | null;
          plan: "starter" | "plus" | null;
          status: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_product_id?: string | null;
          stripe_price_id?: string | null;
          plan?: "starter" | "plus" | null;
          status?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
      tax_filing_overrides: {
        Row: {
          id: string;
          user_id: string;
          tax_year: number;
          form_type: string;
          line_key: string;
          original_value: string | null;
          override_value: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tax_year: number;
          form_type: string;
          line_key: string;
          original_value?: string | null;
          override_value: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tax_filing_overrides"]["Insert"]>;
      };
      disclaimer_acknowledgments: {
        Row: {
          id: string;
          user_id: string;
          action_type: string;
          tax_year: number;
          acknowledged_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action_type: string;
          tax_year: number;
          acknowledged_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["disclaimer_acknowledgments"]["Insert"]>;
      };
      activity_view_settings: {
        Row: {
          id: string;
          user_id: string;
          org_id: string | null;
          sort_column: string | null;
          sort_asc: boolean | null;
          visible_columns: Json | null;
          column_widths: Json | null;
          filters: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          org_id?: string | null;
          sort_column?: string | null;
          sort_asc?: boolean | null;
          visible_columns?: Json | null;
          column_widths?: Json | null;
          filters?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_view_settings"]["Insert"]>;
      };
      transaction_property_definitions: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          type: string;
          config: Json;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          type: string;
          config?: Json;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transaction_property_definitions"]["Insert"]>;
      };
      org_transaction_rules: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          enabled: boolean;
          position: number;
          conditions_json: Json;
          actions_json: Json;
          trigger_mode: string;
          once_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name?: string;
          enabled?: boolean;
          position?: number;
          conditions_json?: Json;
          actions_json?: Json;
          trigger_mode?: string;
          once_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["org_transaction_rules"]["Insert"]>;
      };
      org_transaction_rule_runs: {
        Row: {
          id: string;
          org_id: string;
          rule_id: string | null;
          started_at: string;
          finished_at: string | null;
          status: string;
          match_count: number;
          update_count: number;
          ai_count: number;
          error_summary: string | null;
          context: Json;
        };
        Insert: {
          id?: string;
          org_id: string;
          rule_id?: string | null;
          started_at?: string;
          finished_at?: string | null;
          status?: string;
          match_count?: number;
          update_count?: number;
          ai_count?: number;
          error_summary?: string | null;
          context?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["org_transaction_rule_runs"]["Insert"]>;
      };
      user_financial_snapshots: {
        Row: {
          user_id: string;
          snapshot_date: string;
          net_worth: number | string;
          total_assets: number | string;
          total_liabilities: number | string;
          accounts: Json;
          created_at: string;
        };
        Insert: {
          user_id: string;
          snapshot_date: string;
          net_worth: number | string;
          total_assets: number | string;
          total_liabilities: number | string;
          accounts?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_financial_snapshots"]["Insert"]>;
      };
    };
  };
}
