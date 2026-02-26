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
          "group rounded-2xl border border-[#d4bf98] bg-[#fffaf0] p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(17,37,31,0.10)]",
          highlight && "border-[#b99653] bg-gradient-to-br from-[#fffaf0] to-[#f5e9d0]"
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center",
              highlight
                ? "bg-gradient-to-br from-[#dfc89b]/55 to-[#d0b57d]/40"
                : "bg-[#efe2c8]"
            )}
          >
            <Icon className={cn("h-5 w-5", highlight ? "text-[#8a672d]" : "text-[#726a5e]")} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#1f1d1a]">{title}</h3>
              {badge && (
                <span className="rounded-full bg-[#a37d38] px-1.5 py-0.5 text-[10px] font-semibold text-[#fff7e8]">
                  {badge}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs font-medium text-[#6e675a]">{description}</p>
            
            {status && (
              <div className="mt-2">
                <span
                  className={cn(
                    "text-[10px] font-medium px-2 py-1 rounded-full",
                    status.variant === "success" && "bg-[#dcead7] text-[#2f5a36]",
                    status.variant === "warning" && "bg-[#f2e2c4] text-[#8a5f20]",
                    status.variant === "muted" && "bg-[#ece4d3] text-[#726a5e]",
                    status.variant === "default" && "bg-[#dce4dc] text-[#1d3b31]"
                  )}
                >
                  {status.label}
                </span>
              </div>
            )}
          </div>

          <ChevronRight className="h-5 w-5 shrink-0 text-[#726a5e] opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </Link>
  );
}
