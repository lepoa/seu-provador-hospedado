// Types for Promotional Tables / Price Rules

export interface CategoryDiscount {
  category: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
}

export interface ProductDiscount {
  product_id: string;
  product_name?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
}

export interface PromotionalTable {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  start_at: string | null;
  end_at: string | null;
  store_discount_type: 'percentage' | 'fixed' | null;
  store_discount_value: number | null;
  store_min_order_value: number | null;
  category_discounts: CategoryDiscount[];
  product_discounts: ProductDiscount[];
  channel_scope: 'all' | 'catalog' | 'live';
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type PromotionalTableInsert = Omit<PromotionalTable, 'id' | 'created_at' | 'updated_at'>;
export type PromotionalTableUpdate = Partial<PromotionalTableInsert>;
