import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installRuntimeDiagnostics, runtimeLog } from "@/lib/runtimeLogger";

installRuntimeDiagnostics();
runtimeLog("app", "bootstrap", { mode: import.meta.env.MODE });

createRoot(document.getElementById("root")!).render(<App />);
