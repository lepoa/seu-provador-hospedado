import { useCallback } from "react";
import confetti from "canvas-confetti";

interface ConfettiOptions {
  type?: "default" | "stars" | "emoji" | "celebration";
  emoji?: string[];
}

export function useConfetti() {
  const fireConfetti = useCallback((options: ConfettiOptions = {}) => {
    const { type = "default" } = options;

    switch (type) {
      case "stars":
        // Star burst effect
        const starColors = ["#FFD700", "#FFA500", "#FF6B6B", "#9333EA"];
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: starColors,
          shapes: ["star"],
          scalar: 1.2,
        });
        break;

      case "emoji":
        // Custom emoji effect (uses default shapes but with fun colors)
        confetti({
          particleCount: 30,
          spread: 70,
          origin: { y: 0.5 },
          colors: ["#FFD700", "#E91E63", "#9C27B0", "#4CAF50"],
        });
        break;

      case "celebration":
        // Full celebration effect - fireworks style
        const duration = 2000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

        function randomInRange(min: number, max: number) {
          return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function () {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          
          // Confetti from both sides
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            colors: ["#FFD700", "#FF6B6B", "#9333EA", "#22C55E"],
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            colors: ["#FFD700", "#FF6B6B", "#9333EA", "#22C55E"],
          });
        }, 250);
        break;

      default:
        // Simple burst
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#FFD700", "#9333EA", "#22C55E", "#FF6B6B", "#3B82F6"],
        });
    }
  }, []);

  const firePoints = useCallback((points: number) => {
    // Scale confetti based on points earned
    const particleCount = Math.min(30 + points, 100);
    
    confetti({
      particleCount,
      spread: 50 + points,
      origin: { y: 0.7, x: 0.5 },
      colors: ["#FFD700", "#FFA500", "#9333EA"],
      shapes: ["star", "circle"],
      scalar: 0.8,
    });
  }, []);

  const fireLevelUp = useCallback(() => {
    // Epic level up celebration
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 1000,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ["#FFD700"],
    });
    fire(0.2, {
      spread: 60,
      colors: ["#9333EA"],
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      colors: ["#22C55E", "#FFD700"],
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      colors: ["#FF6B6B", "#9333EA"],
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      colors: ["#FFD700", "#FFA500"],
    });
  }, []);

  return { fireConfetti, firePoints, fireLevelUp };
}
