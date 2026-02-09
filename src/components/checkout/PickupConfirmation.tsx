import { Store, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { STORE_CONFIG } from "@/lib/storeDeliveryConfig";

interface PickupConfirmationProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

export function PickupConfirmation({ notes, onNotesChange }: PickupConfirmationProps) {
  return (
    <div className="space-y-4">
      {/* Store Info */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Store className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-green-800">Retirar na Loja</p>
              <p className="text-sm text-green-700 mt-1">{STORE_CONFIG.storeAddress}</p>
              <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
                <Clock className="h-4 w-4" />
                <span>{STORE_CONFIG.storeHours}</span>
              </div>
              <p className="text-lg font-bold text-green-700 mt-2">Grátis</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optional Notes */}
      <Card>
        <CardContent className="p-4">
          <Label className="font-medium mb-2 block">Observações (opcional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Ex: vou buscar amanhã às 10h / outra pessoa vai retirar (nome)..."
            rows={3}
            className="resize-none"
          />
        </CardContent>
      </Card>
    </div>
  );
}
