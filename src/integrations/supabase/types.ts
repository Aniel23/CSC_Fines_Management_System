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
      csc_officers: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          photo_url: string | null
          position: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          photo_url?: string | null
          position: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          photo_url?: string | null
          position?: string
        }
        Relationships: []
      }
      fines: {
        Row: {
          amount: number
          balance: number
          created_at: string
          deleted_at: string | null
          is_archived: boolean | null
          fine_type: Database["public"]["Enums"]["fine_type"]
          id: string
          notes: string | null
          proof_image: string | null
          payment_proof: string | null
          payment_proofs: Json | null
          pending_payment?: number
          status: Database["public"]["Enums"]["fine_status"]
          student_id: string
          updated_at: string
          voucher_used: string | null
          original_amount: number | null
        }
        Insert: {
          amount: number
          balance: number
          created_at?: string
          deleted_at?: string | null
          is_archived?: boolean | null
          fine_type: Database["public"]["Enums"]["fine_type"]
          id?: string
          notes?: string | null
          proof_image?: string | null
          payment_proof?: string | null
          payment_proofs?: Json | null
          pending_payment?: number
          status: Database["public"]["Enums"]["fine_status"]
          student_id: string
          updated_at?: string
          voucher_used?: string | null
          original_amount?: number | null
        }
        Update: {
          amount?: number
          balance?: number
          created_at?: string
          deleted_at?: string | null
          is_archived?: boolean | null
          fine_type?: Database["public"]["Enums"]["fine_type"]
          id?: string
          notes?: string | null
          proof_image?: string | null
          payment_proof?: string | null
          payment_proofs?: Json | null
          pending_payment?: number
          status?: Database["public"]["Enums"]["fine_status"]
          student_id?: string
          updated_at?: string
          voucher_used?: string | null
          original_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fines_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          age: number
          created_at: string
          deleted_at: string | null
          department: string
          gender: Database["public"]["Enums"]["gender_type"]
          id: string
          is_archived: boolean | null
          name: string
          photo_url: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          age: number
          created_at?: string
          deleted_at?: string | null
          department: string
          gender: Database["public"]["Enums"]["gender_type"]
          id?: string
          is_archived?: boolean | null
          name: string
          photo_url?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          age?: number
          created_at?: string
          deleted_at?: string | null
          department?: string
          gender?: Database["public"]["Enums"]["gender_type"]
          id?: string
          is_archived?: boolean | null
          name?: string
          photo_url?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_paid: number
          deleted_at: string | null
          fine_id: string | null
          id: string
          is_archived: boolean | null
          notes: string | null
          payment_date: string
          recorded_by: string | null
          voucher_used: string | null
          original_amount: number | null
        }
        Insert: {
          amount_paid: number
          deleted_at?: string | null
          fine_id?: string | null
          id?: string
          is_archived?: boolean | null
          notes?: string | null
          payment_date?: string
          recorded_by?: string | null
          voucher_used?: string | null
          original_amount?: number | null
        }
        Update: {
          amount_paid?: number
          deleted_at?: string | null
          fine_id?: string | null
          id?: string
          is_archived?: boolean | null
          notes?: string | null
          payment_date?: string
          recorded_by?: string | null
          voucher_used?: string | null
          original_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_fine_id_fkey"
            columns: ["fine_id"]
            isOneToOne: false
            referencedRelation: "fines"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          is_read: boolean
          actor_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type: string
          is_read?: boolean
          actor_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: string
          is_read?: boolean
          actor_name?: string | null
          created_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          id: string
          name: string
          description: string | null
          head_of_department: string | null
          office_location: string | null
          contact_email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          head_of_department?: string | null
          office_location?: string | null
          contact_email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          head_of_department?: string | null
          office_location?: string | null
          contact_email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          student_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          student_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          student_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_student_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
      department: "BSIS" | "BPA" | "BTVTED" | "BTVTED-CHS" | string
      fine_status: "Paid" | "Pending" | "To Pay"
      fine_type:
        | "Not wearing ID"
        | "Late enrollment"
        | "Library fine"
        | "Laboratory damage"
        | "Dress code violation"
        | "Unauthorized absence"
        | "Property damage"
        | "Other"
      gender_type: "Male" | "Female" | "Other"
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
      app_role: ["admin", "student"],
      department: ["BSIS", "BPA", "BTVTED"],
      fine_status: ["Paid", "Pending", "To Pay"],
      fine_type: [
        "Not wearing ID",
        "Late enrollment",
        "Library fine",
        "Laboratory damage",
        "Dress code violation",
        "Unauthorized absence",
        "Property damage",
        "Other",
      ],
      gender_type: ["Male", "Female", "Other"],
    },
  },
} as const
