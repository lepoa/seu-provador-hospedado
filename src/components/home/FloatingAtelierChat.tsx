import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, MessageCircle, Minimize2, Send, Sparkles, User, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffectivePrices } from "@/hooks/useEffectivePrices";
import { useCart } from "@/contexts/CartContext";
import { cn } from "@/lib/utils";

type AutoOpenReason = "idle" | "products" | "scroll" | "cart_abandon";

interface ProductDetails {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  images: string[] | null;
  main_image_index: number | null;
}

interface ChatMessage {
  id: string;
  type: "user" | "bot";
  text: string;
  createdAt: number;
  reason?: AutoOpenReason;
  look?: {
    title: string;
    products: string[];
  };
  products?: ProductDetails[];
}

const STORAGE_MESSAGES_KEY = "lepoa_atelier_chat_messages_v1";
const STORAGE_REASONS_KEY = "lepoa_atelier_chat_auto_reasons_v1";
const STORAGE_PRODUCTS_KEY = "lepoa_atelier_chat_visited_products_v1";
const STORAGE_AUTO_DISABLED_KEY = "lepoa_atelier_chat_auto_disabled_v1";

const WELCOME_MESSAGE: ChatMessage = {
  id: "atelier-welcome",
  type: "bot",
  text: "Olá! Sou o Atelier de Estilo IA da Le.Poá. Conte sua ocasião e monto combinações personalizadas para você.",
  createdAt: Date.now(),
};

const AUTO_MESSAGES: Record<AutoOpenReason, string> = {
  idle: "Percebi que você está explorando com calma. Se quiser, monto um look completo em poucos minutos.",
  products: "Vi que você visitou vários produtos. Posso comparar estilos e sugerir uma combinação pronta.",
  scroll: "Posso resumir as melhores opções desta página no seu estilo e tamanho.",
  cart_abandon: "Posso revisar sua sacola e sugerir ajustes para aumentar o aproveitamento da compra.",
};

const sanitizeDisplayText = (value: string) =>
  value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

const loadMessages = (): ChatMessage[] => {
  if (typeof window === "undefined") return [WELCOME_MESSAGE];
  const raw = window.localStorage.getItem(STORAGE_MESSAGES_KEY);
  if (!raw) return [WELCOME_MESSAGE];
  try {
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [WELCOME_MESSAGE];
    return parsed.map((message) => ({
      ...message,
      text:
        message.id === WELCOME_MESSAGE.id
          ? WELCOME_MESSAGE.text
          : sanitizeDisplayText(message.text || ""),
    }));
  } catch {
    return [WELCOME_MESSAGE];
  }
};

const loadStringArray = (storageKey: string): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
};

const loadBool = (storageKey: string): boolean => {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(storageKey) === "1";
};

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const getMainImage = (product: ProductDetails) => {
  if (product.images?.length) {
    return product.images[product.main_image_index || 0] || product.images[0];
  }
  return product.image_url || undefined;
};

