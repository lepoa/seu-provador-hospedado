import { Component, ReactNode } from "react";
import { runtimeLog } from "@/lib/runtimeLogger";

type GlobalErrorBoundaryState = {
  hasError: boolean;
};

export default class GlobalErrorBoundary extends Component<{ children: ReactNode }, GlobalErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    runtimeLog("runtime", "global-error-boundary", { error }, "error");
    if (import.meta.env.DEV) {
      console.error("[global-error-boundary]", error);
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">Erro ao carregar pagina.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-opacity hover:opacity-85"
        >
          Clique para recarregar.
        </button>
      </div>
    );
  }
}
