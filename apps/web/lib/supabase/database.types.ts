// Supabase 스키마에서 생성 — `supabase gen types` / MCP generate_typescript_types.
// 스키마 변경 시 재생성한다 (apps/web/supabase/migrations 와 동기).
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      project_exports: {
        Row: {
          bytes: number
          created_at: string
          id: string
          masked: boolean
          project_id: string
          spec_updated_at: string
        }
        Insert: {
          bytes: number
          created_at?: string
          id: string
          masked: boolean
          project_id: string
          spec_updated_at: string
        }
        Update: {
          bytes?: number
          created_at?: string
          id?: string
          masked?: boolean
          project_id?: string
          spec_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tokens: {
        Row: {
          created_at: string
          id: string
          project_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          id: string
          project_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          spec: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          owner_id?: string
          spec: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          spec?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
