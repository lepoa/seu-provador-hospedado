import { Link } from "react-router-dom";
import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  highlight?: boolean;
  status?: {
    label: string;
    variant: "default" | "success" | "warning" | "muted";
  };
}

export function QuickActionCard({
  title,
  description,
  href,
  icon: Icon,
  badge,
  highlight,
  status,
}: QuickActionCardProps) {
  return (
    <Link to={href}>
      <div
        className={cn(
          "bg-card border rounded-xl p-4 hover:shadow-md transition-all group",
          highlight && "border-accent/30 bg-gradient-to-br from-card to-accent/5"
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
              highlight
                ? "bg-gradient-to-br from-accent/20 to-primary/20"
                : "bg-secondary"
            )}
          >
            <Icon className={cn("h-5 w-5", highlight ? "text-accent" : "text-muted-foreground")} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{title}</h3>
              {badge && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            
            {status && (
              <div className="mt-2">
                <span
                  className={cn(
                    "text-[10px] font-medium px-2 py-1 rounded-full",
                    status.variant === "success" && "bg-success/10 text-success",
                    status.variant === "warning" && "bg-amber-100 text-amber-700",
                    status.variant === "muted" && "bg-muted text-muted-foreground",
                    status.variant === "default" && "bg-primary/10 text-primary"
                  )}
                >
                  {status.label}
                </span>
              </div>
            )}
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      </div>
    </Link>
  );
}
