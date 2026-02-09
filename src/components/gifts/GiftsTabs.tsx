import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Wand2 } from "lucide-react";
import { GiftsManager } from "./GiftsManager";
import { GiftRulesManager } from "./GiftRulesManager";

export function GiftsTabs() {
  return (
    <Tabs defaultValue="gifts" className="space-y-4">
      {/* Scrollable tabs on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <TabsList className="inline-flex w-max sm:w-auto">
          <TabsTrigger value="gifts" className="gap-2 min-h-[44px] px-4">
            <Gift className="h-4 w-4" />
            <span>Brindes</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2 min-h-[44px] px-4">
            <Wand2 className="h-4 w-4" />
            <span>Regras</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="gifts">
        <GiftsManager />
      </TabsContent>

      <TabsContent value="rules">
        <GiftRulesManager />
      </TabsContent>
    </Tabs>
  );
}
