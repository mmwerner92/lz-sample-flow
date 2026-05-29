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
  public: {
    Tables: {
      inventory_items: {
        Row: {
          cost_per_item: number | null
          created_at: string
          date_of_last_order: string | null
          days_per_reorder: number | null
          description: string | null
          designation: string | null
          expiry: string | null
          id: string
          in_use: number
          in_use_level: number | null
          item_discontinued: boolean
          item_name: string
          item_number: string | null
          item_reorder_quantity: number | null
          items_per_pk: number | null
          kit_number: string | null
          lab_location: string | null
          lab_stock: number
          lot_number: string | null
          max_val: number | null
          median: number | null
          min_val: number | null
          quantity_last_ordered: number | null
          routine: boolean
          updated_at: string
          vendor: string | null
          warehouse_location: string | null
          warehouse_stock: number
        }
        Insert: {
          cost_per_item?: number | null
          created_at?: string
          date_of_last_order?: string | null
          days_per_reorder?: number | null
          description?: string | null
          designation?: string | null
          expiry?: string | null
          id?: string
          in_use?: number
          in_use_level?: number | null
          item_discontinued?: boolean
          item_name: string
          item_number?: string | null
          item_reorder_quantity?: number | null
          items_per_pk?: number | null
          kit_number?: string | null
          lab_location?: string | null
          lab_stock?: number
          lot_number?: string | null
          max_val?: number | null
          median?: number | null
          min_val?: number | null
          quantity_last_ordered?: number | null
          routine?: boolean
          updated_at?: string
          vendor?: string | null
          warehouse_location?: string | null
          warehouse_stock?: number
        }
        Update: {
          cost_per_item?: number | null
          created_at?: string
          date_of_last_order?: string | null
          days_per_reorder?: number | null
          description?: string | null
          designation?: string | null
          expiry?: string | null
          id?: string
          in_use?: number
          in_use_level?: number | null
          item_discontinued?: boolean
          item_name?: string
          item_number?: string | null
          item_reorder_quantity?: number | null
          items_per_pk?: number | null
          kit_number?: string | null
          lab_location?: string | null
          lab_stock?: number
          lot_number?: string | null
          max_val?: number | null
          median?: number | null
          min_val?: number | null
          quantity_last_ordered?: number | null
          routine?: boolean
          updated_at?: string
          vendor?: string | null
          warehouse_location?: string | null
          warehouse_stock?: number
        }
        Relationships: []
      }
      method_fields: {
        Row: {
          created_at: string
          description: string
          formula: string | null
          id: string
          is_calculated: boolean
          max_val: number | null
          method_id: string
          min_val: number | null
          position: number
          unit: string | null
        }
        Insert: {
          created_at?: string
          description: string
          formula?: string | null
          id?: string
          is_calculated?: boolean
          max_val?: number | null
          method_id: string
          min_val?: number | null
          position?: number
          unit?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          formula?: string | null
          id?: string
          is_calculated?: boolean
          max_val?: number | null
          method_id?: string
          min_val?: number | null
          position?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "method_fields_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "methods"
            referencedColumns: ["id"]
          },
        ]
      }
      method_inventory_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          method_id: string
          quantity_per_sample: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          method_id: string
          quantity_per_sample?: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          method_id?: string
          quantity_per_sample?: number
        }
        Relationships: []
      }
      methods: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      sample_inventory_usage: {
        Row: {
          id: string
          inventory_item_id: string
          method_id: string
          quantity: number
          sample_id: string
          used_at: string
          used_by: string | null
        }
        Insert: {
          id?: string
          inventory_item_id: string
          method_id: string
          quantity?: number
          sample_id: string
          used_at?: string
          used_by?: string | null
        }
        Update: {
          id?: string
          inventory_item_id?: string
          method_id?: string
          quantity?: number
          sample_id?: string
          used_at?: string
          used_by?: string | null
        }
        Relationships: []
      }
      sample_points: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sample_readings: {
        Row: {
          created_at: string
          id: string
          method_field_id: string
          sample_id: string
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          method_field_id: string
          sample_id: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          method_field_id?: string
          sample_id?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sample_readings_method_field_id_fkey"
            columns: ["method_field_id"]
            isOneToOne: false
            referencedRelation: "method_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_readings_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_schedules: {
        Row: {
          created_at: string
          frequency: string
          id: string
          next_trigger_at: string
          sample_number: string | null
          sample_point_id: string
          status: string
          time_of_day: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          frequency: string
          id?: string
          next_trigger_at: string
          sample_number?: string | null
          sample_point_id: string
          status: string
          time_of_day: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          frequency?: string
          id?: string
          next_trigger_at?: string
          sample_number?: string | null
          sample_point_id?: string
          status?: string
          time_of_day?: string
          updated_at?: string
        }
        Relationships: []
      }
      samples: {
        Row: {
          analyst_id: string | null
          color: string | null
          created_at: string
          date_analyzed: string | null
          id: string
          oil_visibility: string | null
          particulates: string | null
          sample_number: string
          sample_point_id: string
          sampled_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          analyst_id?: string | null
          color?: string | null
          created_at?: string
          date_analyzed?: string | null
          id?: string
          oil_visibility?: string | null
          particulates?: string | null
          sample_number: string
          sample_point_id: string
          sampled_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          analyst_id?: string | null
          color?: string | null
          created_at?: string
          date_analyzed?: string | null
          id?: string
          oil_visibility?: string | null
          particulates?: string | null
          sample_number?: string
          sample_point_id?: string
          sampled_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "samples_sample_point_id_fkey"
            columns: ["sample_point_id"]
            isOneToOne: false
            referencedRelation: "sample_points"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
