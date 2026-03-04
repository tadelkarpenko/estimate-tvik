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
      cost_audits: {
        Row: {
          created_at: string
          estimate_id: string
          findings_json: string
          id: string
          recommended_actions: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimate_id: string
          findings_json?: string
          id?: string
          recommended_actions?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimate_id?: string
          findings_json?: string
          id?: string
          recommended_actions?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      cost_library: {
        Row: {
          created_at: string
          default_included: boolean
          description: string
          id: string
          labor_unit_cost: number
          last_updated: string
          material_unit_cost: number
          notes: string
          project_type: string
          qty_rule: string
          trade: string
          unit_label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_included?: boolean
          description?: string
          id?: string
          labor_unit_cost?: number
          last_updated?: string
          material_unit_cost?: number
          notes?: string
          project_type: string
          qty_rule?: string
          trade: string
          unit_label?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_included?: boolean
          description?: string
          id?: string
          labor_unit_cost?: number
          last_updated?: string
          material_unit_cost?: number
          notes?: string
          project_type?: string
          qty_rule?: string
          trade?: string
          unit_label?: string
          user_id?: string
        }
        Relationships: []
      }
      estimate_counter: {
        Row: {
          counter: number
          id: string
          user_id: string
        }
        Insert: {
          counter?: number
          id?: string
          user_id: string
        }
        Update: {
          counter?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      estimates: {
        Row: {
          ai_price_audit_summary: string
          ai_scope: string
          assumptions_rich: string
          city: string
          client_email: string
          client_name: string
          client_phone: string
          contingency_pct: number
          cost_structure_json: string
          created_at: string
          created_by: string
          estimate_id: string
          finish_level: string
          finish_materials_included: boolean
          fixture_count: number
          id: string
          internal_pdf_url: string
          labor_hours: number
          labor_subtotal: number
          last_revision_summary: string
          line_items_json: string
          material_subtotal: number
          overall_risk_level: string
          overhead_pct: number
          profit_pct: number
          project_address: string
          project_name: string
          project_type: string
          public_pdf_url: string
          risk_cost_high: number
          risk_cost_low: number
          risk_table_json: string
          sqft: number
          state: string
          status: string
          subtotal: number
          timeline_rich: string
          total_high: number
          total_low: number
          updated_at: string
          user_id: string
          version: string
          zip: string
        }
        Insert: {
          ai_price_audit_summary?: string
          ai_scope?: string
          assumptions_rich?: string
          city?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          contingency_pct?: number
          cost_structure_json?: string
          created_at?: string
          created_by?: string
          estimate_id: string
          finish_level?: string
          finish_materials_included?: boolean
          fixture_count?: number
          id?: string
          internal_pdf_url?: string
          labor_hours?: number
          labor_subtotal?: number
          last_revision_summary?: string
          line_items_json?: string
          material_subtotal?: number
          overall_risk_level?: string
          overhead_pct?: number
          profit_pct?: number
          project_address?: string
          project_name?: string
          project_type?: string
          public_pdf_url?: string
          risk_cost_high?: number
          risk_cost_low?: number
          risk_table_json?: string
          sqft?: number
          state?: string
          status?: string
          subtotal?: number
          timeline_rich?: string
          total_high?: number
          total_low?: number
          updated_at?: string
          user_id: string
          version?: string
          zip?: string
        }
        Update: {
          ai_price_audit_summary?: string
          ai_scope?: string
          assumptions_rich?: string
          city?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          contingency_pct?: number
          cost_structure_json?: string
          created_at?: string
          created_by?: string
          estimate_id?: string
          finish_level?: string
          finish_materials_included?: boolean
          fixture_count?: number
          id?: string
          internal_pdf_url?: string
          labor_hours?: number
          labor_subtotal?: number
          last_revision_summary?: string
          line_items_json?: string
          material_subtotal?: number
          overall_risk_level?: string
          overhead_pct?: number
          profit_pct?: number
          project_address?: string
          project_name?: string
          project_type?: string
          public_pdf_url?: string
          risk_cost_high?: number
          risk_cost_low?: number
          risk_table_json?: string
          sqft?: number
          state?: string
          status?: string
          subtotal?: number
          timeline_rich?: string
          total_high?: number
          total_low?: number
          updated_at?: string
          user_id?: string
          version?: string
          zip?: string
        }
        Relationships: []
      }
      revision_logs: {
        Row: {
          change_summary: string
          created_at: string
          delta_high: number
          delta_low: number
          estimate_id: string
          id: string
          snapshot_json: string
          user_id: string
          version: string
        }
        Insert: {
          change_summary?: string
          created_at?: string
          delta_high?: number
          delta_low?: number
          estimate_id: string
          id?: string
          snapshot_json?: string
          user_id: string
          version?: string
        }
        Update: {
          change_summary?: string
          created_at?: string
          delta_high?: number
          delta_low?: number
          estimate_id?: string
          id?: string
          snapshot_json?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      risk_library: {
        Row: {
          created_at: string
          default_included: boolean
          default_level: string
          exposure_high_pct: number
          exposure_low_pct: number
          id: string
          mitigation_note: string
          project_type: string
          risk_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_included?: boolean
          default_level?: string
          exposure_high_pct?: number
          exposure_low_pct?: number
          id?: string
          mitigation_note?: string
          project_type: string
          risk_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_included?: boolean
          default_level?: string
          exposure_high_pct?: number
          exposure_low_pct?: number
          id?: string
          mitigation_note?: string
          project_type?: string
          risk_name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
