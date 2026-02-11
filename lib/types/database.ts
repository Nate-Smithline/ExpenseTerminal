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
          is_meal: boolean | null;
          is_travel: boolean | null;
          tax_year: number;
          source: string | null;
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
          is_meal?: boolean | null;
          is_travel?: boolean | null;
          tax_year: number;
          source?: string | null;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vendor_pattern: string;
          quick_label: string;
          business_purpose?: string | null;
          category?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["auto_sort_rules"]["Insert"]>;
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
    };
  };
}

