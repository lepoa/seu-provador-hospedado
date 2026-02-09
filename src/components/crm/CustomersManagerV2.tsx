import { useState, useEffect } from "react";
import { Users, Loader2 } from "lucide-react";
import { CustomerCard } from "@/components/crm/CustomerCard";
import { CustomerFilters } from "@/components/crm/CustomerFilters";
import { CustomerCatalogModal } from "@/components/crm/CustomerCatalogModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CustomerWithStats {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  size: string | null;
  size_letter: string | null;
  size_number: string | null;
  style_title: string | null;
  created_at: string;
  total_orders: number;
  last_order_at: string | null;
  total_spent: number;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  user_id: string | null;
  document: string | null; // CPF
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  images: string[] | null;
  main_image_index: number | null;
  stock_by_size: Record<string, number> | null;
  color: string | null;
  category: string | null;
}

export function CustomersManagerV2() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [styleFilter, setStyleFilter] = useState("_all");
  const [sizeFilter, setSizeFilter] = useState("_all");
  
  // Catalog modal state
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [selectedCustomerForCatalog, setSelectedCustomerForCatalog] = useState<CustomerWithStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [customersResult, productsResult] = await Promise.all([
        supabase
          .from("customers")
          .select("*")
          .order("last_order_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("product_catalog")
          .select("id, name, price, image_url, images, main_image_index, stock_by_size, color, category")
          .eq("is_active", true),
      ]);

      if (customersResult.error) throw customersResult.error;
      if (productsResult.error) throw productsResult.error;

      // Map customers
      const enrichedCustomers: CustomerWithStats[] = (customersResult.data || []).map((c: any) => ({
        id: c.id,
        phone: c.phone,
        name: c.name,
        email: c.email,
        size: c.size,
        size_letter: c.size_letter,
        size_number: c.size_number,
        style_title: c.style_title,
        created_at: c.created_at,
        total_orders: c.total_orders || 0,
        last_order_at: c.last_order_at,
        total_spent: Number(c.total_spent) || 0,
        address_line: c.address_line,
        city: c.city,
        state: c.state,
        zip_code: c.zip_code,
        user_id: c.user_id,
        document: c.document,
      }));

      // Sort by activity
      enrichedCustomers.sort((a, b) => {
        if (a.last_order_at && b.last_order_at) {
          return new Date(b.last_order_at).getTime() - new Date(a.last_order_at).getTime();
        }
        if (a.last_order_at) return -1;
        if (b.last_order_at) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setCustomers(enrichedCustomers);
      setProducts((productsResult.data || []) as Product[]);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique styles for filter
  const availableStyles = [...new Set(customers.map((c) => c.style_title).filter(Boolean) as string[])];

  // Check if customer has complete registration
  const isComplete = (c: CustomerWithStats) => {
    const fields = [c.name, c.phone, c.email, c.size_letter || c.size_number, c.address_line, c.city, c.zip_code];
    return fields.filter(Boolean).length === fields.length;
  };

  // Filter customers
  const filteredCustomers = customers.filter((c) => {
    // Text search
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      c.name?.toLowerCase().includes(searchLower) ||
      c.phone?.includes(search) ||
      c.style_title?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // Quick filter
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    switch (filter) {
      case "incomplete":
        if (isComplete(c)) return false;
        break;
      case "has_orders":
        if (c.total_orders === 0) return false;
        break;
      case "no_orders":
        if (c.total_orders > 0) return false;
        break;
      case "has_quiz":
        if (!c.style_title) return false;
        break;
      case "no_quiz":
        if (c.style_title) return false;
        break;
      case "recent":
        const recentDate = c.last_order_at || c.created_at;
        if (new Date(recentDate) < sevenDaysAgo) return false;
        break;
    }

    // Style filter
    if (styleFilter !== "_all" && c.style_title !== styleFilter) return false;

    // Size filter
    if (sizeFilter !== "_all") {
      const matchesSize =
        c.size_letter?.toLowerCase() === sizeFilter.toLowerCase() ||
        c.size_number === sizeFilter;
      if (!matchesSize) return false;
    }

    return true;
  });

  const openCatalogModal = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setSelectedCustomerForCatalog(customer);
      setCatalogModalOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <CustomerFilters
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        styleFilter={styleFilter}
        onStyleFilterChange={setStyleFilter}
        sizeFilter={sizeFilter}
        onSizeFilterChange={setSizeFilter}
        totalCount={customers.length}
        filteredCount={filteredCustomers.length}
        availableStyles={availableStyles}
      />

      {/* Customer Cards Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>
            {search || filter !== "all" || styleFilter !== "_all" || sizeFilter !== "_all"
              ? "Nenhum cliente encontrado com esses filtros"
              : "Nenhum cliente cadastrado ainda"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onOpenCatalog={openCatalogModal}
            />
          ))}
        </div>
      )}

      {/* Catalog Modal */}
      {selectedCustomerForCatalog && (
        <CustomerCatalogModal
          open={catalogModalOpen}
          onClose={() => {
            setCatalogModalOpen(false);
            setSelectedCustomerForCatalog(null);
          }}
          customerId={selectedCustomerForCatalog.id}
          customerName={selectedCustomerForCatalog.name}
          customerPhone={selectedCustomerForCatalog.phone}
          customerStyle={selectedCustomerForCatalog.style_title}
          customerSizeLetter={selectedCustomerForCatalog.size_letter}
          customerSizeNumber={selectedCustomerForCatalog.size_number}
          availableProducts={products}
        />
      )}
    </div>
  );
}
