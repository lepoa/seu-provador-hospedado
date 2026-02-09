import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessageCircle, ShoppingBag, Sparkles, Camera, BookOpen, Radio, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// Customer detail components
import { CustomerHeader } from "@/components/customer-detail/CustomerHeader";
import { CustomerDataCard } from "@/components/customer-detail/CustomerDataCard";
import { StyleProfile } from "@/components/customer-detail/StyleProfile";
import { OrderHistory } from "@/components/customer-detail/OrderHistory";
import { CustomerPrints } from "@/components/customer-detail/CustomerPrints";
import { MessageTemplates } from "@/components/customer-detail/MessageTemplates";
import { CustomerLiveHistory } from "@/components/customer-detail/CustomerLiveHistory";
import { CustomerSalesReport } from "@/components/customer-detail/CustomerSalesReport";

// New CRM components
import { CustomerInspirationPhotos } from "@/components/crm/CustomerInspirationPhotos";
import { ProductSuggestionsWithStatus } from "@/components/crm/ProductSuggestionsWithStatus";
import { IncompleteRegistration } from "@/components/crm/IncompleteRegistration";
import { CustomerCatalogModal } from "@/components/crm/CustomerCatalogModal";

interface Customer {
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
  total_spent: number;
  last_order_at: string | null;
  user_id: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  address_reference: string | null;
  document: string | null; // CPF
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  status: string;
  total: number;
  created_at: string;
  delivery_method: string | null;
  shipping_service: string | null;
  tracking_code: string | null;
  customer_notes: string | null;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  size: string;
  quantity: number;
  color: string | null;
  image_url: string | null;
}

interface QuizResponse {
  id: string;
  question: string;
  answer: string;
  question_number: number;
  points: number | null;
}

interface PrintRequest {
  id: string;
  image_path: string;
  size: string | null;
  preference: string | null;
  status: string | null;
  created_at: string;
  linked_product_id: string | null;
}

interface ProfileData {
  style_title: string | null;
  style_description: string | null;
  color_palette: string[] | null;
  avoid_items: string[] | null;
  personal_tip: string | null;
  size_letter: string | null;
  size_number: string | null;
  quiz_points: number | null;
  quiz_level: number | null;
  quiz_completed_at: string | null;
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
  sizes: string[] | null;
  style: string | null;
  category: string | null;
  occasion: string | null;
  tags: string[] | null;
}

interface InspirationPhoto {
  id: string;
  image_url: string;
  is_starred: boolean;
  merchant_notes: string | null;
  source: string;
  created_at: string;
}

