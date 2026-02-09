// Gift System Types

export type GiftChannelScope = 'catalog_only' | 'live_only' | 'both' | 'live_specific';
export type GiftConditionType = 'all_purchases' | 'min_value' | 'first_n_paid' | 'first_n_reserved';
export type OrderGiftStatus = 'pending_separation' | 'separated' | 'removed' | 'out_of_stock';

export interface Gift {
  id: string;
  name: string;
  image_url: string | null;
  description: string | null;
  sku: string | null;
  stock_qty: number;
  unlimited_stock: boolean;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
  require_manual_confirm: boolean;
  cost: number | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GiftRule {
  id: string;
  name: string;
  is_active: boolean;
  channel_scope: GiftChannelScope;
  live_event_id: string | null;
  start_at: string | null;
  end_at: string | null;
  priority: number;
  condition_type: GiftConditionType;
  condition_value: number | null;
  gift_id: string;
  gift_qty: number;
  max_per_customer: number | null;
  max_total_awards: number | null;
  current_awards_count: number;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  gift?: Gift;
  live_event?: {
    id: string;
    titulo: string;
  };
}

export interface OrderGift {
  id: string;
  order_id: string | null;
  live_cart_id: string | null;
  gift_id: string;
  qty: number;
  status: OrderGiftStatus;
  applied_by_rule_id: string | null;
  applied_by_raffle_id: string | null;
  separation_confirmed: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  gift?: Gift;
  gift_rule?: GiftRule;
}

export interface LiveRaffle {
  id: string;
  live_event_id: string;
  gift_id: string;
  winner_live_cart_id: string | null;
  winner_bag_number: number | null;
  winner_instagram_handle: string | null;
  created_by: string | null;
  created_at: string;
  // Joined data
  gift?: Gift;
}

// Form types
export interface CreateGiftForm {
  name: string;
  image_url?: string;
  description?: string;
  stock_qty: number;
  unlimited_stock: boolean;
  is_active: boolean;
  start_at?: string;
  end_at?: string;
  require_manual_confirm: boolean;
  cost?: number;
}

export interface CreateGiftRuleForm {
  name: string;
  is_active: boolean;
  channel_scope: GiftChannelScope;
  live_event_id?: string;
  start_at?: string;
  end_at?: string;
  priority: number;
  condition_type: GiftConditionType;
  condition_value?: number;
  gift_id: string;
  gift_qty: number;
  max_per_customer?: number;
  max_total_awards?: number;
}
