import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import {
  Archive,
  BadgeCheck,
  Brain,
  Crown,
  FileSpreadsheet,
  Gift,
  Image,
  LayoutDashboard,
  Link2,
  LogOut,
  Package,
  Radio,
  ShoppingBag,
  Sparkles,
  Tag,
  Ticket,
  UserCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ProductsManager } from "@/components/ProductsManager";
import { ProductCategoriesManager } from "@/components/ProductCategoriesManager";
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
import { cn } from "@/lib/utils";

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

type DashboardTabValue =
  | "overview"
  | "clientes"
  | "products"
  | "categories"
  | "orders"
  | "lives"
  | "cupons"
  | "promocoes"
  | "brindes"
  | "club"
  | "equipe"
  | "profiles"
  | "prints";

type SidebarItem = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  kind: "tab" | "route";
  value: string;
  showPrintCount?: boolean;
};

type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: "VISÃO GERAL",
    items: [{ id: "overview", label: "Dashboard", icon: LayoutDashboard, kind: "tab", value: "overview" }],
  },
  {
    title: "VENDAS",
    items: [
      { id: "orders", label: "Pedidos", icon: ShoppingBag, kind: "tab", value: "orders" },
      { id: "lives", label: "Lives", icon: Radio, kind: "tab", value: "lives" },
      { id: "cupons", label: "Cupons", icon: Ticket, kind: "tab", value: "cupons" },
      { id: "promocoes", label: "Promoções", icon: Tag, kind: "tab", value: "promocoes" },
      { id: "brindes", label: "Brindes", icon: Gift, kind: "tab", value: "brindes" },
    ],
  },
  {
    title: "CLIENTES",
    items: [
      { id: "clientes", label: "Clientes", icon: UserCheck, kind: "tab", value: "clientes" },
      { id: "rfv", label: "RFV", icon: Brain, kind: "route", value: "/dashboard/rfv" },
      { id: "club", label: "Club", icon: Crown, kind: "tab", value: "club" },
    ],
  },
  {
    title: "PRODUTOS",
    items: [
      { id: "products", label: "Produtos", icon: Package, kind: "tab", value: "products" },
      { id: "importar-estoque", label: "Estoque", icon: Archive, kind: "route", value: "/importar-estoque" },
      { id: "categorias", label: "Categorias", icon: BadgeCheck, kind: "tab", value: "categories" },
      { id: "prints", label: "Prints", icon: Image, kind: "tab", value: "prints", showPrintCount: true },
    ],
  },
  {
    title: "GESTÃO",
    items: [
      { id: "equipe", label: "Equipe", icon: UsersRound, kind: "tab", value: "equipe" },
      { id: "profiles", label: "Time & Acessos", icon: UsersRound, kind: "tab", value: "profiles" },
      { id: "consultora", label: "Consultoria IA", icon: Sparkles, kind: "route", value: "/dashboard/consultora" },
    ],
  },
];

