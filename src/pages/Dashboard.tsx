import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { User, Session } from "@supabase/supabase-js";
import {
  Users,
  Image,
  LogOut,
  Package,
  Link2,
  FileSpreadsheet,
  ShoppingBag,
  UserCheck,
  Radio,
  Ticket,
  LayoutDashboard,
  UsersRound,
  Crown,
  Gift,
  RefreshCw,
  Tag,
  Brain,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ProductsManager } from "@/components/ProductsManager";
import { PrintLinkProduct } from "@/components/PrintLinkProduct";
import { OrdersManager } from "@/components/OrdersManager";
import { CustomersManagerV2 } from "@/components/crm/CustomersManagerV2";
import { LiveEventsList } from "@/components/live-shop/LiveEventsList";
import { CouponsManager } from "@/components/CouponsManager";
import { DashboardOverviewV2 } from "@/components/dashboard/DashboardOverviewV2";
import { DashboardMobileNav } from "@/components/dashboard/DashboardMobileNav";
import { SellersManager } from "@/components/SellersManager";
import { GiftsTabs } from "@/components/gifts/GiftsTabs";
import { LoyaltyClubAdmin } from "@/components/admin/LoyaltyClubAdmin";
import { PromotionalTablesManager } from "@/components/promotions/PromotionalTablesManager";
import { ProfileManager } from "@/components/admin/ProfileManager";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import logoLepoa from "@/assets/logo-lepoa.png";

interface Customer {
  id: string;
  phone: string;
  name: string | null;
  size: string | null;
  style_title: string | null;
  created_at: string;
}

