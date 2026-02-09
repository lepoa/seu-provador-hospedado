import { useState, useEffect, useRef } from "react";
import { Check, AlertCircle, Sparkles, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ImageAnalysisResult, FieldAnalysis } from "@/hooks/useImageAnalysis";

// Field options matching ProductForm
const CATEGORIES = ["Vestidos", "Blusas", "Calças", "Saias", "Conjuntos", "Acessórios", "Blazers", "Shorts", "Casacos", "Macacões", "Camisas"];
const COLORS = ["Preto", "Branco", "Bege", "Rosa", "Azul", "Verde", "Vermelho", "Marrom", "Cinza", "Estampado"];
const STYLES = ["elegante", "clássico", "minimal", "romântico", "casual", "moderno", "fashion", "sexy_chic"];
const OCCASIONS = ["trabalho", "casual", "festa", "dia a dia", "especial", "casual_chic", "eventos", "viagem"];
const MODELINGS = ["ajustado", "regular", "soltinho", "oversized", "acinturado", "slim", "reto", "amplo"];

// Common tags for autocomplete
const COMMON_TAGS = [
  "premium", "básico", "tendência", "atemporal", "versátil", "sofisticado",
  "confortável", "leve", "estruturado", "fluido", "minimalista", "estampado",
  "bordado", "renda", "cetim", "linho", "algodão", "seda", "alfaiataria",
  "verão", "inverno", "meia-estação", "praia", "escritório", "noite"
];

interface AnalysisSuggestionUIProps {
  analysis: ImageAnalysisResult;
  onApply: (field: string, value: string) => void;
  onApplyAll: () => void;
  onApplySelected: (selections: SelectedFields) => void;
  onDismiss: () => void;
  currentValues: {
    category: string | null;
    color: string | null;
    style: string | null;
    occasion: string | null;
    modeling: string | null;
  };
}

export interface SelectedFields {
  category: { selected: boolean; value: string | null };
  color: { selected: boolean; value: string | null };
  style: { selected: boolean; value: string | null };
  occasion: { selected: boolean; value: string | null };
  modeling: { selected: boolean; value: string | null };
  tags: string[];
}

const FIELD_LABELS: Record<string, string> = {
  category: "Categoria",
  color: "Cor",
  style: "Estilo",
  occasion: "Ocasião",
  modeling: "Modelagem",
};

const FIELD_OPTIONS: Record<string, string[]> = {
  category: CATEGORIES,
  color: COLORS,
  style: STYLES,
  occasion: OCCASIONS,
  modeling: MODELINGS,
};

// Mapping from AI response values to form values
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

const AI_TO_FORM_COLOR: Record<string, string> = {
  preto: "Preto",
  branco: "Branco",
  bege: "Bege",
  rosa: "Rosa",
  azul: "Azul",
  verde: "Verde",
  vermelho: "Vermelho",
  marrom: "Marrom",
  cinza: "Cinza",
  estampado: "Estampado",
};

function normalizeAIValue(field: string, value: string | null): string | null {
  if (!value) return null;
  
  if (field === "category") {
    return AI_TO_FORM_CATEGORY[value.toLowerCase()] || value;
  }
  if (field === "color") {
    return AI_TO_FORM_COLOR[value.toLowerCase()] || value;
  }
  return value;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.8) {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
        Alta
      </Badge>
    );
  }
  if (confidence >= 0.5) {
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 text-xs">
        Média
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs">
      Baixa
    </Badge>
  );
}

interface EditableFieldProps {
  fieldKey: string;
  aiValue: string | null;
  confidence: number;
  editedValue: string | null;
  isSelected: boolean;
  onValueChange: (value: string | null) => void;
  onSelectionChange: (selected: boolean) => void;
}

function EditableField({
  fieldKey,
  aiValue,
  confidence,
  editedValue,
  isSelected,
  onValueChange,
  onSelectionChange,
}: EditableFieldProps) {
  const options = FIELD_OPTIONS[fieldKey] || [];
  const displayValue = editedValue || "";

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-background">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`select-${fieldKey}`}
          checked={isSelected}
          onCheckedChange={(checked) => onSelectionChange(checked === true)}
        />
        <label 
          htmlFor={`select-${fieldKey}`}
          className="font-medium text-sm flex-1 cursor-pointer"
        >
          {FIELD_LABELS[fieldKey]}
        </label>
        <ConfidenceBadge confidence={confidence} />
      </div>

      <Select
        value={displayValue}
        onValueChange={(val) => onValueChange(val || null)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="capitalize">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {aiValue && editedValue !== aiValue && (
        <p className="text-xs text-muted-foreground">
          Sugestão original: <span className="capitalize">{aiValue}</span>
        </p>
      )}
    </div>
  );
}

interface TagsEditorProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

