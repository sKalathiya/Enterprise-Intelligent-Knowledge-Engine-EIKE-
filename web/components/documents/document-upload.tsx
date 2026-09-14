"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { uploadDocument } from "@/lib/api";
import { notify } from "@/lib/stores/toast-store";

const MAX_BYTES = 10 * 1024 * 1024;

function isAllowedFile(file: File) {
  if (file.type === "application/pdf" || file.type === "text/plain") return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || name.endsWith(".txt");
}

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
  return "Upload failed.";
}

type DocumentUploadProps = {
  onUploaded: () => Promise<void>;
  onUnauthorized: () => void;
};

export function DocumentUpload({ onUploaded, onUnauthorized }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitFile(file: File) {
    if (!isAllowedFile(file)) {
      const message = "Only PDF and plain text files are accepted.";
      setError(message);
      notify.error("Upload failed", message);
      return;
    }
    if (file.size > MAX_BYTES) {
      const message = "File exceeds the 10MB limit.";
      setError(message);
      notify.error("Upload failed", message);
      return;
    }

    setError(null);
    setPending(true);
    try {
      const response = await uploadDocument(file);
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      if (!response.ok) {
        const message = errorMessage(payload);
        setError(message);
        notify.error("Upload failed", message);
        return;
      }
      notify.success("File uploaded", `${file.name} is being prepared.`);
      await onUploaded();
    } catch {
      const message = "Could not reach the upload service. Try again.";
      setError(message);
      notify.error("Upload failed", message);
    } finally {
      setPending(false);
    }
  }

  function takeFile(files: FileList | null) {
    const file = files?.[0];
    if (file) void submitFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        className={`group flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center shadow-sm transition-all outline-none select-none sm:py-12 ${
          pending ? "pointer-events-none opacity-70" : ""
        } ${
          dragging
            ? "border-foreground bg-background shadow-md"
            : "border-border/80 bg-background hover:border-foreground/40 hover:bg-muted/30 active:scale-[0.995]"
        } has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50`}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          if (!pending) takeFile(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,text/plain,.pdf,.txt"
          className="sr-only"
          disabled={pending}
          onChange={(event) => {
            takeFile(event.target.files);
            event.target.value = "";
          }}
        />
        <span className={`flex size-12 items-center justify-center rounded-full bg-muted text-foreground transition-all group-hover:bg-background group-active:bg-background ${dragging ? "scale-110" : ""}`}>
          <Upload className={`size-5 transition-transform ${pending ? "animate-bounce" : "group-hover:-translate-y-0.5"}`} />
        </span>
        <p className="mt-4 text-base font-semibold">
          {pending ? "Uploading…" : dragging ? "Drop to upload" : "Click to upload"}
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {pending
            ? "Uploading your file. This may take a moment."
            : "or drag and drop a PDF or .txt file here. Maximum 10MB."}
        </p>
        {!pending ? (
          <span className="mt-4 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-transform group-hover:translate-y-px group-active:translate-y-0.5">
            Choose file
          </span>
        ) : null}
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
