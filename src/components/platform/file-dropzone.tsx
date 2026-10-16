"use client";

import { FileArchive, FileText, FileUp, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/config/limits";
import { cn } from "@/lib/cn";

const ACCEPT = ".zip,.json,.csv,.tsv,.txt,application/zip,application/json,text/csv,text/plain";

export function FileDropzone({
  files,
  onAdd,
  onRemove,
  disabled,
}: {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length) onAdd(dropped);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-primary bg-primary-soft" : "border-border bg-surface-2/40",
          disabled && "opacity-60",
        )}
      >
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <FileUp className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-sm font-medium">Arrastra aquí tu exportación</p>
        <p className="mt-1 text-xs text-muted">ZIP, JSON, CSV o TXT · puedes seleccionar varios archivos</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => inputRef.current?.click()} disabled={disabled}>
          Seleccionar archivos
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          aria-label="Seleccionar archivos de exportación"
          data-testid="file-input"
          onChange={(e) => {
            const selected = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (selected.length) onAdd(selected);
          }}
        />
      </div>

      {files.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border" aria-label="Archivos seleccionados">
          {files.map((file, i) => {
            const Icon = /\.zip$/i.test(file.name) ? FileArchive : FileText;
            return (
              <li key={`${file.name}-${file.size}-${file.lastModified}-${i}`} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  disabled={disabled}
                  className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
                  aria-label={`Quitar ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
