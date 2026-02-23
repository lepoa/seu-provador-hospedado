import { ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AILookConsultant } from "@/components/home/AILookConsultant";
import logoLepoa from "@/assets/logo-lepoa.png";

export default function DashboardConsultoraPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logoLepoa} alt="LE.POA" className="h-8" />
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-base font-semibold">Sua Consultora Digital</h1>
            </div>
          </div>
        </div>
      </header>

      <AILookConsultant />
    </div>
  );
}
