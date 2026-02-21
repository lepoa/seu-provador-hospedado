import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, User, Bot, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffectivePrices } from "@/hooks/useEffectivePrices";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    type: "user" | "bot";
    text: string;
    look?: AILook;
    products?: ProductDetails[];
}

interface AILook {
    title: string;
    description: string;
    products: string[]; // UUIDs
}

interface ProductDetails {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    images: string[] | null;
    main_image_index: number | null;
}

const SUGGESTED_PROMPTS = [
    "Jantar romântico",
    "Reunião de trabalho",
    "Casamento de dia",
    "Look casual chic",
];

export function AILookConsultant() {
    const { user } = useAuth();
    const [inputText, setInputText] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            type: "bot",
            text: "Olá! Sou sua consultora de estilo Le.Poá. Me conte: qual a ocasião de hoje para eu montar o look ideal para você?",
        },
    ]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const { trackEvent } = useAnalytics();

    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isGenerating]);

    // Pricing & Stock hooks
    const allGeneratedProductIds = messages
        .filter((m) => m.look)
        .flatMap((m) => m.look!.products);

    const { getEffectivePrice } = useEffectivePrices({
        channel: "catalog",
        productIds: allGeneratedProductIds.length > 0 ? allGeneratedProductIds : undefined,
        enabled: allGeneratedProductIds.length > 0
    });

    const handleSendMessage = async (text: string) => {
        if (!text.trim() || !user) return;

        const userMsg: Message = {
            id: crypto.randomUUID(),
            type: "user",
            text: text,
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputText("");
        setIsGenerating(true);

        try {
            const { data, error } = await supabase.functions.invoke("generate-ai-look", {
                body: {
                    input_text: text,
                    user_id: user?.id,
                    session_id: localStorage.getItem("analytics_session_id") || crypto.randomUUID(),
                    history: messages.slice(1).map(m => ({ type: m.type, text: m.text }))
                },
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error || "Erro ao gerar look");

            const content = data.data;

            // Fetch product details for the generated look
            let productsData: any[] = [];
            if (content.type === "look" && content.products?.length > 0) {
                const { data: fetchedProducts, error: fetchError } = await supabase
                    .from("product_catalog")
                    .select("id, name, price, image_url, images, main_image_index")
                    .in("id", content.products);

                if (fetchError) throw fetchError;
                productsData = fetchedProducts || [];
            }

            const botMsg: Message = {
                id: crypto.randomUUID(),
                type: "bot",
                text: content.text,
                look: content.type === "look" ? {
                    title: content.title,
                    description: content.text,
                    products: content.products
                } : undefined,
                products: productsData,
            };

            setMessages((prev) => [...prev, botMsg]);

            if (content.type === "look") {
                trackEvent("ai_look_generated", {
                    occasion: text,
                    title: content.title,
                    products_count: content.products.length,
                });
            }

        } catch (err: any) {
            console.error("DEBUG: Error generating AI look:", err);
            const errorMessage = err?.message || "Erro desconhecido";
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    type: "bot",
                    text: `Desculpe, tive um probleminha para montar seu look: "${errorMessage}".`,
                },
            ]);
        } finally {
            setIsGenerating(false);
        }
    };

    const getMainImage = (p: ProductDetails) => {
        if (p.images?.length) return p.images[p.main_image_index || 0] || p.images[0];
        return p.image_url || undefined;
    };

    const formatPrice = (value: number) =>
        new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);

    return (
        <section id="consultora-ai" className="py-16 md:py-24 px-5 bg-primary relative overflow-hidden">
            {/* Background decorative blob */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gold/5 rounded-full blur-[100px] -mr-48 -mt-48" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/5 rounded-full blur-[100px] -ml-48 -mb-48" />

            <div className="relative z-10 max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/10 text-gold mb-6 border border-gold/20 shadow-lg">
                        <Sparkles className="h-8 w-8" />
                    </div>
                    <h2 className="font-serif text-4xl md:text-5xl font-medium mb-4 text-white italic">Atelier de Estilo <span className="text-gold">IA</span></h2>
                    <p className="text-white/60 font-light text-base md:text-lg max-w-lg mx-auto">
                        Sua consultora exclusiva 24/7. Conte qual a ocasião e nós criamos o visual perfeito.
                    </p>
                </div>

                <Card className="border-none shadow-xl overflow-hidden rounded-3xl bg-white/80 backdrop-blur-sm relative">
                    {!user && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 bg-primary/80 backdrop-blur-md text-center">
                            <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mb-6">
                                <ShoppingBag className="h-8 w-8 text-gold" />
                            </div>
                            <h3 className="text-2xl font-serif font-medium mb-4 text-white italic">Acesso Exclusivo Le.Poá</h3>
                            <p className="text-white/60 max-w-sm mb-10 leading-relaxed font-light">
                                Inicie sua jornada de estilo personalizada agora. Faça login para acessar nossa curadoria guiada por IA.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
                                <Link to="/auth" className="flex-1">
                                    <Button className="btn-gold w-full rounded-full h-14">
                                        ENTRAR NO MEU ATELIER
                                    </Button>
                                </Link>
                            </div>
                            <p className="mt-6 text-[11px] uppercase tracking-widest text-muted-foreground/60">
                                Acesso gratuito e instantâneo
                            </p>
                        </div>
                    )}

                    <CardContent className={cn(
                        "p-0 flex flex-col h-[600px] transition-all duration-500",
                        !user && "blur-[2px] pointer-events-none select-none"
                    )}>
                        {/* Message Area */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
                        >
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex w-full mb-4 animate-fade-in",
                                        msg.type === "user" ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div className={cn(
                                        "flex gap-3 max-w-[85%] md:max-w-[70%]",
                                        msg.type === "user" ? "flex-row-reverse" : "flex-row"
                                    )}>
                                        <div className={cn(
                                            "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-md",
                                            msg.type === "user" ? "bg-gold text-white" : "bg-primary border border-gold/20"
                                        )}>
                                            {msg.type === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-gold" />}
                                        </div>
                                        <div className="space-y-4">
                                            <div className={cn(
                                                "rounded-2xl px-6 py-4 text-sm leading-relaxed shadow-sm",
                                                msg.type === "user"
                                                    ? "bg-gold text-white rounded-tr-none font-medium"
                                                    : "bg-white border border-border/50 text-gray-800 rounded-tl-none"
                                            )}>
                                                {msg.text}
                                            </div>

                                            {msg.look && msg.products && (
                                                <div className="space-y-4">
                                                    <p className="text-xs font-bold uppercase tracking-widest text-accent px-1">
                                                        {msg.look.title}
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {msg.products.map((product) => (
                                                            <Link
                                                                key={product.id}
                                                                to={`/produto/${product.id}?from=ai_look`}
                                                                className="bg-white rounded-xl border border-border/40 overflow-hidden shadow-sm hover:shadow-md transition-all group"
                                                            >
                                                                <div className="aspect-[3/4] overflow-hidden bg-secondary">
                                                                    <img
                                                                        src={getMainImage(product)}
                                                                        alt={product.name}
                                                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                                    />
                                                                </div>
                                                                <div className="p-3">
                                                                    <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-1">{product.name}</p>
                                                                    <p className="text-base font-bold text-primary">
                                                                        {formatPrice(getEffectivePrice(product.id, product.price))}
                                                                    </p>
                                                                </div>
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {isGenerating && (
                                <div className="flex justify-start animate-fade-in">
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
                                            <Bot className="h-4 w-4 text-accent" />
                                        </div>
                                        <div className="bg-white border border-border/50 rounded-2xl rounded-tl-none px-5 py-3.5 shadow-sm">
                                            <div className="flex gap-1.5 pt-1">
                                                <span className="w-1.5 h-1.5 bg-accent/40 rounded-full animate-bounce" />
                                                <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce [animation-delay:0.2s]" />
                                                <span className="w-1.5 h-1.5 bg-accent/80 rounded-full animate-bounce [animation-delay:0.4s]" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-5 bg-card/30 border-t border-border/40">
                            {messages.length === 1 && !isGenerating && (
                                <div className="flex flex-wrap gap-2 mb-4 animate-fade-in">
                                    {SUGGESTED_PROMPTS.map((prompt) => (
                                        <button
                                            key={prompt}
                                            onClick={() => handleSendMessage(prompt)}
                                            className="text-[10px] font-bold tracking-widest uppercase border border-gold/20 bg-white/50 text-primary hover:bg-gold hover:text-white px-5 py-2.5 rounded-full transition-all backdrop-blur-sm"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="relative group">
                                <Input
                                    placeholder="Conte-nos o que você precisa..."
                                    className="h-14 pl-6 pr-24 rounded-full border border-gold/20 bg-white shadow-inner focus-visible:ring-gold focus-visible:ring-offset-0 focus-visible:border-gold transition-all text-sm"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage(inputText)}
                                    disabled={isGenerating}
                                />
                                <Button
                                    size="icon"
                                    className="absolute right-2 top-2 bottom-2 w-10 h-10 rounded-full bg-primary hover:bg-gold text-white transition-all duration-300 shadow-md"
                                    disabled={isGenerating || !inputText.trim()}
                                    onClick={() => handleSendMessage(inputText)}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