interface Suggestion {
  id: string;
  product_id: string;
  status: string;
  score: number;
  reasons: string[];
  product?: Product;
}

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isMerchant, rolesLoading } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [quizResponses, setQuizResponses] = useState<QuizResponse[]>([]);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [prints, setPrints] = useState<PrintRequest[]>([]);
  const [linkedProducts, setLinkedProducts] = useState<Record<string, Product>>({});
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [inspirationPhotos, setInspirationPhotos] = useState<InspirationPhoto[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);

  useEffect(() => {
    if (!rolesLoading && (!user || !isMerchant())) {
      navigate("/login");
    }
  }, [user, isMerchant, rolesLoading, navigate]);

  useEffect(() => {
    if (id && user) {
      loadCustomerData();
    }
  }, [id, user]);

  const loadCustomerData = async () => {
    if (!id) return;
    setIsLoading(true);

    try {
      // Load customer
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData as unknown as Customer);

      // Load orders by customer_id first, then by phone match
      const { data: ordersById } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });

      // Also search by phone for legacy orders without customer_id
      const customerPhone = customerData.phone?.replace(/\D/g, "");
      let additionalOrders: any[] = [];
      if (customerPhone) {
        const { data: ordersByPhone } = await supabase
          .from("orders")
          .select("*")
          .is("customer_id", null)
          .order("created_at", { ascending: false });

        additionalOrders = (ordersByPhone || []).filter((order) => {
          const orderPhone = order.customer_phone?.replace(/\D/g, "");
          return (
            orderPhone === customerPhone ||
            orderPhone?.endsWith(customerPhone) ||
            customerPhone?.endsWith(orderPhone)
          );
        });
      }

      // Merge and deduplicate
      const allOrders = [...(ordersById || []), ...additionalOrders];
      const uniqueOrderIds = new Set<string>();
      const uniqueOrders = allOrders.filter((o) => {
        if (uniqueOrderIds.has(o.id)) return false;
        uniqueOrderIds.add(o.id);
        return true;
      });

      // Load order items for each order
      const ordersWithItems: Order[] = [];
      for (const order of uniqueOrders) {
        const { data: items } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", order.id);

        ordersWithItems.push({
          ...order,
          items: items || [],
        });
      }
      setOrders(ordersWithItems);

      // Load quiz responses - try by customer_id first, then by user_id
      let quizData: any[] = [];
      const { data: quizByCustomer } = await supabase
        .from("quiz_responses")
        .select("*")
        .eq("customer_id", id)
        .order("question_number");

      if (quizByCustomer && quizByCustomer.length > 0) {
        quizData = quizByCustomer;
      } else if (customerData.user_id) {
        // Fallback: search by user_id if no responses found by customer_id
        const { data: quizByUser } = await supabase
          .from("quiz_responses")
          .select("*")
          .eq("user_id", customerData.user_id)
          .order("created_at", { ascending: false })
          .limit(10);
        
        quizData = quizByUser || [];
      }
      setQuizResponses(quizData);

      // Load profile data if user_id exists
      if (customerData.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("style_title, style_description, color_palette, avoid_items, personal_tip, size_letter, size_number, quiz_points, quiz_level, quiz_completed_at")
          .eq("user_id", customerData.user_id)
          .maybeSingle();

        if (profile) {
          setProfileData(profile as ProfileData);
        }
      }

      // Load prints by customer_id or user_id
      const printsQuery = supabase
        .from("print_requests")
        .select("*")
        .order("created_at", { ascending: false });

      // Build OR condition
      if (customerData.user_id) {
        const { data: printsData } = await printsQuery.or(
          `customer_id.eq.${id},user_id.eq.${customerData.user_id}`
        );
        setPrints(printsData || []);

        // Load linked products for prints
        const linkedIds = (printsData || [])
          .filter((p) => p.linked_product_id)
          .map((p) => p.linked_product_id!);

        if (linkedIds.length > 0) {
          const { data: linkedProductsData } = await supabase
            .from("product_catalog")
            .select("id, name, price, image_url")
            .in("id", linkedIds);

          const productsMap: Record<string, Product> = {};
          (linkedProductsData || []).forEach((p) => {
            productsMap[p.id] = p as Product;
          });
          setLinkedProducts(productsMap);
        }
      } else {
        const { data: printsData } = await printsQuery.eq("customer_id", id);
        setPrints(printsData || []);
      }

      // Load catalog for suggestions
      const { data: catalogData } = await supabase
        .from("product_catalog")
        .select("*")
        .eq("is_active", true);

      setCatalogProducts((catalogData || []) as Product[]);

      // Load inspiration photos
      const { data: photosData } = await supabase
        .from("customer_inspiration_photos")
        .select("*")
        .eq("customer_id", id)
        .order("is_starred", { ascending: false })
        .order("created_at", { ascending: false });

      setInspirationPhotos((photosData || []) as InspirationPhoto[]);

      // Load suggestions with products
      const { data: suggestionsData } = await supabase
        .from("customer_product_suggestions")
        .select("*")
        .eq("customer_id", id)
        .order("score", { ascending: false });

      if (suggestionsData && suggestionsData.length > 0) {
        // Get product details for suggestions
        const productIds = suggestionsData.map((s) => s.product_id);
        const { data: suggestedProducts } = await supabase
          .from("product_catalog")
          .select("*")
          .in("id", productIds);

        const productMap: Record<string, Product> = {};
        (suggestedProducts || []).forEach((p) => {
          productMap[p.id] = p as Product;
        });

        const suggestionsWithProducts: Suggestion[] = suggestionsData.map((s) => ({
          id: s.id,
          product_id: s.product_id,
          status: s.status || "nova",
          score: s.score,
          reasons: Array.isArray(s.reasons) ? s.reasons as string[] : [],
          product: productMap[s.product_id],
        }));

        setSuggestions(suggestionsWithProducts);
      }
    } catch (error) {
      console.error("Error loading customer data:", error);
      toast.error("Erro ao carregar dados do cliente");
    } finally {
      setIsLoading(false);
    }
  };

  const quizLink = `${window.location.origin}/quiz`;

  if (isLoading || rolesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">Cliente não encontrado</p>
          <Button onClick={() => navigate("/dashboard?tab=clientes")} className="mt-4">
            Voltar
          </Button>
        </main>
      </div>
    );
  }

  // Use profile data style if customer doesn't have one
  const effectiveStyleTitle = customer.style_title || profileData?.style_title;
  const effectiveSizeLetter = customer.size_letter || profileData?.size_letter;
  const effectiveSizeNumber = customer.size_number || profileData?.size_number;
  
  const hasQuiz = quizResponses.length > 0 || !!effectiveStyleTitle || !!profileData?.quiz_completed_at;
  const hasPrints = prints.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back button */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard?tab=clientes")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar para Clientes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCatalogModalOpen(true)}
            className="gap-1"
          >
            <BookOpen className="h-4 w-4" />
            Montar catálogo
          </Button>
        </div>

        {/* Customer Header with score */}
        <div className="mb-6">
          <CustomerHeader
            customer={{
              id: customer.id,
              phone: customer.phone,
              name: customer.name,
              email: customer.email,
              style_title: effectiveStyleTitle || null,
              size_letter: effectiveSizeLetter || null,
              size_number: effectiveSizeNumber || null,
              created_at: customer.created_at,
              total_orders: customer.total_orders || 0,
              total_spent: Number(customer.total_spent) || 0,
              last_order_at: customer.last_order_at,
            }}
            hasQuiz={hasQuiz}
            hasPrints={hasPrints}
          />
        </div>

        {/* Incomplete Registration Block */}
        <div className="mb-6">
          <IncompleteRegistration
            customer={{
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
              size_letter: effectiveSizeLetter || null,
              size_number: effectiveSizeNumber || null,
              address_line: customer.address_line,
              city: customer.city,
              state: customer.state,
              zip_code: customer.zip_code,
              address_reference: customer.address_reference,
              document: customer.document,
            }}
            onUpdate={loadCustomerData}
          />
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="vendas" className="space-y-6">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
            <TabsTrigger value="vendas" className="gap-1">
              <BarChart3 className="h-4 w-4" />
              Vendas
            </TabsTrigger>
            <TabsTrigger value="perfil" className="gap-1">
              <Sparkles className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-1">
              <ShoppingBag className="h-4 w-4" />
              Pedidos
              {orders.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {orders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inspiracoes" className="gap-1">
              <Camera className="h-4 w-4" />
              Inspirações
              {inspirationPhotos.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {inspirationPhotos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="prints" className="gap-1">
              <Camera className="h-4 w-4" />
              Prints
              {prints.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {prints.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sugestoes" className="gap-1">
              <Sparkles className="h-4 w-4" />
              Sugestões
              {suggestions.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {suggestions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="lives" className="gap-1">
              <Radio className="h-4 w-4" />
              Lives
            </TabsTrigger>
            <TabsTrigger value="mensagens" className="gap-1">
              <MessageCircle className="h-4 w-4" />
              Mensagens
            </TabsTrigger>
          </TabsList>

          {/* Vendas Tab - Consolidated Sales Report */}
          <TabsContent value="vendas">
            <CustomerSalesReport 
              customerId={customer.id} 
              customerPhone={customer.phone}
            />
          </TabsContent>

          {/* Perfil Tab - Style Profile */}
          <TabsContent value="perfil" className="space-y-6">
            {/* Customer Data Card - editable CPF and basic info */}
            <CustomerDataCard
              customer={{
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address_line: customer.address_line,
                city: customer.city,
                state: customer.state,
                zip_code: customer.zip_code,
                document: customer.document,
              }}
              onUpdate={loadCustomerData}
            />

            {/* Style Profile */}
            <StyleProfile
              customer={{
                name: customer.name,
                style_title: effectiveStyleTitle || null,
                size_letter: effectiveSizeLetter || null,
                size_number: effectiveSizeNumber || null,
              }}
              profileData={profileData}
              quizResponses={quizResponses}
              quizLink={quizLink}
            />
          </TabsContent>

          {/* Pedidos Tab */}
          <TabsContent value="pedidos">
            <OrderHistory orders={orders} />
          </TabsContent>

          {/* Inspirações Tab - Quiz Photos */}
          <TabsContent value="inspiracoes">
            <CustomerInspirationPhotos
              photos={inspirationPhotos}
              onPhotosUpdate={loadCustomerData}
            />
          </TabsContent>

          {/* Prints Tab */}
          <TabsContent value="prints">
            <CustomerPrints prints={prints} linkedProducts={linkedProducts} />
          </TabsContent>

          {/* Sugestões Tab - With Status */}
          <TabsContent value="sugestoes">
            <ProductSuggestionsWithStatus
              customerId={customer.id}
              customer={{
                name: customer.name,
                phone: customer.phone,
                style_title: effectiveStyleTitle || null,
                size_letter: effectiveSizeLetter || null,
                size_number: effectiveSizeNumber || null,
              }}
              suggestions={suggestions}
              onRefresh={loadCustomerData}
            />
          </TabsContent>

          {/* Lives Tab */}
          <TabsContent value="lives">
            <CustomerLiveHistory customerId={customer.id} />
          </TabsContent>

          {/* Mensagens Tab */}
          <TabsContent value="mensagens">
            <MessageTemplates
              customer={{
                name: customer.name,
                size_letter: effectiveSizeLetter || null,
                size_number: effectiveSizeNumber || null,
              }}
              quizLink={quizLink}
              lastOrderId={orders[0]?.id}
              lastOrderStatus={orders[0]?.status}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Catalog Modal */}
      <CustomerCatalogModal
        open={catalogModalOpen}
        onClose={() => setCatalogModalOpen(false)}
        customerId={customer.id}
        customerName={customer.name}
        customerPhone={customer.phone}
        customerStyle={effectiveStyleTitle || null}
        customerSizeLetter={effectiveSizeLetter || null}
        customerSizeNumber={effectiveSizeNumber || null}
        availableProducts={catalogProducts}
      />
    </div>
  );
};

export default CustomerDetail;
