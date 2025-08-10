import React, { useEffect, useMemo, useRef, useState } from "react";

const WS_UI_URL = (import.meta.env.VITE_REALTIME_WS_UI as string) || "ws://localhost:8081/ui";

type UiEvent =
  | { type: "hello"; serverTime: number }
  | { type: "call-start"; callId: string; from?: string; to?: string }
  | { type: "call-stop"; callId: string }
  | { type: "level"; callId: string; rms: number }
  | { type: "error"; message: string };

export default function Live() {
  const [status, setStatus] = useState<string>("disconnected");
  const [calls, setCalls] = useState<Record<string, { rms: number; from?: string; to?: string }>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_UI_URL);
    wsRef.current = ws;
    ws.onopen = () => setStatus("connected");
    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (ev) => {
      try {
        const msg: UiEvent = JSON.parse(ev.data);
        if (msg.type === "call-start") {
          setCalls((prev) => ({ ...prev, [msg.callId]: { rms: 0, from: msg.from, to: msg.to } }));
        } else if (msg.type === "call-stop") {
          setCalls((prev) => {
            const next = { ...prev };
            delete next[msg.callId];
            return next;
          });
        } else if (msg.type === "level") {
          setCalls((prev) => ({ ...prev, [msg.callId]: { ...(prev[msg.callId] || {}), rms: msg.rms } }));
        }
      } catch (e) {
        // ignore
      }
    };
    return () => ws.close();
  }, []);

  const activeCallIds = useMemo(() => Object.keys(calls), [calls]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="container mx-auto max-w-2xl px-4 py-16">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">Live Call Monitor</h1>
          <p className="text-sm text-muted-foreground">WebSocket status: {status}</p>
          <p className="text-sm text-muted-foreground">UI WS: {WS_UI_URL}</p>
        </header>

        {activeCallIds.length === 0 ? (
          <p className="text-muted-foreground">No active calls</p>
        ) : (
          <div className="space-y-4">
            {activeCallIds.map((id) => {
              const info = calls[id];
              const level = Math.min(100, Math.round(info.rms * 100));
              return (
                <div key={id} className="rounded-md border border-input p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-mono">Call: {id}</p>
                      <p className="text-xs text-muted-foreground">{info.from ? `From: ${info.from}` : ''} {info.to ? `→ ${info.to}` : ''}</p>
                    </div>
                    <div className="w-64 h-3 bg-muted rounded overflow-hidden" aria-label="VU meter">
                      <div className="h-full bg-green-500" style={{ width: `${level}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
} 