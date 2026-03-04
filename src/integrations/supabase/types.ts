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
      change_orders: {
        Row: {
          approved: boolean
          approved_at: string | null
          change_order_id: string
          change_type: string
          contract_id: string
          created_at: string
          delta_value: number
          description: string
          id: string
          override_reason: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          change_order_id: string
          change_type?: string
          contract_id: string
          created_at?: string
          delta_value?: number
          description?: string
          id?: string
          override_reason?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          change_order_id?: string
          change_type?: string
          contract_id?: string
          created_at?: string
          delta_value?: number
          description?: string
          id?: string
          override_reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_audit_log: {
        Row: {
          action_type: string
          contract_id: string
          created_at: string
          id: string
          new_value: string
          old_value: string
          reason: string
          user_id: string
        }
        Insert: {
          action_type?: string
          contract_id: string
          created_at?: string
          id?: string
          new_value?: string
          old_value?: string
          reason?: string
          user_id: string
        }
        Update: {
          action_type?: string
          contract_id?: string
          created_at?: string
          id?: string
          new_value?: string
          old_value?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_audit_log_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          baseline_contract_value: number
          baseline_margin_pct: number
          baseline_risk_exposure: number
          cash_forecast_30: number
          cash_forecast_60: number
          cash_forecast_90: number
          contract_id: string
          contract_status: string
          created_at: string
          earned_revenue: number
          estimate_id: string
          id: string
          locked: boolean
          margin_current_pct: number
          net_contract_value: number
          payment_schedule_json: string
          payment_terms_template: string
          percent_complete: number
          profit_fade_flag: boolean
          projected_final_cost: number
          projected_final_profit: number
          signed_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline_contract_value?: number
          baseline_margin_pct?: number
          baseline_risk_exposure?: number
          cash_forecast_30?: number
          cash_forecast_60?: number
          cash_forecast_90?: number
          contract_id: string
          contract_status?: string
          created_at?: string
          earned_revenue?: number
          estimate_id: string
          id?: string
          locked?: boolean
          margin_current_pct?: number
          net_contract_value?: number
          payment_schedule_json?: string
          payment_terms_template?: string
          percent_complete?: number
          profit_fade_flag?: boolean
          projected_final_cost?: number
          projected_final_profit?: number
          signed_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline_contract_value?: number
          baseline_margin_pct?: number
          baseline_risk_exposure?: number
          cash_forecast_30?: number
          cash_forecast_60?: number
          cash_forecast_90?: number
          contract_id?: string
          contract_status?: string
          created_at?: string
          earned_revenue?: number
          estimate_id?: string
          id?: string
          locked?: boolean
          margin_current_pct?: number
          net_contract_value?: number
          payment_schedule_json?: string
          payment_terms_template?: string
          percent_complete?: number
          profit_fade_flag?: boolean
          projected_final_cost?: number
          projected_final_profit?: number
          signed_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
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
          active: boolean
          created_at: string
          crew_trade: string
          default_included: boolean
          description: string
          id: string
          labor_hours_per_unit: number
          labor_unit_cost: number
          last_updated: string
          material_unit_cost: number
          notes: string
          productivity_note: string
          project_type: string
          qty_rule: string
          trade: string
          unit_label: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          crew_trade?: string
          default_included?: boolean
          description?: string
          id?: string
          labor_hours_per_unit?: number
          labor_unit_cost?: number
          last_updated?: string
          material_unit_cost?: number
          notes?: string
          productivity_note?: string
          project_type: string
          qty_rule?: string
          trade: string
          unit_label?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          crew_trade?: string
          default_included?: boolean
          description?: string
          id?: string
          labor_hours_per_unit?: number
          labor_unit_cost?: number
          last_updated?: string
          material_unit_cost?: number
          notes?: string
          productivity_note?: string
          project_type?: string
          qty_rule?: string
          trade?: string
          unit_label?: string
          user_id?: string
        }
        Relationships: []
      }
      estimate_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          message_id: string
          role: string
          suggested_changes_json: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          message_id: string
          role?: string
          suggested_changes_json?: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          message_id?: string
          role?: string
          suggested_changes_json?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "estimate_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_chat_threads: {
        Row: {
          created_at: string
          estimate_id: string
          id: string
          thread_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimate_id: string
          id?: string
          thread_id: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimate_id?: string
          id?: string
          thread_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_chat_threads_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
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
      estimate_line_items: {
        Row: {
          actual_labor_cost_to_date: number
          actual_material_cost_to_date: number
          confidence: string
          contract_id: string | null
          created_at: string
          description: string
          estimate_id: string
          evidence_source: string
          id: string
          labor_hours_per_unit: number
          labor_hours_total: number
          labor_total: number
          labor_unit_cost: number
          line_id: string
          line_total: number
          locked: boolean
          material_total: number
          material_unit_cost: number
          notes: string
          pending_confirmation: boolean
          percent_complete: number
          phase: string
          projected_labor_cost: number
          projected_material_cost: number
          qty: number
          scheduled_finish: string | null
          scheduled_start: string | null
          source: string
          unit: string
          user_id: string
          wip_status: string
        }
        Insert: {
          actual_labor_cost_to_date?: number
          actual_material_cost_to_date?: number
          confidence?: string
          contract_id?: string | null
          created_at?: string
          description?: string
          estimate_id: string
          evidence_source?: string
          id?: string
          labor_hours_per_unit?: number
          labor_hours_total?: number
          labor_total?: number
          labor_unit_cost?: number
          line_id: string
          line_total?: number
          locked?: boolean
          material_total?: number
          material_unit_cost?: number
          notes?: string
          pending_confirmation?: boolean
          percent_complete?: number
          phase?: string
          projected_labor_cost?: number
          projected_material_cost?: number
          qty?: number
          scheduled_finish?: string | null
          scheduled_start?: string | null
          source?: string
          unit?: string
          user_id: string
          wip_status?: string
        }
        Update: {
          actual_labor_cost_to_date?: number
          actual_material_cost_to_date?: number
          confidence?: string
          contract_id?: string | null
          created_at?: string
          description?: string
          estimate_id?: string
          evidence_source?: string
          id?: string
          labor_hours_per_unit?: number
          labor_hours_total?: number
          labor_total?: number
          labor_unit_cost?: number
          line_id?: string
          line_total?: number
          locked?: boolean
          material_total?: number
          material_unit_cost?: number
          notes?: string
          pending_confirmation?: boolean
          percent_complete?: number
          phase?: string
          projected_labor_cost?: number
          projected_material_cost?: number
          qty?: number
          scheduled_finish?: string | null
          scheduled_start?: string | null
          source?: string
          unit?: string
          user_id?: string
          wip_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_media: {
        Row: {
          caption: string
          created_at: string
          estimate_id: string
          file_url: string
          id: string
          include_in_internal_pdf: boolean
          include_in_public_pdf: boolean
          media_id: string
          user_id: string
        }
        Insert: {
          caption?: string
          created_at?: string
          estimate_id: string
          file_url?: string
          id?: string
          include_in_internal_pdf?: boolean
          include_in_public_pdf?: boolean
          media_id: string
          user_id: string
        }
        Update: {
          caption?: string
          created_at?: string
          estimate_id?: string
          file_url?: string
          id?: string
          include_in_internal_pdf?: boolean
          include_in_public_pdf?: boolean
          media_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_media_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_media_analysis: {
        Row: {
          ai_confidence: string
          analysis_id: string
          created_at: string
          id: string
          media_id: string
          observed_conditions: string
          questions_needed_json: string
          recommended_allowance_range: string
          risk_flags: string
          suggested_scope_impacts: string
          user_id: string
        }
        Insert: {
          ai_confidence?: string
          analysis_id: string
          created_at?: string
          id?: string
          media_id: string
          observed_conditions?: string
          questions_needed_json?: string
          recommended_allowance_range?: string
          risk_flags?: string
          suggested_scope_impacts?: string
          user_id: string
        }
        Update: {
          ai_confidence?: string
          analysis_id?: string
          created_at?: string
          id?: string
          media_id?: string
          observed_conditions?: string
          questions_needed_json?: string
          recommended_allowance_range?: string
          risk_flags?: string
          suggested_scope_impacts?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_media_analysis_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "estimate_media"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          ai_price_audit_summary: string
          ai_scope: string
          ai_suggestions_last_json: string
          assumptions_rich: string
          city: string
          clarification_answers_json: string
          client_email: string
          client_name: string
          client_phone: string
          contingency_pct: number
          cost_structure_json: string
          created_at: string
          created_by: string
          crew_size: number
          estimate_id: string
          estimated_duration_days: number
          finish_level: string
          finish_materials_included: boolean
          fixture_count: number
          hours_per_day: number
          id: string
          internal_notes: string
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
          public_notes: string
          public_pdf_url: string
          risk_cost_high: number
          risk_cost_low: number
          risk_table_json: string
          sqft: number
          state: string
          status: string
          subtotal: number
          subtotal_labor_hours: number
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
          ai_suggestions_last_json?: string
          assumptions_rich?: string
          city?: string
          clarification_answers_json?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          contingency_pct?: number
          cost_structure_json?: string
          created_at?: string
          created_by?: string
          crew_size?: number
          estimate_id: string
          estimated_duration_days?: number
          finish_level?: string
          finish_materials_included?: boolean
          fixture_count?: number
          hours_per_day?: number
          id?: string
          internal_notes?: string
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
          public_notes?: string
          public_pdf_url?: string
          risk_cost_high?: number
          risk_cost_low?: number
          risk_table_json?: string
          sqft?: number
          state?: string
          status?: string
          subtotal?: number
          subtotal_labor_hours?: number
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
          ai_suggestions_last_json?: string
          assumptions_rich?: string
          city?: string
          clarification_answers_json?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          contingency_pct?: number
          cost_structure_json?: string
          created_at?: string
          created_by?: string
          crew_size?: number
          estimate_id?: string
          estimated_duration_days?: number
          finish_level?: string
          finish_materials_included?: boolean
          fixture_count?: number
          hours_per_day?: number
          id?: string
          internal_notes?: string
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
          public_notes?: string
          public_pdf_url?: string
          risk_cost_high?: number
          risk_cost_low?: number
          risk_table_json?: string
          sqft?: number
          state?: string
          status?: string
          subtotal?: number
          subtotal_labor_hours?: number
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
