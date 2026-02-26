import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import RuntimeLoggerPanel from "@/components/RuntimeLoggerPanel";
import { FloatingAtelierChat } from "@/components/home/FloatingAtelierChat";
import { CartProvider } from "@/contexts/CartContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ComponentType, LazyExoticComponent, Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { runtimeLog } from "@/lib/runtimeLogger";

const Index = lazy(() => import("./pages/Index"));
const MeuEstilo = lazy(() => import("./pages/MeuEstilo"));
const QuizV2 = lazy(() => import("./pages/QuizV2"));
const QuizResultV2 = lazy(() => import("./pages/QuizResultV2"));
const MissionQuiz = lazy(() => import("./pages/MissionQuiz"));
const PrintStory = lazy(() => import("./pages/PrintStory"));
const Login = lazy(() => import("./pages/Login"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const EsqueciSenha = lazy(() => import("./pages/EsqueciSenha"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));
const ResetarSenha = lazy(() => import("./pages/ResetarSenha"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Catalog = lazy(() => import("./pages/Catalog"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const ImportarEstoque = lazy(() => import("./pages/ImportarEstoque"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const CatalogView = lazy(() => import("./pages/CatalogView"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MinhaConta = lazy(() => import("./pages/conta/MinhaConta"));
const AccountOverview = lazy(() => import("./pages/conta/AccountOverview"));
const LepoaClub = lazy(() => import("./pages/conta/LepoaClub"));
const Missions = lazy(() => import("./pages/conta/Missions"));
const MeusPedidos = lazy(() => import("./pages/conta/MeusPedidos"));
const PedidoDetalhe = lazy(() => import("./pages/conta/PedidoDetalhe"));
const MeusPrints = lazy(() => import("./pages/conta/MeusPrints"));
const MeuPerfil = lazy(() => import("./pages/conta/MeuPerfil"));
const MinhasSugestoes = lazy(() => import("./pages/conta/MinhasSugestoes"));
const MeusFavoritos = lazy(() => import("./pages/conta/MeusFavoritos"));
const PedidoSucesso = lazy(() => import("./pages/PedidoSucesso"));
const PedidoPendente = lazy(() => import("./pages/PedidoPendente"));
const PedidoErro = lazy(() => import("./pages/PedidoErro"));
const LivePlanningPage = lazy(() => import("./pages/LivePlanningPage"));
const LiveBackstagePage = lazy(() => import("./pages/LiveBackstagePage"));
const LiveReportsPage = lazy(() => import("./pages/LiveReportsPage"));
const LiveReportsPeriodPage = lazy(() => import("./pages/LiveReportsPeriodPage"));
const LiveSeparationPage = lazy(() => import("./pages/LiveSeparationPage"));
const LiveCheckout = lazy(() => import("./pages/LiveCheckout"));
const BagDetails = lazy(() => import("./pages/BagDetails"));
const BagTrackerPage = lazy(() => import("./pages/BagTrackerPage"));
const LiveOrdersPage = lazy(() => import("./pages/LiveOrdersPage"));
const LivePendenciasPage = lazy(() => import("./pages/LivePendenciasPage"));
const InsightsPage = lazy(() => import("./pages/InsightsPage"));
const CopilotoRFV = lazy(() => import("./pages/CopilotoRFV"));
const DashboardConsultoraPage = lazy(() => import("./pages/DashboardConsultoraPage"));
const ClientesRankingPage = lazy(() => import("./pages/ClientesRankingPage"));

const queryClient = new QueryClient();

const routeFallback = (
  <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
    Carregando...
  </div>
);

const withRouteSuspense = <T extends ComponentType<any>>(Component: LazyExoticComponent<T>) => (
  <Suspense fallback={routeFallback}>
    <Component />
  </Suspense>
);

const RouteChangeLogger = () => {
  const location = useLocation();

  useEffect(() => {
    runtimeLog("navigation", "route-change", {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    });
  }, [location.pathname, location.search, location.hash]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CartProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RouteChangeLogger />
          <Routes>
            <Route path="/" element={withRouteSuspense(Index)} />
            <Route path="/meu-estilo" element={withRouteSuspense(MeuEstilo)} />
            <Route path="/quiz" element={withRouteSuspense(QuizV2)} />
            <Route path="/resultado/:customerId" element={withRouteSuspense(QuizResultV2)} />
            <Route path="/missao/:missionId" element={withRouteSuspense(MissionQuiz)} />
            <Route path="/enviar-print" element={withRouteSuspense(PrintStory)} />
            <Route path="/print-story" element={<Navigate to="/enviar-print" replace />} />
            <Route path="/buscar-por-foto" element={<Navigate to="/enviar-print" replace />} />
            
            {/* Customer account routes */}
            <Route path="/entrar" element={withRouteSuspense(Auth)} />
            <Route path="/auth/callback" element={withRouteSuspense(AuthCallback)} />
            <Route path="/esqueci-senha" element={withRouteSuspense(EsqueciSenha)} />
            <Route path="/redefinir-senha" element={withRouteSuspense(RedefinirSenha)} />
            <Route path="/resetar-senha" element={withRouteSuspense(ResetarSenha)} />
            <Route path="/minha-conta" element={withRouteSuspense(AccountOverview)} />
            <Route path="/minha-conta/club" element={withRouteSuspense(LepoaClub)} />
            <Route path="/minha-conta/missoes" element={withRouteSuspense(Missions)} />
            <Route path="/minha-conta/auth" element={withRouteSuspense(MinhaConta)} />
            <Route path="/meus-pedidos" element={withRouteSuspense(MeusPedidos)} />
            <Route path="/meus-pedidos/:id" element={withRouteSuspense(PedidoDetalhe)} />
            <Route path="/meus-prints" element={withRouteSuspense(MeusPrints)} />
            <Route path="/meu-perfil" element={withRouteSuspense(MeuPerfil)} />
            <Route path="/minhas-sugestoes" element={withRouteSuspense(MinhasSugestoes)} />
            <Route path="/meus-favoritos" element={withRouteSuspense(MeusFavoritos)} />
            
            {/* Hidden merchant routes - no public links */}
            <Route path="/login" element={withRouteSuspense(Login)} />
            <Route path="/area-lojista" element={withRouteSuspense(Login)} />
            <Route path="/dashboard" element={withRouteSuspense(Dashboard)} />
            <Route path="/dashboard/clientes/:id" element={withRouteSuspense(CustomerDetail)} />
            <Route path="/dashboard/lives/relatorio" element={withRouteSuspense(LiveReportsPeriodPage)} />
            <Route path="/dashboard/lives/rastreador" element={withRouteSuspense(BagTrackerPage)} />
            <Route path="/dashboard/lives/:eventId/planejar" element={withRouteSuspense(LivePlanningPage)} />
            <Route path="/dashboard/lives/:eventId/backstage" element={withRouteSuspense(LiveBackstagePage)} />
            <Route path="/dashboard/lives/:eventId/relatorio" element={withRouteSuspense(LiveReportsPage)} />
            <Route path="/dashboard/lives/:eventId/pedidos" element={withRouteSuspense(LiveOrdersPage)} />
            <Route path="/dashboard/lives/:eventId/pendencias" element={withRouteSuspense(LivePendenciasPage)} />
            <Route path="/dashboard/lives/:eventId/separacao" element={withRouteSuspense(LiveSeparationPage)} />
            <Route path="/dashboard/insights" element={withRouteSuspense(InsightsPage)} />
            <Route path="/dashboard/rfv" element={withRouteSuspense(CopilotoRFV)} />
            <Route path="/dashboard/consultora" element={withRouteSuspense(DashboardConsultoraPage)} />
            <Route path="/clientes/ranking" element={withRouteSuspense(ClientesRankingPage)} />
            <Route path="/importar-estoque" element={withRouteSuspense(ImportarEstoque)} />
            
            {/* E-commerce routes */}
            <Route path="/catalogo" element={withRouteSuspense(Catalog)} />
            <Route path="/produto/:productId" element={withRouteSuspense(ProductDetail)} />
            <Route path="/carrinho" element={withRouteSuspense(Cart)} />
            <Route path="/checkout" element={withRouteSuspense(Checkout)} />
            
            {/* Payment result pages */}
            <Route path="/pedido/sucesso" element={withRouteSuspense(PedidoSucesso)} />
            <Route path="/pedido/pendente" element={withRouteSuspense(PedidoPendente)} />
            <Route path="/pedido/erro" element={withRouteSuspense(PedidoErro)} />
            
            {/* Live checkout (public) */}
            <Route path="/live-checkout/:cartId" element={withRouteSuspense(LiveCheckout)} />
            
            {/* Bag details (public - for QR code) */}
            <Route path="/sacola/:bagId" element={withRouteSuspense(BagDetails)} />
            
            {/* Public catalog view */}
            <Route path="/c/:link" element={withRouteSuspense(CatalogView)} />
            
            <Route path="*" element={withRouteSuspense(NotFound)} />
          </Routes>
          <FloatingAtelierChat />
          <RuntimeLoggerPanel />
        </BrowserRouter>
      </TooltipProvider>
    </CartProvider>
  </QueryClientProvider>
);

export default App;