export function FloatingAtelierChat() {
  const location = useLocation();
  const { user } = useAuth();
  const { itemCount } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages());
  const [autoReasons, setAutoReasons] = useState<AutoOpenReason[]>(
    () => loadStringArray(STORAGE_REASONS_KEY) as AutoOpenReason[]
  );
  const [visitedProducts, setVisitedProducts] = useState<string[]>(() => loadStringArray(STORAGE_PRODUCTS_KEY));
  const [autoOpenDisabled, setAutoOpenDisabled] = useState<boolean>(() => loadBool(STORAGE_AUTO_DISABLED_KEY));
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const previousPathRef = useRef(location.pathname);
  const lastAutoOpenRef = useRef(0);

  const generatedProductIds = useMemo(
    () =>
      Array.from(
        new Set(
          messages
            .flatMap((message) => message.products?.map((product) => product.id) || [])
            .filter(Boolean)
        )
      ),
    [messages]
  );

  const { getEffectivePrice } = useEffectivePrices({
    channel: "catalog",
    productIds: generatedProductIds.length > 0 ? generatedProductIds : undefined,
    enabled: generatedProductIds.length > 0,
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_REASONS_KEY, JSON.stringify(autoReasons));
  }, [autoReasons]);

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(visitedProducts));
  }, [visitedProducts]);

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_AUTO_DISABLED_KEY, autoOpenDisabled ? "1" : "0");
  }, [autoOpenDisabled]);

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, [messages, isGenerating, isOpen]);

  const appendBotMessage = (text: string, reason?: AutoOpenReason) => {
    setMessages((prev) => {
      if (reason && prev.some((message) => message.reason === reason && message.type === "bot")) {
        return prev;
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "bot",
          text: sanitizeDisplayText(text),
          createdAt: Date.now(),
          reason,
        },
      ];
    });
  };

  const maybeAutoOpen = (reason: AutoOpenReason) => {
    if (autoOpenDisabled) return;
    if (autoReasons.includes(reason)) return;
    const now = Date.now();
    if (now - lastAutoOpenRef.current < 120000) return;

    setAutoReasons((prev) => [...prev, reason]);
    setIsOpen(true);
    setIsMinimized(false);
    appendBotMessage(AUTO_MESSAGES[reason], reason);
    lastAutoOpenRef.current = now;
  };

  const handleSendMessage = async (text: string) => {
    const cleanedText = text.trim();
    if (!cleanedText || isGenerating) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      type: "user",
      text: cleanedText,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");

    if (!user) {
      appendBotMessage("Para liberar sugestões personalizadas com seu estoque, entre na sua conta e continue daqui.");
      return;
    }

    setIsGenerating(true);
    try {
      const history = messages.slice(-10).map((message) => ({
        type: message.type,
        text: message.text,
      }));

      const { data, error } = await supabase.functions.invoke("generate-ai-look", {
        body: {
          input_text: cleanedText,
          user_id: user.id,
          session_id: window.localStorage.getItem("analytics_session_id") || crypto.randomUUID(),
          history,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Não foi possível gerar sugestões.");

      const content = data.data as {
        type: string;
        title?: string;
        text: string;
        products?: string[];
      };

      let productsData: ProductDetails[] = [];
      if (content.type === "look" && content.products && content.products.length > 0) {
        const { data: fetchedProducts, error: fetchError } = await supabase
          .from("product_catalog")
          .select("id,name,price,image_url,images,main_image_index")
          .in("id", content.products);

        if (fetchError) throw fetchError;
        productsData = (fetchedProducts || []) as ProductDetails[];
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "bot",
          text: sanitizeDisplayText(content.text),
          createdAt: Date.now(),
          look:
            content.type === "look" && content.products
              ? {
                  title: content.title || "Sugestão de look",
                  products: content.products,
                }
              : undefined,
          products: productsData,
        },
      ]);
    } catch (error) {
      console.error("Error generating concierge response:", error);
      appendBotMessage("Não consegui gerar o look agora. Tente novamente em instantes.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const productMatch = location.pathname.match(/^\/produto\/([^/]+)/);
    if (!productMatch) return;

    const productId = decodeURIComponent(productMatch[1]);
    setVisitedProducts((prev) => {
      if (prev.includes(productId)) return prev;
      const next = [...prev, productId];
      if (next.length >= 3) {
        maybeAutoOpen("products");
      }
      return next;
    });
  }, [location.pathname]);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const isLeavingCart =
      (previousPath.startsWith("/carrinho") || previousPath.startsWith("/checkout")) &&
      !location.pathname.startsWith("/carrinho") &&
      !location.pathname.startsWith("/checkout") &&
      !location.pathname.startsWith("/pedido/");

    if (isLeavingCart && itemCount > 0) {
      maybeAutoOpen("cart_abandon");
    }

    previousPathRef.current = location.pathname;
  }, [itemCount, location.pathname]);

  useEffect(() => {
    const interactionState = { touched: false };
    const markInteraction = () => {
      interactionState.touched = true;
    };

    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("scroll", markInteraction, { passive: true });
    window.addEventListener("touchstart", markInteraction, { passive: true });

    const timer = window.setTimeout(() => {
      if (!interactionState.touched) {
        maybeAutoOpen("idle");
      }
    }, 45000);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("scroll", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
    };
  }, [location.pathname, autoOpenDisabled, autoReasons]);

  useEffect(() => {
    const onScroll = () => {
      const pageHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (pageHeight <= window.innerHeight * 0.15) return;
      const progress = window.scrollY / pageHeight;
      if (progress >= 0.7) {
        maybeAutoOpen("scroll");
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [autoOpenDisabled, autoReasons]);

  useEffect(() => {
    const openByEvent = () => {
      setIsOpen(true);
      setIsMinimized(false);
      setAutoOpenDisabled(false);
    };
    window.addEventListener("lepoa-open-atelier", openByEvent);
    return () => {
      window.removeEventListener("lepoa-open-atelier", openByEvent);
    };
  }, []);

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Fechar overlay do chat"
          className="fixed inset-0 z-[90] bg-[#0f1d19]/45 backdrop-blur-[1px]"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed bottom-20 right-3 z-[91] flex h-[72vh] w-[min(420px,calc(100vw-24px))] max-h-[680px] flex-col overflow-hidden rounded-2xl border border-[#caa45f66] bg-[#f9f4e8] shadow-[0_24px_70px_-30px_rgba(0,0,0,0.65)] transition-all duration-300",
          "sm:right-5 sm:bottom-24",
          isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        )}
      >
        <header className="flex items-center justify-between border-b border-[#d7bf8a66] bg-[#123128] px-4 py-3 text-[#f6ecd4]">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#d7b36b]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Atelier de Estilo IA</p>
              <p className="truncate text-[11px] text-[#e8d7ad]">Concierge digital Le.Poá</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#f6ecd4] hover:bg-[#1a4237] hover:text-[#f8ebcb]"
              onClick={() => {
                setIsMinimized(true);
                setIsOpen(false);
              }}
              aria-label="Minimizar chat"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#f6ecd4] hover:bg-[#1a4237] hover:text-[#f8ebcb]"
              onClick={() => {
                setAutoOpenDisabled(true);
                setIsMinimized(false);
                setIsOpen(false);
              }}
              aria-label="Fechar chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div ref={messagesContainerRef} className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {messages.map((message) => (
            <div key={message.id} className={cn("flex w-full", message.type === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("flex max-w-[90%] gap-2", message.type === "user" ? "flex-row-reverse" : "flex-row")}>
                <div
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    message.type === "user" ? "bg-[#b98d45] text-white" : "bg-[#123128] text-[#e2c582]"
                  )}
                >
                  {message.type === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className="space-y-2">
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm leading-relaxed",
                      message.type === "user"
                        ? "rounded-tr-sm bg-[#b98d45] text-white"
                        : "rounded-tl-sm border border-[#d6c29a66] bg-white text-[#262421]"
                    )}
                  >
                    {message.text}
                  </div>

                  {message.products && message.products.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {message.products.slice(0, 4).map((product) => (
                        <Link
                          key={product.id}
                          to={`/produto/${product.id}?from=atelier`}
                          className="overflow-hidden rounded-lg border border-[#d6c29a66] bg-white transition hover:border-[#c9a95f] hover:shadow-sm"
                          onClick={() => setIsOpen(false)}
                        >
                          <div className="aspect-[3/4] overflow-hidden bg-[#f3eee1]">
                            <img
                              src={getMainImage(product)}
                              alt={product.name}
                              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                            />
                          </div>
                          <div className="p-2">
                            <p className="line-clamp-1 text-xs font-medium text-[#2f2b24]">{product.name}</p>
                            <p className="text-xs font-semibold text-[#8b6a30]">
                              {formatPrice(getEffectivePrice(product.id, product.price))}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {isGenerating ? (
            <div className="flex justify-start">
              <div className="rounded-xl border border-[#d6c29a66] bg-white px-3 py-2 text-xs text-[#6c6354]">
                Preparando sugestões...
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-[#d6c29a66] bg-[#f7f1e4] p-3">
          {!user ? (
            <div className="space-y-2">
              <p className="text-xs text-[#5a5348]">
                Entre para liberar recomendações completas de looks e produtos.
              </p>
              <Link to="/auth" onClick={() => setIsOpen(false)}>
                <Button className="h-9 w-full bg-[#123128] text-[#f5ebd2] hover:bg-[#183e32]">Entrar na minha conta</Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleSendMessage(inputText);
                  }
                }}
                className="h-10 border-[#cfb98f] bg-white focus-visible:ring-[#b58f49]"
                placeholder="Descreva sua ocasião ou objetivo..."
                disabled={isGenerating}
              />
              <Button
                type="button"
                size="icon"
                className="h-10 w-10 bg-[#123128] text-[#f7edcf] hover:bg-[#1a4337]"
                onClick={() => {
                  void handleSendMessage(inputText);
                }}
                disabled={isGenerating || !inputText.trim()}
                aria-label="Enviar mensagem"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setIsMinimized(false);
          setAutoOpenDisabled(false);
        }}
        className={cn(
          "animate-concierge-pulse fixed bottom-4 right-3 z-[92] inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#d2b375] bg-[#123128] text-[#f8ecd0] shadow-[0_14px_35px_-18px_rgba(0,0,0,0.8)] transition-all duration-300 hover:scale-[1.03] hover:bg-[#183f33] sm:bottom-5 sm:right-5",
          isOpen && "bg-[#1b4639]"
        )}
        aria-label={isOpen ? "Minimizar Atelier de Estilo IA" : "Abrir Atelier de Estilo IA"}
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {isMinimized && !isOpen ? (
        <div className="pointer-events-none fixed bottom-[76px] right-4 z-[91] hidden rounded-md bg-[#123128] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#e8d6ab] sm:block">
          Minimizado
        </div>
      ) : null}
    </>
  );
}