function TagsEditor({ tags, onTagsChange }: TagsEditorProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = COMMON_TAGS.filter(
    (tag) =>
      !tags.includes(tag) &&
      tag.toLowerCase().includes(inputValue.toLowerCase())
  ).slice(0, 6);

  const handleAddTag = (tag: string) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (normalizedTag && !tags.includes(normalizedTag)) {
      onTagsChange([...tags, normalizedTag]);
    }
    setInputValue("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      handleAddTag(inputValue);
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-background">
      <span className="font-medium text-sm">Tags Sugeridas</span>
      
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="capitalize flex items-center gap-1 pr-1"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (e.target.value) setIsOpen(true);
              }}
              onFocus={() => inputValue && setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Adicionar tag..."
              className="pr-8"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => inputValue && handleAddTag(inputValue)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </PopoverTrigger>
        {filteredSuggestions.length > 0 && (
          <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
            <Command>
              <CommandList>
                <CommandEmpty>Nenhuma sugestão</CommandEmpty>
                <CommandGroup>
                  {filteredSuggestions.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => handleAddTag(tag)}
                      className="capitalize cursor-pointer"
                    >
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}

export function AnalysisSuggestionUI({
  analysis,
  onApply,
  onApplyAll,
  onApplySelected,
  onDismiss,
  currentValues,
}: AnalysisSuggestionUIProps) {
  const fields = ["category", "color", "style", "occasion", "modeling"] as const;
  
  const analysisFieldMap: Record<string, keyof ImageAnalysisResult> = {
    category: "categoria",
    color: "cor",
    style: "estilo",
    occasion: "ocasiao",
    modeling: "modelagem",
  };

  // Initialize state with AI suggestions
  const [selections, setSelections] = useState<SelectedFields>(() => {
    const initial: SelectedFields = {
      category: { selected: true, value: null },
      color: { selected: true, value: null },
      style: { selected: true, value: null },
      occasion: { selected: true, value: null },
      modeling: { selected: true, value: null },
      tags: [],
    };

    fields.forEach((field) => {
      const analysisField = analysis[analysisFieldMap[field]] as FieldAnalysis;
      const normalizedValue = normalizeAIValue(field, analysisField.value);
      initial[field] = {
        selected: !!normalizedValue,
        value: normalizedValue,
      };
    });

    initial.tags = analysis.tags_extras || [];
    
    return initial;
  });

  const handleFieldValueChange = (field: keyof Omit<SelectedFields, "tags">, value: string | null) => {
    setSelections((prev) => ({
      ...prev,
      [field]: { ...prev[field], value },
    }));
  };

  const handleFieldSelectionChange = (field: keyof Omit<SelectedFields, "tags">, selected: boolean) => {
    setSelections((prev) => ({
      ...prev,
      [field]: { ...prev[field], selected },
    }));
  };

  const handleTagsChange = (tags: string[]) => {
    setSelections((prev) => ({ ...prev, tags }));
  };

  const handleApplySelected = () => {
    onApplySelected(selections);
  };

  const handleApplyAllEdited = () => {
    // Select all fields before applying
    const allSelected: SelectedFields = { ...selections };
    fields.forEach((field) => {
      allSelected[field] = { ...allSelected[field], selected: true };
    });
    onApplySelected(allSelected);
  };

  const selectedCount = fields.filter((f) => selections[f].selected && selections[f].value).length;

  return (
    <div className="bg-accent/30 border border-accent rounded-xl p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 text-accent-foreground">
        <Sparkles className="h-5 w-5" />
        <h4 className="font-medium">Sugestões da IA</h4>
        <span className="text-xs text-muted-foreground ml-auto">
          Edite os valores antes de aplicar
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((field) => {
          const analysisField = analysis[analysisFieldMap[field]] as FieldAnalysis;
          return (
            <EditableField
              key={field}
              fieldKey={field}
              aiValue={normalizeAIValue(field, analysisField.value)}
              confidence={analysisField.confidence}
              editedValue={selections[field].value}
              isSelected={selections[field].selected}
              onValueChange={(val) => handleFieldValueChange(field, val)}
              onSelectionChange={(sel) => handleFieldSelectionChange(field, sel)}
            />
          );
        })}
      </div>

      <TagsEditor tags={selections.tags} onTagsChange={handleTagsChange} />

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          size="sm"
          onClick={handleApplySelected}
          disabled={selectedCount === 0}
          className="flex-1 min-w-[140px]"
        >
          <Check className="h-4 w-4 mr-1" />
          Aplicar selecionados ({selectedCount})
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleApplyAllEdited}
          className="flex-1 min-w-[140px]"
        >
          Aplicar todas sugestões
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          Dispensar
        </Button>
      </div>
    </div>
  );
}
