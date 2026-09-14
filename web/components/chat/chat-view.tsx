"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, FileText, Sparkles, Square } from "lucide-react";
import { getDocuments, searchDocuments } from "@/lib/api";
import { ensureAvatarSeed } from "@/lib/profile-avatar";
import { readSearchStream } from "@/lib/search-stream";
import { ProfileAvatar } from "@/components/profile/profile-avatar";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: string[];
  pending?: boolean;
};

const QUERY_TYPES = [
  "A summary",
  "A specific fact",
  "A date or number",
  "Who or what",
];

function errorMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message: string | string[] }).message;
    return Array.isArray(message) ? message.join(" ") : message;
  }
  return "Could not get an answer. Try again.";
}

function uniqueNames(ids: string[], fileNames: Record<string, string>) {
  return ids
    .map((id) => fileNames[id] ?? "A file in your library")
    .filter((name, index, all) => all.indexOf(name) === index);
}

export function ChatView() {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSeed(ensureAvatarSeed());

    let cancelled = false;
    async function loadNames() {
      try {
        const response = await getDocuments();
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        const payload: unknown = await response.json().catch(() => null);
        if (!Array.isArray(payload) || cancelled) return;
        const next: Record<string, string> = {};
        for (const item of payload) {
          if (item && typeof item === "object" && "id" in item && "fileName" in item) {
            const id = (item as { id: unknown }).id;
            const fileName = (item as { fileName: unknown }).fileName;
            if (typeof id === "string" && typeof fileName === "string") {
              next[id] = fileName;
            }
          }
        }
        setFileNames(next);
      } catch {
        // Names are optional; the answer can still stream.
      }
    }
    void loadNames();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [router]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function updateAssistant(id: string, patch: Partial<ChatMessage>) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...patch } : message)),
    );
  }

  function resizeInput() {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }

  async function ask(text = question) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed, sources: [] };
    const assistantId = crypto.randomUUID();
    setQuestion("");
    setError(null);
    setBusy(true);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
    });
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: "assistant", content: "", sources: [], pending: true },
    ]);

    try {
      const response = await searchDocuments(trimmed, controller.signal);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        setError(errorMessage(payload));
        updateAssistant(assistantId, {
          content: "I could not answer that just now.",
          pending: false,
        });
        return;
      }

      let content = "";
      let sources: string[] = [];
      for await (const event of readSearchStream(response)) {
        if (event.type === "sources") {
          sources = event.sources;
          updateAssistant(assistantId, { sources });
        } else if (event.type === "token") {
          content += event.token;
          updateAssistant(assistantId, { content, pending: true });
        } else if (event.type === "error") {
          setError(event.message);
        } else if (event.type === "end") {
          break;
        }
      }

      updateAssistant(assistantId, {
        content: content.trim() || "I could not find an answer in your files.",
        sources,
        pending: false,
      });
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") {
        updateAssistant(assistantId, { pending: false });
        return;
      }
      setError("Could not reach the search. Try again.");
      updateAssistant(assistantId, {
        content: "I could not answer that just now.",
        pending: false,
      });
    } finally {
      setBusy(false);
      if (abortRef.current === controller) abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask();
    }
  }

  return (
    <div className="animate-fade-up flex h-[calc(100vh-8rem)] min-h-[32rem] flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <header className="border-b border-border/70 bg-[radial-gradient(ellipse_at_top_left,oklch(0.88_0.06_185/0.4),transparent_55%)] px-5 py-4 dark:bg-[radial-gradient(ellipse_at_top_left,oklch(0.34_0.05_185/0.35),transparent_55%)]">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight">Chat with your library</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ask in everyday words. Answers come from your files.
            </p>
          </div>
        </div>
      </header>

      <div ref={listRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="animate-pop-in flex size-14 items-center justify-center rounded-3xl bg-accent text-primary shadow-sm">
              <Sparkles className="size-6" />
            </span>
            <p className="animate-fade-up animate-delay-1 mt-4 text-lg font-semibold tracking-tight">Ask about your documents</p>
            <p className="animate-fade-up animate-delay-2 mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              Folio reads only the files in your account and writes a short answer you can check.
            </p>
            <div className="animate-fade-up animate-delay-3 mt-6">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                You can ask for
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {QUERY_TYPES.map((kind) => (
                  <span
                    key={kind}
                    className="rounded-full border border-border/80 bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-sm"
                  >
                    {kind}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const fromUser = message.role === "user";
            const names = uniqueNames(message.sources, fileNames);
            return (
              <article
                key={message.id}
                className={`animate-message-in flex items-end gap-2.5 ${fromUser ? "flex-row-reverse" : ""}`}
              >
                {fromUser ? (
                  seed ? (
                    <ProfileAvatar seed={seed} size={32} className="mb-0.5 shrink-0" />
                  ) : (
                    <span className="mb-0.5 size-8 shrink-0 rounded-full bg-muted" />
                  )
                ) : (
                  <span className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Sparkles className="size-3.5" />
                  </span>
                )}
                <div className={`max-w-[min(100%,36rem)] ${fromUser ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
                  <div
                    className={`px-4 py-3 text-sm leading-6 shadow-sm ${
                      fromUser
                        ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-2xl rounded-bl-md border border-border/70 bg-background"
                    }`}
                  >
                    {message.pending && !message.content ? (
                      <span className="flex h-5 items-center gap-1" aria-label="Thinking">
                        <span className="chat-dot size-1.5 rounded-full bg-current" />
                        <span className="chat-dot size-1.5 rounded-full bg-current" />
                        <span className="chat-dot size-1.5 rounded-full bg-current" />
                      </span>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {message.content}
                        {message.pending ? (
                          <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-px animate-pulse bg-current align-middle" />
                        ) : null}
                      </p>
                    )}
                  </div>
                  {!fromUser && names.length > 0 && !message.pending ? (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {names.map((name) => (
                        <span
                          key={name}
                          className="animate-fade-in inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          <FileText className="size-3" />
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="border-t border-border/70 bg-background/70 px-4 py-3 backdrop-blur sm:px-5">
        {error ? (
          <div className="animate-shake mb-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="flex items-end gap-2 rounded-2xl border border-border/80 bg-card p-2 shadow-sm">
          <label className="sr-only" htmlFor="chat-question">
            Your question
          </label>
          <textarea
            ref={inputRef}
            id="chat-question"
            rows={1}
            value={question}
            disabled={busy}
            placeholder="Ask a question about your files"
            onChange={(event) => {
              setQuestion(event.target.value);
              resizeInput();
            }}
            onKeyDown={onKeyDown}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="mb-0.5 inline-flex size-11 cursor-pointer items-center justify-center rounded-xl bg-muted text-foreground transition-colors hover:bg-accent"
              aria-label="Stop"
            >
              <Square className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!question.trim()}
              className="mb-0.5 inline-flex size-11 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/85 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              aria-label="Ask"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </div>
  );
}
