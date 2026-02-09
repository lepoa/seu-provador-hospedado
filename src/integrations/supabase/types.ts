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
      ai_business_insights: {
        Row: {
          analysis_period_end: string
          analysis_period_start: string
          created_at: string
          details_clicked_at: string | null
          id: string
          insight_date: string
          insights: Json
          raw_metrics: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          analysis_period_end: string
          analysis_period_start: string
          created_at?: string
          details_clicked_at?: string | null
          id?: string
          insight_date?: string
          insights?: Json
          raw_metrics?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          analysis_period_end?: string
          analysis_period_start?: string
          created_at?: string
          details_clicked_at?: string | null
          id?: string
          insight_date?: string
          insights?: Json
          raw_metrics?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_daily_snapshots: {
        Row: {
          created_at: string
          id: string
          metrics_json: Json
          snapshot_date: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metrics_json?: Json
          snapshot_date?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metrics_json?: Json
          snapshot_date?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          comentario: string | null
          contexto_json: Json
          created_at: string
          feedback: string
          id: string
          recommendation_key: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          comentario?: string | null
          contexto_json?: Json
          created_at?: string
          feedback: string
          id?: string
          recommendation_key?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          comentario?: string | null
          contexto_json?: Json
          created_at?: string
          feedback?: string
          id?: string
          recommendation_key?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      coupon_uses: {
        Row: {
          coupon_id: string
          discount_applied: number
          id: string
          live_cart_id: string | null
          order_id: string | null
          used_at: string
        }
        Insert: {
          coupon_id: string
          discount_applied: number
          id?: string
          live_cart_id?: string | null
          order_id?: string | null
          used_at?: string
        }
        Update: {
          coupon_id?: string
          discount_applied?: number
          id?: string
          live_cart_id?: string | null
          order_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_uses_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_uses_live_cart_id_fkey"
            columns: ["live_cart_id"]
            isOneToOne: false
            referencedRelation: "live_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_uses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_value: number | null
          starts_at: string | null
          times_used: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_value?: number | null
          starts_at?: string | null
          times_used?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_value?: number | null
          starts_at?: string | null
          times_used?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string
          customer_id: string
          document: string | null
          id: string
          is_default: boolean | null
          label: string | null
          neighborhood: string | null
          number: string | null
          reference: string | null
          state: string
          street: string
          updated_at: string
          zip_code: string
        }
        Insert: {
          city: string
          complement?: string | null
          created_at?: string
          customer_id: string
          document?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          neighborhood?: string | null
          number?: string | null
          reference?: string | null
          state: string
          street: string
          updated_at?: string
          zip_code: string
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          customer_id?: string
          document?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          neighborhood?: string | null
          number?: string | null
          reference?: string | null
          state?: string
          street?: string
          updated_at?: string
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_catalogs: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          intro_text: string | null
          products: Json | null
          public_link: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          intro_text?: string | null
          products?: Json | null
          public_link?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          intro_text?: string | null
          products?: Json | null
          public_link?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_catalogs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_inspiration_photos: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          image_url: string
          is_starred: boolean | null
          merchant_notes: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          image_url: string
          is_starred?: boolean | null
          merchant_notes?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          image_url?: string
          is_starred?: boolean | null
          merchant_notes?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_inspiration_photos_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_loyalty: {
        Row: {
          annual_points: number
          annual_points_reset_at: string | null
          created_at: string
          current_points: number
          current_tier: Database["public"]["Enums"]["loyalty_tier"]
          customer_id: string | null
          id: string
          lifetime_points: number
          tier_updated_at: string | null
          updated_at: string
          user_id: string
          weekly_mission_points: number
          weekly_mission_reset_at: string | null
        }
        Insert: {
          annual_points?: number
          annual_points_reset_at?: string | null
          created_at?: string
          current_points?: number
          current_tier?: Database["public"]["Enums"]["loyalty_tier"]
          customer_id?: string | null
          id?: string
          lifetime_points?: number
          tier_updated_at?: string | null
          updated_at?: string
          user_id: string
          weekly_mission_points?: number
          weekly_mission_reset_at?: string | null
        }
        Update: {
          annual_points?: number
          annual_points_reset_at?: string | null
          created_at?: string
          current_points?: number
          current_tier?: Database["public"]["Enums"]["loyalty_tier"]
          customer_id?: string | null
          id?: string
          lifetime_points?: number
          tier_updated_at?: string | null
          updated_at?: string
          user_id?: string
          weekly_mission_points?: number
          weekly_mission_reset_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_loyalty_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_product_suggestions: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          notified: boolean
          product_id: string
          reasons: Json
          score: number
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          notified?: boolean
          product_id: string
          reasons?: Json
          score?: number
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          notified?: boolean
          product_id?: string
          reasons?: Json
          score?: number
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_product_suggestions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_suggestions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "customer_product_suggestions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_suggestions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_product_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line: string | null
          address_reference: string | null
          city: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          instagram_handle: string | null
          last_order_at: string | null
          merged_into_customer_id: string | null
          name: string | null
          phone: string
          size: string | null
          size_letter: string | null
          size_number: string | null
          state: string | null
          style_title: string | null
          total_orders: number
          total_spent: number
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address_line?: string | null
          address_reference?: string | null
          city?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          instagram_handle?: string | null
          last_order_at?: string | null
          merged_into_customer_id?: string | null
          name?: string | null
          phone: string
          size?: string | null
          size_letter?: string | null
          size_number?: string | null
          state?: string | null
          style_title?: string | null
          total_orders?: number
          total_spent?: number
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line?: string | null
          address_reference?: string | null
          city?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          instagram_handle?: string | null
          last_order_at?: string | null
          merged_into_customer_id?: string | null
          name?: string | null
          phone?: string
          size?: string | null
          size_letter?: string | null
          size_number?: string | null
          state?: string | null
          style_title?: string | null
          total_orders?: number
          total_spent?: number
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey"
            columns: ["merged_into_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_rules: {
        Row: {
          channel_scope: Database["public"]["Enums"]["gift_channel_scope"]
          condition_type: Database["public"]["Enums"]["gift_condition_type"]
          condition_value: number | null
          created_at: string
          current_awards_count: number
          end_at: string | null
          gift_id: string
          gift_qty: number
          id: string
          is_active: boolean
          live_event_id: string | null
          max_per_customer: number | null
          max_total_awards: number | null
          name: string
          priority: number
          start_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel_scope?: Database["public"]["Enums"]["gift_channel_scope"]
          condition_type?: Database["public"]["Enums"]["gift_condition_type"]
          condition_value?: number | null
          created_at?: string
          current_awards_count?: number
          end_at?: string | null
          gift_id: string
          gift_qty?: number
          id?: string
          is_active?: boolean
          live_event_id?: string | null
          max_per_customer?: number | null
          max_total_awards?: number | null
          name: string
          priority?: number
          start_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel_scope?: Database["public"]["Enums"]["gift_channel_scope"]
          condition_type?: Database["public"]["Enums"]["gift_condition_type"]
          condition_value?: number | null
          created_at?: string
          current_awards_count?: number
          end_at?: string | null
          gift_id?: string
          gift_qty?: number
          id?: string
          is_active?: boolean
          live_event_id?: string | null
          max_per_customer?: number | null
          max_total_awards?: number | null
          name?: string
          priority?: number
          start_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_rules_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_rules_live_event_id_fkey"
            columns: ["live_event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
        ]
      }
      gifts: {
        Row: {
          cost: number | null
          created_at: string
          description: string | null
          end_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          require_manual_confirm: boolean
          sku: string | null
          start_at: string | null
          stock_qty: number
          unlimited_stock: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          require_manual_confirm?: boolean
          sku?: string | null
          start_at?: string | null
          stock_qty?: number
          unlimited_stock?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          require_manual_confirm?: boolean
          sku?: string | null
          start_at?: string | null
          stock_qty?: number
          unlimited_stock?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      instagram_identities: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          instagram_handle_normalized: string
          instagram_handle_raw: string
          last_order_id: string | null
          last_paid_at: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          instagram_handle_normalized: string
          instagram_handle_raw: string
          last_order_id?: string | null
          last_paid_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          instagram_handle_normalized?: string
          instagram_handle_raw?: string
          last_order_id?: string | null
          last_paid_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_identities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_identities_last_order_id_fkey"
            columns: ["last_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_imports: {
        Row: {
          created_at: string
          filename: string
          id: string
          matched_count: number
          status: string
          total_rows: number
          unmatched_count: number
          unmatched_skus: Json | null
          updated_products: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          matched_count?: number
          status?: string
          total_rows?: number
          unmatched_count?: number
          unmatched_skus?: Json | null
          updated_products?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          matched_count?: number
          status?: string
          total_rows?: number
          unmatched_count?: number
          unmatched_skus?: Json | null
          updated_products?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          items_json: Json
          movement_type: string
          order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items_json?: Json
          movement_type?: string
          order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items_json?: Json
          movement_type?: string
          order_id?: string
        }
        Relationships: []
      }
      live_attention_log: {
        Row: {
          attention_type: string
          created_at: string
          destination_bag_number: number | null
          destination_instagram: string | null
          id: string
          live_cart_id: string
          origin_bag_number: number | null
          payload: Json | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          resolved_at: string | null
          resolved_by: string | null
          size: string | null
        }
        Insert: {
          attention_type: string
          created_at?: string
          destination_bag_number?: number | null
          destination_instagram?: string | null
          id?: string
          live_cart_id: string
          origin_bag_number?: number | null
          payload?: Json | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          size?: string | null
        }
        Update: {
          attention_type?: string
          created_at?: string
          destination_bag_number?: number | null
          destination_instagram?: string | null
          id?: string
          live_cart_id?: string
          origin_bag_number?: number | null
          payload?: Json | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_attention_log_live_cart_id_fkey"
            columns: ["live_cart_id"]
            isOneToOne: false
            referencedRelation: "live_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_attention_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "live_attention_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_attention_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_product_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      live_cart_items: {
        Row: {
          created_at: string
          expiracao_reserva_em: string | null
          id: string
          live_cart_id: string
          preco_unitario: number
          product_id: string
          qtd: number
          reservado_em: string
          separation_notes: string | null
          separation_status: string | null
          status: Database["public"]["Enums"]["live_cart_item_status"]
          tamanho: string | null
          updated_at: string
          variante: Json
        }
        Insert: {
          created_at?: string
          expiracao_reserva_em?: string | null
          id?: string
          live_cart_id: string
          preco_unitario: number
          product_id: string
          qtd?: number
          reservado_em?: string
          separation_notes?: string | null
          separation_status?: string | null
          status?: Database["public"]["Enums"]["live_cart_item_status"]
          tamanho?: string | null
          updated_at?: string
          variante?: Json
        }
        Update: {
          created_at?: string
          expiracao_reserva_em?: string | null
          id?: string
          live_cart_id?: string
          preco_unitario?: number
          product_id?: string
          qtd?: number
          reservado_em?: string
          separation_notes?: string | null
          separation_status?: string | null
          status?: Database["public"]["Enums"]["live_cart_item_status"]
          tamanho?: string | null
          updated_at?: string
          variante?: Json
        }
        Relationships: [
          {
            foreignKeyName: "live_cart_items_live_cart_id_fkey"
            columns: ["live_cart_id"]
            isOneToOne: false
            referencedRelation: "live_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "live_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_product_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      live_cart_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          live_cart_id: string
          new_status: string
          notes: string | null
          old_status: string | null
          payment_method: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          live_cart_id: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          payment_method?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          live_cart_id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_cart_status_history_live_cart_id_fkey"
            columns: ["live_cart_id"]
            isOneToOne: false
            referencedRelation: "live_carts"
            referencedColumns: ["id"]
          },
        ]
      }
      live_carts: {
        Row: {
          bag_number: number | null
          charge_attempts: number | null
          charge_by_user: string | null
          charge_channel: string | null
          coupon_discount: number | null
          coupon_id: string | null
          created_at: string
          customer_checkout_notes: string | null
          customer_live_notes: string | null
          delivery_method: string | null
          delivery_notes: string | null
          delivery_period: string | null
          descontos: number
          frete: number
          id: string
          is_raffle_winner: boolean | null
          label_printed_at: string | null
          last_charge_at: string | null
          live_customer_id: string
          live_event_id: string
          me_label_url: string | null
          me_shipment_id: string | null
          mp_checkout_url: string | null
          mp_preference_id: string | null
          needs_label_reprint: boolean | null
          operational_status: string | null
          order_id: string | null
          paid_at: string | null
          paid_by_user: string | null
          paid_method: string | null
          payment_proof_url: string | null
          payment_review_status: string | null
          public_token: string
          raffle_applied: boolean | null
          raffle_name: string | null
          raffle_prize: string | null
          rejection_reason: string | null
          seller_id: string | null
          separation_status: string | null
          shipping_address_snapshot: Json | null
          shipping_deadline_days: number | null
          shipping_service_name: string | null
          shipping_tracking_code: string | null
          status: Database["public"]["Enums"]["live_cart_status"]
          stock_decremented_at: string | null
          subtotal: number
          total: number
          updated_at: string
          validated_at: string | null
          validated_by_user_id: string | null
        }
        Insert: {
          bag_number?: number | null
          charge_attempts?: number | null
          charge_by_user?: string | null
          charge_channel?: string | null
          coupon_discount?: number | null
          coupon_id?: string | null
          created_at?: string
          customer_checkout_notes?: string | null
          customer_live_notes?: string | null
          delivery_method?: string | null
          delivery_notes?: string | null
          delivery_period?: string | null
          descontos?: number
          frete?: number
          id?: string
          is_raffle_winner?: boolean | null
          label_printed_at?: string | null
          last_charge_at?: string | null
          live_customer_id: string
          live_event_id: string
          me_label_url?: string | null
          me_shipment_id?: string | null
          mp_checkout_url?: string | null
          mp_preference_id?: string | null
          needs_label_reprint?: boolean | null
          operational_status?: string | null
          order_id?: string | null
          paid_at?: string | null
          paid_by_user?: string | null
          paid_method?: string | null
          payment_proof_url?: string | null
          payment_review_status?: string | null
          public_token?: string
          raffle_applied?: boolean | null
          raffle_name?: string | null
          raffle_prize?: string | null
          rejection_reason?: string | null
          seller_id?: string | null
          separation_status?: string | null
          shipping_address_snapshot?: Json | null
          shipping_deadline_days?: number | null
          shipping_service_name?: string | null
          shipping_tracking_code?: string | null
          status?: Database["public"]["Enums"]["live_cart_status"]
          stock_decremented_at?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          validated_at?: string | null
          validated_by_user_id?: string | null
        }
        Update: {
          bag_number?: number | null
          charge_attempts?: number | null
          charge_by_user?: string | null
          charge_channel?: string | null
          coupon_discount?: number | null
          coupon_id?: string | null
          created_at?: string
          customer_checkout_notes?: string | null
          customer_live_notes?: string | null
          delivery_method?: string | null
          delivery_notes?: string | null
          delivery_period?: string | null
          descontos?: number
          frete?: number
          id?: string
          is_raffle_winner?: boolean | null
          label_printed_at?: string | null
          last_charge_at?: string | null
          live_customer_id?: string
          live_event_id?: string
          me_label_url?: string | null
          me_shipment_id?: string | null
          mp_checkout_url?: string | null
          mp_preference_id?: string | null
          needs_label_reprint?: boolean | null
          operational_status?: string | null
          order_id?: string | null
          paid_at?: string | null
          paid_by_user?: string | null
          paid_method?: string | null
          payment_proof_url?: string | null
          payment_review_status?: string | null
          public_token?: string
          raffle_applied?: boolean | null
          raffle_name?: string | null
          raffle_prize?: string | null
          rejection_reason?: string | null
          seller_id?: string | null
          separation_status?: string | null
          shipping_address_snapshot?: Json | null
          shipping_deadline_days?: number | null
          shipping_service_name?: string | null
          shipping_tracking_code?: string | null
          status?: Database["public"]["Enums"]["live_cart_status"]
          stock_decremented_at?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          validated_at?: string | null
          validated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_carts_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_carts_live_customer_id_fkey"
            columns: ["live_customer_id"]
            isOneToOne: false
            referencedRelation: "live_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_carts_live_event_id_fkey"
            columns: ["live_event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_carts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_carts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      live_charge_logs: {
        Row: {
          channel: string
          charged_by: string | null
          created_at: string
          id: string
          live_cart_id: string
          message_template: string | null
        }
        Insert: {
          channel: string
          charged_by?: string | null
          created_at?: string
          id?: string
          live_cart_id: string
          message_template?: string | null
        }
        Update: {
          channel?: string
          charged_by?: string | null
          created_at?: string
          id?: string
          live_cart_id?: string
          message_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_charge_logs_live_cart_id_fkey"
            columns: ["live_cart_id"]
            isOneToOne: false
            referencedRelation: "live_carts"
            referencedColumns: ["id"]
          },
        ]
      }
      live_customers: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          instagram_handle: string
          live_event_id: string
          nome: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["live_customer_status"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          instagram_handle: string
          live_event_id: string
          nome?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["live_customer_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          instagram_handle?: string
          live_event_id?: string
          nome?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["live_customer_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_customers_live_event_id_fkey"
            columns: ["live_event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
        ]
      }
      live_events: {
        Row: {
          created_at: string
          data_hora_fim: string | null
          data_hora_inicio: string
          id: string
          observacoes: string | null
          reservation_expiry_minutes: number
          status: Database["public"]["Enums"]["live_event_status"]
          titulo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data_hora_fim?: string | null
          data_hora_inicio: string
          id?: string
          observacoes?: string | null
          reservation_expiry_minutes?: number
          status?: Database["public"]["Enums"]["live_event_status"]
          titulo: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data_hora_fim?: string | null
          data_hora_inicio?: string
          id?: string
          observacoes?: string | null
          reservation_expiry_minutes?: number
          status?: Database["public"]["Enums"]["live_event_status"]
          titulo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      live_pendencias: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          live_cart_id: string | null
          live_customer_id: string | null
          live_event_id: string | null
          priority: Database["public"]["Enums"]["pendencia_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["pendencia_status"]
          title: string
          type: Database["public"]["Enums"]["pendencia_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          live_cart_id?: string | null
          live_customer_id?: string | null
          live_event_id?: string | null
          priority?: Database["public"]["Enums"]["pendencia_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["pendencia_status"]
          title: string
          type?: Database["public"]["Enums"]["pendencia_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          live_cart_id?: string | null
          live_customer_id?: string | null
          live_event_id?: string | null
          priority?: Database["public"]["Enums"]["pendencia_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["pendencia_status"]
          title?: string
          type?: Database["public"]["Enums"]["pendencia_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_pendencias_live_cart_id_fkey"
            columns: ["live_cart_id"]
            isOneToOne: false
            referencedRelation: "live_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_pendencias_live_customer_id_fkey"
            columns: ["live_customer_id"]
            isOneToOne: false
            referencedRelation: "live_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_pendencias_live_event_id_fkey"
            columns: ["live_event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
        ]
      }
      live_products: {
        Row: {
          bloquear_desde_planejamento: boolean
          created_at: string
          id: string
          limite_unidades_live: number | null
          live_discount_type:
            | Database["public"]["Enums"]["discount_type"]
            | null
          live_discount_value: number | null
          live_event_id: string
          prioridade_ordem: number
          product_id: string
          snapshot_variantes: Json | null
          updated_at: string
          visibilidade: Database["public"]["Enums"]["live_product_visibility"]
        }
        Insert: {
          bloquear_desde_planejamento?: boolean
          created_at?: string
          id?: string
          limite_unidades_live?: number | null
          live_discount_type?:
            | Database["public"]["Enums"]["discount_type"]
            | null
          live_discount_value?: number | null
          live_event_id: string
          prioridade_ordem?: number
          product_id: string
          snapshot_variantes?: Json | null
          updated_at?: string
          visibilidade?: Database["public"]["Enums"]["live_product_visibility"]
        }
        Update: {
          bloquear_desde_planejamento?: boolean
          created_at?: string
          id?: string
          limite_unidades_live?: number | null
          live_discount_type?:
            | Database["public"]["Enums"]["discount_type"]
            | null
          live_discount_value?: number | null
          live_event_id?: string
          prioridade_ordem?: number
          product_id?: string
          snapshot_variantes?: Json | null
          updated_at?: string
          visibilidade?: Database["public"]["Enums"]["live_product_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "live_products_live_event_id_fkey"
            columns: ["live_event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "live_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_product_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      live_raffles: {
        Row: {
          applied_at: string | null
          created_at: string
          created_by: string | null
          gift_id: string
          id: string
          live_event_id: string
          status: string
          winner_bag_number: number | null
          winner_instagram_handle: string | null
          winner_live_cart_id: string | null
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          created_by?: string | null
          gift_id: string
          id?: string
          live_event_id: string
          status?: string
          winner_bag_number?: number | null
          winner_instagram_handle?: string | null
          winner_live_cart_id?: string | null
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          created_by?: string | null
          gift_id?: string
          id?: string
          live_event_id?: string
          status?: string
          winner_bag_number?: number | null
          winner_instagram_handle?: string | null
          winner_live_cart_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_raffles_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_raffles_live_event_id_fkey"
            columns: ["live_event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_raffles_winner_live_cart_id_fkey"
            columns: ["winner_live_cart_id"]
            isOneToOne: false
            referencedRelation: "live_carts"
            referencedColumns: ["id"]
          },
        ]
      }
      live_waitlist: {
        Row: {
          created_at: string
          id: string
          instagram_handle: string
          live_event_id: string
          ordem: number
          product_id: string
          status: Database["public"]["Enums"]["live_waitlist_status"]
          updated_at: string
          variante: Json
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instagram_handle: string
          live_event_id: string
          ordem?: number
          product_id: string
          status?: Database["public"]["Enums"]["live_waitlist_status"]
          updated_at?: string
          variante?: Json
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instagram_handle?: string
          live_event_id?: string
          ordem?: number
          product_id?: string
          status?: Database["public"]["Enums"]["live_waitlist_status"]
          updated_at?: string
          variante?: Json
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_waitlist_live_event_id_fkey"
            columns: ["live_event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_waitlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "live_waitlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_waitlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_product_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      loyalty_campaigns: {
        Row: {
          applicable_tiers: string[] | null
          bonus_points: number | null
          campaign_type: string
          category_filter: string[] | null
          channel: string
          channel_scope: string
          created_at: string
          current_uses: number
          description: string | null
          end_at: string | null
          gift_id: string | null
          id: string
          is_active: boolean
          max_total_uses: number | null
          max_uses_per_customer: number | null
          min_order_value: number | null
          multiplier_value: number | null
          name: string
          priority: number
          sku_filter: string[] | null
          start_at: string | null
          updated_at: string
        }
        Insert: {
          applicable_tiers?: string[] | null
          bonus_points?: number | null
          campaign_type: string
          category_filter?: string[] | null
          channel?: string
          channel_scope?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          end_at?: string | null
          gift_id?: string | null
          id?: string
          is_active?: boolean
          max_total_uses?: number | null
          max_uses_per_customer?: number | null
          min_order_value?: number | null
          multiplier_value?: number | null
          name: string
          priority?: number
          sku_filter?: string[] | null
          start_at?: string | null
          updated_at?: string
        }
        Update: {
          applicable_tiers?: string[] | null
          bonus_points?: number | null
          campaign_type?: string
          category_filter?: string[] | null
          channel?: string
          channel_scope?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          end_at?: string | null
          gift_id?: string | null
          id?: string
          is_active?: boolean
          max_total_uses?: number | null
          max_uses_per_customer?: number | null
          min_order_value?: number | null
          multiplier_value?: number | null
          name?: string
          priority?: number
          sku_filter?: string[] | null
          start_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_campaigns_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_missions: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          emoji: string | null
          id: string
          is_active: boolean
          is_published: boolean
          is_repeatable: boolean
          max_photos: number | null
          min_tier: string | null
          mission_key: string
          mission_type: string
          points_reward: number
          prerequisite_mission_id: string | null
          questions_json: Json | null
          repeat_interval_days: number | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          emoji?: string | null
          id?: string
          is_active?: boolean
          is_published?: boolean
          is_repeatable?: boolean
          max_photos?: number | null
          min_tier?: string | null
          mission_key: string
          mission_type?: string
          points_reward?: number
          prerequisite_mission_id?: string | null
          questions_json?: Json | null
          repeat_interval_days?: number | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          emoji?: string | null
          id?: string
          is_active?: boolean
          is_published?: boolean
          is_repeatable?: boolean
          max_photos?: number | null
          min_tier?: string | null
          mission_key?: string
          mission_type?: string
          points_reward?: number
          prerequisite_mission_id?: string | null
          questions_json?: Json | null
          repeat_interval_days?: number | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_missions_prerequisite_mission_id_fkey"
            columns: ["prerequisite_mission_id"]
            isOneToOne: false
            referencedRelation: "loyalty_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          channel: string
          created_at: string
          current_redemptions: number
          description: string | null
          discount_value: number | null
          end_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          max_per_customer: number | null
          max_per_customer_30d: number | null
          min_order_value: number | null
          min_order_value_cents: number | null
          min_tier: Database["public"]["Enums"]["loyalty_tier"]
          name: string
          points_cost: number
          reward_mode: string
          start_at: string | null
          stock_qty: number | null
          type: Database["public"]["Enums"]["reward_type"]
          unlimited_stock: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          current_redemptions?: number
          description?: string | null
          discount_value?: number | null
          end_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          max_per_customer?: number | null
          max_per_customer_30d?: number | null
          min_order_value?: number | null
          min_order_value_cents?: number | null
          min_tier?: Database["public"]["Enums"]["loyalty_tier"]
          name: string
          points_cost: number
          reward_mode?: string
          start_at?: string | null
          stock_qty?: number | null
          type: Database["public"]["Enums"]["reward_type"]
          unlimited_stock?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          current_redemptions?: number
          description?: string | null
          discount_value?: number | null
          end_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          max_per_customer?: number | null
          max_per_customer_30d?: number | null
          min_order_value?: number | null
          min_order_value_cents?: number | null
          min_tier?: Database["public"]["Enums"]["loyalty_tier"]
          name?: string
          points_cost?: number
          reward_mode?: string
          start_at?: string | null
          stock_qty?: number | null
          type?: Database["public"]["Enums"]["reward_type"]
          unlimited_stock?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      loyalty_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      loyalty_tiers: {
        Row: {
          badge_color: string | null
          benefits: string | null
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          max_points: number | null
          min_points: number
          multiplier: number
          name: string
          no_expiry: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          badge_color?: string | null
          benefits?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          max_points?: number | null
          min_points?: number
          multiplier?: number
          name: string
          no_expiry?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          badge_color?: string | null
          benefits?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          max_points?: number | null
          min_points?: number
          multiplier?: number
          name?: string
          no_expiry?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      mission_attempts: {
        Row: {
          analysis_json: Json | null
          answers_json: Json | null
          completed_at: string | null
          created_at: string
          current_question: number
          id: string
          images_urls: string[] | null
          mission_id: string
          score_earned: number
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_json?: Json | null
          answers_json?: Json | null
          completed_at?: string | null
          created_at?: string
          current_question?: number
          id?: string
          images_urls?: string[] | null
          mission_id: string
          score_earned?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_json?: Json | null
          answers_json?: Json | null
          completed_at?: string | null
          created_at?: string
          current_question?: number
          id?: string
          images_urls?: string[] | null
          mission_id?: string
          score_earned?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mission_responses: {
        Row: {
          answers_json: Json | null
          completed_at: string | null
          created_at: string
          id: string
          images_urls: string[] | null
          mission_id: string
          points_earned: number
          status: string
          user_id: string
        }
        Insert: {
          answers_json?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          images_urls?: string[] | null
          mission_id: string
          points_earned?: number
          status?: string
          user_id: string
        }
        Update: {
          answers_json?: Json | null
          completed_at?: string | null
          created_at?: string
          id?: string
          images_urls?: string[] | null
          mission_id?: string
          points_earned?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_responses_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "loyalty_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions_log: {
        Row: {
          answers: Json | null
          completed_at: string
          created_at: string
          id: string
          mission_id: string
          points_earned: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string
          created_at?: string
          id?: string
          mission_id: string
          points_earned?: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string
          created_at?: string
          id?: string
          mission_id?: string
          points_earned?: number
          user_id?: string
        }
        Relationships: []
      }
      mp_payment_events: {
        Row: {
          amount: number | null
          error_message: string | null
          event_type: string | null
          id: string
          live_cart_id: string | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          mp_status: string | null
          mp_status_detail: string | null
          order_id: string | null
          payload: Json | null
          processed_at: string | null
          processing_result: string
          received_at: string
          signature_verified: boolean | null
          verification_method: string | null
        }
        Insert: {
          amount?: number | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          live_cart_id?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_status?: string | null
          mp_status_detail?: string | null
          order_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          processing_result?: string
          received_at?: string
          signature_verified?: boolean | null
          verification_method?: string | null
        }
        Update: {
          amount?: number | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          live_cart_id?: string | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_status?: string | null
          mp_status_detail?: string | null
          order_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          processing_result?: string
          received_at?: string
          signature_verified?: boolean | null
          verification_method?: string | null
        }
        Relationships: []
      }
      order_gifts: {
        Row: {
          applied_by_raffle_id: string | null
          applied_by_rule_id: string | null
          created_at: string
          gift_id: string
          id: string
          live_cart_id: string | null
          order_id: string | null
          qty: number
          separation_confirmed: boolean
          status: Database["public"]["Enums"]["order_gift_status"]
          updated_at: string
        }
        Insert: {
          applied_by_raffle_id?: string | null
          applied_by_rule_id?: string | null
          created_at?: string
          gift_id: string
          id?: string
          live_cart_id?: string | null
          order_id?: string | null
          qty?: number
          separation_confirmed?: boolean
          status?: Database["public"]["Enums"]["order_gift_status"]
          updated_at?: string
        }
        Update: {
          applied_by_raffle_id?: string | null
          applied_by_rule_id?: string | null
          created_at?: string
          gift_id?: string
          id?: string
          live_cart_id?: string | null
          order_id?: string | null
          qty?: number
          separation_confirmed?: boolean
          status?: Database["public"]["Enums"]["order_gift_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_gifts_applied_by_rule_id_fkey"
            columns: ["applied_by_rule_id"]
            isOneToOne: false
            referencedRelation: "gift_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_gifts_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_gifts_live_cart_id_fkey"
            columns: ["live_cart_id"]
            isOneToOne: false
            referencedRelation: "live_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_gifts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_gifts_raffle_fkey"
            columns: ["applied_by_raffle_id"]
            isOneToOne: false
            referencedRelation: "live_raffles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          color: string | null
          created_at: string
          discount_percent: number | null
          discount_source: string | null
          id: string
          image_url: string | null
          order_id: string
          product_id: string
          product_name: string
          product_price: number
          product_sku: string | null
          promotion_id: string | null
          promotion_name: string | null
          quantity: number
          size: string
          subtotal: number | null
          unit_price_original: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          discount_percent?: number | null
          discount_source?: string | null
          id?: string
          image_url?: string | null
          order_id: string
          product_id: string
          product_name: string
          product_price: number
          product_sku?: string | null
          promotion_id?: string | null
          promotion_name?: string | null
          quantity?: number
          size: string
          subtotal?: number | null
          unit_price_original?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          discount_percent?: number | null
          discount_source?: string | null
          id?: string
          image_url?: string | null
          order_id?: string
          product_id?: string
          product_name?: string
          product_price?: number
          product_sku?: string | null
          promotion_id?: string | null
          promotion_name?: string | null
          quantity?: number
          size?: string
          subtotal?: number | null
          unit_price_original?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotional_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_snapshot: Json | null
          attention_at: string | null
          attention_reason: string | null
          cancel_reason: string | null
          canceled_at: string | null
          coupon_discount: number | null
          coupon_id: string | null
          created_at: string
          customer_address: string
          customer_id: string | null
          customer_name: string
          customer_notes: string | null
          customer_phone: string
          delivery_method: string | null
          delivery_notes: string | null
          delivery_period: string | null
          gateway: string | null
          id: string
          internal_notes: string | null
          last_whatsapp_sent_at: string | null
          last_whatsapp_status: string | null
          live_bag_number: number | null
          live_cart_id: string | null
          live_event_id: string | null
          me_label_url: string | null
          me_shipment_id: string | null
          mp_checkout_url: string | null
          mp_preference_id: string | null
          paid_at: string | null
          payment_confirmed_amount: number | null
          payment_confirmed_at: string | null
          payment_link: string | null
          payment_mismatch: boolean
          payment_mismatch_details: string | null
          payment_provider_payment_id: string | null
          payment_status: string | null
          print_request_id: string | null
          requires_physical_cancel: boolean | null
          reserved_until: string | null
          seller_id: string | null
          shipping_address: Json | null
          shipping_calculated_at: string | null
          shipping_deadline_days: number | null
          shipping_fee: number | null
          shipping_label_generated_at: string | null
          shipping_method: string | null
          shipping_postal_code: string | null
          shipping_price: number | null
          shipping_quote_key: string | null
          shipping_service: string | null
          shipping_service_code: string | null
          shipping_status: string | null
          source: string
          status: string
          stock_decremented_at: string | null
          subtotal: number | null
          total: number
          tracking_code: string | null
          updated_at: string
          user_id: string | null
          whatsapp_message_override: string | null
        }
        Insert: {
          address_snapshot?: Json | null
          attention_at?: string | null
          attention_reason?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          coupon_discount?: number | null
          coupon_id?: string | null
          created_at?: string
          customer_address: string
          customer_id?: string | null
          customer_name: string
          customer_notes?: string | null
          customer_phone: string
          delivery_method?: string | null
          delivery_notes?: string | null
          delivery_period?: string | null
          gateway?: string | null
          id?: string
          internal_notes?: string | null
          last_whatsapp_sent_at?: string | null
          last_whatsapp_status?: string | null
          live_bag_number?: number | null
          live_cart_id?: string | null
          live_event_id?: string | null
          me_label_url?: string | null
          me_shipment_id?: string | null
          mp_checkout_url?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          payment_confirmed_amount?: number | null
          payment_confirmed_at?: string | null
          payment_link?: string | null
          payment_mismatch?: boolean
          payment_mismatch_details?: string | null
          payment_provider_payment_id?: string | null
          payment_status?: string | null
          print_request_id?: string | null
          requires_physical_cancel?: boolean | null
          reserved_until?: string | null
          seller_id?: string | null
          shipping_address?: Json | null
          shipping_calculated_at?: string | null
          shipping_deadline_days?: number | null
          shipping_fee?: number | null
          shipping_label_generated_at?: string | null
          shipping_method?: string | null
          shipping_postal_code?: string | null
          shipping_price?: number | null
          shipping_quote_key?: string | null
          shipping_service?: string | null
          shipping_service_code?: string | null
          shipping_status?: string | null
          source?: string
          status?: string
          stock_decremented_at?: string | null
          subtotal?: number | null
          total?: number
          tracking_code?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_message_override?: string | null
        }
        Update: {
          address_snapshot?: Json | null
          attention_at?: string | null
          attention_reason?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          coupon_discount?: number | null
          coupon_id?: string | null
          created_at?: string
          customer_address?: string
          customer_id?: string | null
          customer_name?: string
          customer_notes?: string | null
          customer_phone?: string
          delivery_method?: string | null
          delivery_notes?: string | null
          delivery_period?: string | null
          gateway?: string | null
          id?: string
          internal_notes?: string | null
          last_whatsapp_sent_at?: string | null
          last_whatsapp_status?: string | null
          live_bag_number?: number | null
          live_cart_id?: string | null
          live_event_id?: string | null
          me_label_url?: string | null
          me_shipment_id?: string | null
          mp_checkout_url?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          payment_confirmed_amount?: number | null
          payment_confirmed_at?: string | null
          payment_link?: string | null
          payment_mismatch?: boolean
          payment_mismatch_details?: string | null
          payment_provider_payment_id?: string | null
          payment_status?: string | null
          print_request_id?: string | null
          requires_physical_cancel?: boolean | null
          reserved_until?: string | null
          seller_id?: string | null
          shipping_address?: Json | null
          shipping_calculated_at?: string | null
          shipping_deadline_days?: number | null
          shipping_fee?: number | null
          shipping_label_generated_at?: string | null
          shipping_method?: string | null
          shipping_postal_code?: string | null
          shipping_price?: number | null
          shipping_quote_key?: string | null
          shipping_service?: string | null
          shipping_service_code?: string | null
          shipping_status?: string | null
          source?: string
          status?: string
          stock_decremented_at?: string | null
          subtotal?: number | null
          total?: number
          tracking_code?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_message_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_live_cart_id_fkey"
            columns: ["live_cart_id"]
            isOneToOne: false
            referencedRelation: "live_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_live_event_id_fkey"
            columns: ["live_event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_print_request_id_fkey"
            columns: ["print_request_id"]
            isOneToOne: false
            referencedRelation: "print_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_total: number
          created_at: string
          id: string
          installments: number | null
          mp_payment_id: string | null
          mp_preference_id: string | null
          order_id: string
          payer_email: string | null
          payer_phone: string | null
          provider: string
          raw_webhook_data: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_total?: number
          created_at?: string
          id?: string
          installments?: number | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          order_id: string
          payer_email?: string | null
          payer_phone?: string | null
          provider?: string
          raw_webhook_data?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_total?: number
          created_at?: string
          id?: string
          installments?: number | null
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          order_id?: string
          payer_email?: string | null
          payer_phone?: string | null
          provider?: string
          raw_webhook_data?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      point_transactions: {
        Row: {
          adjusted_by: string | null
          adjustment_reason: string | null
          base_points: number | null
          campaign_id: string | null
          created_at: string
          description: string | null
          expired: boolean
          expires_at: string | null
          id: string
          mission_id: string | null
          multiplier: number | null
          order_id: string | null
          points: number
          redemption_id: string | null
          reward_id: string | null
          source_type: string | null
          type: Database["public"]["Enums"]["point_transaction_type"]
          user_id: string
        }
        Insert: {
          adjusted_by?: string | null
          adjustment_reason?: string | null
          base_points?: number | null
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          expired?: boolean
          expires_at?: string | null
          id?: string
          mission_id?: string | null
          multiplier?: number | null
          order_id?: string | null
          points: number
          redemption_id?: string | null
          reward_id?: string | null
          source_type?: string | null
          type: Database["public"]["Enums"]["point_transaction_type"]
          user_id: string
        }
        Update: {
          adjusted_by?: string | null
          adjustment_reason?: string | null
          base_points?: number | null
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          expired?: boolean
          expires_at?: string | null
          id?: string
          mission_id?: string | null
          multiplier?: number | null
          order_id?: string | null
          points?: number
          redemption_id?: string | null
          reward_id?: string | null
          source_type?: string | null
          type?: Database["public"]["Enums"]["point_transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "loyalty_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: false
            referencedRelation: "reward_redemptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      print_requests: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          image_path: string
          linked_product_id: string | null
          notes: string | null
          preference: string | null
          response_sent: boolean | null
          size: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          image_path: string
          linked_product_id?: string | null
          notes?: string | null
          preference?: string | null
          response_sent?: boolean | null
          size?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          image_path?: string
          linked_product_id?: string | null
          notes?: string | null
          preference?: string | null
          response_sent?: boolean | null
          size?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_requests_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "product_available_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "print_requests_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "product_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_requests_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "public_product_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_catalog: {
        Row: {
          category: string | null
          color: string | null
          committed_by_size: Json | null
          created_at: string
          created_from_import: boolean | null
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"] | null
          discount_value: number | null
          erp_sku_by_size: Json | null
          erp_stock_by_size: Json | null
          group_key: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean | null
          length_cm: number | null
          main_image_index: number | null
          modeling: string | null
          name: string
          occasion: string | null
          price: number
          sizes: string[] | null
          sku: string | null
          stock_by_size: Json | null
          style: string | null
          tags: string[] | null
          user_id: string | null
          video_url: string | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          committed_by_size?: Json | null
          created_at?: string
          created_from_import?: boolean | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number | null
          erp_sku_by_size?: Json | null
          erp_stock_by_size?: Json | null
          group_key?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          length_cm?: number | null
          main_image_index?: number | null
          modeling?: string | null
          name: string
          occasion?: string | null
          price: number
          sizes?: string[] | null
          sku?: string | null
          stock_by_size?: Json | null
          style?: string | null
          tags?: string[] | null
          user_id?: string | null
          video_url?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          category?: string | null
          color?: string | null
          committed_by_size?: Json | null
          created_at?: string
          created_from_import?: boolean | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number | null
          erp_sku_by_size?: Json | null
          erp_stock_by_size?: Json | null
          group_key?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          length_cm?: number | null
          main_image_index?: number | null
          modeling?: string | null
          name?: string
          occasion?: string | null
          price?: number
          sizes?: string[] | null
          sku?: string | null
          stock_by_size?: Json | null
          style?: string | null
          tags?: string[] | null
          user_id?: string | null
          video_url?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          address_line: string | null
          address_reference: string | null
          avoid_items: string[] | null
          city: string | null
          color_palette: string[] | null
          completed_missions: string[] | null
          cpf: string | null
          created_at: string
          full_name: string | null
          id: string
          last_mission_completed_at: string | null
          last_mission_id: string | null
          name: string | null
          personal_tip: string | null
          preferred_sizes: string[] | null
          quiz_completed_at: string | null
          quiz_level: number | null
          quiz_points: number | null
          size_letter: string | null
          size_number: string | null
          state: string | null
          store_name: string | null
          style_description: string | null
          style_preferences: string | null
          style_title: string | null
          suggestions_updated_at: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_line?: string | null
          address_reference?: string | null
          avoid_items?: string[] | null
          city?: string | null
          color_palette?: string[] | null
          completed_missions?: string[] | null
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_mission_completed_at?: string | null
          last_mission_id?: string | null
          name?: string | null
          personal_tip?: string | null
          preferred_sizes?: string[] | null
          quiz_completed_at?: string | null
          quiz_level?: number | null
          quiz_points?: number | null
          size_letter?: string | null
          size_number?: string | null
          state?: string | null
          store_name?: string | null
          style_description?: string | null
          style_preferences?: string | null
          style_title?: string | null
          suggestions_updated_at?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_line?: string | null
          address_reference?: string | null
          avoid_items?: string[] | null
          city?: string | null
          color_palette?: string[] | null
          completed_missions?: string[] | null
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_mission_completed_at?: string | null
          last_mission_id?: string | null
          name?: string | null
          personal_tip?: string | null
          preferred_sizes?: string[] | null
          quiz_completed_at?: string | null
          quiz_level?: number | null
          quiz_points?: number | null
          size_letter?: string | null
          size_number?: string | null
          state?: string | null
          store_name?: string | null
          style_description?: string | null
          style_preferences?: string | null
          style_title?: string | null
          suggestions_updated_at?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      promotional_tables: {
        Row: {
          category_discounts: Json | null
          channel_scope: string
          created_at: string
          description: string | null
          end_at: string | null
          id: string
          is_active: boolean
          name: string
          priority: number
          product_discounts: Json | null
          start_at: string | null
          store_discount_type: string | null
          store_discount_value: number | null
          store_min_order_value: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category_discounts?: Json | null
          channel_scope?: string
          created_at?: string
          description?: string | null
          end_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          product_discounts?: Json | null
          start_at?: string | null
          store_discount_type?: string | null
          store_discount_value?: number | null
          store_min_order_value?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category_discounts?: Json | null
          channel_scope?: string
          created_at?: string
          description?: string | null
          end_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          product_discounts?: Json | null
          start_at?: string | null
          store_discount_type?: string | null
          store_discount_value?: number | null
          store_min_order_value?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      quiz_leads: {
        Row: {
          contact: string | null
          converted_at: string | null
          converted_to_customer_id: string | null
          created_at: string
          id: string
          instagram_handle: string | null
          name: string | null
          quiz_answers: Json | null
          size_letter: string | null
          size_number: string | null
          style_result: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          contact?: string | null
          converted_at?: string | null
          converted_to_customer_id?: string | null
          created_at?: string
          id?: string
          instagram_handle?: string | null
          name?: string | null
          quiz_answers?: Json | null
          size_letter?: string | null
          size_number?: string | null
          style_result?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          contact?: string | null
          converted_at?: string | null
          converted_to_customer_id?: string | null
          created_at?: string
          id?: string
          instagram_handle?: string | null
          name?: string | null
          quiz_answers?: Json | null
          size_letter?: string | null
          size_number?: string | null
          style_result?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_leads_converted_to_customer_id_fkey"
            columns: ["converted_to_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_responses: {
        Row: {
          answer: string
          created_at: string
          customer_id: string | null
          id: string
          points: number | null
          question: string
          question_number: number
          user_id: string | null
        }
        Insert: {
          answer: string
          created_at?: string
          customer_id?: string | null
          id?: string
          points?: number | null
          question: string
          question_number: number
          user_id?: string | null
        }
        Update: {
          answer?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          points?: number | null
          question?: string
          question_number?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          look_name: string | null
          products: string[] | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          look_name?: string | null
          products?: string[] | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          look_name?: string | null
          products?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          coupon_code: string
          created_at: string
          discount_value: number | null
          expires_at: string
          id: string
          order_id: string | null
          points_spent: number
          reward_id: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          status: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          coupon_code: string
          created_at?: string
          discount_value?: number | null
          expires_at: string
          id?: string
          order_id?: string | null
          points_spent: number
          reward_id: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          status?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          coupon_code?: string
          created_at?: string
          discount_value?: number | null
          expires_at?: string
          id?: string
          order_id?: string | null
          points_spent?: number
          reward_id?: string
          reward_type?: Database["public"]["Enums"]["reward_type"]
          status?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      loyalty_reports_summary: {
        Row: {
          active_users: number | null
          month: string | null
          points_earned: number | null
          points_expired: number | null
          points_redeemed: number | null
        }
        Relationships: []
      }
      product_available_stock: {
        Row: {
          available: number | null
          committed: number | null
          product_id: string | null
          reserved: number | null
          size: string | null
          stock: number | null
        }
        Relationships: []
      }
      public_product_stock: {
        Row: {
          available: number | null
          product_id: string | null
          size: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_live_cart_paid_effects: {
        Args: { p_live_cart_id: string }
        Returns: Json
      }
      apply_paid_effects: {
        Args: {
          p_confirmed_amount?: number
          p_gateway?: string
          p_order_id: string
          p_paid_at?: string
        }
        Returns: Json
      }
      calculate_loyalty_tier: {
        Args: { p_annual_points: number }
        Returns: Database["public"]["Enums"]["loyalty_tier"]
      }
      calculate_order_points: {
        Args: { p_order_total: number; p_user_tier?: string }
        Returns: number
      }
      cleanup_expired_password_tokens: { Args: never; Returns: undefined }
      convert_quiz_lead_to_customer: {
        Args: { p_lead_id: string; p_user_id?: string }
        Returns: string
      }
      decrement_gift_stock: {
        Args: { p_gift_id: string; p_qty?: number }
        Returns: boolean
      }
      ensure_order_items_for_live_order: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      expire_order_reservations: {
        Args: never
        Returns: {
          old_status: string
          order_id: string
          order_source: string
        }[]
      }
      expire_pending_orders: { Args: never; Returns: Json }
      finalize_order: { Args: { p_order_id: string }; Returns: Json }
      finalize_order_prices: { Args: { p_order_id: string }; Returns: Json }
      find_uuid_matches: {
        Args: { p_uuid: string }
        Returns: {
          column_name: string
          match_count: number
          schema_name: string
          table_name: string
        }[]
      }
      generate_reward_coupon: { Args: never; Returns: string }
      get_available_stock: {
        Args: { p_product_id: string; p_size: string }
        Returns: number
      }
      get_live_checkout: {
        Args: { p_cart_id: string; p_token: string }
        Returns: Json
      }
      get_live_reserved_stock: {
        Args: { p_product_id: string; p_size: string }
        Returns: number
      }
      get_order_final_status: {
        Args: { cart_status: string; op_status: string }
        Returns: string
      }
      get_products_effective_prices: {
        Args: { p_channel?: string; p_product_ids?: string[] }
        Returns: {
          debug_info: Json
          discount_source: string
          discount_type: string
          discount_value: number
          effective_price: number
          original_price: number
          product_id: string
          promotion_id: string
          promotion_name: string
        }[]
      }
      get_reserved_stock_map: {
        Args: never
        Returns: {
          product_id: string
          reserved: number
          size: string
        }[]
      }
      get_tier_multiplier: {
        Args: { p_tier: Database["public"]["Enums"]["loyalty_tier"] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_uses: { Args: { coupon_id: string }; Returns: undefined }
      increment_gift_rule_awards: {
        Args: { p_qty?: number; p_rule_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_cart_in_committed_state: {
        Args: { p_cart_id: string }
        Returns: boolean
      }
      is_product_hidden_by_live: {
        Args: { p_product_id: string }
        Returns: boolean
      }
      log_live_attention: {
        Args: {
          p_attention_type: string
          p_cart_id: string
          p_destination_bag_number?: number
          p_destination_instagram?: string
          p_origin_bag_number?: number
          p_payload?: Json
          p_product_id?: string
          p_product_name?: string
          p_quantity?: number
          p_size?: string
        }
        Returns: string
      }
      normalize_instagram_handle: { Args: { handle: string }; Returns: string }
      normalize_phone: { Args: { phone: string }; Returns: string }
      reserve_order_stock: { Args: { p_order_id: string }; Returns: Json }
      resolve_live_attention: {
        Args: { p_log_id: string; p_resolved_by?: string }
        Returns: boolean
      }
      save_customer_registration: {
        Args: { p_email: string; p_name: string; p_phone: string }
        Returns: {
          address_line: string | null
          address_reference: string | null
          city: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          instagram_handle: string | null
          last_order_at: string | null
          merged_into_customer_id: string | null
          name: string | null
          phone: string
          size: string | null
          size_letter: string | null
          size_number: string | null
          state: string | null
          style_title: string | null
          total_orders: number
          total_spent: number
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_live_checkout_details: {
        Args: {
          p_address_snapshot?: Json
          p_cart_id: string
          p_customer_notes?: string
          p_delivery_method: string
          p_delivery_notes?: string
          p_delivery_period?: string
          p_name: string
          p_phone: string
          p_shipping_deadline_days?: number
          p_shipping_fee?: number
          p_shipping_service_name?: string
          p_token: string
        }
        Returns: Json
      }
      sync_live_cart_to_orders: {
        Args: { p_live_cart_id: string }
        Returns: Json
      }
      sync_order_to_live_cart: { Args: { p_order_id: string }; Returns: Json }
      upsert_instagram_identity: {
        Args: {
          p_customer_id?: string
          p_handle: string
          p_order_id?: string
          p_paid_at?: string
          p_phone?: string
        }
        Returns: undefined
      }
      upsert_live_cart_item: {
        Args: {
          p_expiracao_reserva_em?: string
          p_live_cart_id: string
          p_preco_unitario: number
          p_product_id: string
          p_qtd: number
          p_variante: Json
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "customer" | "merchant" | "admin"
      discount_type: "percentage" | "fixed"
      gift_channel_scope:
        | "catalog_only"
        | "live_only"
        | "both"
        | "live_specific"
      gift_condition_type:
        | "all_purchases"
        | "min_value"
        | "first_n_paid"
        | "first_n_reserved"
      live_cart_item_status:
        | "reservado"
        | "confirmado"
        | "removido"
        | "substituido"
        | "cancelado"
        | "expirado"
      live_cart_status:
        | "aberto"
        | "em_confirmacao"
        | "aguardando_pagamento"
        | "pago"
        | "cancelado"
        | "expirado"
      live_customer_status: "ativo" | "parou" | "finalizado" | "cancelado"
      live_event_status: "planejada" | "ao_vivo" | "encerrada" | "arquivada"
      live_product_visibility: "exclusivo_live" | "catalogo_e_live"
      live_waitlist_status: "ativa" | "chamada" | "atendida" | "cancelada"
      loyalty_tier: "poa" | "classica" | "icone" | "atelier" | "poa_black"
      order_gift_status:
        | "pending_separation"
        | "separated"
        | "removed"
        | "out_of_stock"
      pendencia_priority: "baixa" | "media" | "alta"
      pendencia_status: "aberta" | "em_andamento" | "resolvida"
      pendencia_type:
        | "observacao_cliente"
        | "ajuste_tamanho"
        | "troca"
        | "enviar_opcoes"
        | "outros"
      point_transaction_type:
        | "purchase"
        | "mission"
        | "redemption"
        | "expiration"
        | "reversal"
        | "bonus"
        | "adjustment"
      reward_type:
        | "discount_fixed"
        | "discount_percentage"
        | "free_shipping"
        | "gift"
        | "vip_access"
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
      app_role: ["customer", "merchant", "admin"],
      discount_type: ["percentage", "fixed"],
      gift_channel_scope: [
        "catalog_only",
        "live_only",
        "both",
        "live_specific",
      ],
      gift_condition_type: [
        "all_purchases",
        "min_value",
        "first_n_paid",
        "first_n_reserved",
      ],
      live_cart_item_status: [
        "reservado",
        "confirmado",
        "removido",
        "substituido",
        "cancelado",
        "expirado",
      ],
      live_cart_status: [
        "aberto",
        "em_confirmacao",
        "aguardando_pagamento",
        "pago",
        "cancelado",
        "expirado",
      ],
      live_customer_status: ["ativo", "parou", "finalizado", "cancelado"],
      live_event_status: ["planejada", "ao_vivo", "encerrada", "arquivada"],
      live_product_visibility: ["exclusivo_live", "catalogo_e_live"],
      live_waitlist_status: ["ativa", "chamada", "atendida", "cancelada"],
      loyalty_tier: ["poa", "classica", "icone", "atelier", "poa_black"],
      order_gift_status: [
        "pending_separation",
        "separated",
        "removed",
        "out_of_stock",
      ],
      pendencia_priority: ["baixa", "media", "alta"],
      pendencia_status: ["aberta", "em_andamento", "resolvida"],
      pendencia_type: [
        "observacao_cliente",
        "ajuste_tamanho",
        "troca",
        "enviar_opcoes",
        "outros",
      ],
      point_transaction_type: [
        "purchase",
        "mission",
        "redemption",
        "expiration",
        "reversal",
        "bonus",
        "adjustment",
      ],
      reward_type: [
        "discount_fixed",
        "discount_percentage",
        "free_shipping",
        "gift",
        "vip_access",
      ],
    },
  },
} as const