const DASHBOARD_TAB_VALUES: DashboardTabValue[] = [
  "overview",
  "clientes",
  "products",
  "categories",
  "orders",
  "lives",
  "cupons",
  "promocoes",
  "brindes",
  "club",
  "equipe",
  "profiles",
  "prints",
];

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParamRaw = searchParams.get("tab");
  const tabParam = DASHBOARD_TAB_VALUES.includes(tabParamRaw as DashboardTabValue)
    ? (tabParamRaw as DashboardTabValue)
    : null;
  const filterParam = searchParams.get("filter");
  const [activeTab, setActiveTab] = useState<DashboardTabValue>(tabParam || "overview");

  // Sync tab with URL params
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [activeTab, tabParam]);

  const handleTabChange = (value: DashboardTabValue) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", value);

    if (value !== tabParam) {
      newParams.delete("filter");
    }

    setSearchParams(newParams);
  };

  const handleSidebarItemSelect = (item: SidebarItem) => {
    if (item.kind === "tab") {
      handleTabChange(item.value as DashboardTabValue);
      return;
    }

    navigate(item.value);
  };

  const handleMobileNavSelect = (value: string) => {
    if (value === "rfv") {
      navigate("/dashboard/rfv");
      return;
    }

    if (value === "consultora") {
      navigate("/dashboard/consultora");
      return;
    }

    if (DASHBOARD_TAB_VALUES.includes(value as DashboardTabValue)) {
      handleTabChange(value as DashboardTabValue);
    }
  };

  useEffect(() => {
    if (tabParamRaw === "rfv") {
      navigate("/dashboard/rfv", { replace: true });
      return;
    }

    if (tabParamRaw === "consultora") {
      navigate("/dashboard/consultora", { replace: true });
    }
  }, [navigate, tabParamRaw]);

  const [user, setUser] = useState<User | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [printRequests, setPrintRequests] = useState<PrintRequest[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedPrint, setSelectedPrint] = useState<PrintRequest | null>(null);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState("");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (!session) {
        navigate("/login");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
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

      const linkedProductIds = (printsData || []).filter((p) => p.linked_product_id).map((p) => p.linked_product_id);

      if (linkedProductIds.length > 0) {
        const { data: productsData } = await supabase
          .from("product_catalog")
          .select("id, name, image_url, price")
          .in("id", linkedProductIds);

        if (productsData) {
          const productsMap: Record<string, Product> = {};
          productsData.forEach((p) => {
            productsMap[p.id] = p;
          });
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
    const customer = customers.find((c) => c.id === print.customer_id);
    setSelectedPrint(print);
    setSelectedCustomerPhone(customer?.phone || "");
    setLinkModalOpen(true);
  };

  const isRouteItemActive = (item: SidebarItem) => {
    if (item.kind !== "route") return false;
    if (item.value === "/dashboard/rfv") return location.pathname.startsWith("/dashboard/rfv");
    if (item.value === "/dashboard/consultora") return location.pathname.startsWith("/dashboard/consultora");
    if (item.value === "/importar-estoque") return location.pathname.startsWith("/importar-estoque");
    return false;
  };

  if (!user) {
    return null;
  }

  return (
    <div className="admin-theme min-h-screen bg-[#f7f3e9] text-[#141414]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] border-r border-[#c8aa6a33] bg-[#102820] lg:flex lg:flex-col">
        <div className="px-5 pb-5 pt-6">
          <img src={logoLepoa} alt="Le.Poá" className="h-10 w-auto max-w-[170px] object-contain" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="px-2 pb-2 text-[11px] font-semibold tracking-[0.16em] text-[#d8c18f]">{section.title}</p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.kind === "tab" ? activeTab === item.value : isRouteItemActive(item);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSidebarItemSelect(item)}
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0b06b]/50",
                        isActive
                          ? "bg-[#17372e] font-medium text-[#f4e8c9]"
                          : "text-[#d6cab1] hover:bg-[#153129] hover:text-[#f4e8c9]"
                      )}
                    >
                      {isActive ? <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-[#d4b26f]" /> : null}
                      <Icon className={cn("h-4 w-4", isActive ? "text-[#f0dfb2]" : "text-[#bfae8b]")} />
                      <span className="truncate">{item.label}</span>
                      {item.showPrintCount ? (
                        <span className="ml-auto rounded-full border border-[#d4b26f66] bg-[#1a3a31] px-2 py-0.5 text-[11px] text-[#e8d7ad]">
                          {printRequests.length}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-30 border-b border-[#ceb98a66] bg-[#f7f3e9]/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <DashboardMobileNav
                activeTab={activeTab}
                onTabChange={handleMobileNavSelect}
                onLogout={handleLogout}
                onImportStock={() => navigate("/importar-estoque")}
                printCount={printRequests.length}
              />
              <img src={logoLepoa} alt="Le.Poá" className="h-8 w-auto object-contain lg:hidden" />
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/importar-estoque")}
                className="h-9 gap-2 border-[#c6ab73] bg-[#f9f3e4] text-[#2a2a2a] hover:border-[#b59657] hover:bg-[#f6edd8]"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">Importar Estoque</span>
              </Button>

              <div className="hidden items-center gap-2 rounded-md border border-[#d2be9366] bg-[#f9f4e7] px-3 py-1.5 text-sm text-[#3d3a33] sm:flex">
                <UserRound className="h-4 w-4 text-[#7b6a4a]" />
                <span className="max-w-[160px] truncate">{user.email}</span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-9 w-9 text-[#5c5345] hover:bg-[#efe4c9] hover:text-[#27231d]"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as DashboardTabValue)} className="space-y-5">
            <TabsContent value="overview">
              <DashboardOverviewV2 />
            </TabsContent>

            <TabsContent value="products">
              <ProductsManager userId={user.id} initialFilter={filterParam || undefined} />
            </TabsContent>

            <TabsContent value="categories">
              <ProductCategoriesManager userId={user.id} />
            </TabsContent>

            <TabsContent value="orders">
              <OrdersManager initialFilter={filterParam || undefined} />
            </TabsContent>

            <TabsContent value="prints">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {printRequests.map((print) => {
                  const customer = customers.find((c) => c.id === print.customer_id);
                  const linkedProduct = print.linked_product_id ? products[print.linked_product_id] : null;

                  return (
                    <div key={print.id} className="overflow-hidden rounded-xl border border-border bg-card">
                      <div className="aspect-square bg-secondary">
                        <img src={getImageUrl(print.image_path)} alt="Print do story" className="h-full w-full object-cover" />
                      </div>

                      <div className="space-y-3 p-4">
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              linkedProduct ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {linkedProduct ? "Vinculado" : "Pendente"}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDate(print.created_at)}</span>
                        </div>

                        <div className="space-y-1 text-sm">
                          <p>
                            <strong>Tel:</strong> {customer?.phone || "-"}
                          </p>
                          <p>
                            <strong>Tamanho:</strong> {print.size || "-"}
                          </p>
                          <p>
                            <strong>Preferência:</strong> {print.preference === "ajustado" ? "Mais ajustado" : "Mais soltinho"}
                          </p>
                        </div>

                        {linkedProduct ? (
                          <div className="rounded-lg bg-secondary/50 p-3">
                            <p className="mb-2 text-xs text-muted-foreground">Produto vinculado:</p>
                            <div className="flex items-center gap-3">
                              {linkedProduct.image_url ? (
                                <img
                                  src={linkedProduct.image_url}
                                  alt={linkedProduct.name}
                                  className="h-10 w-10 rounded object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded bg-secondary">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{linkedProduct.name}</p>
                                <p className="text-xs text-muted-foreground">{formatPrice(linkedProduct.price)}</p>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => handleOpenLinkModal(print)}>
                          <Link2 className="h-4 w-4" />
                          {linkedProduct ? "Alterar produto" : "Vincular a produto"}
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {printRequests.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-muted-foreground">Nenhum print recebido ainda.</div>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="clientes">
              <CustomersManagerV2 />
            </TabsContent>

            <TabsContent value="lives">
              <LiveEventsList />
            </TabsContent>

            <TabsContent value="cupons">
              <CouponsManager />
            </TabsContent>

            <TabsContent value="promocoes">
              <PromotionalTablesManager />
            </TabsContent>

            <TabsContent value="brindes">
              <GiftsTabs />
            </TabsContent>

            <TabsContent value="club">
              <LoyaltyClubAdmin />
            </TabsContent>

            <TabsContent value="equipe">
              <SellersManager />
            </TabsContent>

            <TabsContent value="profiles">
              <ProfileManager />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {selectedPrint ? (
        <PrintLinkProduct
          open={linkModalOpen}
          onOpenChange={setLinkModalOpen}
          print={selectedPrint}
          customerPhone={selectedCustomerPhone}
          onSuccess={loadData}
        />
      ) : null}
    </div>
  );
};

export default Dashboard;
