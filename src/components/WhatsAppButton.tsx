import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsAppButtonProps {
  href: string;
  variant?: "primary" | "circle";
  label?: string;
  showMicrocopy?: boolean;
  className?: string;
}

export function WhatsAppButton({ 
  href,
  variant = "primary",
  label = "Falar no WhatsApp",
  showMicrocopy = false,
  className,
}: WhatsAppButtonProps) {
  if (variant === "circle") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full",
          "bg-[#25D366] text-white",
          "hover:bg-[#1EBE5D] active:bg-[#18A84F]",
          "transition-colors",
          className
        )}
      >
        <MessageCircle className="h-5 w-5" />
      </a>
    );
  }

  return (
    <div className="w-full">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center justify-center gap-2 w-full h-12",
          "bg-[#25D366] text-white font-medium",
          "rounded-xl",
          "hover:bg-[#1EBE5D] active:bg-[#18A84F]",
          "transition-colors",
          className
        )}
      >
        <MessageCircle className="h-5 w-5" />
        {label}
      </a>
      {showMicrocopy && (
        <p className="text-center text-xs text-muted-foreground mt-2">
          Abrimos o WhatsApp com a mensagem pronta 💛
        </p>
      )}
    </div>
  );
}
