import { useState } from "react";
import { format, isAfter, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Tag,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Calendar,
  Percent,
  DollarSign,
  Pencil,
  Store,
  Clock,
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { usePromotionalTables } from "@/hooks/usePromotionalTables";
import { PromotionalTableFormModal } from "./PromotionalTableFormModal";
import type { PromotionalTable, PromotionalTableInsert } from "@/types/promotionalTables";

export function PromotionalTablesManager() {
  const { tables, isLoading, createTable, updateTable, deleteTable, toggleActive } =
    usePromotionalTables();
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTable, setEditingTable] = useState<PromotionalTable | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCreate = () => {
    setEditingTable(null);
    setShowFormModal(true);
  };

  const handleEdit = (table: PromotionalTable) => {
    setEditingTable(table);
    setShowFormModal(true);
  };

  const handleDelete = async (table: PromotionalTable) => {
    if (!confirm(`Excluir a tabela "${table.name}"?`)) return;
    await deleteTable(table.id);
  };

  const handleSubmit = async (data: PromotionalTableInsert) => {
    if (editingTable) {
      return await updateTable(editingTable.id, data);
    }
    return await createTable(data);
  };

  const filteredTables = tables.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase())
  );

  const getTableStatus = (table: PromotionalTable) => {
    if (!table.is_active) return { label: "Inativa", variant: "secondary" as const };

    const now = new Date();
    if (table.start_at && isAfter(parseISO(table.start_at), now)) {
      return { label: "Agendada", variant: "outline" as const };
    }
    if (table.end_at && isBefore(parseISO(table.end_at), now)) {
      return { label: "Expirada", variant: "destructive" as const };
    }
    return { label: "Ativa", variant: "default" as const };
  };

  const formatDiscount = (type: string | null, value: number | null) => {
    if (!type || !value) return "-";
    if (type === "percentage") return `${value}%`;
    return `R$ ${value.toFixed(2)}`;
  };

  const getChannelLabel = (scope: string) => {
    switch (scope) {
      case "catalog":
        return "Catálogo";
      case "live":
        return "Live";
      default:
        return "Todos";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Tabelas Promocionais
            </CardTitle>
            <CardDescription>
              Regras de preço com agendamento e descontos por loja, categoria ou produto
            </CardDescription>
          </div>
          <Button onClick={handleCreate} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1" />
            Nova Tabela
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tabelas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-secondary/50 rounded-lg text-center">
            <div className="text-2xl font-bold">{tables.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">
              {tables.filter((t) => getTableStatus(t).label === "Ativa").length}
            </div>
            <div className="text-xs text-muted-foreground">Ativas</div>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
            <div className="text-2xl font-bold text-amber-600">
              {tables.filter((t) => getTableStatus(t).label === "Agendada").length}
            </div>
            <div className="text-xs text-muted-foreground">Agendadas</div>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredTables.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma tabela promocional encontrada</p>
            <Button variant="link" onClick={handleCreate} className="mt-2">
              Criar primeira tabela
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTables.map((table) => {
              const status = getTableStatus(table);
              const isExpanded = expandedId === table.id;
              const hasStoreDiscount = !!table.store_discount_type && !!table.store_discount_value;
              const hasCategoryDiscounts = table.category_discounts.length > 0;
              const hasProductDiscounts = table.product_discounts.length > 0;

              return (
                <Collapsible
                  key={table.id}
                  open={isExpanded}
                  onOpenChange={() => setExpandedId(isExpanded ? null : table.id)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    {/* Header */}
                    <div className="p-4 bg-card flex flex-col sm:flex-row sm:items-center gap-3">
                      <CollapsibleTrigger asChild>
                        <button className="flex-1 flex items-start gap-3 text-left">
                          <div className="mt-1">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{table.name}</span>
                              <Badge variant={status.variant}>{status.label}</Badge>
                              <Badge variant="outline" className="text-xs">
                                {getChannelLabel(table.channel_scope)}
                              </Badge>
                            </div>
                            {table.description && (
                              <p className="text-sm text-muted-foreground mt-1 truncate">
                                {table.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                              {(table.start_at || table.end_at) && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {table.start_at &&
                                    format(parseISO(table.start_at), "dd/MM HH:mm", {
                                      locale: ptBR,
                                    })}
                                  {table.start_at && table.end_at && " → "}
                                  {table.end_at &&
                                    format(parseISO(table.end_at), "dd/MM HH:mm", {
                                      locale: ptBR,
                                    })}
                                </span>
                              )}
                              {hasStoreDiscount && (
                                <span className="flex items-center gap-1">
                                  <Store className="h-3 w-3" />
                                  {formatDiscount(
                                    table.store_discount_type,
                                    table.store_discount_value
                                  )}
                                </span>
                              )}
                              {hasCategoryDiscounts && (
                                <span className="flex items-center gap-1">
                                  <Tag className="h-3 w-3" />
                                  {table.category_discounts.length} cat.
                                </span>
                              )}
                              {hasProductDiscounts && (
                                <span className="flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  {table.product_discounts.length} prod.
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(table)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActive(table)}
                          title={table.is_active ? "Desativar" : "Ativar"}
                        >
                          {table.is_active ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(table)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <CollapsibleContent>
                      <div className="border-t p-4 bg-muted/30 space-y-4">
                        {/* Store Discount */}
                        {hasStoreDiscount && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Store className="h-4 w-4" />
                              Desconto Geral
                            </h4>
                            <div className="text-sm">
                              {formatDiscount(
                                table.store_discount_type,
                                table.store_discount_value
                              )}
                              {table.store_min_order_value && table.store_min_order_value > 0 && (
                                <span className="text-muted-foreground ml-2">
                                  (mín. R$ {table.store_min_order_value.toFixed(2)})
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Category Discounts */}
                        {hasCategoryDiscounts && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Tag className="h-4 w-4" />
                              Por Categoria
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {table.category_discounts.map((cd) => (
                                <Badge key={cd.category} variant="secondary" className="capitalize">
                                  {cd.category}: {formatDiscount(cd.discount_type, cd.discount_value)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Product Discounts */}
                        {hasProductDiscounts && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              Por Produto
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {table.product_discounts.map((pd) => (
                                <Badge key={pd.product_id} variant="secondary">
                                  {pd.product_name || pd.product_id.slice(0, 8)}:{" "}
                                  {formatDiscount(pd.discount_type, pd.discount_value)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {!hasStoreDiscount && !hasCategoryDiscounts && !hasProductDiscounts && (
                          <p className="text-sm text-muted-foreground">
                            Nenhum desconto configurado
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Form Modal */}
      <PromotionalTableFormModal
        open={showFormModal}
        onOpenChange={setShowFormModal}
        table={editingTable}
        onSubmit={handleSubmit}
      />
    </Card>
  );
}
