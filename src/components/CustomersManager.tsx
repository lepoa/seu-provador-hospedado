import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  Search, 
  ChevronRight,
  ShoppingBag,
  Sparkles,
  Phone
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CustomerWithStats {
  id: string;
  phone: string;
  name: string | null;
  size: string | null;
  style_title: string | null;
  created_at: string;
  total_orders: number;
  last_order_at: string | null;
  total_spent: number;
}

export function CustomersManager() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      // Load customers with stats (now stored directly in the table)
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .order("last_order_at", { ascending: false, nullsFirst: false });

      if (customersError) throw customersError;

      // Map to expected interface
      const enrichedCustomers: CustomerWithStats[] = (customersData || []).map((c) => ({
        id: c.id,
        phone: c.phone,
        name: c.name,
        size: c.size,
        style_title: c.style_title,
        created_at: c.created_at,
        total_orders: c.total_orders || 0,
        last_order_at: c.last_order_at,
        total_spent: Number(c.total_spent) || 0,
      }));

      // Already sorted by last_order_at from DB query, but keep secondary sort
      enrichedCustomers.sort((a, b) => {
        if (a.last_order_at && b.last_order_at) {
          return new Date(b.last_order_at).getTime() - new Date(a.last_order_at).getTime();
        }
        if (a.last_order_at) return -1;
        if (b.last_order_at) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setCustomers(enrichedCustomers);
    } catch (error) {
      console.error("Error loading customers:", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 13 && digits.startsWith("55")) {
      return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    return phone;
  };

  const filteredCustomers = customers.filter((c) => {
    const searchLower = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(searchLower) ||
      c.phone?.includes(search) ||
      c.style_title?.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou estilo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" />
          {customers.length} clientes
        </Badge>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Estilo</TableHead>
              <TableHead className="text-center">Pedidos</TableHead>
              <TableHead className="text-right">Total gasto</TableHead>
              <TableHead>Último pedido</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.map((customer) => (
              <TableRow 
                key={customer.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/dashboard/clientes/${customer.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <span className="text-xs font-medium">
                        {(customer.name || customer.phone)?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <span className="font-medium">
                      {customer.name || "Sem nome"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span className="text-sm">{formatPhone(customer.phone)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {customer.style_title ? (
                    <Badge variant="outline" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      {customer.style_title}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {customer.total_orders > 0 ? (
                    <Badge variant="secondary" className="gap-1">
                      <ShoppingBag className="h-3 w-3" />
                      {customer.total_orders}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {customer.total_spent > 0 
                    ? formatPrice(customer.total_spent) 
                    : "-"
                  }
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(customer.last_order_at)}
                </TableCell>
                <TableCell>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
            {filteredCustomers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {search 
                    ? "Nenhum cliente encontrado com essa busca" 
                    : "Nenhum cliente cadastrado ainda"
                  }
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
