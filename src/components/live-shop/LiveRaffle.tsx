import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift,
  Trophy,
  Sparkles,
  Loader2,
  Check,
  ShoppingBag,
  Plus,
  RefreshCw,
  Pencil,
  XCircle,
  PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InlineGiftCreate } from "./InlineGiftCreate";
import type { LiveCart } from "@/types/liveShop";
import type { Gift as GiftType } from "@/types/gifts";
import logoLepoa from "@/assets/logo-lepoa.png";

interface Props {
  eventId: string;
  carts: LiveCart[];
  onRefresh?: () => void;
  onRaffleOverlayChange?: (isActive: boolean) => void;
}

interface RaffleHistory {
  id: string;
  gift: GiftType | null;
  gift_id: string;
  winner_instagram_handle: string | null;
  winner_bag_number: number | null;
  winner_live_cart_id: string | null;
  created_at: string;
  status: "pending" | "applied" | "cancelled";
  applied_at: string | null;
}

// Raffle phases: idle -> spinning -> winner_revealed -> applying_prize -> done
type RafflePhase = "idle" | "spinning" | "winner_revealed" | "applying_prize" | "done";

export function LiveRaffle({ eventId, carts, onRefresh, onRaffleOverlayChange }: Props) {
  const [gifts, setGifts] = useState<GiftType[]>([]);
  const [isLoadingGifts, setIsLoadingGifts] = useState(true);
  const [selectedGiftId, setSelectedGiftId] = useState("");
  const [onlyPaid, setOnlyPaid] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [rafflePhase, setRafflePhase] = useState<RafflePhase>("idle");
  const [winner, setWinner] = useState<{
    cart: LiveCart;
    gift: GiftType;
    raffleId: string;
  } | null>(null);
  const [history, setHistory] = useState<RaffleHistory[]>([]);
  const [showCreateGift, setShowCreateGift] = useState(false);
  
  // Use refs to keep winner and phase stable against re-renders
  const winnerRef = useRef<typeof winner>(null);
  const phaseRef = useRef<RafflePhase>("idle");
  
  // Edit/Cancel states
  const [editingRaffle, setEditingRaffle] = useState<RaffleHistory | null>(null);
  const [newGiftId, setNewGiftId] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [cancelingRaffle, setCancelingRaffle] = useState<RaffleHistory | null>(null);

  // Notify parent when overlay is active (to pause refetch)
  useEffect(() => {
    const isActive = rafflePhase === "spinning" || rafflePhase === "winner_revealed" || rafflePhase === "applying_prize";
    phaseRef.current = rafflePhase;
    onRaffleOverlayChange?.(isActive);
  }, [rafflePhase, onRaffleOverlayChange]);

  // Fetch active gifts
  const fetchGifts = useCallback(async () => {
    setIsLoadingGifts(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("gifts")
        .select("*")
        .eq("is_active", true)
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gte.${now}`)
        .order("name");

      if (error) throw error;
      
      // Filter out gifts with zero stock (unless unlimited)
      const availableGifts = (data || []).filter(
        (g: GiftType) => g.unlimited_stock || g.stock_qty > 0
      );
      setGifts(availableGifts);
    } catch (err) {
      console.error("Error fetching gifts:", err);
    } finally {
      setIsLoadingGifts(false);
    }
  }, []);

  // Fetch raffle history
  const fetchHistory = useCallback(async () => {
    const { data } = await supabase
      .from("live_raffles")
      .select(`
        id,
        gift_id,
        winner_instagram_handle,
        winner_bag_number,
        winner_live_cart_id,
        created_at,
        status,
        applied_at,
        gift:gifts(*)
      `)
      .eq("live_event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(20);
    
    setHistory((data || []) as RaffleHistory[]);
  }, [eventId]);

  useEffect(() => {
    fetchGifts();
    fetchHistory();
  }, [fetchGifts, fetchHistory]);

  // Check if a raffle's cart is already paid
  const isRafflePaid = (raffle: RaffleHistory) => {
    const cart = carts.find(c => c.id === raffle.winner_live_cart_id);
    return cart?.status === "pago";
  };

  // Edit raffle prize (only for applied raffles)
  const handleEditRaffle = async () => {
    if (!editingRaffle || !newGiftId) return;
    
    if (isRafflePaid(editingRaffle)) {
      toast.error("Este pedido já foi pago. Ajustes não são permitidos.");
      return;
    }

    setIsUpdating(true);
    try {
      const newGift = gifts.find(g => g.id === newGiftId);
      if (!newGift) throw new Error("Brinde não encontrado");
      
      // Check stock
      if (!newGift.unlimited_stock && newGift.stock_qty < 1) {
        toast.error(`Brinde "${newGift.name}" sem estoque!`);
        return;
      }

      // Only update order_gifts if the raffle was already applied
      if (editingRaffle.status === "applied") {
        // Remove old order_gift entry
        await supabase
          .from("order_gifts")
          .delete()
          .eq("applied_by_raffle_id", editingRaffle.id);

        // Restore old gift stock
        if (editingRaffle.gift_id) {
          await supabase.rpc("decrement_gift_stock", { 
            p_gift_id: editingRaffle.gift_id, 
            p_qty: -1 // negative to increment
          });
        }

        // Add new order_gift
        await supabase
          .from("order_gifts")
          .insert({
            live_cart_id: editingRaffle.winner_live_cart_id,
            gift_id: newGiftId,
            qty: 1,
            status: "pending_separation",
            applied_by_raffle_id: editingRaffle.id,
          });

        // Decrement new gift stock
        await supabase.rpc("decrement_gift_stock", { 
          p_gift_id: newGiftId, 
          p_qty: 1 
        });

        // Update cart raffle info - only mark for reprint if label was already printed
        const cartForEdit = carts.find(c => c.id === editingRaffle.winner_live_cart_id);
        const shouldMarkForReprint = !!(cartForEdit?.bag_number && cartForEdit?.label_printed_at);
        
        await supabase
          .from("live_carts")
          .update({
            raffle_prize: newGift.name,
            raffle_name: `Sorteio - ${newGift.name}`,
            needs_label_reprint: shouldMarkForReprint,
          })
          .eq("id", editingRaffle.winner_live_cart_id);
      }

      // Update raffle with new gift
      await supabase
        .from("live_raffles")
        .update({ gift_id: newGiftId })
        .eq("id", editingRaffle.id);

      toast.success("Brinde atualizado com sucesso");
      setEditingRaffle(null);
      setNewGiftId("");
      fetchHistory();
      fetchGifts();
      onRefresh?.();
    } catch (err) {
      console.error("Error updating raffle:", err);
      toast.error("Erro ao atualizar brinde");
    } finally {
      setIsUpdating(false);
    }
  };

  // Cancel raffle
  const handleCancelRaffle = async () => {
    if (!cancelingRaffle) return;
    
    if (isRafflePaid(cancelingRaffle)) {
      toast.error("Este pedido já foi pago. Cancelamento não é permitido.");
      setCancelingRaffle(null);
      return;
    }

    setIsUpdating(true);
    try {
      // Only remove order_gift if raffle was applied
      if (cancelingRaffle.status === "applied") {
        // Remove order_gift entry
        await supabase
          .from("order_gifts")
          .delete()
          .eq("applied_by_raffle_id", cancelingRaffle.id);

        // Restore gift stock
        if (cancelingRaffle.gift_id) {
          await supabase.rpc("decrement_gift_stock", { 
            p_gift_id: cancelingRaffle.gift_id, 
            p_qty: -1 // negative to increment
          });
        }

        // Update cart to remove raffle winner status - only mark for reprint if label was already printed
        const cartForCancel = carts.find(c => c.id === cancelingRaffle.winner_live_cart_id);
        const shouldMarkForReprintCancel = !!(cartForCancel?.bag_number && cartForCancel?.label_printed_at);
        
        await supabase
          .from("live_carts")
          .update({
            is_raffle_winner: false,
            raffle_name: null,
            raffle_prize: null,
            raffle_applied: false,
            needs_label_reprint: shouldMarkForReprintCancel,
          })
          .eq("id", cancelingRaffle.winner_live_cart_id);
      }

      // Mark raffle as cancelled (don't delete to keep history)
      await supabase
        .from("live_raffles")
        .update({ status: "cancelled" })
        .eq("id", cancelingRaffle.id);

      toast.success("Sorteio cancelado");
      setCancelingRaffle(null);
      fetchHistory();
      fetchGifts();
      onRefresh?.();
    } catch (err) {
      console.error("Error canceling raffle:", err);
      toast.error("Erro ao cancelar sorteio");
    } finally {
      setIsUpdating(false);
    }
  };

  // Get eligible carts
  const eligibleCarts = carts.filter(cart => {
    // Must have at least 1 active item
    const hasActiveItems = (cart.items || []).some(item => 
      ["reservado", "confirmado"].includes(item.status)
    );
    
    if (!hasActiveItems) return false;
    
    // If "only paid" is checked, filter by status
    if (onlyPaid && cart.status !== "pago") return false;
    
    // Exclude cancelled carts
    if (cart.status === "cancelado") return false;
    
    return true;
  });

  // Step 1: Start raffle - only picks winner and saves as PENDING
  const handleStartRaffle = async () => {
    if (!selectedGiftId) {
      toast.error("Selecione um brinde para sortear");
      return;
    }

    if (eligibleCarts.length === 0) {
      toast.error("Não há sacolas elegíveis para o sorteio");
      return;
    }

    const gift = gifts.find(g => g.id === selectedGiftId);
    if (!gift) return;

    // Check stock
    if (!gift.unlimited_stock && gift.stock_qty < 1) {
      toast.error(`Brinde "${gift.name}" sem estoque!`);
      return;
    }

    setShowAnimation(true);
    setRafflePhase("spinning");

    // Simulate suspenseful animation (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Pick random winner
    const randomIndex = Math.floor(Math.random() * eligibleCarts.length);
    const winnerCart = eligibleCarts[randomIndex];

    try {
      const { data: session } = await supabase.auth.getSession();
      
      // Insert raffle record as PENDING (NOT applied yet)
      const { data: raffle, error: raffleError } = await supabase
        .from("live_raffles")
        .insert({
          live_event_id: eventId,
          gift_id: selectedGiftId,
          winner_live_cart_id: winnerCart.id,
          winner_bag_number: winnerCart.bag_number,
          winner_instagram_handle: winnerCart.live_customer?.instagram_handle,
          created_by: session?.session?.user?.id,
          status: "pending", // IMPORTANT: starts as pending
        })
        .select()
        .single();

      if (raffleError) throw raffleError;

      // Store winner in state and ref
      const winnerData = { cart: winnerCart, gift, raffleId: raffle.id };
      winnerRef.current = winnerData;
      setWinner(winnerData);
      
      // Transition to revealed phase (winner stays on screen)
      setRafflePhase("winner_revealed");
      
      // Refresh history to show pending raffle
      fetchHistory();
    } catch (err) {
      console.error("Error recording raffle:", err);
      toast.error("Erro ao registrar o sorteio");
      setShowAnimation(false);
      setRafflePhase("idle");
    }
  };

  // Step 2: Apply prize - actually adds gift to cart
  const handleApplyPrize = async () => {
    const currentWinner = winner || winnerRef.current;
    if (!currentWinner) return;

    setRafflePhase("applying_prize");

    try {
      const { cart, gift, raffleId } = currentWinner;

      // Add gift as order_gift to winner's cart
      const { error: giftError } = await supabase
        .from("order_gifts")
        .insert({
          live_cart_id: cart.id,
          gift_id: gift.id,
          qty: 1,
          status: "pending_separation",
          applied_by_raffle_id: raffleId,
        });

      if (giftError) throw giftError;

      // Decrement gift stock
      await supabase.rpc("decrement_gift_stock", { 
        p_gift_id: gift.id, 
        p_qty: 1 
      });

      // Mark cart as raffle winner - only mark for reprint if label was already printed
      const shouldMarkForReprintApply = !!(cart.bag_number && cart.label_printed_at);
      
      await supabase
        .from("live_carts")
        .update({
          is_raffle_winner: true,
          raffle_name: `Sorteio - ${gift.name}`,
          raffle_prize: gift.name,
          raffle_applied: true,
          needs_label_reprint: shouldMarkForReprintApply,
        })
        .eq("id", cart.id);

      // Update raffle status to applied
      await supabase
        .from("live_raffles")
        .update({ 
          status: "applied",
          applied_at: new Date().toISOString(),
        })
        .eq("id", raffleId);

      toast.success(`🏆 Prêmio aplicado! ${cart.live_customer?.instagram_handle} ganhou ${gift.name}!`);
      
      setRafflePhase("done");
      fetchHistory();
      fetchGifts();
      onRefresh?.();
    } catch (err) {
      console.error("Error applying prize:", err);
      toast.error("Erro ao aplicar o prêmio");
      setRafflePhase("winner_revealed"); // Go back to revealed so user can try again
    }
  };

  // Close animation (only when user clicks "Fechar")
  const closeAnimation = () => {
    setShowAnimation(false);
    setWinner(null);
    winnerRef.current = null;
    setRafflePhase("idle");
  };

  const handleGiftCreated = (giftId: string) => {
    fetchGifts();
    setSelectedGiftId(giftId);
  };

  const selectedGift = gifts.find(g => g.id === selectedGiftId);
  const displayWinner = winner || winnerRef.current;

  // Get status badge for raffle
  const getRaffleStatusBadge = (raffle: RaffleHistory) => {
    switch (raffle.status) {
      case "pending":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Pendente</Badge>;
      case "applied":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Aplicado</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Cancelado</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Sorteio ao Vivo
          </CardTitle>
          <CardDescription>
            Sorteie brindes entre as sacolas da live
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Gift Selection */}
          <div className="space-y-2">
            <Label>Brinde para sortear</Label>
            <div className="flex gap-2">
              <Select value={selectedGiftId} onValueChange={setSelectedGiftId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um brinde cadastrado" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {isLoadingGifts ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                      Carregando...
                    </div>
                  ) : gifts.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      Nenhum brinde disponível
                    </div>
                  ) : (
                    gifts.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        <span className="flex items-center gap-2">
                          {g.image_url ? (
                            <img src={g.image_url} alt="" className="w-5 h-5 rounded object-cover" />
                          ) : (
                            <Gift className="h-4 w-4" />
                          )}
                          {g.name}
                          {!g.unlimited_stock && (
                            <span className="text-xs text-muted-foreground">
                              ({g.stock_qty} disponíveis)
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowCreateGift(true)}
                title="Criar novo brinde"
              >
                <Plus className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchGifts}
                title="Atualizar lista"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Selected gift preview */}
          {selectedGift && (
            <div className="p-3 bg-secondary/50 rounded-lg flex items-center gap-3">
              {selectedGift.image_url ? (
                <img 
                  src={selectedGift.image_url} 
                  alt={selectedGift.name} 
                  className="w-12 h-12 rounded object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                  <Gift className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <div className="font-medium">{selectedGift.name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedGift.unlimited_stock 
                    ? "Estoque ilimitado" 
                    : `${selectedGift.stock_qty} disponíveis`}
                </div>
              </div>
            </div>
          )}

          {/* Filter Options */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={onlyPaid}
                onChange={(e) => setOnlyPaid(e.target.checked)}
                className="rounded border-input"
              />
              Apenas sacolas pagas
            </label>
          </div>

          {/* Eligible Count */}
          <div className="p-3 bg-secondary/50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sacolas elegíveis:</span>
              <Badge variant="secondary" className="text-lg font-bold">
                {eligibleCarts.length}
              </Badge>
            </div>
          </div>

          {/* Raffle Button */}
          <Button
            onClick={handleStartRaffle}
            disabled={rafflePhase !== "idle" || !selectedGiftId || eligibleCarts.length === 0}
            className="w-full gap-2 h-12 text-lg"
            size="lg"
          >
            {rafflePhase !== "idle" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Sorteando...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Sortear Agora
              </>
            )}
          </Button>

          {/* History */}
          {history.length > 0 && (
            <div className="pt-4 border-t space-y-2">
              <h4 className="text-sm font-medium">Sorteios desta live</h4>
              <div className="space-y-2">
                {history.map((h) => {
                  const isPaid = isRafflePaid(h);
                  const isCancelled = h.status === "cancelled";
                  return (
                    <div 
                      key={h.id} 
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        isCancelled ? 'bg-secondary/20 opacity-60' : 'bg-secondary/30'
                      }`}
                    >
                      <Trophy className={`h-4 w-4 shrink-0 ${isCancelled ? 'text-muted-foreground' : 'text-amber-500'}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`font-medium ${isCancelled ? 'line-through' : ''}`}>
                          @{h.winner_instagram_handle?.replace(/^@/, '')}
                        </span>
                        {h.winner_bag_number && (
                          <span className="text-muted-foreground ml-1">
                            (Sacola #{h.winner_bag_number})
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {h.gift?.name || "Brinde"}
                      </Badge>
                      {getRaffleStatusBadge(h)}
                      {/* Action buttons - only show if not cancelled */}
                      {!isCancelled && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              if (isPaid) {
                                toast.error("Este pedido já foi pago. Ajustes não são permitidos.");
                                return;
                              }
                              setEditingRaffle(h);
                              setNewGiftId(h.gift_id || "");
                            }}
                            title={isPaid ? "Pedido pago - não pode editar" : "Editar brinde"}
                            disabled={isPaid}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (isPaid) {
                                toast.error("Este pedido já foi pago. Cancelamento não é permitido.");
                                return;
                              }
                              setCancelingRaffle(h);
                            }}
                            title={isPaid ? "Pedido pago - não pode cancelar" : "Cancelar sorteio"}
                            disabled={isPaid}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      {isPaid && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          Pago
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline Gift Create Modal */}
      <InlineGiftCreate
        open={showCreateGift}
        onClose={() => setShowCreateGift(false)}
        onCreated={handleGiftCreated}
      />

      {/* Edit Raffle Modal */}
      <Dialog open={!!editingRaffle} onOpenChange={(open) => !open && setEditingRaffle(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Brinde do Sorteio
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Ganhadora:</p>
              <p className="font-medium">@{editingRaffle?.winner_instagram_handle?.replace(/^@/, '')}</p>
              {editingRaffle?.winner_bag_number && (
                <p className="text-sm text-muted-foreground">Sacola #{editingRaffle.winner_bag_number}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Novo brinde</Label>
              <Select value={newGiftId} onValueChange={setNewGiftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um brinde" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {gifts.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <span className="flex items-center gap-2">
                        {g.image_url ? (
                          <img src={g.image_url} alt="" className="w-5 h-5 rounded object-cover" />
                        ) : (
                          <Gift className="h-4 w-4" />
                        )}
                        {g.name}
                        {!g.unlimited_stock && (
                          <span className="text-xs text-muted-foreground">
                            ({g.stock_qty} disp.)
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingRaffle(null)}
              disabled={isUpdating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditRaffle}
              disabled={!newGiftId || newGiftId === editingRaffle?.gift_id || isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Raffle Confirmation */}
      <AlertDialog open={!!cancelingRaffle} onOpenChange={(open) => !open && setCancelingRaffle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Sorteio?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja cancelar este sorteio? 
              {cancelingRaffle?.status === "applied" && (
                <>O brinde será removido da sacola de{" "}
                <strong>@{cancelingRaffle?.winner_instagram_handle?.replace(/^@/, '')}</strong>.</>
              )}
              {cancelingRaffle?.status === "pending" && (
                <>O sorteio pendente de{" "}
                <strong>@{cancelingRaffle?.winner_instagram_handle?.replace(/^@/, '')}</strong> será cancelado.</>
              )}
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Manter</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelRaffle}
              disabled={isUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Cancelando...
                </>
              ) : (
                "Sim, Cancelar Sorteio"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Raffle Animation Modal - 2 Stage Flow */}
      <Dialog 
        open={showAnimation} 
        onOpenChange={(open) => {
          // Only allow closing via the "Fechar" button in done phase
          if (!open && rafflePhase === "done") {
            closeAnimation();
          }
        }}
      >
        <DialogContent 
          className="sm:max-w-lg p-0 overflow-hidden border-0 bg-transparent shadow-none"
          onPointerDownOutside={(e) => {
            // Prevent closing on outside click
            e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            // Prevent escape key closing
            e.preventDefault();
          }}
        >
          <div className="bg-gradient-to-br from-[#faf8f5] via-white to-[#f5f0eb] rounded-2xl overflow-hidden shadow-2xl border border-amber-100">
            {/* LE.POÁ Header with LOGO */}
            <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-amber-100/50 border-b border-amber-200/50 flex justify-center">
              <img 
                src={logoLepoa} 
                alt="LE.POÁ" 
                className="h-10 object-contain"
              />
            </div>
            
            <div className="p-8 text-center space-y-6">
              <AnimatePresence mode="wait">
                {/* PHASE: SPINNING */}
                {rafflePhase === "spinning" && (
                  <motion.div
                    key="spinning"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Spinning gift icon */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      className="w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shadow-lg border-4 border-white"
                    >
                      <Gift className="h-14 w-14 text-amber-600" />
                    </motion.div>
                    
                    <div className="space-y-3">
                      <h2 className="text-2xl font-serif text-amber-900">Sorteando...</h2>
                      <p className="text-sm text-amber-700/70">Selecionando a ganhadora</p>
                    </div>
                    
                    {/* Animated participant names */}
                    <div className="flex flex-wrap justify-center gap-1.5 max-h-24 overflow-hidden px-4">
                      {eligibleCarts.slice(0, 15).map((cart, i) => (
                        <motion.div
                          key={cart.id}
                          animate={{
                            scale: [1, 1.15, 1],
                            opacity: [0.4, 1, 0.4],
                          }}
                          transition={{
                            duration: 0.25,
                            delay: (i * 0.06) % 0.9,
                            repeat: Infinity,
                          }}
                          className="px-2.5 py-1 bg-amber-100 rounded-full text-xs font-medium text-amber-800"
                        >
                          {cart.live_customer?.instagram_handle?.replace(/^@/, '')}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* PHASE: WINNER REVEALED (waiting for user to apply) */}
                {rafflePhase === "winner_revealed" && displayWinner && (
                  <motion.div
                    key="winner_revealed"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                    className="space-y-6"
                  >
                    {/* Trophy animation with sparkles */}
                    <motion.div
                      initial={{ y: -30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="relative"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 flex items-center justify-center shadow-xl border-4 border-white"
                      >
                        <Trophy className="h-16 w-16 text-white drop-shadow-lg" />
                      </motion.div>
                      
                      {/* Sparkle effects */}
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                          animate={{
                            scale: [0, 1.2, 0],
                            x: Math.cos((i * Math.PI) / 3) * 70,
                            y: Math.sin((i * Math.PI) / 3) * 70,
                            opacity: [0, 1, 0],
                          }}
                          transition={{ delay: 0.3, duration: 0.8 }}
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        >
                          <Sparkles className="h-5 w-5 text-amber-400" />
                        </motion.div>
                      ))}
                    </motion.div>

                    {/* Winner announcement */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="space-y-4"
                    >
                      <h2 className="text-xl font-serif text-amber-800">✨ Temos uma vencedora! ✨</h2>
                      
                      {/* Winner card */}
                      <div className="p-5 bg-gradient-to-br from-amber-50 to-white rounded-xl border border-amber-200 shadow-md space-y-3">
                        <div className="text-3xl font-bold text-amber-900 tracking-tight">
                          @{displayWinner.cart.live_customer?.instagram_handle?.replace(/^@/, '')}
                        </div>
                        {displayWinner.cart.bag_number && (
                          <div className="flex items-center justify-center gap-2 text-amber-700">
                            <ShoppingBag className="h-4 w-4" />
                            <span className="font-medium">Sacola #{String(displayWinner.cart.bag_number).padStart(3, '0')}</span>
                          </div>
                        )}
                      </div>

                      {/* Prize */}
                      <div className="flex items-center justify-center gap-2 text-lg">
                        <span className="text-2xl">🎁</span>
                        <span className="text-amber-800">
                          Ganhou: <strong className="text-amber-900">{displayWinner.gift.name}</strong>
                        </span>
                      </div>
                    </motion.div>

                    {/* Action buttons */}
                    <motion.div
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="flex flex-col gap-3"
                    >
                      <Button 
                        onClick={handleApplyPrize}
                        className="gap-2 px-8 bg-amber-600 hover:bg-amber-700 text-white shadow-lg"
                        size="lg"
                      >
                        <Gift className="h-4 w-4" />
                        Aplicar prêmio no carrinho
                      </Button>
                      <Button 
                        onClick={closeAnimation}
                        variant="ghost"
                        className="text-amber-700 hover:text-amber-900"
                      >
                        Fechar (não aplicar)
                      </Button>
                      <p className="text-xs text-amber-600/70">
                        O sorteio ficará como pendente na lista
                      </p>
                    </motion.div>
                  </motion.div>
                )}

                {/* PHASE: APPLYING PRIZE */}
                {rafflePhase === "applying_prize" && displayWinner && (
                  <motion.div
                    key="applying"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                  >
                    <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shadow-lg border-4 border-white">
                      <Loader2 className="h-14 w-14 text-amber-600 animate-spin" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-serif text-amber-900">Aplicando prêmio...</h2>
                      <p className="text-sm text-amber-700/70">Adicionando brinde ao carrinho</p>
                    </div>
                  </motion.div>
                )}

                {/* PHASE: DONE (prize applied successfully) */}
                {rafflePhase === "done" && displayWinner && (
                  <motion.div
                    key="done"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.3 }}
                    className="space-y-6"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.1 }}
                      className="w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center shadow-xl border-4 border-white"
                    >
                      <Check className="h-14 w-14 text-white" />
                    </motion.div>

                    <div className="space-y-4">
                      <h2 className="text-xl font-serif text-green-800">Prêmio aplicado! ✅</h2>
                      
                      <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                        <p className="text-green-800">
                          <strong>@{displayWinner.cart.live_customer?.instagram_handle?.replace(/^@/, '')}</strong>
                          {" "}ganhou{" "}
                          <strong>{displayWinner.gift.name}</strong>
                        </p>
                        <p className="text-sm text-green-600 mt-1">
                          O brinde foi adicionado ao carrinho e aparecerá na separação
                        </p>
                      </div>
                    </div>

                    <Button 
                      onClick={closeAnimation}
                      className="gap-2 px-8 bg-green-600 hover:bg-green-700 text-white shadow-lg"
                      size="lg"
                    >
                      <Check className="h-4 w-4" />
                      Fechar
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
