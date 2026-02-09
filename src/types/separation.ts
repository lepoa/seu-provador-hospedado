// Separation (Pós-Live) Types

export type SeparationItemStatus = 'em_separacao' | 'separado' | 'cancelado' | 'retirado_confirmado';
export type SeparationBagStatus = 'pendente' | 'em_separacao' | 'separado' | 'atencao' | 'cancelado';

// Attention/Reallocation tracking
export interface ReallocationInfo {
  itemId: string;
  productName: string;
  productImage: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  originBagId: string;
  originBagNumber: number;
  destinationBagId: string | null;
  destinationBagNumber: number | null;
  destinationInstagram: string | null;
  createdAt: string;
  // Confirmation status
  removedFromOriginConfirmed: boolean;
  placedInDestinationConfirmed: boolean;
}

export interface AttentionRequirement {
  type: 'reallocation' | 'cancellation' | 'quantity_reduction';
  reallocationInfo?: ReallocationInfo;
  description: string;
  resolved: boolean;
}

export interface SeparationBag {
  id: string;
  bagNumber: number;
  instagramHandle: string;
  customerName: string | null;
  totalItems: number;
  totalValue: number;
  status: SeparationBagStatus;
  items: SeparationItem[];
  hasCancelledItems: boolean;
  hasUnseparatedItems: boolean;
  cartStatus: string;
  createdAt: string;
  needsReprintLabel: boolean; // True if bag was modified after label was printed (only after first print)
  pendingRemovalCount: number; // Count of cancelled item units pending physical removal confirmation
  labelPrintedAt: string | null; // Timestamp of last label print, null = never printed
  // Attention/Reallocation tracking
  attentionRequirements: AttentionRequirement[];
  hasUnresolvedAttention: boolean;
  isBlocked: boolean; // True when bag cannot advance (print, finalize) due to unresolved attention
}

export interface SeparationItem {
  id: string;
  bagId: string;
  bagNumber: number;
  productId: string;
  productName: string;
  productImage: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  unitPrice: number;
  status: SeparationItemStatus;
  notes: string | null;
  instagramHandle: string;
  cartItemStatus: string; // original live_cart_item status
  removedConfirmedCount: number; // For cancelled items: how many units have been confirmed as removed
  pendingRemovalFromQuantityReduction?: number; // Units cancelled via quantity reduction (item stays, but some units cancelled)
  wasSeparatedBeforeCancellation?: boolean; // True if item was separated before being cancelled
  isGift?: boolean; // True if this is a gift item (from order_gifts)
  giftSource?: 'rule' | 'raffle' | null; // Source of gift application
}

export interface ProductSeparationGroup {
  productId: string;
  productName: string;
  productImage: string | null;
  color: string | null;
  size: string | null;
  sku: string | null;
  totalNeeded: number;
  totalSeparated: number;
  totalPending: number;
  totalCancelled: number;
  bags: {
    bagId: string;
    bagNumber: number;
    instagramHandle: string;
    itemId: string;
    quantity: number;
    status: SeparationItemStatus;
  }[];
}

export interface SeparationKPIs {
  totalBags: number;
  bagsSeparated: number;
  bagsPending: number;
  bagsAttention: number;
  bagsCancelled: number; // Bags where all items were cancelled
  itemsCancelled: number;
  separationPercentage: number;
}

export type SeparationMode = 'by_product' | 'by_bag';
export type SeparationFilter = 'all' | 'pending' | 'separated' | 'cancelled' | 'attention';
export type SeparationSort = 'bag_number' | 'instagram' | 'status';
