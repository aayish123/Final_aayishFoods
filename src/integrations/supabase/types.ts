export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean | null
          phone: string
          pincode: string
          state: string
          user_id: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean | null
          phone: string
          pincode: string
          state: string
          user_id?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean | null
          phone?: string
          pincode?: string
          state?: string
          user_id?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          id: string
          action: string
          subject: string
          description: string | null
        }
        Insert: {
          id?: string
          action: string
          subject: string
          description?: string | null
        }
        Update: {
          id?: string
          action?: string
          subject?: string
          description?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          role_id: string
          permission_id: string
        }
        Insert: {
          role_id: string
          permission_id: string
        }
        Update: {
          role_id?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          }
        ]
      }
      delivery_zones: {
        Row: {
          id: string
          name: string
          pincode: string
          delivery_charge: number
          min_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          pincode: string
          delivery_charge?: number
          min_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          pincode?: string
          delivery_charge?: number
          min_order?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          image_url: string | null
          parent_id: string | null
          display_order: number
          seo_title: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          image_url?: string | null
          parent_id?: string | null
          display_order?: number
          seo_title?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          image_url?: string | null
          parent_id?: string | null
          display_order?: number
          seo_title?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      food_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          in_stock: boolean | null
          name: string
          price: number
          updated_at: string
          slug: string
          short_description: string | null
          tags: string[] | null
          status: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived' | 'hidden'
          gallery_images: string[] | null
          category_id: string | null
          search_keywords: string[] | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          name: string
          price: number
          updated_at?: string
          slug: string
          short_description?: string | null
          tags?: string[] | null
          status?: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived' | 'hidden'
          gallery_images?: string[] | null
          category_id?: string | null
          search_keywords?: string[] | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          name?: string
          price?: number
          updated_at?: string
          slug?: string
          short_description?: string | null
          tags?: string[] | null
          status?: 'draft' | 'pending_review' | 'approved' | 'published' | 'archived' | 'hidden'
          gallery_images?: string[] | null
          category_id?: string | null
          search_keywords?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "food_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      food_item_variants: {
        Row: {
          id: string
          food_item_id: string
          label: string
          price: number
          name: string | null
          weight: string | null
          mrp: number | null
          stock: number
          sku: string | null
          status: 'active' | 'inactive'
        }
        Insert: {
          id?: string
          food_item_id: string
          label: string
          price: number
          name?: string | null
          weight?: string | null
          mrp?: number | null
          stock?: number
          sku?: string | null
          status?: 'active' | 'inactive'
        }
        Update: {
          id?: string
          food_item_id?: string
          label?: string
          price?: number
          name?: string | null
          weight?: string | null
          mrp?: number | null
          stock?: number
          sku?: string | null
          status?: 'active' | 'inactive'
        }
        Relationships: [
          {
            foreignKeyName: "food_item_variants_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          }
        ]
      }
      media_library: {
        Row: {
          id: string
          file_name: string
          file_url: string
          bucket_name: string | null
          storage_path: string | null
          folder_name: string | null
          alt_text: string | null
          width: number | null
          height: number | null
          file_size: number | null
          uploaded_by: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          file_name: string
          file_url: string
          bucket_name?: string | null
          storage_path?: string | null
          folder_name?: string | null
          alt_text?: string | null
          width?: number | null
          height?: number | null
          file_size?: number | null
          uploaded_by?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          file_name?: string
          file_url?: string
          bucket_name?: string | null
          storage_path?: string | null
          folder_name?: string | null
          alt_text?: string | null
          width?: number | null
          height?: number | null
          file_size?: number | null
          uploaded_by?: string | null
          created_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_library_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      product_seo: {
        Row: {
          id: string
          product_id: string
          seo_title: string | null
          seo_description: string | null
          seo_keywords: string | null
          canonical_url: string | null
          og_title: string | null
          og_description: string | null
          og_image: string | null
          twitter_title: string | null
          twitter_description: string | null
          twitter_image: string | null
          faq_schema: Json | null
          is_indexable: boolean
          last_updated_by: string | null
          last_updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          seo_title?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          canonical_url?: string | null
          og_title?: string | null
          og_description?: string | null
          og_image?: string | null
          twitter_title?: string | null
          twitter_description?: string | null
          twitter_image?: string | null
          faq_schema?: Json | null
          is_indexable?: boolean
          last_updated_by?: string | null
          last_updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          seo_title?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          canonical_url?: string | null
          og_title?: string | null
          og_description?: string | null
          og_image?: string | null
          twitter_title?: string | null
          twitter_description?: string | null
          twitter_image?: string | null
          faq_schema?: Json | null
          is_indexable?: boolean
          last_updated_by?: string | null
          last_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_seo_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_seo_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      reviews: {
        Row: {
          id: string
          food_item_id: string
          user_id: string
          rating: number
          comment: string | null
          status: 'pending' | 'approved' | 'rejected' | 'hidden'
          is_featured: boolean
          admin_reply: string | null
          replied_by: string | null
          replied_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          food_item_id: string
          user_id: string
          rating: number
          comment?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'hidden'
          is_featured?: boolean
          admin_reply?: string | null
          replied_by?: string | null
          replied_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          food_item_id?: string
          user_id?: string
          rating?: number
          comment?: string | null
          status?: 'pending' | 'approved' | 'rejected' | 'hidden'
          is_featured?: boolean
          admin_reply?: string | null
          replied_by?: string | null
          replied_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      coupons: {
        Row: {
          id: string
          code: string
          type: 'flat' | 'percentage' | 'free_shipping' | 'bogo' | 'referral' | 'birthday' | 'category_specific' | 'product_specific' | 'first_order' | 'festival_campaign'
          value: number
          min_order_amount: number | null
          max_discount_amount: number | null
          start_date: string | null
          end_date: string | null
          usage_limit: number | null
          usage_count: number
          max_uses_per_user: number
          is_active: boolean
          category_id: string | null
          food_item_id: string | null
          campaign_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          type: 'flat' | 'percentage' | 'free_shipping' | 'bogo' | 'referral' | 'birthday' | 'category_specific' | 'product_specific' | 'first_order' | 'festival_campaign'
          value: number
          min_order_amount?: number | null
          max_discount_amount?: number | null
          start_date?: string | null
          end_date?: string | null
          usage_limit?: number | null
          usage_count?: number
          max_uses_per_user?: number
          is_active?: boolean
          category_id?: string | null
          food_item_id?: string | null
          campaign_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          type?: 'flat' | 'percentage' | 'free_shipping' | 'bogo' | 'referral' | 'birthday' | 'category_specific' | 'product_specific' | 'first_order' | 'festival_campaign'
          value?: number
          min_order_amount?: number | null
          max_discount_amount?: number | null
          start_date?: string | null
          end_date?: string | null
          usage_limit?: number | null
          usage_count?: number
          max_uses_per_user?: number
          is_active?: boolean
          category_id?: string | null
          food_item_id?: string | null
          campaign_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          }
        ]
      }
      coupon_redemptions: {
        Row: {
          id: string
          coupon_id: string
          user_id: string | null
          order_id: string
          discount_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          coupon_id: string
          user_id?: string | null
          order_id: string
          discount_amount: number
          created_at?: string
        }
        Update: {
          id?: string
          coupon_id?: string
          user_id?: string | null
          order_id?: string
          discount_amount?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          }
        ]
      }
      banners: {
        Row: {
          id: string
          title: string
          image_url: string
          link_url: string | null
          page: string
          section: string
          device_type: 'desktop' | 'mobile' | 'all'
          start_date: string | null
          end_date: string | null
          is_active: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          image_url: string
          link_url?: string | null
          page: string
          section: string
          device_type: 'desktop' | 'mobile' | 'all'
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          image_url?: string
          link_url?: string | null
          page?: string
          section?: string
          device_type?: 'desktop' | 'mobile' | 'all'
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      banner_analytics: {
        Row: {
          id: string
          banner_id: string
          event_type: 'view' | 'click'
          user_id: string | null
          device_type: string | null
          country: string | null
          created_at: string
        }
        Insert: {
          id?: string
          banner_id: string
          event_type: 'view' | 'click'
          user_id?: string | null
          device_type?: string | null
          country?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          banner_id?: string
          event_type?: 'view' | 'click'
          user_id?: string | null
          device_type?: string | null
          country?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banner_analytics_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: false
            referencedRelation: "banners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banner_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      warehouses: {
        Row: {
          id: string
          name: string
          location: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          location?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          location?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      warehouse_stock: {
        Row: {
          id: string
          warehouse_id: string
          variant_id: string
          quantity: number
          reserved_stock: number
          available_stock: number
          reorder_level: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          warehouse_id: string
          variant_id: string
          quantity?: number
          reserved_stock?: number
          reorder_level?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          warehouse_id?: string
          variant_id?: string
          quantity?: number
          reserved_stock?: number
          reorder_level?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stock_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "food_item_variants"
            referencedColumns: ["id"]
          }
        ]
      }
      inventory_movements: {
        Row: {
          id: string
          warehouse_id: string
          variant_id: string
          type: 'in' | 'out' | 'adjustment' | 'transfer' | 'audit'
          quantity: number
          reason: string | null
          created_by: string | null
          created_at: string
          transfer_group_id: string | null
        }
        Insert: {
          id?: string
          file_name?: string // wait, why file_name? No, let's keep original
          warehouse_id: string
          variant_id: string
          type: 'in' | 'out' | 'adjustment' | 'transfer' | 'audit'
          quantity: number
          reason?: string | null
          created_by?: string | null
          created_at?: string
          transfer_group_id?: string | null
        }
        Update: {
          id?: string
          warehouse_id?: string
          variant_id?: string
          type?: 'in' | 'out' | 'adjustment' | 'transfer' | 'audit'
          quantity?: number
          reason?: string | null
          created_by?: string | null
          created_at?: string
          transfer_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "food_item_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      wishlists: {
        Row: {
          id: string
          user_id: string
          food_item_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          food_item_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          food_item_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          }
        ]
      }
      order_refunds: {
        Row: {
          id: string
          order_id: string
          amount: number
          reason: string | null
          status: 'pending' | 'approved' | 'failed'
          approved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          amount: number
          reason?: string | null
          status?: 'pending' | 'approved' | 'failed'
          approved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          amount?: number
          reason?: string | null
          status?: 'pending' | 'approved' | 'failed'
          approved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refunds_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          title: string
          message: string
          type: 'order' | 'coupon' | 'stock' | 'review' | 'system'
          user_id: string
          is_read: boolean
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          title: string
          message: string
          type: 'order' | 'coupon' | 'stock' | 'review' | 'system'
          user_id: string
          is_read?: boolean
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          message?: string
          type?: 'order' | 'coupon' | 'stock' | 'review' | 'system'
          user_id?: string
          is_read?: boolean
          created_at?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      order_notes: {
        Row: {
          id: string
          order_id: string
          admin_id: string | null
          note: string
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          admin_id?: string | null
          note: string
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          admin_id?: string | null
          note?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notes_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      order_status_history: {
        Row: {
          id: string
          order_id: string
          old_status: string | null
          new_status: string | null
          changed_by: string | null
          changed_at: string
          notes: string | null
        }
        Insert: {
          id?: string
          order_id: string
          old_status?: string | null
          new_status?: string | null
          changed_by?: string | null
          changed_at?: string
          notes?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          old_status?: string | null
          new_status?: string | null
          changed_by?: string | null
          changed_at?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      customer_activity: {
        Row: {
          id: string
          customer_id: string
          activity_type: 'login' | 'order_placed' | 'review_submitted' | 'coupon_used' | 'wishlist_added' | 'cart_activity' | 'profile_updated'
          description: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          activity_type: 'login' | 'order_placed' | 'review_submitted' | 'coupon_used' | 'wishlist_added' | 'cart_activity' | 'profile_updated'
          description?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          activity_type?: 'login' | 'order_placed' | 'review_submitted' | 'coupon_used' | 'wishlist_added' | 'cart_activity' | 'profile_updated'
          description?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_activity_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      customer_notes: {
        Row: {
          id: string
          customer_id: string
          admin_id: string | null
          note: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          admin_id?: string | null
          note: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          admin_id?: string | null
          note?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string
          old_data: Json | null
          new_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id: string
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      settings: {
        Row: {
          key: string
          category: 'store' | 'seo' | 'payment' | 'shipping' | 'sms' | 'email' | 'tax' | 'social' | 'system'
          value: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          key: string
          category: 'store' | 'seo' | 'payment' | 'shipping' | 'sms' | 'email' | 'tax' | 'social' | 'system'
          value: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          key?: string
          category?: 'store' | 'seo' | 'payment' | 'shipping' | 'sms' | 'email' | 'tax' | 'social' | 'system'
          value?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_sections: {
        Row: {
          id: string
          version: number
          published_version: number
          draft_content: Json | null
          published_content: Json | null
          updated_at: string
        }
        Insert: {
          id: string
          version?: number
          published_version?: number
          draft_content?: Json | null
          published_content?: Json | null
          updated_at?: string
        }
        Update: {
          id?: string
          version?: number
          published_version?: number
          draft_content?: Json | null
          published_content?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      report_snapshots: {
        Row: {
          id: string
          snapshot_type: 'daily_sales' | 'weekly_sales' | 'monthly_sales' | 'inventory_valuation' | 'coupon_performance'
          snapshot_date: string
          data: Json
          created_at: string
        }
        Insert: {
          id?: string
          snapshot_type: 'daily_sales' | 'weekly_sales' | 'monthly_sales' | 'inventory_valuation' | 'coupon_performance'
          snapshot_date: string
          data: Json
          created_at?: string
        }
        Update: {
          id?: string
          snapshot_type?: 'daily_sales' | 'weekly_sales' | 'monthly_sales' | 'inventory_valuation' | 'coupon_performance'
          snapshot_date?: string
          data?: Json
          created_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          food_item_id: string | null
          id: string
          order_id: string | null
          quantity: number
          unit_price: number
          variant_id: string | null
          subtotal: number | null
          product_name_snapshot: string | null
          variant_name_snapshot: string | null
        }
        Insert: {
          created_at?: string
          food_item_id?: string | null
          id?: string
          order_id?: string | null
          quantity: number
          unit_price: number
          variant_id?: string | null
          subtotal?: number | null
          product_name_snapshot?: string | null
          variant_name_snapshot?: string | null
        }
        Update: {
          created_at?: string
          food_item_id?: string | null
          id?: string
          order_id?: string | null
          quantity?: number
          unit_price?: number
          variant_id?: string | null
          subtotal?: number | null
          product_name_snapshot?: string | null
          variant_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "food_item_variants"
            referencedColumns: ["id"]
          }
        ]
      }
      orders: {
        Row: {
          address_id: string | null
          created_at: string
          id: string
          notes: string | null
          payment_status: string | null
          status: string | null
          total_amount: number
          updated_at: string
          user_id: string | null
          tracking_number: string | null
          courier_partner: string | null
          dispatch_date: string | null
          packed_at: string | null
          shipped_at: string | null
          delivered_at: string | null
        }
        Insert: {
          address_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_status?: string | null
          status?: string | null
          total_amount: number
          updated_at?: string
          user_id?: string | null
          tracking_number?: string | null
          courier_partner?: string | null
          dispatch_date?: string | null
          packed_at?: string | null
          shipped_at?: string | null
          delivered_at?: string | null
        }
        Update: {
          address_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_status?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string | null
          tracking_number?: string | null
          courier_partner?: string | null
          dispatch_date?: string | null
          packed_at?: string | null
          shipped_at?: string | null
          delivered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          role_id: string | null
          role: string
          avatar_url: string | null
          provider: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          role_id?: string | null
          role?: string
          avatar_url?: string | null
          provider?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          role_id?: string | null
          role?: string
          avatar_url?: string | null
          provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          }
        ]
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
