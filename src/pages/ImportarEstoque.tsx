import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileSpreadsheet, Check, X, AlertCircle, Download, History, Plus, Archive, Merge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { reconcileCommittedAfterImport, calculateDisplayStock } from "@/lib/stockCalculation";
import { useAuth } from "@/hooks/useAuth";
import { loadExcelJS } from "@/lib/loadExcel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// New format: REFERENCIA + COR1DESC as unique product
interface NewFormatRow {
  referencia: string;
  tipoDesc: string;
  cor1Desc: string;
  stockBySize: Record<string, number>;
  prices: number[]; // All PRCVENDA values for this group
}

interface GroupedProduct {
  groupKey: string; // REFERENCIA-slug(COR1DESC)
  referencia: string;
  color: string;
  productName: string;
  stockBySize: Record<string, number>;
  price: number;
  hasPriceVariation: boolean;
  existingProductId?: string;
  isNew: boolean;
  hasNegativeValues: boolean;
  hasZeroStock: boolean; // Flag for products with no stock > 0
  mappedSizesCount: number; // How many size columns were mapped
}

interface ImportResult {
  updatedCount: number;
  createdCount: number;
  negativeValuesWarning: boolean;
  showResult: boolean;
}

interface ImportHistory {
  id: string;
  filename: string;
  total_rows: number;
  matched_count: number;
  unmatched_count: number;
  created_at: string;
}

// Size columns to look for in new format - expanded list with variations
const SIZE_COLUMNS = [
  "PP", "P", "M", "G", "GG", "XG", "XXG", "XXXG",  // Letter sizes
  "UN", "U", "UNICO", "ÚNICO",                       // Universal/unique
  "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "48", "50", "52" // Numeric sizes
];

// Columns to explicitly ignore (not sizes)
const IGNORE_COLUMNS = ["QT", "QTDE", "QUANTIDADE", "TOTAL", "SALDO"];

// Normalize size column name (trim, uppercase, handle common variations)
function normalizeSize(size: string): string {
  const normalized = size.trim().toUpperCase();
  // Map common variations
  if (normalized === "U" || normalized === "UNICO" || normalized === "ÚNICO") return "UN";
  return normalized;
}

// Check if a column should be ignored
function shouldIgnoreColumn(header: string): boolean {
  const normalized = header.trim().toUpperCase();
  return IGNORE_COLUMNS.includes(normalized);
}

// Create URL-safe slug from color name
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ""); // Trim hyphens from start/end
}

