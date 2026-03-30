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
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
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
          plaid_cursor: string | null;
          plaid_institution_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
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
          plaid_cursor?: string | null;
          plaid_institution_id?: string | null;
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
          sort_column: string | null;
          sort_asc: boolean | null;
          visible_columns: Json | null;
          filters: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sort_column?: string | null;
          sort_asc?: boolean | null;
          visible_columns?: Json | null;
          filters?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_view_settings"]["Insert"]>;
      };
    };
  };
}
