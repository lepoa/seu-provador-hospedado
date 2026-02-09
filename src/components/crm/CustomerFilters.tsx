import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CustomerFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  styleFilter: string;
  onStyleFilterChange: (value: string) => void;
  sizeFilter: string;
  onSizeFilterChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
  availableStyles: string[];
}

const QUICK_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "incomplete", label: "Cadastro incompleto" },
  { value: "has_orders", label: "Já compraram" },
  { value: "no_orders", label: "Nunca compraram" },
  { value: "has_quiz", label: "Com quiz" },
  { value: "no_quiz", label: "Sem quiz" },
  { value: "recent", label: "Últimos 7 dias" },
];

const SIZES = [
  { value: "_all", label: "Todos tamanhos" },
  { value: "PP", label: "PP" },
  { value: "P", label: "P" },
  { value: "M", label: "M" },
  { value: "G", label: "G" },
  { value: "GG", label: "GG" },
  { value: "34", label: "34" },
  { value: "36", label: "36" },
  { value: "38", label: "38" },
  { value: "40", label: "40" },
  { value: "42", label: "42" },
  { value: "44", label: "44" },
  { value: "46", label: "46" },
];

export function CustomerFilters({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  styleFilter,
  onStyleFilterChange,
  sizeFilter,
  onSizeFilterChange,
  totalCount,
  filteredCount,
  availableStyles,
}: CustomerFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Search + Dropdowns row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou estilo..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={styleFilter} onValueChange={onStyleFilterChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Estilo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos estilos</SelectItem>
            {availableStyles.map((style) => (
              <SelectItem key={style} value={style}>
                {style}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sizeFilter} onValueChange={onSizeFilterChange}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Tamanho" />
          </SelectTrigger>
          <SelectContent>
            {SIZES.map((size) => (
              <SelectItem key={size.value} value={size.value}>
                {size.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="h-10 px-3 flex items-center gap-1 whitespace-nowrap">
          {filteredCount} / {totalCount} clientes
        </Badge>
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