// Mapping from ERP color names to normalized form values
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
function normalizeColor(color: string): string {
  if (!color) return color;
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

/**
 * Parse a number from pt-BR format (e.g., "1.234,56" or "159,9")
 * - Accepts number or string
 * - If string: trims, removes currency symbols, handles thousands separator "." and decimal ","
 * - Returns null if empty/null/undefined or invalid (NaN)
 * - NEVER multiplies or scales the value - returns as-is
 */
function parseNumberPtBR(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  
  // If already a number, return it directly (no scaling!)
  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }
  
  let str = String(value).trim();
  if (str === "") return null;
  
  // Remove currency symbols and whitespace
  str = str.replace(/[R$\s]/g, "");
  
  // Auto-detect format based on separator positions
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  
  // Brazilian format: comma is decimal separator (e.g., "1.234,56" or "159,9")
  // US format: dot is decimal separator (e.g., "1,234.56" or "159.9")
  const isCommaDecimal = lastComma > lastDot && lastComma !== -1;
  
  if (isCommaDecimal) {
    // Brazilian: remove thousand separators (dots) and convert comma to dot
    str = str.replace(/\./g, ""); // Remove thousand separators
    str = str.replace(",", "."); // Convert decimal separator
  } else if (lastDot !== -1 || lastComma === -1) {
    // US format or no separators: remove thousand separators (commas)
    str = str.replace(/,/g, ""); // Remove thousand separators
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse price for display/storage - returns 0 if invalid
 * IMPORTANT: Detects if value looks like it's in centavos (> 10000 for prices 
 * that would normally be < 1000 BRL) and auto-divides by 100
 */
function parsePrice(value: unknown): number {
  const result = parseNumberPtBR(value);
  if (result === null) return 0;
  
  // Auto-detect centavos: if value > 10000, it's likely stored as centavos
  // Typical clothing prices are R$50-R$500, so anything > 10000 is suspicious
  // A R$ 159,90 stored as centavos would be 15990
  // Check: if > 10000 and has 2+ trailing zeros pattern, divide by 100
  if (result > 10000) {
    // This is very likely stored in centavos format
    console.log(`[parsePrice] Auto-converting from centavos: ${result} -> ${result / 100}`);
    return result / 100;
  }
  
  return result;
}

/**
 * Parse stock quantity - returns integer (truncated), 0 if invalid or negative
 * NEVER scales or multiplies the value
 */
function parseStock(value: unknown): number {
  const result = parseNumberPtBR(value);
  if (result === null) return 0;
  // Truncate to integer (no rounding, no scaling)
  const intValue = Math.trunc(result);
  return intValue < 0 ? 0 : intValue;
}

export default function ImportarEstoque() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, rolesLoading, isMerchant } = useAuth();
  
  const [file, setFile] = useState<File | null>(null);
  const [groupedProducts, setGroupedProducts] = useState<GroupedProduct[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [autoCreateProducts, setAutoCreateProducts] = useState(true);
  const [importResult, setImportResult] = useState<ImportResult>({ 
    updatedCount: 0, 
    createdCount: 0, 
    negativeValuesWarning: false, 
    showResult: false 
  });
  const [isMerging, setIsMerging] = useState(false);
  const [totalRowsRead, setTotalRowsRead] = useState(0);

  // Wait for both auth and roles to load before checking access
  useEffect(() => {
    if (!authLoading && !rolesLoading) {
      if (!user || !isMerchant()) {
        navigate("/login");
      }
    }
  }, [user, authLoading, rolesLoading, isMerchant, navigate]);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from("inventory_imports")
      .select("id, filename, total_rows, matched_count, unmatched_count, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (!error && data) {
      setImportHistory(data);
    }
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setShowPreview(false);
      setGroupedProducts([]);
    }
  }, []);

  const parseFile = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    try {
      const ExcelJS = await loadExcelJS();
      const data = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(data);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        toast.error("Planilha vazia");
        setIsProcessing(false);
        return;
      }
      // Convert ExcelJS worksheet to array-of-arrays format (same as old XLSX)
      const jsonData: unknown[][] = [];
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        jsonData.push(row.values ? (row.values as unknown[]).slice(1) : []); // ExcelJS row.values is 1-indexed
      });
      
      // Find header row
      const headerRow = (jsonData[0] || []) as unknown[];

      const headerText = (h: unknown) => String(h ?? "").trim();
      const headerUpper = (h: unknown) => headerText(h).toUpperCase();
      
      // Find column indexes for new format - support both REFERE and REFERENCIA
      let referenciaIndex = headerRow.findIndex((h) => headerUpper(h) === "REFERE");
      // Fallback to REFERENCIA if REFERE not found
      if (referenciaIndex === -1) {
        referenciaIndex = headerRow.findIndex((h) => headerUpper(h).includes("REFERENCIA"));
      }
      
      const tipoDescIndex = headerRow.findIndex((h) => headerUpper(h).includes("TIPODESC"));
      const cor1DescIndex = headerRow.findIndex((h) => headerUpper(h).includes("COR1DESC"));
      const prcVendaIndex = headerRow.findIndex((h) => headerUpper(h).includes("PRCVENDA"));
      
      // Find size columns indexes - normalize column names (trim/uppercase)
      // We keep an array of column indexes per size to safely handle duplicated headers (e.g. "P" twice)
      const sizeColumnIndexes: Record<string, number[]> = {};
      
      for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
        const trimmedHeader = headerText(headerRow[colIdx]);
        if (!trimmedHeader) continue;
        const normalizedHeader = trimmedHeader.toUpperCase();
        
        // Skip columns that should be ignored (QT, QTDE, etc.)
        if (shouldIgnoreColumn(trimmedHeader)) {
          console.log(`Ignoring column: "${trimmedHeader}" at index ${colIdx}`);
          continue;
        }

        // Numeric sizes: accept any header that is a number between 34 and 46 (inclusive)
        const isNumericHeader = /^\d+$/.test(trimmedHeader);
        let normalizedSize: string | null = null;
        if (isNumericHeader) {
          const n = Number(trimmedHeader);
          if (Number.isFinite(n) && n >= 34 && n <= 46) {
            normalizedSize = String(n);
          }
        } else {
          // Letter sizes: normalize and validate against our known list
          const candidate = normalizeSize(normalizedHeader);
          if (SIZE_COLUMNS.includes(candidate)) {
            normalizedSize = candidate;
          }
        }

        if (!normalizedSize) continue;

        if (!sizeColumnIndexes[normalizedSize]) sizeColumnIndexes[normalizedSize] = [];
        sizeColumnIndexes[normalizedSize].push(colIdx);
        
        if (sizeColumnIndexes[normalizedSize].length > 1) {
          console.log(`Mapped duplicate size column: "${trimmedHeader}" -> "${normalizedSize}" at index ${colIdx}`);
        } else {
          console.log(`Mapped size column: "${trimmedHeader}" -> "${normalizedSize}" at index ${colIdx}`);
        }
      }
      
      console.log("Final mapped size columns:", sizeColumnIndexes);
      
      console.log("Header mapping:", { 
        referenciaIndex, 
        tipoDescIndex,
        cor1DescIndex, 
        prcVendaIndex, 
        sizeColumnIndexes,
        headerRow: headerRow.slice(0, 20) // Log first 20 columns for debugging
      });
      
      if (referenciaIndex === -1 || tipoDescIndex === -1 || cor1DescIndex === -1) {
        toast.error("Colunas obrigatórias não encontradas: REFERE/REFERENCIA, TIPODESC, COR1DESC");
        setIsProcessing(false);
        return;
      }
      
      if (Object.keys(sizeColumnIndexes).length === 0) {
        toast.error("Nenhuma coluna de tamanho encontrada (PP/P/M/G/GG/UN ou numéricas 34–46 como 36/38/40/42/44)");
        setIsProcessing(false);
        return;
      }
      
      if (prcVendaIndex === -1) {
        toast.warning("Coluna PRCVENDA não encontrada - preços serão definidos como 0");
      }
      
      // Parse rows - group by REFERENCIA + COR1DESC
      const productMap = new Map<string, NewFormatRow>();
      let hasNegativeValues = false;
      let rowsRead = 0;
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as unknown[];
        const referencia = String(row[referenciaIndex] || "").trim();
        const tipoDesc = String(row[tipoDescIndex] || "").trim();
        const cor1Desc = String(row[cor1DescIndex] || "").trim();
        
        if (!referencia || !cor1Desc) continue;
        rowsRead++;
        
        // Create unique key: REFERENCIA + COLOR slug
        const colorSlug = slugify(cor1Desc);
        const groupKey = `${referencia}-${colorSlug}`;
        
        // Get or create product entry
        if (!productMap.has(groupKey)) {
          productMap.set(groupKey, {
            referencia,
            tipoDesc,
            cor1Desc,
            stockBySize: {},
            prices: [],
          });
        }
        
        const product = productMap.get(groupKey)!;
        
        // Read price from PRCVENDA column
        if (prcVendaIndex !== -1) {
          const rawPrice = row[prcVendaIndex];
          // DEBUG: Log first 5 rows to understand what XLSX returns
          if (i <= 5) {
            console.log(`[DEBUG Row ${i}] PRCVENDA raw:`, rawPrice, `type: ${typeof rawPrice}`);
          }
          const price = parsePrice(rawPrice);
          if (i <= 5) {
            console.log(`[DEBUG Row ${i}] PRCVENDA parsed:`, price);
          }
          if (price > 0) {
            product.prices.push(price);
          }
        }
        
        // Read stock from size columns - use parseStock for pt-BR format
        for (const [size, colIdxs] of Object.entries(sizeColumnIndexes)) {
          let qtySum = 0;
          for (const colIdx of colIdxs) {
            const rawValue = row[colIdx];
            // DEBUG: Log first 5 rows
            if (i <= 5 && rawValue !== undefined && rawValue !== null && rawValue !== "") {
              console.log(`[DEBUG Row ${i}] Stock ${size} raw:`, rawValue, `type: ${typeof rawValue}`);
            }
            // Use parseStock: handles pt-BR format, truncates to int, no scaling
            const qty = parseStock(rawValue);
            if (i <= 5 && rawValue !== undefined && rawValue !== null && rawValue !== "") {
              console.log(`[DEBUG Row ${i}] Stock ${size} parsed:`, qty);
            }
            
            // Check for negative in original value for warning
            const numericCheck = parseNumberPtBR(rawValue);
            if (numericCheck !== null && numericCheck < 0) {
              hasNegativeValues = true;
            }
            
            qtySum += qty;
          }
          
          // Always write the size key (even if 0) so grade doesn't disappear in preview
          product.stockBySize[size] = (product.stockBySize[size] || 0) + qtySum;
        }
      }
      
      setTotalRowsRead(rowsRead);
      
      // Build grouped products - count ALL mapped columns (including duplicates)
      const mappedSizesCount = Object.values(sizeColumnIndexes).reduce(
        (acc, arr) => acc + arr.length,
        0
      );
      await buildGroupedProducts(Array.from(productMap.values()), hasNegativeValues, mappedSizesCount);
      setShowPreview(true);
      
      if (hasNegativeValues) {
        toast.warning("Valores negativos detectados e normalizados para 0");
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error("Erro ao ler arquivo");
    } finally {
      setIsProcessing(false);
    }
  };

  const buildGroupedProducts = async (rows: NewFormatRow[], hasNegativeValues: boolean, mappedSizesCount: number) => {
    // Build SKUs to check for existing products
    const skus = rows.map(r => `${r.referencia}-${slugify(r.cor1Desc)}`);
    
    // Fetch existing products by SKU
    const { data: existingProducts, error } = await supabase
      .from("product_catalog")
      .select("id, sku, group_key, name")
      .in("sku", skus);
    
    if (error) {
      console.error("Error fetching products:", error);
    }
    
    const productBySku = new Map(
      existingProducts?.map(p => [p.sku, p]) || []
    );
    
    // Build grouped products array
    const grouped: GroupedProduct[] = rows.map(row => {
      const sku = `${row.referencia}-${slugify(row.cor1Desc)}`;
      const existingProduct = productBySku.get(sku);
      
      // Check if any size has stock > 0
      const totalStock = Object.values(row.stockBySize).reduce((sum, qty) => sum + qty, 0);
      const hasZeroStock = totalStock === 0;
      
      // Determine price and variation
      const uniquePrices = [...new Set(row.prices)];
      const hasPriceVariation = uniquePrices.length > 1;
      const price = uniquePrices.length > 0 ? Math.max(...uniquePrices) : 0;
      
      return {
        groupKey: sku,
        referencia: row.referencia,
        color: normalizeColor(row.cor1Desc), // Normalize color for form compatibility
        productName: row.tipoDesc,
        stockBySize: row.stockBySize, // Keep all sizes for database (including zeros)
        price,
        hasPriceVariation,
        existingProductId: existingProduct?.id,
        isNew: !existingProduct,
        hasNegativeValues,
        hasZeroStock,
        mappedSizesCount,
      };
    });
    
    setGroupedProducts(grouped);
  };

  const applyChanges = async () => {
    if (groupedProducts.length === 0) {
      toast.error("Nenhum produto para processar");
      return;
    }
    
    setIsApplying(true);
    let updatedCount = 0;
    let createdCount = 0;
    const hasNegativeValues = groupedProducts.some(p => p.hasNegativeValues);
    
    try {
      for (const product of groupedProducts) {
        const sizes = Object.entries(product.stockBySize)
          .filter(([, qty]) => qty > 0)
          .map(([size]) => size);
        
        if (product.existingProductId) {
          // LAYERED STOCK MODEL: 
          // 1. Fetch current product to get previous ERP stock and committed
          const { data: currentProduct } = await supabase
            .from("product_catalog")
            .select("erp_stock_by_size, committed_by_size")
            .eq("id", product.existingProductId)
            .single();
          
          const prevErpStock = (currentProduct?.erp_stock_by_size || {}) as Record<string, number>;
          const currentCommitted = (currentProduct?.committed_by_size || {}) as Record<string, number>;
          
          // 2. Reconcile committed: if ERP decreased, reduce committed
          const reconciledCommitted = reconcileCommittedAfterImport(
            prevErpStock,
            product.stockBySize,
            currentCommitted
          );
          
          // 3. Calculate display stock = ERP - committed (for backward compat)
          const displayStock = calculateDisplayStock(product.stockBySize, reconciledCommitted);
          
          // Update existing product with layered stock
          const { error } = await supabase
            .from("product_catalog")
            .update({ 
              erp_stock_by_size: product.stockBySize,  // New ERP stock
              committed_by_size: reconciledCommitted,   // Reconciled committed
              stock_by_size: displayStock,              // Display stock = ERP - committed
              sizes: sizes,
            })
            .eq("id", product.existingProductId);
          
          if (error) {
            console.error("Error updating product:", product.groupKey, error);
          } else {
            updatedCount++;
          }
        } else if (autoCreateProducts) {
          // Create new product as archived/draft
          // New products start with ERP stock = stock_by_size, committed = 0
          const sku = product.groupKey;
          const description = `${product.productName} - ${product.color} (${product.referencia})`;
          
          const { error } = await supabase
            .from("product_catalog")
            .insert({
              user_id: user?.id,
              sku: sku,
              group_key: product.referencia,
              name: product.productName,
              color: product.color,
              description: description,
              price: product.price,
              is_active: false, // archived = true means is_active = false
              created_from_import: true,
              erp_stock_by_size: product.stockBySize, // New: ERP source
              committed_by_size: {},                   // New: No commitments yet
              stock_by_size: product.stockBySize,     // Display = ERP for new products
              sizes: sizes,
              tags: product.hasPriceVariation ? ["revisao-preco"] : [],
            });
          
          if (error) {
            console.error("Error creating product:", product.groupKey, error);
          } else {
            createdCount++;
          }
        }
      }
      
      // Save import history
      const newProducts = groupedProducts.filter(p => p.isNew);
      const existingProducts = groupedProducts.filter(p => !p.isNew);
      
      await supabase
        .from("inventory_imports")
        .insert({
          user_id: user?.id,
          filename: file?.name || "import.xlsx",
          total_rows: totalRowsRead,
          matched_count: existingProducts.length,
          unmatched_count: autoCreateProducts ? 0 : newProducts.length,
          updated_products: existingProducts.map(p => ({ 
            id: p.existingProductId, 
            sku: p.groupKey, 
            name: p.productName 
          })),
          unmatched_skus: autoCreateProducts ? [] : newProducts.map(p => p.groupKey),
        });
      
      loadHistory();
      
      // Show result summary
      setImportResult({
        updatedCount,
        createdCount,
        negativeValuesWarning: hasNegativeValues,
        showResult: true,
      });
      
      // Reset file state but keep result visible
      setFile(null);
      setGroupedProducts([]);
      setShowPreview(false);
      
      if (createdCount > 0) {
        toast.success(`${updatedCount} produtos atualizados e ${createdCount} produtos criados como rascunho!`);
      } else {
        toast.success(`${updatedCount} produtos atualizados!`);
      }
    } catch (error) {
      console.error("Error applying changes:", error);
      toast.error("Erro ao aplicar alterações");
    } finally {
      setIsApplying(false);
    }
  };

  // Merge duplicated products that were imported incorrectly
  const mergeDuplicatedProducts = async () => {
    setIsMerging(true);
    try {
      // Fetch all products created from import
      const { data: importedProducts, error } = await supabase
        .from("product_catalog")
        .select("id, name, sku, stock_by_size, group_key, created_from_import")
        .eq("created_from_import", true);
      
      if (error) {
        toast.error("Erro ao buscar produtos importados");
        return;
      }
      
      if (!importedProducts || importedProducts.length === 0) {
        toast.info("Nenhum produto importado encontrado para consolidar");
        return;
      }
      
      // Group products by SKU
      const groupMap = new Map<string, typeof importedProducts>();
      
      for (const product of importedProducts) {
        const sku = product.sku || product.group_key;
        if (!sku) continue;
        
        if (!groupMap.has(sku)) {
          groupMap.set(sku, []);
        }
        groupMap.get(sku)!.push(product);
      }
      
      let mergedCount = 0;
      let deletedCount = 0;
      
      for (const [sku, products] of groupMap) {
        if (products.length <= 1) continue; // Nothing to merge
        
        // Consolidate into first product
        const mainProduct = products[0];
        const mergedStock: Record<string, number> = (mainProduct.stock_by_size as Record<string, number>) || {};
        
        // Merge data from other products
        for (let i = 1; i < products.length; i++) {
          const otherProduct = products[i];
          const otherStock = (otherProduct.stock_by_size as Record<string, number>) || {};
          
          // Sum stocks
          for (const [size, qty] of Object.entries(otherStock)) {
            mergedStock[size] = (mergedStock[size] || 0) + qty;
          }
        }
        
        // Update main product with merged data
        const { error: updateError } = await supabase
          .from("product_catalog")
          .update({
            stock_by_size: mergedStock,
            sizes: Object.keys(mergedStock).filter(s => mergedStock[s] > 0),
          })
          .eq("id", mainProduct.id);
        
        if (updateError) {
          console.error("Error updating main product:", updateError);
          continue;
        }
        
        // Delete other products
        const idsToDelete = products.slice(1).map(p => p.id);
        const { error: deleteError } = await supabase
          .from("product_catalog")
          .delete()
          .in("id", idsToDelete);
        
        if (deleteError) {
          console.error("Error deleting duplicates:", deleteError);
        } else {
          mergedCount++;
          deletedCount += idsToDelete.length;
        }
      }
      
      if (mergedCount > 0) {
        toast.success(`${mergedCount} produtos consolidados, ${deletedCount} duplicatas removidas!`);
      } else {
        toast.info("Nenhuma duplicata encontrada para consolidar");
      }
    } catch (error) {
      console.error("Error merging products:", error);
      toast.error("Erro ao consolidar produtos");
    } finally {
      setIsMerging(false);
    }
  };

  const downloadTemplate = async () => {
    const ExcelJS = await loadExcelJS();
    const templateData = [
      ["REFERENCIA", "TIPODESC", "COR1DESC", "PRCVENDA", "PP", "P", "M", "G", "GG", "UN", "36", "38", "40", "42"],
      ["YT00172", "TOP CARLA", "PRETO", "129,90", 2, 5, 3, 1, 0, 0, 0, 0, 0, 0],
      ["YT00172", "TOP CARLA", "BRANCO", "129,90", 1, 4, 2, 2, 1, 0, 0, 0, 0, 0],
      ["YT00015", "TOP DANI", "ROSA", "89,90", 0, 3, 5, 2, 0, 0, 0, 0, 0, 0],
    ];
    
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Estoque");
    templateData.forEach(row => ws.addRow(row));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_estoque_novo.xlsx";
    link.click();
    window.URL.revokeObjectURL(url);
  };
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };
  
  const hasPriceVariations = groupedProducts.some(p => p.hasPriceVariation);

  if (authLoading || rolesLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  const newProducts = groupedProducts.filter(p => p.isNew);
  const existingProducts = groupedProducts.filter(p => !p.isNew);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-serif font-bold">Importar Estoque</h1>
            <p className="text-muted-foreground">Novo formato: REFERENCIA + COR = produto único</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Baixar modelo
            </Button>
            <Button 
              variant="outline" 
              onClick={mergeDuplicatedProducts}
              disabled={isMerging}
            >
              <Merge className="h-4 w-4 mr-2" />
              {isMerging ? "Consolidando..." : "Consolidar duplicatas"}
            </Button>
            <Button variant="outline" onClick={() => setShowHistory(true)}>
              <History className="h-4 w-4 mr-2" />
              Histórico
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload de Planilha
            </CardTitle>
            <CardDescription>
              Formato: REFERENCIA, TIPODESC, COR1DESC, PRCVENDA e colunas de tamanho (PP, P, M, G, GG, UN, 36-42)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    {file ? file.name : "Clique ou arraste um arquivo"}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
              
              <Button 
                onClick={parseFile} 
                disabled={!file || isProcessing}
                className="sm:self-end"
              >
                {isProcessing ? "Processando..." : "Processar arquivo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {showPreview && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-primary">{totalRowsRead}</div>
                  <p className="text-sm text-muted-foreground">Linhas lidas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-primary">{groupedProducts.length}</div>
                  <p className="text-sm text-muted-foreground">Produtos (Ref+Cor)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold text-green-600">{existingProducts.length}</span>
                    <span className="text-muted-foreground">/</span>
                    <Plus className="h-5 w-5 text-amber-500" />
                    <span className="text-2xl font-bold text-amber-600">{newProducts.length}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Existentes / Novos</p>
                </CardContent>
              </Card>
            </div>

            {/* Warning for negative values */}
            {groupedProducts.some(p => p.hasNegativeValues) && (
              <Card className="mb-6 border-amber-200 bg-amber-50">
                <CardContent className="pt-6 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <span className="text-amber-800">
                    <strong>Atenção:</strong> Valores negativos foram detectados na planilha e normalizados para 0.
                  </span>
                </CardContent>
              </Card>
            )}

            {/* Warning for price variations */}
            {hasPriceVariations && (
              <Card className="mb-6 border-orange-200 bg-orange-50">
                <CardContent className="pt-6 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  <span className="text-orange-800">
                    <strong>Variação de preço:</strong> Alguns produtos possuem preços diferentes entre tamanhos. 
                    O maior valor foi usado e os produtos foram marcados para revisão.
                  </span>
                </CardContent>
              </Card>
            )}

            {/* Warning for products with zero stock */}
            {groupedProducts.some(p => p.hasZeroStock) && (
              <Card className="mb-6 border-red-200 bg-red-50">
                <CardContent className="pt-6 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-800">
                    <strong>Estoque zerado:</strong> {groupedProducts.filter(p => p.hasZeroStock).length} produto(s) 
                    não possuem estoque ou as colunas de tamanho não foram mapeadas corretamente.
                    {groupedProducts[0]?.mappedSizesCount > 0 && (
                      <span className="block text-sm mt-1">
                        Colunas de tamanho mapeadas: {groupedProducts[0]?.mappedSizesCount}
                      </span>
                    )}
                  </span>
                </CardContent>
              </Card>
            )}

            {/* Grouped Products */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Produtos ({groupedProducts.length})
                </CardTitle>
                <CardDescription>
                  Cada linha = REFERENCIA + COR (produto único)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {autoCreateProducts && newProducts.length > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200 mb-4">
                    <input
                      type="checkbox"
                      id="autoCreate"
                      checked={autoCreateProducts}
                      onChange={(e) => setAutoCreateProducts(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="autoCreate" className="text-sm">
                      <strong>Auto-cadastrar {newProducts.length} produto(s) novo(s) como rascunho</strong>
                    </label>
                  </div>
                )}
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estoque por Tamanho</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedProducts.slice(0, 30).map((product) => (
                      <TableRow key={product.groupKey}>
                        <TableCell>
                          {product.isNew ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              <Plus className="h-3 w-3 mr-1" />
                              Novo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <Check className="h-3 w-3 mr-1" />
                              Atualizar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono font-bold">{product.referencia}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{product.color}</Badge>
                        </TableCell>
                        <TableCell>{product.productName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {product.price > 0 ? (
                              <span className={product.hasPriceVariation ? "text-orange-600 font-medium" : ""}>
                                {formatPrice(product.price)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                            {product.hasPriceVariation && (
                              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                                Variação
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const entries = Object.entries(product.stockBySize);
                              const withStock = entries.filter(([, qty]) => qty > 0);
                              const withoutStock = entries.filter(([, qty]) => qty === 0);
                              
                              if (withStock.length === 0 && entries.length === 0) {
                                return (
                                  <span className="text-xs text-red-500 font-medium">
                                    ⚠️ Colunas não mapeadas
                                  </span>
                                );
                              }
                              
                              if (withStock.length === 0) {
                                return (
                                  <span className="text-xs text-amber-600 font-medium">
                                    ⚠️ Estoque zerado
                                  </span>
                                );
                              }
                              
                              return (
                                <>
                                  {withStock.map(([size, qty]) => (
                                    <Badge key={size} variant="default" className="text-xs">
                                      {size}: {qty}
                                    </Badge>
                                  ))}
                                  {withoutStock.slice(0, 3).map(([size]) => (
                                    <Badge key={size} variant="outline" className="text-xs text-muted-foreground">
                                      {size}: 0
                                    </Badge>
                                  ))}
                                  {withoutStock.length > 3 && (
                                    <span className="text-xs text-muted-foreground">+{withoutStock.length - 3}</span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {groupedProducts.length > 30 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    E mais {groupedProducts.length - 30} produtos...
                  </p>
                )}
              </CardContent>
            </Card>

            <Separator className="my-6" />

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => {
                setShowPreview(false);
                setFile(null);
                setGroupedProducts([]);
              }}>
                Cancelar
              </Button>
              <Button 
                onClick={applyChanges} 
                disabled={isApplying || groupedProducts.length === 0}
              >
                {isApplying ? "Aplicando..." : (
                  `Aplicar (${existingProducts.length} atualizar${newProducts.length > 0 && autoCreateProducts ? ` + ${newProducts.length} criar` : ""})`
                )}
              </Button>
            </div>
          </>
        )}

        {/* Import Result Summary */}
        {importResult.showResult && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <Check className="h-5 w-5" />
                Importação Concluída!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-lg border">
                  <div className="text-2xl font-bold text-primary">{importResult.updatedCount}</div>
                  <p className="text-sm text-muted-foreground">Produtos atualizados</p>
                </div>
                <div className="p-4 bg-white rounded-lg border">
                  <div className="text-2xl font-bold text-amber-600">{importResult.createdCount}</div>
                  <p className="text-sm text-muted-foreground">Produtos criados (rascunho)</p>
                </div>
                {importResult.negativeValuesWarning && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Valores negativos normalizados</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setImportResult({ updatedCount: 0, createdCount: 0, negativeValuesWarning: false, showResult: false })}
                >
                  Fazer nova importação
                </Button>
                {importResult.createdCount > 0 && (
                  <Button onClick={() => navigate("/dashboard?tab=products&filter=imported")}>
                    <Archive className="h-4 w-4 mr-2" />
                    Ver produtos arquivados
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Importações</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Linhas</TableHead>
                <TableHead>Atualizados</TableHead>
                <TableHead>Novos</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {importHistory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.filename}</TableCell>
                  <TableCell>{item.total_rows}</TableCell>
                  <TableCell className="text-green-600">{item.matched_count}</TableCell>
                  <TableCell className="text-amber-600">{item.unmatched_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
