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
      contract_chat_messages: {
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
            foreignKeyName: "contract_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "contract_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_chat_threads: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          thread_id: string
          title: string
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          thread_id: string
          title?: string
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          thread_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_chat_threads_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_media: {
        Row: {
          caption: string
          contract_id: string
          created_at: string
          file_url: string
          id: string
          include_in_internal_pdf: boolean
          media_id: string
          user_id: string
        }
        Insert: {
          caption?: string
          contract_id: string
          created_at?: string
          file_url?: string
          id?: string
          include_in_internal_pdf?: boolean
          media_id: string
          user_id: string
        }
        Update: {
          caption?: string
          contract_id?: string
          created_at?: string
          file_url?: string
          id?: string
          include_in_internal_pdf?: boolean
          media_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_media_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_media_analysis: {
        Row: {
          allowance_risk_flags_json: string
          analysis_id: string
          conditional_items_json: string
          confidence: string
          created_at: string
          id: string
          media_id: string
          observed_conditions_json: string
          questions_needed_json: string
          user_id: string
        }
        Insert: {
          allowance_risk_flags_json?: string
          analysis_id: string
          conditional_items_json?: string
          confidence?: string
          created_at?: string
          id?: string
          media_id: string
          observed_conditions_json?: string
          questions_needed_json?: string
          user_id: string
        }
        Update: {
          allowance_risk_flags_json?: string
          analysis_id?: string
          conditional_items_json?: string
          confidence?: string
          created_at?: string
          id?: string
          media_id?: string
          observed_conditions_json?: string
          questions_needed_json?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_media_analysis_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "contract_media"
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
          cost_volatility_index: number
          created_at: string
          data_completeness_score: number
          earned_revenue: number
          estimate_id: string
          execution_priority_score: number
          id: string
          locked: boolean
          margin_current_pct: number
          margin_opportunity_score: number
          margin_risk_score: number
          net_contract_value: number
          payment_schedule_json: string
          payment_terms_template: string
          percent_complete: number
          pm_scorecard_json: string
          profit_fade_flag: boolean
          projected_final_cost: number
          projected_final_profit: number
          risk_quadrant: string
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
          cost_volatility_index?: number
          created_at?: string
          data_completeness_score?: number
          earned_revenue?: number
          estimate_id: string
          execution_priority_score?: number
          id?: string
          locked?: boolean
          margin_current_pct?: number
          margin_opportunity_score?: number
          margin_risk_score?: number
          net_contract_value?: number
          payment_schedule_json?: string
          payment_terms_template?: string
          percent_complete?: number
          pm_scorecard_json?: string
          profit_fade_flag?: boolean
          projected_final_cost?: number
          projected_final_profit?: number
          risk_quadrant?: string
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
          cost_volatility_index?: number
          created_at?: string
          data_completeness_score?: number
          earned_revenue?: number
          estimate_id?: string
          execution_priority_score?: number
          id?: string
          locked?: boolean
          margin_current_pct?: number
          margin_opportunity_score?: number
          margin_risk_score?: number
          net_contract_value?: number
          payment_schedule_json?: string
          payment_terms_template?: string
          percent_complete?: number
          pm_scorecard_json?: string
          profit_fade_flag?: boolean
          projected_final_cost?: number
          projected_final_profit?: number
          risk_quadrant?: string
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
      crew_capacity: {
        Row: {
          created_at: string
          crew_size: number
          effective_from: string
          effective_to: string | null
          hours_per_day: number
          id: string
          max_safe_utilization_pct: number
          overtime_allowed: boolean
          overtime_multiplier: number
          trade: string
          updated_at: string
          user_id: string
          work_days_per_week: number
        }
        Insert: {
          created_at?: string
          crew_size?: number
          effective_from?: string
          effective_to?: string | null
          hours_per_day?: number
          id?: string
          max_safe_utilization_pct?: number
          overtime_allowed?: boolean
          overtime_multiplier?: number
          trade?: string
          updated_at?: string
          user_id: string
          work_days_per_week?: number
        }
        Update: {
          created_at?: string
          crew_size?: number
          effective_from?: string
          effective_to?: string | null
          hours_per_day?: number
          id?: string
          max_safe_utilization_pct?: number
          overtime_allowed?: boolean
          overtime_multiplier?: number
          trade?: string
          updated_at?: string
          user_id?: string
          work_days_per_week?: number
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
          created_by: string
          description: string
          estimate_id: string
          evidence_source: string
          id: string
          include_in_internal_pdf: boolean
          include_in_public_pdf: boolean
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
          created_by?: string
          description?: string
          estimate_id: string
          evidence_source?: string
          id?: string
          include_in_internal_pdf?: boolean
          include_in_public_pdf?: boolean
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
          created_by?: string
          description?: string
          estimate_id?: string
          evidence_source?: string
          id?: string
          include_in_internal_pdf?: boolean
          include_in_public_pdf?: boolean
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
          calc_status: string
          city: string
          clarification_answers_json: string
          client_email: string
          client_name: string
          client_phone: string
          completeness_score: number
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
          material_volatility_flag: boolean
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
          validity_days: number
          version: string
          volatility_reviewed: boolean
          zip: string
        }
        Insert: {
          ai_price_audit_summary?: string
          ai_scope?: string
          ai_suggestions_last_json?: string
          assumptions_rich?: string
          calc_status?: string
          city?: string
          clarification_answers_json?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          completeness_score?: number
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
          material_volatility_flag?: boolean
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
          validity_days?: number
          version?: string
          volatility_reviewed?: boolean
          zip?: string
        }
        Update: {
          ai_price_audit_summary?: string
          ai_scope?: string
          ai_suggestions_last_json?: string
          assumptions_rich?: string
          calc_status?: string
          city?: string
          clarification_answers_json?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          completeness_score?: number
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
          material_volatility_flag?: boolean
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
          validity_days?: number
          version?: string
          volatility_reviewed?: boolean
          zip?: string
        }
        Relationships: []
      }
      execution_events: {
        Row: {
          contract_id: string
          created_at: string
          event_type: string
          id: string
          payload_json: string
          processed_at: string | null
          result_json: string
          status: string
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          event_type?: string
          id?: string
          payload_json?: string
          processed_at?: string | null
          result_json?: string
          status?: string
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload_json?: string
          processed_at?: string | null
          result_json?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_crew: string
          calendar_event_id: string
          client_email: string
          client_name: string
          client_phone: string
          created_at: string
          created_by: string
          created_from_estimate: boolean
          crew_lead_name: string
          crew_lead_phone: string
          end_datetime: string | null
          estimate_id: string
          id: string
          internal_notes: string
          job_id: string
          job_status: string
          job_title: string
          last_notification_at: string | null
          notification_status_summary: string
          property_address: string
          reminder_1h_status: string
          reminder_24h_status: string
          reminder_4h_status: string
          reminder_email_enabled: boolean
          reminder_sms_enabled: boolean
          reminder_telegram_enabled: boolean
          reminder_whatsapp_enabled: boolean
          scheduling_ready: boolean
          start_datetime: string | null
          updated_at: string
          updated_by: string
          user_id: string
        }
        Insert: {
          assigned_crew?: string
          calendar_event_id?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          created_by?: string
          created_from_estimate?: boolean
          crew_lead_name?: string
          crew_lead_phone?: string
          end_datetime?: string | null
          estimate_id: string
          id?: string
          internal_notes?: string
          job_id: string
          job_status?: string
          job_title?: string
          last_notification_at?: string | null
          notification_status_summary?: string
          property_address?: string
          reminder_1h_status?: string
          reminder_24h_status?: string
          reminder_4h_status?: string
          reminder_email_enabled?: boolean
          reminder_sms_enabled?: boolean
          reminder_telegram_enabled?: boolean
          reminder_whatsapp_enabled?: boolean
          scheduling_ready?: boolean
          start_datetime?: string | null
          updated_at?: string
          updated_by?: string
          user_id: string
        }
        Update: {
          assigned_crew?: string
          calendar_event_id?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          created_by?: string
          created_from_estimate?: boolean
          crew_lead_name?: string
          crew_lead_phone?: string
          end_datetime?: string | null
          estimate_id?: string
          id?: string
          internal_notes?: string
          job_id?: string
          job_status?: string
          job_title?: string
          last_notification_at?: string | null
          notification_status_summary?: string
          property_address?: string
          reminder_1h_status?: string
          reminder_24h_status?: string
          reminder_4h_status?: string
          reminder_email_enabled?: boolean
          reminder_sms_enabled?: boolean
          reminder_telegram_enabled?: boolean
          reminder_whatsapp_enabled?: boolean
          scheduling_ready?: boolean
          start_datetime?: string | null
          updated_at?: string
          updated_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_scorecard_snapshots: {
        Row: {
          change_order_quality: number
          composite_score: number
          contract_id: string
          created_at: string
          forecast_accuracy: number
          id: string
          margin_discipline: number
          margin_expansion: number
          schedule_integrity: number
          snapshot_json: string
          user_id: string
        }
        Insert: {
          change_order_quality?: number
          composite_score?: number
          contract_id: string
          created_at?: string
          forecast_accuracy?: number
          id?: string
          margin_discipline?: number
          margin_expansion?: number
          schedule_integrity?: number
          snapshot_json?: string
          user_id: string
        }
        Update: {
          change_order_quality?: number
          composite_score?: number
          contract_id?: string
          created_at?: string
          forecast_accuracy?: number
          id?: string
          margin_discipline?: number
          margin_expansion?: number
          schedule_integrity?: number
          snapshot_json?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_scorecard_snapshots_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
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
      schedule_phases: {
        Row: {
          actual_days: number
          actual_finish: string | null
          actual_start: string | null
          contract_id: string
          created_at: string
          delay_ratio: number
          depends_on_phase: string | null
          id: string
          phase_name: string
          planned_days: number
          planned_finish: string | null
          planned_start: string | null
          status: string
          user_id: string
        }
        Insert: {
          actual_days?: number
          actual_finish?: string | null
          actual_start?: string | null
          contract_id: string
          created_at?: string
          delay_ratio?: number
          depends_on_phase?: string | null
          id?: string
          phase_name?: string
          planned_days?: number
          planned_finish?: string | null
          planned_start?: string | null
          status?: string
          user_id: string
        }
        Update: {
          actual_days?: number
          actual_finish?: string | null
          actual_start?: string | null
          contract_id?: string
          created_at?: string
          delay_ratio?: number
          depends_on_phase?: string | null
          id?: string
          phase_name?: string
          planned_days?: number
          planned_finish?: string | null
          planned_start?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_phases_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_phases_depends_on_phase_fkey"
            columns: ["depends_on_phase"]
            isOneToOne: false
            referencedRelation: "schedule_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontract_invoices: {
        Row: {
          amount: number
          created_at: string
          dispute_flag: boolean
          dispute_reason: string
          id: string
          invoice_id: string
          paid_at: string | null
          status: string
          subcontract_id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          dispute_flag?: boolean
          dispute_reason?: string
          id?: string
          invoice_id: string
          paid_at?: string | null
          status?: string
          subcontract_id: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          dispute_flag?: boolean
          dispute_reason?: string
          id?: string
          invoice_id?: string
          paid_at?: string | null
          status?: string
          subcontract_id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontract_invoices_subcontract_id_fkey"
            columns: ["subcontract_id"]
            isOneToOne: false
            referencedRelation: "subcontracts"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontracts: {
        Row: {
          approved_cost: number
          committed_cost: number
          contract_id: string
          created_at: string
          estimated_trade_budget: number
          exposure_index: number
          id: string
          notes: string
          remaining_commitment: number
          status: string
          subcontract_id: string
          trade: string
          updated_at: string
          user_id: string
          vendor_name: string
        }
        Insert: {
          approved_cost?: number
          committed_cost?: number
          contract_id: string
          created_at?: string
          estimated_trade_budget?: number
          exposure_index?: number
          id?: string
          notes?: string
          remaining_commitment?: number
          status?: string
          subcontract_id: string
          trade?: string
          updated_at?: string
          user_id: string
          vendor_name?: string
        }
        Update: {
          approved_cost?: number
          committed_cost?: number
          contract_id?: string
          created_at?: string
          estimated_trade_budget?: number
          exposure_index?: number
          id?: string
          notes?: string
          remaining_commitment?: number
          status?: string
          subcontract_id?: string
          trade?: string
          updated_at?: string
          user_id?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontracts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_performance: {
        Row: {
          avg_schedule_delay: number
          avg_trade_variance: number
          billing_accuracy_score: number
          change_order_behavior_score: number
          contracts_count: number
          cost_reliability_score: number
          created_at: string
          id: string
          invoice_dispute_rate: number
          last_computed_at: string
          performance_score: number
          retention_issue_rate: number
          schedule_reliability_score: number
          user_id: string
          vendor_name: string
        }
        Insert: {
          avg_schedule_delay?: number
          avg_trade_variance?: number
          billing_accuracy_score?: number
          change_order_behavior_score?: number
          contracts_count?: number
          cost_reliability_score?: number
          created_at?: string
          id?: string
          invoice_dispute_rate?: number
          last_computed_at?: string
          performance_score?: number
          retention_issue_rate?: number
          schedule_reliability_score?: number
          user_id: string
          vendor_name: string
        }
        Update: {
          avg_schedule_delay?: number
          avg_trade_variance?: number
          billing_accuracy_score?: number
          change_order_behavior_score?: number
          contracts_count?: number
          cost_reliability_score?: number
          created_at?: string
          id?: string
          invoice_dispute_rate?: number
          last_computed_at?: string
          performance_score?: number
          retention_issue_rate?: number
          schedule_reliability_score?: number
          user_id?: string
          vendor_name?: string
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
