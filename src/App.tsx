import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import RuntimeLoggerPanel from "@/components/RuntimeLoggerPanel";
import { FloatingAtelierChat } from "@/components/home/FloatingAtelierChat";
import { CartProvider } from "@/contexts/CartContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Component, ComponentType, LazyExoticComponent, ReactNode, Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { runtimeLog } from "@/lib/runtimeLogger";

const Index = lazy(() => import("./pages/Index"));
const MeuEstilo = lazy(() => import("./pages/MeuEstilo"));
const QuizV2 = lazy(() => import("./pages/QuizV2"));
const QuizResultV2 = lazy(() => import("./pages/QuizResultV2"));
const MissionQuiz = lazy(() => import("./pages/MissionQuiz"));
const PrintStory = lazy(() => import("./pages/PrintStory"));
import Login from "./pages/Login";
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const EsqueciSenha = lazy(() => import("./pages/EsqueciSenha"));
const ReiniciarSenha = lazy(() => import("./pages/ReiniciarSenha"));
const ResetarSenha = lazy(() => import("./pages/ResetarSenha"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Catalog = lazy(() => import("./pages/Catalog"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CatalogView = lazy(() => import("./pages/CatalogView"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Sitemap = lazy(() => import("./pages/Sitemap").then(m => ({ default: m.Sitemap })));
const ModaFemininaElegante = lazy(() => import("./pages/ModaFemininaElegante"));
const Sobre = lazy(() => import("./pages/Sobre"));
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
const LiveCheckout = lazy(() => import("./pages/LiveCheckout"));
const BagDetails = lazy(() => import("./pages/BagDetails"));

const queryClient = new QueryClient();

const routeFallback = (
  <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
    Carregando...
  </div>
);

type RouteErrorBoundaryState = { hasError: boolean; message: string };

class RouteErrorBoundary extends Component<{ children: ReactNode }, RouteErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "Erro ao carregar pagina." };
  }

  static getDerivedStateFromError(error: unknown): RouteErrorBoundaryState {
    const message = error instanceof Error && error.message.includes("dynamically imported module")
      ? "Erro ao carregar login."
      : "Erro ao carregar pagina.";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown): void {
    runtimeLog("runtime", "route-error-boundary", { error }, "error");
    if (import.meta.env.DEV) {
      console.error("[route-error-boundary]", error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">
          <p>{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-border px-3 py-1.5 text-foreground transition-opacity hover:opacity-85"
          >
            Clique para recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
const AUTH_REDIRECT_LOCK_KEY = "auth_redirect_lock";
const AUTH_REDIRECT_LOCK_MS = 1200;

function getCurrentRoute(location: { pathname: string; search: string; hash: string }): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

function canIssueRedirect(from: string, to: string): boolean {
  if (typeof window === "undefined") return true;

  try {
    const raw = sessionStorage.getItem(AUTH_REDIRECT_LOCK_KEY);
    const now = Date.now();

    if (raw) {
      const parsed = JSON.parse(raw) as { from?: string; to?: string; ts?: number };
      const isSameRedirect = parsed.from === from && parsed.to === to;
      const isFresh = typeof parsed.ts === "number" && now - parsed.ts < AUTH_REDIRECT_LOCK_MS;

      if (isSameRedirect && isFresh) {
        return false;
      }
    }

    sessionStorage.setItem(AUTH_REDIRECT_LOCK_KEY, JSON.stringify({ from, to, ts: now }));
  } catch {
    // If sessionStorage fails, allow redirect to preserve auth flow.
  }

  return true;
}

function isMerchantRoute(path: string): boolean {
  return (
    path.startsWith("/dashboard") ||
    path.startsWith("/importar-estoque") ||
    path.startsWith("/clientes/ranking")
  );
}

function resolveMerchantReturnTo(search: string): string {
  const params = new URLSearchParams(search);
  const raw = params.get("returnTo");
  if (!raw) return "/dashboard";

  try {
    const decoded = decodeURIComponent(raw).trim();
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/dashboard";
    if (
      decoded.startsWith("/login") ||
      decoded.startsWith("/area-lojista")
    ) return "/dashboard";
    return isMerchantRoute(decoded) ? decoded : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

const withRouteSuspense = <T extends ComponentType<any>>(Component: LazyExoticComponent<T>) => (
  <RouteErrorBoundary>
    <Suspense fallback={routeFallback}>
      <Component />
    </Suspense>
  </RouteErrorBoundary>
);

function MerchantProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, isLoading, rolesLoading, isMerchant } = useAuth();

  if (isLoading || rolesLoading) {
    return routeFallback;
  }

  if (!user || !isMerchant()) {
    const from = getCurrentRoute(location);
    const target = `/login?returnTo=${encodeURIComponent(from)}`;

    if (import.meta.env.DEV) {
      console.error("[auth-guard] Unauthorized merchant route access", { from, target });
    }

    runtimeLog("auth", "guard:redirect-to-login", { from, target }, "warn");

    if (!canIssueRedirect(from, target)) {
      return routeFallback;
    }

    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

function MerchantLoginRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, isLoading, rolesLoading, isMerchant } = useAuth();

  if (isLoading || rolesLoading) {
    return routeFallback;
  }

  if (user && isMerchant()) {
    const from = getCurrentRoute(location);
    const target = resolveMerchantReturnTo(location.search);

    runtimeLog("auth", "guard:redirect-to-dashboard", { from, target }, "info");

    if (!canIssueRedirect(from, target)) {
      return routeFallback;
    }

    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

const withMerchantProtection = <T extends ComponentType<any>>(Component: LazyExoticComponent<T>) => (
  <MerchantProtectedRoute>{withRouteSuspense(Component)}</MerchantProtectedRoute>
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
  <HelmetProvider>
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
              <Route path="/auth" element={<Navigate to="/entrar" replace />} />
              <Route path="/auth/callback" element={withRouteSuspense(AuthCallback)} />
              <Route path="/esqueci-senha" element={withRouteSuspense(EsqueciSenha)} />
              <Route path="/redefinir-senha" element={withRouteSuspense(ReiniciarSenha)} />
              <Route path="/reiniciar-senha" element={withRouteSuspense(ReiniciarSenha)} />
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
              <Route
                path="/login"
                element={(
                  <MerchantLoginRoute>
                    <RouteErrorBoundary>
                      <Login />
                    </RouteErrorBoundary>
                  </MerchantLoginRoute>
                )}
              />
              <Route path="/admin/login" element={<Navigate to="/login" replace />} />
              <Route
                path="/area-lojista"
                element={(
                  <MerchantLoginRoute>
                    <RouteErrorBoundary>
                      <Login />
                    </RouteErrorBoundary>
                  </MerchantLoginRoute>
                )}
              />
              <Route path="/admin" element={withMerchantProtection(Dashboard)} />
              <Route path="/dashboard" element={withMerchantProtection(Dashboard)} />
              <Route path="/dashboard/clientes/:id" element={<Navigate to="/dashboard?tab=clientes" replace />} />
              <Route path="/dashboard/lives/relatorio" element={<Navigate to="/dashboard?tab=lives" replace />} />
              <Route path="/dashboard/lives/rastreador" element={<Navigate to="/dashboard?tab=lives" replace />} />
              <Route path="/dashboard/lives/:eventId/planejar" element={<Navigate to="/dashboard?tab=lives" replace />} />
              <Route path="/dashboard/lives/:eventId/backstage" element={<Navigate to="/dashboard?tab=lives" replace />} />
              <Route path="/dashboard/lives/:eventId/relatorio" element={<Navigate to="/dashboard?tab=lives" replace />} />
              <Route path="/dashboard/lives/:eventId/pedidos" element={<Navigate to="/dashboard?tab=lives" replace />} />
              <Route path="/dashboard/lives/:eventId/pendencias" element={<Navigate to="/dashboard?tab=lives" replace />} />
              <Route path="/dashboard/lives/:eventId/separacao" element={<Navigate to="/dashboard?tab=lives" replace />} />
              <Route path="/dashboard/insights" element={<Navigate to="/dashboard?tab=insights" replace />} />
              <Route path="/dashboard/rfv" element={<Navigate to="/dashboard?tab=rfv" replace />} />
              <Route path="/dashboard/consultora" element={<Navigate to="/dashboard?tab=consultora" replace />} />
              <Route path="/clientes/ranking" element={<Navigate to="/dashboard?tab=clientes" replace />} />
              <Route path="/importar-estoque" element={<Navigate to="/dashboard?tab=products" replace />} />

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

              <Route path="/sitemap.xml" element={withRouteSuspense(Sitemap)} />
              <Route path="/moda-feminina-elegante" element={withRouteSuspense(ModaFemininaElegante)} />
              <Route path="/sobre" element={withRouteSuspense(Sobre)} />
              <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

              <Route path="*" element={withRouteSuspense(NotFound)} />
            </Routes>
            <FloatingAtelierChat />
            {import.meta.env.DEV && <RuntimeLoggerPanel />}
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;

