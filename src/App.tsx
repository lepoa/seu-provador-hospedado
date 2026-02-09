import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index";
import MeuEstilo from "./pages/MeuEstilo";
import QuizV2 from "./pages/QuizV2";
import QuizResultV2 from "./pages/QuizResultV2";
import MissionQuiz from "./pages/MissionQuiz";
import PrintStory from "./pages/PrintStory";
import Login from "./pages/Login";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import EsqueciSenha from "./pages/EsqueciSenha";
import RedefinirSenha from "./pages/RedefinirSenha";
import ResetarSenha from "./pages/ResetarSenha";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import ImportarEstoque from "./pages/ImportarEstoque";
import CustomerDetail from "./pages/CustomerDetail";
import CatalogView from "./pages/CatalogView";
import NotFound from "./pages/NotFound";
// Customer account pages
import MinhaConta from "./pages/conta/MinhaConta";
import AccountOverview from "./pages/conta/AccountOverview";
import LepoaClub from "./pages/conta/LepoaClub";
import Missions from "./pages/conta/Missions";
import MeusPedidos from "./pages/conta/MeusPedidos";
import PedidoDetalhe from "./pages/conta/PedidoDetalhe";
import MeusPrints from "./pages/conta/MeusPrints";
import MeuPerfil from "./pages/conta/MeuPerfil";
import MinhasSugestoes from "./pages/conta/MinhasSugestoes";
import MeusFavoritos from "./pages/conta/MeusFavoritos";
// Payment result pages
import PedidoSucesso from "./pages/PedidoSucesso";
import PedidoPendente from "./pages/PedidoPendente";
import PedidoErro from "./pages/PedidoErro";
// Live Shop pages
import LivePlanningPage from "./pages/LivePlanningPage";
import LiveBackstagePage from "./pages/LiveBackstagePage";
import LiveReportsPage from "./pages/LiveReportsPage";
import LiveReportsPeriodPage from "./pages/LiveReportsPeriodPage";
import LiveSeparationPage from "./pages/LiveSeparationPage";
import LiveCheckout from "./pages/LiveCheckout";
import BagDetails from "./pages/BagDetails";
import BagTrackerPage from "./pages/BagTrackerPage";
import LiveOrdersPage from "./pages/LiveOrdersPage";
import LivePendenciasPage from "./pages/LivePendenciasPage";
import InsightsPage from "./pages/InsightsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CartProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/meu-estilo" element={<MeuEstilo />} />
            <Route path="/quiz" element={<QuizV2 />} />
            <Route path="/resultado/:customerId" element={<QuizResultV2 />} />
            <Route path="/missao/:missionId" element={<MissionQuiz />} />
            <Route path="/enviar-print" element={<PrintStory />} />
            <Route path="/print-story" element={<Navigate to="/enviar-print" replace />} />
            <Route path="/buscar-por-foto" element={<Navigate to="/enviar-print" replace />} />
            
            {/* Customer account routes */}
            <Route path="/entrar" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />
            <Route path="/resetar-senha" element={<ResetarSenha />} />
            <Route path="/minha-conta" element={<AccountOverview />} />
            <Route path="/minha-conta/club" element={<LepoaClub />} />
            <Route path="/minha-conta/missoes" element={<Missions />} />
            <Route path="/minha-conta/auth" element={<MinhaConta />} />
            <Route path="/meus-pedidos" element={<MeusPedidos />} />
            <Route path="/meus-pedidos/:id" element={<PedidoDetalhe />} />
            <Route path="/meus-prints" element={<MeusPrints />} />
            <Route path="/meu-perfil" element={<MeuPerfil />} />
            <Route path="/minhas-sugestoes" element={<MinhasSugestoes />} />
            <Route path="/meus-favoritos" element={<MeusFavoritos />} />
            
            {/* Hidden merchant routes - no public links */}
            <Route path="/login" element={<Login />} />
            <Route path="/area-lojista" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/clientes/:id" element={<CustomerDetail />} />
            <Route path="/dashboard/lives/relatorio" element={<LiveReportsPeriodPage />} />
            <Route path="/dashboard/lives/rastreador" element={<BagTrackerPage />} />
            <Route path="/dashboard/lives/:eventId/planejar" element={<LivePlanningPage />} />
            <Route path="/dashboard/lives/:eventId/backstage" element={<LiveBackstagePage />} />
            <Route path="/dashboard/lives/:eventId/relatorio" element={<LiveReportsPage />} />
            <Route path="/dashboard/lives/:eventId/pedidos" element={<LiveOrdersPage />} />
            <Route path="/dashboard/lives/:eventId/pendencias" element={<LivePendenciasPage />} />
            <Route path="/dashboard/lives/:eventId/separacao" element={<LiveSeparationPage />} />
            <Route path="/dashboard/insights" element={<InsightsPage />} />
            <Route path="/importar-estoque" element={<ImportarEstoque />} />
            
            {/* E-commerce routes */}
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/produto/:productId" element={<ProductDetail />} />
            <Route path="/carrinho" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            
            {/* Payment result pages */}
            <Route path="/pedido/sucesso" element={<PedidoSucesso />} />
            <Route path="/pedido/pendente" element={<PedidoPendente />} />
            <Route path="/pedido/erro" element={<PedidoErro />} />
            
            {/* Live checkout (public) */}
            <Route path="/live-checkout/:cartId" element={<LiveCheckout />} />
            
            {/* Bag details (public - for QR code) */}
            <Route path="/sacola/:bagId" element={<BagDetails />} />
            
            {/* Public catalog view */}
            <Route path="/c/:link" element={<CatalogView />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </CartProvider>
  </QueryClientProvider>
);

export default App;
