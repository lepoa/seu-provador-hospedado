import { useState, useEffect } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { AnalysisSuggestionUI, SelectedFields } from "@/components/AnalysisSuggestionUI";
import { ProductImageUploader } from "@/components/ProductImageUploader";
import { CustomerSuggestions } from "@/components/CustomerSuggestions";
import { StockBySize, getAvailableSizes } from "@/components/StockBySize";
import { ProductDiscountFields, calculateDiscountedPrice } from "@/components/ProductDiscountFields";
import { generateProductDescription } from "@/lib/generateDescription";
import { suggestCustomersForProduct } from "@/lib/customerSuggestions";
import { runtimeLog } from "@/lib/runtimeLogger";

interface Product {
  id?: string;
  name: string;
  sku: string | null;
  group_key?: string | null;
  category: string | null;
  price: number;
  color: string | null;
  style: string | null;
  occasion: string | null;
  modeling: string | null;
  sizes: string[];
  is_active: boolean;
  image_url: string | null;
  tags: string[];
  user_id?: string | null;
  images?: string[];
  video_url?: string | null;
  main_image_index?: number;
  stock_by_size?: Record<string, number>;
  description?: string | null;
  created_from_import?: boolean;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  discount_type?: string | null;
  discount_value?: number | null;
}

// Suggested weights by category (kg) - updated values per user request
const CATEGORY_WEIGHTS: Record<string, number> = {
  "Blusas": 0.25,
  "Vestidos": 0.45,
  "Calças": 0.60,
  "Blazers": 0.70,
  "Casacos": 0.80,
  "Camisas": 0.25,
  "Saias": 0.30,
  "Shorts": 0.25,
  "Conjuntos": 0.85,
  "Macacões": 0.85,
  "Acessórios": 0.20,
};

// Default dimensions for MVP (cm)
const DEFAULT_DIMENSIONS = {
  length: 30,
  width: 20,
  height: 10,
};

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSuccess: () => void;
  userId: string;
}

const CATEGORIES = ["Vestidos", "Blusas", "Calças", "Saias", "Conjuntos", "Acessórios", "Blazers", "Shorts", "Casacos", "Macacões", "Camisas"];
const BASE_COLORS = ["Preto", "Branco", "Bege", "Rosa", "Azul", "Verde", "Vermelho", "Marrom", "Cinza", "Estampado", "Off White", "Chocolate", "Menta", "Nude", "Caramelo", "Mostarda", "Vinho", "Laranja", "Amarelo", "Lilás", "Roxo", "Coral"];
const STYLES = ["elegante", "clássico", "minimal", "romântico", "casual", "moderno", "fashion", "sexy_chic"];
const OCCASIONS = ["trabalho", "casual", "festa", "dia a dia", "especial", "casual_chic", "eventos", "viagem"];
const MODELINGS = ["ajustado", "regular", "soltinho", "oversized", "acinturado", "slim", "reto", "amplo"];

function toErrorDetails(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") return { raw: String(error) };

  const err = error as Record<string, unknown>;
  return {
    name: err.name,
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
    status: err.status,
  };
}

function getProductSaveErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Erro ao salvar produto";
  }

  const err = error as Record<string, unknown>;
  const code = String(err.code || "");
  const message = String(err.message || "");
  const details = String(err.details || "");
  const hint = String(err.hint || "");
  const merged = `${message} ${details} ${hint}`.toLowerCase();

  if (code === "23505" || merged.includes("duplicate key")) {
    if (merged.includes("sku")) {
      return "SKU já existe. Use outro código para salvar.";
    }
    return "Registro duplicado. Revise os dados e tente novamente.";
  }

  if (code === "42501" || merged.includes("row-level security")) {
    return "Sem permissão para salvar produto. Faça login novamente e confirme seu acesso de lojista.";
  }

  if (code === "PGRST204" || (merged.includes("could not find") && merged.includes("column"))) {
    return "Banco desatualizado para este formulário. Envie o log técnico para ajustarmos a migração.";
  }

  if (code === "22P02" || merged.includes("invalid input syntax")) {
    return "Campo numérico inválido. Revise preço, peso e dimensões.";
  }

  if (message) {
    return `Erro ao salvar produto: ${message}`;
  }

  return "Erro ao salvar produto";
}

