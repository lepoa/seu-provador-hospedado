import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Trophy, 
  Medal, 
  TrendingUp, 
  ArrowUp, 
  ArrowDown,
  Crown,
  Target,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LiveStats {
  eventTitle: string;
  eventDate: string;
  total: number;
  paid: number;
  pending: number;
  cancelled: number;
  totalValue: number;
  paidValue: number;
}

interface RankedLive extends LiveStats {
  rank: number;
  conversionRate: number;
  valueConversionRate: number;
  averageTicket: number;
  score: number; // Composite score for ranking
}

interface LivePerformanceRankingProps {
  liveStats: LiveStats[];
  formatCurrency: (value: number) => string;
}

// Calculate composite performance score
const calculateScore = (stats: LiveStats): number => {
  const conversionRate = stats.total > 0 ? (stats.paid / stats.total) * 100 : 0;
  const valueConversionRate = stats.totalValue > 0 ? (stats.paidValue / stats.totalValue) * 100 : 0;
  const averageTicket = stats.paid > 0 ? stats.paidValue / stats.paid : 0;
  
  // Weight: 40% conversion rate, 40% value conversion, 20% ticket (normalized to 100 scale)
  const normalizedTicket = Math.min((averageTicket / 500) * 100, 100); // Assume R$500 is excellent
  
  return (conversionRate * 0.4) + (valueConversionRate * 0.4) + (normalizedTicket * 0.2);
};

// Get rank icon/badge
const getRankBadge = (rank: number) => {
  switch (rank) {
    case 1:
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100">
          <Crown className="h-5 w-5 text-yellow-600" />
        </div>
      );
    case 2:
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-200">
          <Medal className="h-5 w-5 text-slate-500" />
        </div>
      );
    case 3:
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100">
          <Medal className="h-5 w-5 text-amber-700" />
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-bold text-sm">
          {rank}º
        </div>
      );
  }
};

// Get performance level badge
const getPerformanceBadge = (score: number) => {
  if (score >= 70) {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-300 gap-1">
        <ArrowUp className="h-3 w-3" />
        Excelente
      </Badge>
    );
  } else if (score >= 50) {
    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-300 gap-1">
        <Target className="h-3 w-3" />
        Bom
      </Badge>
    );
  } else if (score >= 30) {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-300 gap-1">
        Regular
      </Badge>
    );
  } else {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-300 gap-1">
        <ArrowDown className="h-3 w-3" />
        Baixo
      </Badge>
    );
  }
};

export function LivePerformanceRanking({ liveStats, formatCurrency }: LivePerformanceRankingProps) {
  if (liveStats.length < 2) {
    return null;
  }

  // Calculate metrics and rank
  const rankedLives: RankedLive[] = liveStats
    .map(stats => ({
      ...stats,
      conversionRate: stats.total > 0 ? (stats.paid / stats.total) * 100 : 0,
      valueConversionRate: stats.totalValue > 0 ? (stats.paidValue / stats.totalValue) * 100 : 0,
      averageTicket: stats.paid > 0 ? stats.paidValue / stats.paid : 0,
      score: calculateScore(stats),
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((live, index) => ({
      ...live,
      rank: index + 1,
    }));

  // Calculate averages for comparison
  const avgConversion = rankedLives.reduce((sum, l) => sum + l.conversionRate, 0) / rankedLives.length;
  const avgValueConversion = rankedLives.reduce((sum, l) => sum + l.valueConversionRate, 0) / rankedLives.length;
  const avgTicket = rankedLives.filter(l => l.averageTicket > 0).reduce((sum, l) => sum + l.averageTicket, 0) / 
    rankedLives.filter(l => l.averageTicket > 0).length || 0;

  const topPerformer = rankedLives[0];
  const bottomPerformer = rankedLives[rankedLives.length - 1];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Ranking de Performance
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Comparação automática entre lives rastreadas
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top Performers Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Best Performer */}
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-yellow-600" />
                <span className="text-xs font-medium text-yellow-700">Melhor Performance</span>
              </div>
              <p className="font-semibold text-sm truncate">{topPerformer.eventTitle}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-yellow-700">{topPerformer.conversionRate.toFixed(0)}%</span>
                <span className="text-xs text-muted-foreground">conversão</span>
              </div>
            </CardContent>
          </Card>

          {/* Average */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Média Geral</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold">{avgConversion.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">Conversão</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{formatCurrency(avgTicket)}</p>
                  <p className="text-xs text-muted-foreground">Ticket</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Needs Attention */}
          <Card className="bg-red-50/50 border-red-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDown className="h-5 w-5 text-red-500" />
                <span className="text-xs font-medium text-red-700">Menor Performance</span>
              </div>
              <p className="font-semibold text-sm truncate">{bottomPerformer.eventTitle}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-red-600">{bottomPerformer.conversionRate.toFixed(0)}%</span>
                <span className="text-xs text-muted-foreground">conversão</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ranking Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Live</TableHead>
                <TableHead className="text-center">Conversão</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Valor Conv.</TableHead>
                <TableHead className="text-center hidden md:table-cell">Ticket Médio</TableHead>
                <TableHead className="text-center">Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedLives.map((live) => {
                const isAboveAvg = live.conversionRate > avgConversion;
                
                return (
                  <TableRow key={live.eventTitle} className={live.rank <= 3 ? "bg-muted/20" : ""}>
                    <TableCell className="text-center">
                      {getRankBadge(live.rank)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm truncate max-w-[150px]">{live.eventTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(live.eventDate), "dd/MM/yy", { locale: ptBR })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-semibold ${isAboveAvg ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {live.conversionRate.toFixed(0)}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {live.paid}/{live.total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      <span className={`font-medium ${live.valueConversionRate > avgValueConversion ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {live.valueConversionRate.toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center hidden md:table-cell">
                      <span className="font-medium">
                        {formatCurrency(live.averageTicket)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {getPerformanceBadge(live.score)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground pt-2">
          <span>Score = 40% conversão + 40% valor + 20% ticket</span>
        </div>
      </CardContent>
    </Card>
  );
}
