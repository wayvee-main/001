export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type RegionalPlaceRow = Database['public']['Tables']['places']['Row'] & {
  region: string;
  county: string | null;
  source_osm_ids: string[];
  source_url: string | null;
  source_license: string | null;
  source_data_at: string | null;
  detail_next_check_at: string;
  detail_checked_at: string | null;
  detail_failure_count: number;
};
export type NearbyRegionalPlace = Pick<RegionalPlaceRow,
  'id' | 'name' | 'category' | 'cuisine' | 'address' | 'lat' | 'lon' | 'website' |
  'phone' | 'image' | 'opening_hours' | 'confidence' | 'needs_review' | 'detail_content' | 'city'
> & { distance_miles: number };
type RegionalBatchRow = {
  id: string; region: string; county: string;
  min_lat: number; min_lon: number; max_lat: number; max_lon: number;
  priority: number; depth: number; status: string; attempts: number;
  place_count: number; next_attempt_at: string; last_completed_at: string | null;
  last_error: string | null; updated_at: string;
};
type RegionalRunRow = {
  id: number; region: string; started_at: string; finished_at: string;
  status: string; source_requests: number; source_bytes: number;
  batches_completed: number; rows_written: number; detail: string | null;
};

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      cities: {
        Row: {
          anchor_lat: number;
          anchor_lon: number;
          bbox_max_lat: number;
          bbox_max_lon: number;
          bbox_min_lat: number;
          bbox_min_lon: number;
          created_at: string;
          launched: boolean;
          name: string;
          region: string | null;
          slug: string;
          timezone: string;
          viator_destinations: string[];
        };
        Insert: {
          anchor_lat: number;
          anchor_lon: number;
          bbox_max_lat: number;
          bbox_max_lon: number;
          bbox_min_lat: number;
          bbox_min_lon: number;
          created_at?: string;
          launched?: boolean;
          name: string;
          region?: string | null;
          slug: string;
          timezone: string;
          viator_destinations?: string[];
        };
        Update: {
          anchor_lat?: number;
          anchor_lon?: number;
          bbox_max_lat?: number;
          bbox_max_lon?: number;
          bbox_min_lat?: number;
          bbox_min_lon?: number;
          created_at?: string;
          launched?: boolean;
          name?: string;
          region?: string | null;
          slug?: string;
          timezone?: string;
          viator_destinations?: string[];
        };
        Relationships: [];
      };
      concierge_runs: {
        Row: {
          attempts: number;
          completion_tokens: number | null;
          created_at: string;
          duration_ms: number;
          id: number;
          model: string | null;
          outcome: string;
          prompt_tokens: number | null;
          total_tokens: number | null;
          upstream_status: number | null;
        };
        Insert: {
          attempts?: number;
          completion_tokens?: number | null;
          created_at?: string;
          duration_ms?: number;
          id?: never;
          model?: string | null;
          outcome: string;
          prompt_tokens?: number | null;
          total_tokens?: number | null;
          upstream_status?: number | null;
        };
        Update: {
          attempts?: number;
          completion_tokens?: number | null;
          created_at?: string;
          duration_ms?: number;
          id?: never;
          model?: string | null;
          outcome?: string;
          prompt_tokens?: number | null;
          total_tokens?: number | null;
          upstream_status?: number | null;
        };
        Relationships: [];
      };
      concierge_signals: {
        Row: {
          city: string | null;
          created_at: string;
          id: number;
          intent: string | null;
          rating: number | null;
          ref_id: string | null;
          signal: string;
          stop_kind: string | null;
          user_id: string;
        };
        Insert: {
          city?: string | null;
          created_at?: string;
          id?: never;
          intent?: string | null;
          rating?: number | null;
          ref_id?: string | null;
          signal: string;
          stop_kind?: string | null;
          user_id: string;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          id?: never;
          intent?: string | null;
          rating?: number | null;
          ref_id?: string | null;
          signal?: string;
          stop_kind?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "concierge_signals_city_fkey";
            columns: ["city"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["slug"];
          },
        ];
      };
      events: {
        Row: {
          detail_content: Json | null;
          addr: string;
          all_in: string;
          cats: string[];
          city: string;
          date_label: string;
          id: string;
          image: string;
          know: string;
          lineup: string;
          name: string;
          price_from: string;
          price_label: string;
          source: string;
          source_url: string;
          starts_at: string;
          ticket_provider: string | null;
          ticket_url: string | null;
          ticketed: boolean;
          time_label: string;
          travel: string;
          updated_at: string;
          venue: string;
          venue_id: string | null;
          verified_label: string;
          vibe_tags: string[];
        };
        Insert: {
          detail_content?: Json | null;
          addr: string;
          all_in: string;
          cats?: string[];
          city?: string;
          date_label: string;
          id: string;
          image: string;
          know: string;
          lineup: string;
          name: string;
          price_from: string;
          price_label: string;
          source?: string;
          source_url: string;
          starts_at: string;
          ticket_provider?: string | null;
          ticket_url?: string | null;
          ticketed?: boolean;
          time_label: string;
          travel: string;
          updated_at?: string;
          venue: string;
          venue_id?: string | null;
          verified_label: string;
          vibe_tags?: string[];
        };
        Update: {
          detail_content?: Json | null;
          addr?: string;
          all_in?: string;
          cats?: string[];
          city?: string;
          date_label?: string;
          id?: string;
          image?: string;
          know?: string;
          lineup?: string;
          name?: string;
          price_from?: string;
          price_label?: string;
          source?: string;
          source_url?: string;
          starts_at?: string;
          ticket_provider?: string | null;
          ticket_url?: string | null;
          ticketed?: boolean;
          time_label?: string;
          travel?: string;
          updated_at?: string;
          venue?: string;
          venue_id?: string | null;
          verified_label?: string;
          vibe_tags?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "events_city_fkey";
            columns: ["city"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["slug"];
          },
        ];
      };
      places: {
        Row: {
          detail_content: Json | null;
          address: string | null;
          category: string;
          city: string;
          confidence: string;
          cuisine: string | null;
          id: string;
          image: string | null;
          lat: number;
          lon: number;
          name: string;
          needs_review: boolean;
          opening_hours: string | null;
          phone: string | null;
          source_osm_id: string | null;
          source_overture_id: string | null;
          synced_at: string;
          website: string | null;
        };
        Insert: {
          detail_content?: Json | null;
          address?: string | null;
          category: string;
          city?: string;
          confidence?: string;
          cuisine?: string | null;
          id: string;
          image?: string | null;
          lat: number;
          lon: number;
          name: string;
          needs_review?: boolean;
          opening_hours?: string | null;
          phone?: string | null;
          source_osm_id?: string | null;
          source_overture_id?: string | null;
          synced_at?: string;
          website?: string | null;
        };
        Update: {
          detail_content?: Json | null;
          address?: string | null;
          category?: string;
          city?: string;
          confidence?: string;
          cuisine?: string | null;
          id?: string;
          image?: string | null;
          lat?: number;
          lon?: number;
          name?: string;
          needs_review?: boolean;
          opening_hours?: string | null;
          phone?: string | null;
          source_osm_id?: string | null;
          source_overture_id?: string | null;
          synced_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "places_city_fkey";
            columns: ["city"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["slug"];
          },
        ];
      };
      regional_places: {
        Row: RegionalPlaceRow;
        Insert: Database['public']['Tables']['places']['Insert'] & {
          region?: string; county?: string | null; source_osm_ids?: string[];
          source_url?: string | null; source_license?: string | null; source_data_at?: string | null;
          detail_next_check_at?: string; detail_checked_at?: string | null; detail_failure_count?: number;
        };
        Update: Partial<RegionalPlaceRow>;
        Relationships: [];
      };
      regional_collection_batches: {
        Row: RegionalBatchRow;
        Insert: Pick<RegionalBatchRow, 'id' | 'county' | 'min_lat' | 'min_lon' | 'max_lat' | 'max_lon'> & Partial<RegionalBatchRow>;
        Update: Partial<RegionalBatchRow>;
        Relationships: [];
      };
      regional_collection_runs: {
        Row: RegionalRunRow;
        Insert: Pick<RegionalRunRow, 'started_at' | 'status'> & Partial<Omit<RegionalRunRow, 'id'>> & { id?: never };
        Update: Partial<Omit<RegionalRunRow, 'id'>> & { id?: never };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_places: {
        Row: {
          created_at: string;
          place_id: string;
          place_kind: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          place_id: string;
          place_kind: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          place_id?: string;
          place_kind?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sync_runs: {
        Row: {
          city: string | null;
          detail: string | null;
          duration_ms: number;
          finished_at: string;
          id: number;
          job: string;
          rows_pruned: number;
          rows_written: number;
          started_at: string;
          status: string;
        };
        Insert: {
          city?: string | null;
          detail?: string | null;
          duration_ms?: number;
          finished_at?: string;
          id?: never;
          job: string;
          rows_pruned?: number;
          rows_written?: number;
          started_at: string;
          status: string;
        };
        Update: {
          city?: string | null;
          detail?: string | null;
          duration_ms?: number;
          finished_at?: string;
          id?: never;
          job?: string;
          rows_pruned?: number;
          rows_written?: number;
          started_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sync_runs_city_fkey";
            columns: ["city"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["slug"];
          },
        ];
      };
      user_plans: {
        Row: {
          city: string | null;
          created_at: string;
          item_id: string;
          item_kind: string;
          user_id: string;
        };
        Insert: {
          city?: string | null;
          created_at?: string;
          item_id: string;
          item_kind: string;
          user_id: string;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          item_id?: string;
          item_kind?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_plans_city_fkey";
            columns: ["city"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["slug"];
          },
        ];
      };
      user_preferences: {
        Row: {
          budget_preference: string | null;
          city: string | null;
          created_at: string;
          dismissed_insight_keys: string[];
          pace_preference: string | null;
          preferred_delivery_provider: string;
          stay_check_in: string | null;
          stay_check_out: string | null;
          stay_property_name: string | null;
          taste_tags: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          budget_preference?: string | null;
          city?: string | null;
          created_at?: string;
          dismissed_insight_keys?: string[];
          pace_preference?: string | null;
          preferred_delivery_provider?: string;
          stay_check_in?: string | null;
          stay_check_out?: string | null;
          stay_property_name?: string | null;
          taste_tags?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          budget_preference?: string | null;
          city?: string | null;
          created_at?: string;
          dismissed_insight_keys?: string[];
          pace_preference?: string | null;
          preferred_delivery_provider?: string;
          stay_check_in?: string | null;
          stay_check_out?: string | null;
          stay_property_name?: string | null;
          taste_tags?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_preferences_city_fkey";
            columns: ["city"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["slug"];
          },
        ];
      };
      venue_follows: {
        Row: {
          created_at: string;
          user_id: string;
          venue_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
          venue_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
          venue_id?: string;
        };
        Relationships: [];
      };
      viator_picks: {
        Row: {
          availability_dates: string[] | null;
          booking_url: string;
          city: string;
          currency: string | null;
          description: string;
          destination: string;
          duration_label: string | null;
          flags: string[] | null;
          free_cancellation: boolean | null;
          id: string;
          image: string;
          inclusions: string[] | null;
          price_from: number | null;
          rating: number | null;
          review_count: number | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          availability_dates?: string[] | null;
          booking_url: string;
          city?: string;
          currency?: string | null;
          description: string;
          destination: string;
          duration_label?: string | null;
          flags?: string[] | null;
          free_cancellation?: boolean | null;
          id: string;
          image: string;
          inclusions?: string[] | null;
          price_from?: number | null;
          rating?: number | null;
          review_count?: number | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          availability_dates?: string[] | null;
          booking_url?: string;
          city?: string;
          currency?: string | null;
          description?: string;
          destination?: string;
          duration_label?: string | null;
          flags?: string[] | null;
          free_cancellation?: boolean | null;
          id?: string;
          image?: string;
          inclusions?: string[] | null;
          price_from?: number | null;
          rating?: number | null;
          review_count?: number | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "viator_picks_city_fkey";
            columns: ["city"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["slug"];
          },
        ];
      };
      weather_hourly: {
        Row: {
          city: string;
          ends_at: string;
          fetched_at: string;
          is_daytime: boolean;
          precip_probability: number | null;
          short_forecast: string;
          source_url: string;
          starts_at: string;
          temperature_f: number;
          wind_label: string | null;
        };
        Insert: {
          city?: string;
          ends_at: string;
          fetched_at?: string;
          is_daytime: boolean;
          precip_probability?: number | null;
          short_forecast: string;
          source_url: string;
          starts_at: string;
          temperature_f: number;
          wind_label?: string | null;
        };
        Update: {
          city?: string;
          ends_at?: string;
          fetched_at?: string;
          is_daytime?: boolean;
          precip_probability?: number | null;
          short_forecast?: string;
          source_url?: string;
          starts_at?: string;
          temperature_f?: number;
          wind_label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "weather_hourly_city_fkey";
            columns: ["city"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["slug"];
          },
        ];
      };
    };
    Views: {
      sync_status: {
        Row: {
          city: string | null;
          duration_ms: number | null;
          finished_at: string | null;
          job: string | null;
          rows_pruned: number | null;
          rows_written: number | null;
          started_at: string | null;
          status: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sync_runs_city_fkey";
            columns: ["city"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["slug"];
          },
        ];
      };
    };
    Functions: {
      nearby_regional_places: {
        Args: { p_lat: number; p_lon: number; p_radius_miles?: number; p_limit?: number; p_offset?: number };
        Returns: NearbyRegionalPlace[];
      };
      regional_identity_candidates: {
        Args: { p_bounds: Json; p_source_ids: string[]; p_offset?: number };
        Returns: Pick<RegionalPlaceRow, 'id' | 'name' | 'category' | 'address' | 'lat' | 'lon' | 'website' | 'phone' | 'city' | 'source_osm_id' | 'source_osm_ids' | 'source_overture_id' | 'needs_review'>[];
      };
      upsert_regional_places: {
        Args: { p_rows: Json };
        Returns: number;
      };
      seed_regional_places_from_catalog: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
