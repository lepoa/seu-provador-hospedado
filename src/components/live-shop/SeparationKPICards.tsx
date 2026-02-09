import { Card, CardContent } from "@/components/ui/card";
import { 
  Package, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle, 
  XCircle,
  TrendingUp
} from "lucide-react";
import type { SeparationKPIs } from "@/types/separation";

interface SeparationKPICardsProps {
  kpis: SeparationKPIs;
}

export function SeparationKPICards({ kpis }: SeparationKPICardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Total bags */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">Sacolas</span>
          </div>
          <p className="text-2xl font-bold mt-1">{kpis.totalBags}</p>
        </CardContent>
      </Card>

      {/* Separated */}
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-sm text-green-700">Separadas</span>
          </div>
          <p className="text-2xl font-bold text-green-700 mt-1">{kpis.bagsSeparated}</p>
        </CardContent>
      </Card>

      {/* Pending */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-blue-700">Pendentes</span>
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-1">{kpis.bagsPending}</p>
        </CardContent>
      </Card>

      {/* Attention */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-amber-700">Atenção</span>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-1">{kpis.bagsAttention}</p>
        </CardContent>
      </Card>

      {/* Cancelled bags */}
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="text-sm text-red-700">Cancelados</span>
          </div>
          <p className="text-2xl font-bold text-red-700 mt-1">{kpis.bagsCancelled}</p>
        </CardContent>
      </Card>

      {/* Separation percentage */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-sm text-primary">Progresso</span>
          </div>
          <p className="text-2xl font-bold text-primary mt-1">{kpis.separationPercentage}%</p>
        </CardContent>
      </Card>
    </div>
  );
}
