"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { File, FileText, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { deleteDocument, getDocuments, retryDocument } from "@/lib/api";
import { DocumentUpload } from "@/components/documents/document-upload";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/stores/toast-store";

type DocumentStatus = "pending" | "processing" | "completed" | "failed";

type DocumentItem = {
  id?: string;
  fileName: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
};

type BusyAction = { id: string; kind: "delete" | "retry" };

const STATUS_LABEL: Record<DocumentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Ready to ask",
  failed: "Failed",
};

const STATUS_CLASS: Record<DocumentStatus, string> = {
  pending: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  processing: "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  completed: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-destructive/10 text-destructive",
};

function errorMessage(payload: unknown): string {
  if (payload && typeof payload === "object") {
    if ("message" in payload) {
      const message = (payload as { message: string | string[] }).message;
      return Array.isArray(message) ? message.join(" ") : message;
    }
    if ("error" in payload && typeof (payload as { error: unknown }).error === "string") {
      return (payload as { error: string }).error;
    }
  }
  return "Could not load documents.";
}

function isDocument(value: unknown): value is DocumentItem {
  if (!value || typeof value !== "object") return false;
  const item = value as DocumentItem;
  return typeof item.fileName === "string" && typeof item.status === "string";
}

function resolveStatus(status: string): DocumentStatus {
  return STATUS_LABEL[status as DocumentStatus] ? (status as DocumentStatus) : "pending";
}

function formatUpdated(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function FileGlyph({ fileName }: { fileName: string }) {
  const pdf = fileName.toLowerCase().endsWith(".pdf");
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
        pdf
          ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200"
          : "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-200"
      }`}
    >
      {pdf ? <FileText className="size-4" /> : <File className="size-4" />}
    </span>
  );
}

export function DocumentDashboard() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const knownStatus = useRef<Map<string, DocumentStatus> | null>(null);

  const load = useCallback(async () => {
    const response = await getDocuments();
    const payload: unknown = await response.json().catch(() => null);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      setError(errorMessage(payload));
      return;
    }

    setError(null);
    const next = Array.isArray(payload) ? payload.filter(isDocument) : [];
    const previous = knownStatus.current;
    if (previous) {
      for (const document of next) {
        const key = document.id ?? `${document.fileName}-${document.createdAt}`;
        const status = resolveStatus(document.status);
        const before = previous.get(key);
        if (!before || before === status) continue;
        if (status === "completed") {
          notify.success("Ready to ask", `${document.fileName} is ready.`);
        }
        if (status === "failed") {
          notify.error("Processing failed", `${document.fileName} could not be processed.`);
        }
      }
    }
    const map = new Map<string, DocumentStatus>();
    for (const document of next) {
      map.set(document.id ?? `${document.fileName}-${document.createdAt}`, resolveStatus(document.status));
    }
    knownStatus.current = map;
    setDocuments(next);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function firstLoad() {
      setLoading(true);
      try {
        await load();
      } catch {
        if (!cancelled) setError("Could not reach the document service. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    firstLoad();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function runAction(kind: "delete" | "retry", document: DocumentItem) {
    if (!document.id) {
      setError("This document has no id, so it cannot be updated.");
      return;
    }
    if (kind === "delete" && !window.confirm(`Delete “${document.fileName}”? This cannot be undone.`)) {
      return;
    }

    setBusy({ id: document.id, kind });
    try {
      const response = kind === "delete"
        ? await deleteDocument(document.id)
        : await retryDocument(document.id);
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        const message = errorMessage(payload);
        setError(message);
        notify.error(kind === "delete" ? "Could not delete" : "Could not retry", message);
        return;
      }
      setError(null);
      if (kind === "delete") {
        notify.success("File removed", `${document.fileName} was deleted.`);
      } else {
        notify.info("Retry started", `${document.fileName} is being processed again.`);
      }
      await load();
    } catch {
      const message = kind === "delete" ? "Could not delete the document." : "Could not retry the document.";
      setError(message);
      notify.error(kind === "delete" ? "Could not delete" : "Could not retry", message);
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } catch {
      setError("Could not reach the document service. Try again.");
    } finally {
      setRefreshing(false);
    }
  }

  const inFlight = documents.some(
    (document) => document.status === "pending" || document.status === "processing",
  );

  useEffect(() => {
    if (!inFlight) return;
    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [inFlight, load]);

  const counts = documents.reduce(
    (acc, document) => {
      acc[resolveStatus(document.status)] += 1;
      return acc;
    },
    { pending: 0, processing: 0, completed: 0, failed: 0 } as Record<DocumentStatus, number>,
  );

  return (
    <div className="animate-fade-up flex min-h-full flex-1 flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Add files, see when they are ready, and keep your library up to date.
          </p>
          {!loading && documents.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-sm ring-1 ring-border">
                {documents.length} file{documents.length === 1 ? "" : "s"}
              </span>
              {counts.completed > 0 ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900">
                  {counts.completed} ready to ask
                </span>
              ) : null}
              {counts.processing + counts.pending > 0 ? (
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs text-sky-800 ring-1 ring-sky-100 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-900">
                  {counts.processing + counts.pending} in progress
                </span>
              ) : null}
              {counts.failed > 0 ? (
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs text-destructive ring-1 ring-destructive/15">
                  {counts.failed} failed
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="self-start bg-background shadow-sm sm:self-auto"
          disabled={refreshing || loading}
          onClick={() => void refresh()}
        >
          <RefreshCw className={refreshing ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </header>

      <DocumentUpload onUploaded={load} onUnauthorized={() => router.push("/login")} />

      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm">
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-3">
          <h2 className="text-sm font-medium">Library</h2>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading…" : documents.length === 0 ? "Nothing here yet" : "Newest first"}
          </p>
        </div>

        {loading ? (
          <div className="divide-y divide-border/80">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-4 px-5 py-4">
                <div className="size-10 animate-pulse rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium">No documents yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Drop a file above and it will appear here when it starts processing.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/80">
            {documents.map((document, index) => {
              const status = resolveStatus(document.status);
              const rowBusy = busy?.id === document.id;
              return (
                <li
                  key={document.id ?? `${document.fileName}-${document.createdAt}-${index}`}
                  className="animate-fade-up flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileGlyph fileName={document.fileName} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{document.fileName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Updated {formatUpdated(document.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[status]} ${status === "processing" || status === "pending" ? "animate-pulse" : ""}`}>
                      {STATUS_LABEL[status]}
                    </span>
                    <div className="flex gap-1.5">
                      {status === "failed" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="bg-background"
                          disabled={!document.id || busy !== null}
                          onClick={() => void runAction("retry", document)}
                        >
                          <RotateCcw className={rowBusy && busy?.kind === "retry" ? "animate-spin" : undefined} />
                          {rowBusy && busy?.kind === "retry" ? "Retrying" : "Retry"}
                        </Button>
                      ) : null}
                      {status !== "processing" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={!document.id || busy !== null}
                          onClick={() => void runAction("delete", document)}
                        >
                          <Trash2 />
                          {rowBusy && busy?.kind === "delete" ? "Deleting" : "Delete"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