interface PrintRequest {
  id: string;
  customer_id: string;
  image_path: string;
  size: string | null;
  preference: string | null;
  status: string;
  created_at: string;
  linked_product_id: string | null;
  response_sent: boolean | null;
}

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const filterParam = searchParams.get("filter");
  const [activeTab, setActiveTab] = useState(tabParam || "overview");

  // Sync tab with URL params
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (value: string) => {
    if (value === "rfv") {
      navigate("/dashboard/rfv");
      return;
    }

    if (value === "consultora") {
      navigate("/dashboard/consultora");
      return;
    }

    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", value);
    // Clear filter when changing tabs
    if (value !== tabParam) {
      newParams.delete("filter");
    }
    setSearchParams(newParams);
  };

  useEffect(() => {
    if (tabParam === "rfv") {
      navigate("/dashboard/rfv", { replace: true });
      return;
    }

    if (tabParam === "consultora") {
      navigate("/dashboard/consultora", { replace: true });
    }
  }, [navigate, tabParam]);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [printRequests, setPrintRequests] = useState<PrintRequest[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedPrint, setSelectedPrint] = useState<PrintRequest | null>(null);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (!session) {
          navigate("/login");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (customersError) throw customersError;
      setCustomers(customersData || []);

      const { data: printsData, error: printsError } = await supabase
        .from("print_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (printsError) throw printsError;
      setPrintRequests(printsData || []);

      const linkedProductIds = (printsData || [])
        .filter(p => p.linked_product_id)
        .map(p => p.linked_product_id);

      if (linkedProductIds.length > 0) {
        const { data: productsData } = await supabase
          .from("product_catalog")
          .select("id, name, image_url, price")
          .in("id", linkedProductIds);

        if (productsData) {
          const productsMap: Record<string, Product> = {};
          productsData.forEach(p => { productsMap[p.id] = p; });
          setProducts(productsMap);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from("prints").getPublicUrl(path);
    return data.publicUrl;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const handleOpenLinkModal = (print: PrintRequest) => {
    const customer = customers.find(c => c.id === print.customer_id);
    setSelectedPrint(print);
    setSelectedCustomerPhone(customer?.phone || "");
    setLinkModalOpen(true);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden w-full max-w-full">
      {/* Custom Header for Dashboard */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Mobile Nav */}
            <DashboardMobileNav
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onLogout={handleLogout}
              onImportStock={() => navigate("/importar-estoque")}
              printCount={printRequests.length}
            />
            <img src={logoLepoa} alt="LE.POÁ" className="h-6 sm:h-8 shrink-0 max-w-[100px]" />
            <div className="hidden md:block h-6 w-px bg-border" />
            <span className="hidden md:block text-sm font-medium text-muted-foreground truncate">
              Painel de Controle
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button variant="outline" onClick={() => navigate("/importar-estoque")} size="sm" className="gap-2 hidden sm:flex h-9">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden lg:inline">Importar Estoque</span>
            </Button>
            <Button variant="ghost" onClick={handleLogout} size="sm" className="gap-2 hidden md:flex h-9">
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 overflow-x-hidden w-full">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 sm:space-y-6">
          {/* Desktop Tabs - Hidden on mobile */}
          <TabsList className="hidden md:flex flex-wrap bg-muted/50 p-1">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="clientes" className="gap-2">
              <UserCheck className="h-4 w-4" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="lives" className="gap-2">
              <Radio className="h-4 w-4" />
              Lives
            </TabsTrigger>
            <TabsTrigger value="cupons" className="gap-2">
              <Ticket className="h-4 w-4" />
              Cupons
            </TabsTrigger>
            <TabsTrigger value="promocoes" className="gap-2">
              <Tag className="h-4 w-4" />
              Promoções
            </TabsTrigger>
            <TabsTrigger value="brindes" className="gap-2">
              <Gift className="h-4 w-4" />
              Brindes
            </TabsTrigger>
            <TabsTrigger value="club" className="gap-2">
              <Crown className="h-4 w-4" />
              Club
            </TabsTrigger>
            <TabsTrigger value="rfv" className="gap-2">
              <Brain className="h-4 w-4" />
              RFV
            </TabsTrigger>
            <TabsTrigger value="consultora" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Consultora IA
            </TabsTrigger>
            <TabsTrigger value="equipe" className="gap-2">
              <UsersRound className="h-4 w-4" />
              Equipe
            </TabsTrigger>
            <TabsTrigger value="profiles" className="gap-2">
              <UsersRound className="h-4 w-4" />
              Time e Acessos
            </TabsTrigger>
            <TabsTrigger value="prints" className="gap-2">

              <Image className="h-4 w-4" />
              Prints ({printRequests.length})
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - V2 */}
          <TabsContent value="overview">
            <DashboardOverviewV2 />
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <ProductsManager userId={user.id} initialFilter={filterParam || undefined} />
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <OrdersManager initialFilter={filterParam || undefined} />
          </TabsContent>

          {/* Prints Tab */}
          <TabsContent value="prints">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {printRequests.map((print) => {
                const customer = customers.find(c => c.id === print.customer_id);
                const linkedProduct = print.linked_product_id ? products[print.linked_product_id] : null;

                return (
                  <div key={print.id} className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="aspect-square bg-secondary">
                      <img
                        src={getImageUrl(print.image_path)}
                        alt="Print do story"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded-full ${linkedProduct
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                          }`}>
                          {linkedProduct ? "Vinculado" : "Pendente"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(print.created_at)}
                        </span>
                      </div>

                      <div className="text-sm space-y-1">
                        <p><strong>Tel:</strong> {customer?.phone || "-"}</p>
                        <p><strong>Tamanho:</strong> {print.size || "-"}</p>
                        <p><strong>Preferência:</strong> {print.preference === "ajustado" ? "Mais ajustado" : "Mais soltinho"}</p>
                      </div>

                      {linkedProduct && (
                        <div className="p-3 bg-secondary/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-2">Produto vinculado:</p>
                          <div className="flex items-center gap-3">
                            {linkedProduct.image_url ? (
                              <img
                                src={linkedProduct.image_url}
                                alt={linkedProduct.name}
                                className="w-10 h-10 object-cover rounded"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-secondary rounded flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{linkedProduct.name}</p>
                              <p className="text-xs text-muted-foreground">{formatPrice(linkedProduct.price)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => handleOpenLinkModal(print)}
                      >
                        <Link2 className="h-4 w-4" />
                        {linkedProduct ? "Alterar produto" : "Vincular a produto"}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {printRequests.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  Nenhum print recebido ainda.
                </div>
              )}
            </div>
          </TabsContent>

          {/* Clientes Tab */}
          <TabsContent value="clientes">
            <CustomersManagerV2 />
          </TabsContent>

          {/* Lives Tab */}
          <TabsContent value="lives">
            <LiveEventsList />
          </TabsContent>

          {/* Cupons Tab */}
          <TabsContent value="cupons">
            <CouponsManager />
          </TabsContent>

          {/* Promoções Tab */}
          <TabsContent value="promocoes">
            <PromotionalTablesManager />
          </TabsContent>

          {/* Brindes Tab */}
          <TabsContent value="brindes">
            <GiftsTabs />
          </TabsContent>

          {/* Club Tab */}
          <TabsContent value="club">
            <LoyaltyClubAdmin />
          </TabsContent>

          {/* Equipe Tab */}
          <TabsContent value="equipe">
            <SellersManager />
          </TabsContent>

          {/* Profiles Tab */}
          <TabsContent value="profiles">
            <ProfileManager />
          </TabsContent>

        </Tabs>
      </main>

      {/* Print Link Modal */}
      {selectedPrint && (
        <PrintLinkProduct
          open={linkModalOpen}
          onOpenChange={setLinkModalOpen}
          print={selectedPrint}
          customerPhone={selectedCustomerPhone}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};

export default Dashboard;