// Mapping from ERP/AI response to form values - normalize color names
const ERP_TO_FORM_COLOR: Record<string, string> = {
  "preto": "Preto",
  "branco": "Branco",
  "bege": "Bege",
  "rosa": "Rosa",
  "azul": "Azul",
  "verde": "Verde",
  "vermelho": "Vermelho",
  "marrom": "Marrom",
  "cinza": "Cinza",
  "estampado": "Estampado",
  "off white": "Off White",
  "offwhite": "Off White",
  "off-white": "Off White",
  "chocolate": "Chocolate",
  "menta": "Menta",
  "nude": "Nude",
  "caramelo": "Caramelo",
  "mostarda": "Mostarda",
  "vinho": "Vinho",
  "laranja": "Laranja",
  "amarelo": "Amarelo",
  "lilas": "Lilás",
  "lilás": "Lilás",
  "roxo": "Roxo",
  "coral": "Coral",
};

// Normalize a color string from ERP format to form format
function normalizeColor(color: string | null): string | null {
  if (!color) return null;
  const normalized = color.trim().toLowerCase();
  // First check direct mapping
  if (ERP_TO_FORM_COLOR[normalized]) {
    return ERP_TO_FORM_COLOR[normalized];
  }
  // If not in map, capitalize first letter of each word
  return color.trim().split(/\s+/).map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(" ");
}

// Mapping from AI response to form values
const AI_TO_FORM_CATEGORY: Record<string, string> = {
  vestido: "Vestidos",
  blazer: "Blazers",
  calça: "Calças",
  camisa: "Camisas",
  saia: "Saias",
  conjunto: "Conjuntos",
  short: "Shorts",
  casaco: "Casacos",
  macacão: "Macacões",
  blusa: "Blusas",
};

const AI_TO_FORM_COLOR: Record<string, string> = ERP_TO_FORM_COLOR;

