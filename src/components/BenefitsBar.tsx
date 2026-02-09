import { Truck, Percent, CreditCard, MessageCircle } from "lucide-react";

const benefits = [
  { icon: CreditCard, text: "3x sem juros" },
  { icon: MessageCircle, text: "Fale Conosco" },
];

export function BenefitsBar() {
  return (
    <div className="benefits-bar">
      <div className="container mx-auto flex items-center justify-center gap-4 md:gap-8 overflow-x-auto">
        {benefits.map((benefit, index) => (
          <div key={index} className="flex items-center gap-1.5 whitespace-nowrap text-xs md:text-sm">
            <benefit.icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span>{benefit.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
