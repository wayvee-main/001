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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      concierge_runs: {
        Row: {
          attempts: number
          completion_tokens: number | null
          created_at: string
          duration_ms: number
          id: number
          model: string | null
          outcome: string
          prompt_tokens: number | null
          total_tokens: number | null
          upstream_status: number | null
        }
        Insert: {
          attempts?: number
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number
          id?: never
          model?: string | null
          outcome: string
          prompt_tokens?: number | null
          total_tokens?: number | null
          upstream_status?: number | null
        }
        Update: {
          attempts?: number
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number
          id?: never
          model?: string | null
          outcome?: string
          prompt_tokens?: number | null
          total_tokens?: number | null
          upstream_status?: number | null
        }
        Relationships: []
      }
      concierge_signals: {
        Row: {
          created_at: string
          id: number
          intent: string | null
          rating: number | null
          ref_id: string | null
          signal: string
          stop_kind: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          intent?: string | null
          rating?: number | null
          ref_id?: string | null
          signal: string
          stop_kind?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          intent?: string | null
          rating?: number | null
          ref_id?: string | null
          signal?: string
          stop_kind?: string | null
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          addr: string
          all_in: string
          cats: string[]
          date_label: string
          id: string
          image: string
          know: string
          lineup: string
          name: string
          price_from: string
          price_label: string
          source: string
          source_url: string
          starts_at: string
          ticket_provider: string | null
          ticket_url: string | null
          ticketed: boolean
          time_label: string
          travel: string
          updated_at: string
          venue: string
          venue_id: string | null
          verified_label: string
          vibe_tags: string[]
        }
        Insert: {
          addr: string
          all_in: string
          cats?: string[]
          date_label: string
          id: string
          image: string
          know: string
          lineup: string
          name: string
          price_from: string
          price_label: string
          source?: string
          source_url: string
          starts_at: string
          ticket_provider?: string | null
          ticket_url?: string | null
          ticketed?: boolean
          time_label: string
          travel: string
          updated_at?: string
          venue: string
          venue_id?: string | null
          verified_label: string
          vibe_tags?: string[]
        }
        Update: {
          addr?: string
          all_in?: string
          cats?: string[]
          date_label?: string
          id?: string
          image?: string
          know?: string
          lineup?: string
          name?: string
          price_from?: string
          price_label?: string
          source?: string
          source_url?: string
          starts_at?: string
          ticket_provider?: string | null
          ticket_url?: string | null
          ticketed?: boolean
          time_label?: string
          travel?: string
          updated_at?: string
          venue?: string
          venue_id?: string | null
          verified_label?: string
          vibe_tags?: string[]
        }
        Relationships: []
      }
      place_menu_items: {
        Row: {
          description: string | null
          id: number
          image: string | null
          name: string
          place_id: string
          price: string | null
          source_url: string
          synced_at: string
          verified_label: string
        }
        Insert: {
          description?: string | null
          id?: never
          image?: string | null
          name: string
          place_id: string
          price?: string | null
          source_url: string
          synced_at?: string
          verified_label: string
        }
        Update: {
          description?: string | null
          id?: never
          image?: string | null
          name?: string
          place_id?: string
          price?: string | null
          source_url?: string
          synced_at?: string
          verified_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_menu_items_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          category: string
          confidence: string
          cuisine: string | null
          id: string
          image: string | null
          lat: number
          lon: number
          name: string
          needs_review: boolean
          opening_hours: string | null
          phone: string | null
          source_osm_id: string | null
          source_overture_id: string | null
          synced_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          category: string
          confidence?: string
          cuisine?: string | null
          id: string
          image?: string | null
          lat: number
          lon: number
          name: string
          needs_review?: boolean
          opening_hours?: string | null
          phone?: string | null
          source_osm_id?: string | null
          source_overture_id?: string | null
          synced_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          confidence?: string
          cuisine?: string | null
          id?: string
          image?: string | null
          lat?: number
          lon?: number
          name?: string
          needs_review?: boolean
          opening_hours?: string | null
          phone?: string | null
          source_osm_id?: string | null
          source_overture_id?: string | null
          synced_at?: string
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_places: {
        Row: {
          created_at: string
          place_id: string
          place_kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          place_id: string
          place_kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          place_id?: string
          place_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          detail: string | null
          duration_ms: number
          finished_at: string
          id: number
          job: string
          rows_pruned: number
          rows_written: number
          started_at: string
          status: string
        }
        Insert: {
          detail?: string | null
          duration_ms?: number
          finished_at?: string
          id?: never
          job: string
          rows_pruned?: number
          rows_written?: number
          started_at: string
          status: string
        }
        Update: {
          detail?: string | null
          duration_ms?: number
          finished_at?: string
          id?: never
          job?: string
          rows_pruned?: number
          rows_written?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          created_at: string
          item_id: string
          item_kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          item_kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          item_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          budget_preference: string | null
          created_at: string
          dismissed_insight_keys: string[]
          pace_preference: string | null
          preferred_delivery_provider: string
          stay_check_in: string | null
          stay_check_out: string | null
          stay_property_name: string | null
          taste_tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_preference?: string | null
          created_at?: string
          dismissed_insight_keys?: string[]
          pace_preference?: string | null
          preferred_delivery_provider?: string
          stay_check_in?: string | null
          stay_check_out?: string | null
          stay_property_name?: string | null
          taste_tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_preference?: string | null
          created_at?: string
          dismissed_insight_keys?: string[]
          pace_preference?: string | null
          preferred_delivery_provider?: string
          stay_check_in?: string | null
          stay_check_out?: string | null
          stay_property_name?: string | null
          taste_tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      venue_follows: {
        Row: {
          created_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: []
      }
      viator_picks: {
        Row: {
          availability_dates: string[] | null
          booking_url: string
          currency: string | null
          description: string
          destination: string
          duration_label: string | null
          flags: string[] | null
          free_cancellation: boolean | null
          id: string
          image: string
          inclusions: string[] | null
          price_from: number | null
          rating: number | null
          review_count: number | null
          title: string
          updated_at: string
        }
        Insert: {
          availability_dates?: string[] | null
          booking_url: string
          currency?: string | null
          description: string
          destination: string
          duration_label?: string | null
          flags?: string[] | null
          free_cancellation?: boolean | null
          id: string
          image: string
          inclusions?: string[] | null
          price_from?: number | null
          rating?: number | null
          review_count?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          availability_dates?: string[] | null
          booking_url?: string
          currency?: string | null
          description?: string
          destination?: string
          duration_label?: string | null
          flags?: string[] | null
          free_cancellation?: boolean | null
          id?: string
          image?: string
          inclusions?: string[] | null
          price_from?: number | null
          rating?: number | null
          review_count?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      weather_hourly: {
        Row: {
          ends_at: string
          fetched_at: string
          is_daytime: boolean
          precip_probability: number | null
          short_forecast: string
          source_url: string
          starts_at: string
          temperature_f: number
          wind_label: string | null
        }
        Insert: {
          ends_at: string
          fetched_at?: string
          is_daytime: boolean
          precip_probability?: number | null
          short_forecast: string
          source_url: string
          starts_at: string
          temperature_f: number
          wind_label?: string | null
        }
        Update: {
          ends_at?: string
          fetched_at?: string
          is_daytime?: boolean
          precip_probability?: number | null
          short_forecast?: string
          source_url?: string
          starts_at?: string
          temperature_f?: number
          wind_label?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      sync_status: {
        Row: {
          duration_ms: number | null
          finished_at: string | null
          job: string | null
          rows_pruned: number | null
          rows_written: number | null
          started_at: string | null
          status: string | null
        }
        Relationships: []
      }
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