export function ProductForm({ open, onOpenChange, product, onSuccess, userId }: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  // Multi-image state
  const [images, setImages] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Stock state
  const [stockBySize, setStockBySize] = useState<Record<string, number>>({});

  const [formData, setFormData] = useState<Product>({
    name: "",
    sku: null,
    category: null,
    price: 0,
    color: null,
    style: null,
    occasion: null,
    modeling: null,
    sizes: [],
    is_active: true,
    image_url: null,
    tags: [],
    description: null,
    // Pre-fill with defaults for new products
    weight_kg: 0.30,
    length_cm: DEFAULT_DIMENSIONS.length,
    width_cm: DEFAULT_DIMENSIONS.width,
    height_cm: DEFAULT_DIMENSIONS.height,
    discount_type: null,
    discount_value: null,
  });

  const { isAnalyzing, analysisResult, analyzeImage, clearAnalysis } = useImageAnalysis();

  // Build dynamic color list including the product's color if not in base list
  const [availableColors, setAvailableColors] = useState<string[]>(BASE_COLORS);

  useEffect(() => {
    if (product) {
      // Normalize the color from ERP/DB to match form options
      const normalizedColor = normalizeColor(product.color);

      setFormData({
        ...product,
        // Auto-fill SKU with group_key if SKU is empty (for imported products)
        sku: product.sku || product.group_key || null,
        // Set normalized color
        color: normalizedColor,
        sizes: product.sizes || [],
        tags: product.tags || [],
        weight_kg: product.weight_kg ?? null,
        length_cm: product.length_cm ?? null,
        width_cm: product.width_cm ?? null,
        height_cm: product.height_cm ?? null,
        discount_type: product.discount_type ?? null,
        discount_value: product.discount_value ?? null,
      });
      setImages(product.images || (product.image_url ? [product.image_url] : []));
      setMainImageIndex(product.main_image_index || 0);
      setVideoUrl(product.video_url || null);
      setStockBySize(product.stock_by_size || {});

      // Add custom color to available options if not already present
      if (normalizedColor && !BASE_COLORS.includes(normalizedColor)) {
        setAvailableColors([...BASE_COLORS, normalizedColor]);
      } else {
        setAvailableColors(BASE_COLORS);
      }
    } else {
      // Reset to defaults for new product
      setFormData({
        name: "",
        sku: null,
        category: null,
        price: 0,
        color: null,
        style: null,
        occasion: null,
        modeling: null,
        sizes: [],
        is_active: true,
        image_url: null,
        tags: [],
        description: null,
        // Pre-fill with defaults
        weight_kg: 0.30,
        length_cm: DEFAULT_DIMENSIONS.length,
        width_cm: DEFAULT_DIMENSIONS.width,
        height_cm: DEFAULT_DIMENSIONS.height,
        discount_type: null,
        discount_value: null,
      });
      setImages([]);
      setMainImageIndex(0);
      setVideoUrl(null);
      setStockBySize({});
      setAvailableColors(BASE_COLORS);
    }
    clearAnalysis();
  }, [product, open]);

  const handleImagesChange = (newImages: string[], newMainIndex: number) => {
    setImages(newImages);
    setMainImageIndex(newMainIndex);
  };

  const handleAnalyzeImage = async () => {
    const imageToAnalyze = images[mainImageIndex] || images[0];
    if (!imageToAnalyze) {
      toast.error("Envie uma imagem primeiro");
      return;
    }
    await analyzeImage(imageToAnalyze);
  };

  const handleApplyField = (field: string, value: string) => {
    let mappedValue = value;

    if (field === "category") {
      mappedValue = AI_TO_FORM_CATEGORY[value.toLowerCase()] || value;
    } else if (field === "color") {
      mappedValue = AI_TO_FORM_COLOR[value.toLowerCase()] || value;
    }

    setFormData(prev => ({ ...prev, [field]: mappedValue }));
  };

  const handleApplyAll = () => {
    if (!analysisResult) return;

    const updates: Partial<Product> = {};

    if (analysisResult.categoria.value) {
      updates.category = AI_TO_FORM_CATEGORY[analysisResult.categoria.value.toLowerCase()] || analysisResult.categoria.value;
    }
    if (analysisResult.cor.value) {
      updates.color = AI_TO_FORM_COLOR[analysisResult.cor.value.toLowerCase()] || analysisResult.cor.value;
    }
    if (analysisResult.estilo.value) {
      updates.style = analysisResult.estilo.value;
    }
    if (analysisResult.ocasiao.value) {
      updates.occasion = analysisResult.ocasiao.value;
    }
    if (analysisResult.modelagem.value) {
      updates.modeling = analysisResult.modelagem.value;
    }

    setFormData(prev => ({ ...prev, ...updates }));
    toast.success("Sugestões aplicadas!");
  };

  const handleApplySelected = (selections: SelectedFields) => {
    const updates: Partial<Product> = {};
    const fields = ["category", "color", "style", "occasion", "modeling"] as const;

    fields.forEach((field) => {
      if (selections[field].selected && selections[field].value) {
        updates[field] = selections[field].value;
      }
    });

    // Also add tags from selections
    if (selections.tags.length > 0) {
      updates.tags = [...new Set([...formData.tags, ...selections.tags])];
    }

    setFormData(prev => ({ ...prev, ...updates }));
    toast.success("Sugestões aplicadas!");
  };

  const handleGenerateDescription = async () => {
    // Check if we have an image to analyze
    const imageToAnalyze = images[mainImageIndex] || images[0];

    if (!imageToAnalyze) {
      toast.error("Adicione uma imagem do produto primeiro");
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-description", {
        body: {
          image_url: imageToAnalyze,
          product_name: formData.name || null,
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error("Erro ao gerar descrição");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.success && data?.data) {
        const result = data.data;

        // Build premium description from AI response
        let fullDescription = result.descricao_completa || "";

        // Add differentials as bullet points if available
        if (result.diferenciais && result.diferenciais.length > 0) {
          fullDescription += "\n\n✨ Diferenciais:\n";
          result.diferenciais.forEach((diff: string) => {
            fullDescription += `• ${diff}\n`;
          });
        }

        // Add SEO keywords at the end
        if (result.palavras_chave && result.palavras_chave.length > 0) {
          fullDescription += `\n🏷️ Tags: ${result.palavras_chave.join(", ")}`;
        }

        setFormData(prev => ({
          ...prev,
          description: fullDescription,
          // Optionally update name if it was empty
          name: prev.name || result.nome_produto || prev.name,
        }));

        toast.success("Descrição premium gerada com sucesso!");

        // Show the ad phrase as a secondary toast
        if (result.frase_anuncio) {
          setTimeout(() => {
            toast.info(`💡 Frase para anúncio: "${result.frase_anuncio}"`);
          }, 1500);
        }
      }
    } catch (error) {
      console.error("Error generating description:", error);
      toast.error("Erro ao conectar com o serviço de IA");
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const generateTags = () => {
    const tags: string[] = [];
    if (formData.style) tags.push(formData.style);
    if (formData.occasion) tags.push(formData.occasion);
    if (formData.category) tags.push(formData.category.toLowerCase());
    if (formData.modeling) tags.push(formData.modeling);
    if (analysisResult?.tags_extras) {
      tags.push(...analysisResult.tags_extras);
    }
    return [...new Set(tags)];
  };

  const handleSubmit = async (e: React.FormEvent, quickSave = false) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      runtimeLog(
        "product-form",
        "submit:validation-failed",
        {
          missingName: !formData.name,
          missingPrice: !formData.price,
          mode: product?.id ? "update" : "create",
        },
        "warn",
      );
      toast.error("Nome e preço são obrigatórios");
      return;
    }

    setIsSubmitting(true);
    try {
      runtimeLog("product-form", "submit:start", {
        mode: product?.id ? "update" : "create",
        quickSave,
        productId: product?.id || null,
        name: formData.name,
        sku: formData.sku || null,
        price: formData.price,
        imagesCount: images.length,
        mainImageIndex,
        active: formData.is_active,
      });

      // Derive sizes from stock
      const sizesFromStock = getAvailableSizes(stockBySize);

      // Main image URL (for backward compatibility)
      const mainImageUrl = images[mainImageIndex] || images[0] || null;

      const productData = {
        name: formData.name,
        sku: formData.sku || null,
        category: formData.category,
        price: formData.price,
        color: formData.color,
        style: formData.style,
        occasion: formData.occasion,
        modeling: formData.modeling,
        sizes: sizesFromStock,
        is_active: formData.is_active,
        image_url: mainImageUrl,
        tags: generateTags(),
        user_id: userId,
        images: images,
        video_url: videoUrl,
        main_image_index: mainImageIndex,
        stock_by_size: stockBySize,
        description: formData.description,
        weight_kg: formData.weight_kg || null,
        length_cm: formData.length_cm || null,
        width_cm: formData.width_cm || null,
        height_cm: formData.height_cm || null,
        discount_type: (formData.discount_type as "percentage" | "fixed" | null) || null,
        discount_value: formData.discount_value || null,
      };

      let savedProductId = product?.id;

      if (product?.id) {
        const { error } = await supabase
          .from("product_catalog")
          .update(productData)
          .eq("id", product.id);

        if (error) {
          runtimeLog("product-form", "submit:update:error", {
            productId: product.id,
            error: toErrorDetails(error),
          }, "error");
          throw error;
        }

        runtimeLog("product-form", "submit:update:success", {
          productId: product.id,
          quickSave,
        });
        toast.success("Produto atualizado!");
      } else {
        const { data: newProduct, error } = await supabase
          .from("product_catalog")
          .insert(productData)
          .select("id")
          .single();

        if (error) {
          runtimeLog("product-form", "submit:create:error", {
            error: toErrorDetails(error),
            payload: {
              name: productData.name,
              sku: productData.sku,
              category: productData.category,
            },
          }, "error");
          throw error;
        }

        savedProductId = newProduct?.id;
        runtimeLog("product-form", "submit:create:success", {
          productId: savedProductId,
          quickSave,
        });
        toast.success("Produto criado!");
      }

      // Generate customer suggestions if product is active
      if (savedProductId && formData.is_active) {
        suggestCustomersForProduct(savedProductId).then((result) => {
          runtimeLog("product-form", "suggest-customers:done", {
            productId: savedProductId,
            count: result.count,
          });
          if (result.count > 0) {
            toast.info(`${result.count} cliente(s) sugerido(s) para avisar!`);
          }
        }).catch((error) => {
          runtimeLog("product-form", "suggest-customers:error", {
            productId: savedProductId,
            error: toErrorDetails(error),
          }, "error");
        });
      }

      runtimeLog("product-form", "submit:complete", {
        productId: savedProductId,
        mode: product?.id ? "update" : "create",
        quickSave,
      });
      onSuccess();
      if (!quickSave) {
        onOpenChange(false);
      }
    } catch (error) {
      const errorDetails = toErrorDetails(error);
      const friendlyMessage = getProductSaveErrorMessage(error);

      runtimeLog("product-form", "submit:exception", {
        mode: product?.id ? "update" : "create",
        productId: product?.id || null,
        quickSave,
        error: errorDetails,
        friendlyMessage,
      }, "error");
      console.error("Error saving product:", error);
      toast.error(friendlyMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {product ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          {/* Image Upload Section */}
          <div className="border border-border rounded-lg p-4">
            <ProductImageUploader
              images={images}
              mainImageIndex={mainImageIndex}
              videoUrl={videoUrl}
              onImagesChange={handleImagesChange}
              onVideoChange={setVideoUrl}
              userId={userId}
            />

            {/* Analyze Button */}
            {images.length > 0 && !analysisResult && (
              <Button
                type="button"
                variant="outline"
                onClick={handleAnalyzeImage}
                disabled={isAnalyzing}
                className="w-full mt-4"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando foto...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analisar foto e sugerir campos
                  </>
                )}
              </Button>
            )}
          </div>

          {/* AI Suggestions UI */}
          {analysisResult && (
            <AnalysisSuggestionUI
              analysis={analysisResult}
              onApply={handleApplyField}
              onApplyAll={handleApplyAll}
              onApplySelected={handleApplySelected}
              onDismiss={clearAnalysis}
              currentValues={{
                category: formData.category,
                color: formData.color,
                style: formData.style,
                occasion: formData.occasion,
                modeling: formData.modeling,
              }}
            />
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do produto"
              />
            </div>

            <div>
              <Label htmlFor="sku">SKU (código único)</Label>
              <Input
                id="sku"
                value={formData.sku || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value || null }))}
                placeholder="Ex: VEST-001"
                className="font-mono"
              />
            </div>

            <div>
              <Label htmlFor="price">Preço *</Label>
              <MoneyInput
                id="price"
                value={formData.price}
                onChange={(value) => setFormData(prev => ({ ...prev, price: value }))}
                placeholder="0,00"
              />
            </div>

            <div>
              <Label>Categoria</Label>
              <Select
                value={formData.category || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Weight and Dimensions Row */}
            <div className="col-span-2 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="weight_kg">Peso (kg) *</Label>
                  {formData.category && CATEGORY_WEIGHTS[formData.category] && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setFormData(prev => ({ ...prev, weight_kg: CATEGORY_WEIGHTS[prev.category!] }))}
                    >
                      Usar sugestão: {CATEGORY_WEIGHTS[formData.category]}kg
                    </Button>
                  )}
                </div>
                <Input
                  id="weight_kg"
                  type="number"
                  step="0.01"
                  min="0"
                  max="30"
                  value={formData.weight_kg ?? ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, weight_kg: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder="Ex: 0.45"
                />
                {!formData.weight_kg && formData.is_active && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Peso obrigatório para produtos ativos. O frete usará 0.30kg como padrão.</p>
                )}
              </div>

              <div>
                <Label className="text-muted-foreground text-xs mb-2 block">
                  Dimensões (cm) - opcional, padrão: {DEFAULT_DIMENSIONS.length}x{DEFAULT_DIMENSIONS.width}x{DEFAULT_DIMENSIONS.height}
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.length_cm ?? ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, length_cm: e.target.value ? parseFloat(e.target.value) : null }))}
                      placeholder="Comp."
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.width_cm ?? ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, width_cm: e.target.value ? parseFloat(e.target.value) : null }))}
                      placeholder="Larg."
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.height_cm ?? ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, height_cm: e.target.value ? parseFloat(e.target.value) : null }))}
                      placeholder="Alt."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Style Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cor</Label>
              <div className="space-y-2">
                <Select
                  value={availableColors.includes(formData.color || "") ? formData.color || "" : "new_color"}
                  onValueChange={(value) => {
                    if (value === "new_color") {
                      setFormData(prev => ({ ...prev, color: "" }));
                    } else {
                      setFormData(prev => ({ ...prev, color: value }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColors.map(color => (
                      <SelectItem key={color} value={color}>{color}</SelectItem>
                    ))}
                    <SelectItem value="new_color" className="font-medium text-primary">
                      + Nova Cor...
                    </SelectItem>
                  </SelectContent>
                </Select>

                {(!availableColors.includes(formData.color || "") || formData.color === "") && (
                  <Input
                    placeholder="Digite a cor..."
                    value={formData.color || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="mt-2 animate-in fade-in slide-in-from-top-1"
                    autoFocus
                  />
                )}
              </div>
            </div>

            <div>
              <Label>Estilo</Label>
              <Select
                value={formData.style || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, style: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map(style => (
                    <SelectItem key={style} value={style}>{style}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ocasião</Label>
              <Select
                value={formData.occasion || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, occasion: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {OCCASIONS.map(occ => (
                    <SelectItem key={occ} value={occ}>{occ}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Modelagem</Label>
              <Select
                value={formData.modeling || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, modeling: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {MODELINGS.map(mod => (
                    <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stock by Size */}
          <div className="border border-border rounded-lg p-4">
            <StockBySize
              stock={stockBySize}
              onChange={setStockBySize}
            />
          </div>

          {/* Discount */}
          <div className="border border-border rounded-lg p-4">
            <ProductDiscountFields
              discountType={formData.discount_type || null}
              discountValue={formData.discount_value ?? null}
              onDiscountTypeChange={(value) => setFormData(prev => ({ ...prev, discount_type: value }))}
              onDiscountValueChange={(value) => setFormData(prev => ({ ...prev, discount_value: value }))}
              label="Desconto no Catálogo"
            />
            {formData.discount_type && formData.discount_value && formData.price > 0 && (
              <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/30 rounded text-sm">
                <span className="text-muted-foreground line-through">
                  R$ {formData.price.toFixed(2)}
                </span>
                <span className="ml-2 font-bold text-green-600">
                  R$ {calculateDiscountedPrice(formData.price, formData.discount_type, formData.discount_value).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Descrição</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDescription || images.length === 0}
                title={images.length === 0 ? "Adicione uma imagem primeiro" : "Gerar descrição premium com IA"}
              >
                {isGeneratingDescription ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                {isGeneratingDescription ? "Gerando..." : "Gerar com IA"}
              </Button>
            </div>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição detalhada do produto..."
              rows={3}
            />
          </div>

          {/* Customer Suggestions - only show when editing existing product */}
          {product?.id && (
            <div className="border-t pt-6">
              <CustomerSuggestions
                productId={product.id}
                productName={formData.name || product.name}
              />
            </div>
          )}

          {/* Active Status */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked as boolean }))}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Produto ativo (visível no catálogo)
            </Label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={(e) => handleSubmit(e, true)}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar rápido"}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar completo"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
