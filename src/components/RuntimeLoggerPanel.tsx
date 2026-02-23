import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getRuntimeLogs, runtimeLog } from "@/lib/runtimeLogger";

const MAX_VISIBLE_ENTRIES = 400;

export default function RuntimeLoggerPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const logs = useMemo(() => getRuntimeLogs(), [refreshTick]);
  const visibleLogs = useMemo(() => logs.slice(-MAX_VISIBLE_ENTRIES), [logs]);
  const logPayload = useMemo(() => JSON.stringify(visibleLogs, null, 2), [visibleLogs]);

  useEffect(() => {
    if (!isOpen) return;

    const intervalId = window.setInterval(() => {
      setRefreshTick((current) => current + 1);
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, [isOpen]);

  const togglePanel = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setRefreshTick((current) => current + 1);
    }

    runtimeLog("diagnostics", "panel:toggle", {
      open: nextState,
      totalEntries: getRuntimeLogs().length,
    });
  };

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logPayload);
      runtimeLog("diagnostics", "panel:copy", {
        copiedEntries: visibleLogs.length,
        totalEntries: logs.length,
      });
    } catch (error) {
      runtimeLog("diagnostics", "panel:copy:error", { error }, "error");
    }
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[9999]">
        <Button
          type="button"
          size="sm"
          variant={isOpen ? "destructive" : "secondary"}
          className="shadow-lg"
          onClick={togglePanel}
        >
          {isOpen ? "Fechar Logs" : "Logs Tecnicos"}
        </Button>
      </div>

      {isOpen && (
        <div className="fixed bottom-16 right-4 z-[9999] flex h-[65vh] w-[min(92vw,680px)] flex-col rounded-md border bg-background shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {`Entradas: ${logs.length} | Exibindo ultimas ${visibleLogs.length}`}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setRefreshTick((current) => current + 1)}>
                Atualizar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={copyLogs}>
                Copiar
              </Button>
            </div>
          </div>
          <textarea
            readOnly
            value={logPayload}
            className="h-full w-full resize-none border-0 bg-background p-3 font-mono text-[11px] leading-5 focus:outline-none"
          />
        </div>
      )}
    </>
  );
}
