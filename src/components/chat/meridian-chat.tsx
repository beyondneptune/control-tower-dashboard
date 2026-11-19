"use client";

import { useState, useRef, useEffect } from "react";

// The Meridian "face" — a brand-navy mark with a laser spark. Swap for the official logo SVG/PNG anytime.
function MeridianMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Meridian" role="img">
      <rect width="32" height="32" rx="8" fill="#0B2545" />
      <path d="M10.6 8.4h6.1a5.5 5.5 0 0 1 0 11h-2.3v4.2h-3.8V8.4Zm3.8 3.4v4.2h2.1a2.1 2.1 0 0 0 0-4.2h-2.1Z" fill="#fff" />
      <circle cx="23.2" cy="10" r="2.3" fill="#F2A900" />
    </svg>
  );
}

type Msg = { role: "user" | "assistant"; content: string };

function renderText(t: string) {
  return t.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**") ? <b key={j}>{p.slice(2, -2)}</b> : <span key={j}>{p}</span>,
    );
    return (
      <div key={i} className={/^\s*[-•]/.test(line) ? "pl-3" : ""}>
        {line.trim() ? parts : <span className="block h-2" />}
      </div>
    );
  });
}

const SUGGESTIONS = [
  "What's our cash & bank balance?",
  "Which jobs are below cost?",
  "Top 5 customers by order value",
  "What's our biggest margin leak?",
];

export function MeridianChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading, open]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const d = await r.json();
      setMsgs([...next, { role: "assistant", content: d.answer || d.error || "Something went wrong." }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "Network error — please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#0B2545] px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-[#0B2545]/90"
          aria-label="Open Meridian AI"
        >
          <MeridianMark className="h-5 w-5" />
          Ask Meridian AI
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[34rem] max-h-[82vh] w-[24rem] max-w-[92vw] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-2">
              <MeridianMark />
              <div>
                <div className="text-sm font-semibold leading-tight">Meridian AI</div>
                <div className="text-[11px] text-muted-foreground">Ask anything about the company</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="px-1 text-muted-foreground hover:text-foreground" aria-label="Close">✕</button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {msgs.length === 0 && (
              <div className="text-muted-foreground">
                <p className="mb-3">
                  Hi — I&apos;m <b className="text-foreground">Meridian AI</b>. I can see the whole Control Tower —
                  finance, orders, margins, drawings, costing, risks — and answer with live numbers.
                </p>
                <p className="mb-1 text-[11px] uppercase tracking-wide">Try asking:</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="mb-1 block w-full rounded-md border px-2 py-1 text-left text-xs hover:bg-accent">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && <MeridianMark className="mt-0.5 h-5 w-5 shrink-0" />}
                <div className={`max-w-[85%] rounded-lg px-3 py-2 leading-relaxed ${m.role === "user" ? "bg-[#0B2545] text-white" : "bg-muted"}`}>
                  {renderText(m.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <MeridianMark className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="rounded-lg bg-muted px-3 py-2 text-muted-foreground">Meridian AI is thinking…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 border-t p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about finance, orders, margins…"
              className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="rounded-md bg-[#0B2545] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
