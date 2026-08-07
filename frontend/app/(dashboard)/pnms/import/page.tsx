"use client";

/**
 * Roster import.
 *
 * The landing page has promised "CSV upload or one-by-one" since launch and
 * only the second half existed, so a chapter with 120 rushees typed them in.
 *
 * Three steps, and the middle one is the point: nothing is written until the
 * operator has seen exactly which rows will land, which will be skipped, and
 * why. The preview and the commit are the same server call with one flag
 * flipped, so the preview cannot lie about what the commit will do.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FeatherAlertTriangle,
  FeatherArrowLeft,
  FeatherCheck,
  FeatherCopy,
  FeatherFileText,
  FeatherUpload,
  FeatherUsers,
} from "@subframe/core";
import { Button } from "@/ui/components/Button";
import { Badge } from "@/ui/components/Badge";
import { Table } from "@/ui/components/Table";
import {
  getChapterId,
  importPnmsCsv,
  IMPORT_FIELDS,
  type ImportResult,
} from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/utils";

type Step = "pick" | "review" | "done";

export default function ImportPnmsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDryRun = useCallback(
    async (candidate: File, override?: Record<string, string>) => {
      setBusy(true);
      setError(null);
      try {
        const chapterId = await getChapterId();
        if (!chapterId) throw new Error("No chapter found");
        const res = await importPnmsCsv(chapterId, candidate, {
          dryRun: true,
          mapping: override,
        });
        setPreview(res);
        setMapping(res.mapping);
        setStep("review");
      } catch (e: any) {
        // A file with no detectable name column lands here. It is recoverable --
        // the operator picks the column by hand -- so keep them on this step
        // with the message rather than bouncing them back.
        setError(e?.message || "Could not read that file");
        setPreview(null);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onFile = (candidate: File | null) => {
    if (!candidate) return;
    if (!/\.(csv|tsv|txt)$/i.test(candidate.name)) {
      setError("Pick a .csv file exported from your spreadsheet");
      return;
    }
    setFile(candidate);
    setResult(null);
    void runDryRun(candidate);
  };

  const remap = (column: string, field: string) => {
    const next = { ...mapping };
    if (field) next[column] = field;
    else delete next[column];
    setMapping(next);
    if (file) void runDryRun(file, next);
  };

  const commit = async () => {
    if (!file || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const chapterId = await getChapterId();
      if (!chapterId) throw new Error("No chapter found");
      const res = await importPnmsCsv(chapterId, file, { dryRun: false, mapping });
      setResult(res);
      setStep("done");
      toast({
        title: `Imported ${res.imported} PNM${res.imported === 1 ? "" : "s"}`,
        description: res.skipped ? `${res.skipped} row(s) skipped` : undefined,
      });
    } catch (e: any) {
      setError(e?.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep("pick");
    setFile(null);
    setPreview(null);
    setResult(null);
    setMapping({});
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="container max-w-none flex h-full w-full flex-col items-start gap-6 bg-default-background py-6">
      <div className="flex w-full items-start justify-between gap-4">
        <div className="flex flex-col items-start gap-1">
          <span className="text-heading-1 font-heading-1 text-default-font">Import PNMs</span>
          <span className="text-body font-body text-subtext-color">
            Upload a CSV from your spreadsheet. Nothing is saved until you confirm.
          </span>
        </div>
        <Link href="/pnms">
          <Button variant="neutral-secondary" icon={<FeatherArrowLeft />}>
            Back to PNMs
          </Button>
        </Link>
      </div>

      <Steps current={step} />

      {error && (
        <div className="flex w-full items-start gap-3 rounded-lg border border-solid border-error-200 bg-error-50 p-4">
          <FeatherAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error-600" />
          <span className="text-body font-body text-error-700 whitespace-pre-wrap">{error}</span>
        </div>
      )}

      {step === "pick" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-16 transition",
            dragging ? "border-brand-600 bg-brand-50" : "border-neutral-border bg-white",
          )}
        >
          <FeatherUpload className="h-8 w-8 text-subtext-color" />
          <span className="text-heading-3 font-heading-3 text-default-font">
            Drop your CSV here
          </span>
          <span className="max-w-md text-center text-body font-body text-subtext-color">
            One row per PNM. A <span className="font-body-bold">name</span> column is required;
            email, phone, major, hometown, year, photo URL and tags are picked up automatically
            when present.
          </span>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <Button
            className="mt-2"
            icon={<FeatherFileText />}
            loading={busy}
            onClick={() => fileInput.current?.click()}
          >
            Choose a file
          </Button>
          <span className="text-caption font-caption text-subtext-color">
            Already exported from RushRank? That file re-imports as-is.
          </span>
        </div>
      )}

      {step === "review" && preview && (
        <>
          <div className="w-full items-start gap-4 grid grid-cols-2 lg:grid-cols-4">
            <Stat label="Rows read" value={preview.total} />
            <Stat label="Will import" value={preview.valid} tone="success" />
            <Stat label="Already in RushRank" value={preview.duplicates.length} tone="neutral" />
            <Stat label="Problems" value={preview.errors.length} tone={preview.errors.length ? "warning" : "neutral"} />
          </div>

          <section className="flex w-full flex-col gap-3 rounded-lg border border-solid border-neutral-border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-1">
              <span className="text-heading-3 font-heading-3 text-default-font">Column mapping</span>
              <span className="text-body font-body text-subtext-color">
                {file?.name} · change any column we guessed wrong.
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {preview.columns.map((column) => (
                <label key={column} className="flex flex-col gap-1">
                  <span className="truncate text-caption-bold font-caption-bold text-subtext-color">
                    {column}
                  </span>
                  <select
                    className="h-10 w-full rounded-lg border border-solid border-neutral-border bg-white px-3 text-body font-body text-default-font focus:outline-none focus:ring-2 focus:ring-brand-600"
                    value={mapping[column] ?? ""}
                    onChange={(e) => remap(column, e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Ignore this column</option>
                    {IMPORT_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {field.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          {preview.preview.length > 0 && (
            <section className="flex w-full flex-col rounded-lg border border-solid border-neutral-border bg-white shadow-sm">
              <div className="border-b border-solid border-neutral-border px-6 py-4">
                <span className="text-heading-3 font-heading-3 text-default-font">
                  First {preview.preview.length} rows
                </span>
              </div>
              <div className="w-full overflow-x-auto">
                <Table
                  header={
                    <thead>
                      <Table.HeaderRow>
                        <Table.HeaderCell>Row</Table.HeaderCell>
                        <Table.HeaderCell>Name</Table.HeaderCell>
                        <Table.HeaderCell>Email</Table.HeaderCell>
                        <Table.HeaderCell>Major</Table.HeaderCell>
                        <Table.HeaderCell>Year</Table.HeaderCell>
                        <Table.HeaderCell>Tags</Table.HeaderCell>
                      </Table.HeaderRow>
                    </thead>
                  }
                >
                  {preview.preview.map((row) => (
                    <Table.Row key={row.row}>
                      <Table.Cell className="text-caption font-caption text-subtext-color">
                        {row.row}
                      </Table.Cell>
                      <Table.Cell className="text-body-bold font-body-bold text-default-font">
                        {row.name}
                      </Table.Cell>
                      <Table.Cell className="text-body font-body text-subtext-color">
                        {row.email || "—"}
                      </Table.Cell>
                      <Table.Cell className="text-body font-body text-subtext-color">
                        {row.major || "—"}
                      </Table.Cell>
                      <Table.Cell className="text-body font-body text-subtext-color">
                        {row.year || "—"}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-wrap gap-1">
                          {(row.tags ?? []).map((tag: string) => (
                            <Badge key={tag} variant="neutral">{tag}</Badge>
                          ))}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table>
              </div>
            </section>
          )}

          {preview.duplicates.length > 0 && (
            <IssueList
              icon={<FeatherCopy className="h-5 w-5 text-subtext-color" />}
              title={`${preview.duplicates.length} row(s) already in RushRank — these will be skipped`}
              items={preview.duplicates.map((d) => ({
                row: d.row,
                message: `${d.name}${d.email ? ` (${d.email})` : ""}`,
              }))}
            />
          )}

          {preview.errors.length > 0 && (
            <IssueList
              icon={<FeatherAlertTriangle className="h-5 w-5 text-warning-600" />}
              title={`${preview.errors.length} row(s) could not be read — these will be skipped`}
              items={preview.errors}
              tone="warning"
            />
          )}

          <div className="flex w-full items-center justify-between gap-3">
            <Button variant="neutral-secondary" onClick={reset} disabled={busy}>
              Choose a different file
            </Button>
            <Button
              icon={<FeatherCheck />}
              loading={busy}
              disabled={preview.valid === 0}
              onClick={commit}
            >
              {preview.valid === 0
                ? "Nothing to import"
                : `Import ${preview.valid} PNM${preview.valid === 1 ? "" : "s"}`}
            </Button>
          </div>
        </>
      )}

      {step === "done" && result && (
        <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-solid border-success-200 bg-success-50 p-6">
          <div className="flex items-center gap-3">
            <FeatherCheck className="h-6 w-6 text-success-600" />
            <span className="text-heading-2 font-heading-2 text-default-font">
              Imported {result.imported} PNM{result.imported === 1 ? "" : "s"}
            </span>
          </div>
          {result.skipped > 0 && (
            <span className="text-body font-body text-subtext-color">
              {result.skipped} row(s) were skipped — {result.duplicates.length} already existed and{" "}
              {result.errors.length} could not be read.
            </span>
          )}
          <div className="flex gap-3">
            <Button icon={<FeatherUsers />} onClick={() => router.push("/pnms")}>
              View PNMs
            </Button>
            <Button variant="neutral-secondary" onClick={reset}>
              Import another file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: "pick", label: "Choose file" },
    { key: "review", label: "Review" },
    { key: "done", label: "Done" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === current);

  return (
    <ol className="flex w-full items-center gap-2">
      {steps.map((step, index) => (
        <li key={step.key} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-caption-bold font-caption-bold",
              index < activeIndex && "bg-success-600 text-white",
              index === activeIndex && "bg-brand-600 text-white",
              index > activeIndex && "bg-neutral-100 text-subtext-color",
            )}
          >
            {index < activeIndex ? "✓" : index + 1}
          </span>
          <span
            className={cn(
              "text-body font-body",
              index <= activeIndex ? "text-default-font" : "text-subtext-color",
            )}
          >
            {step.label}
          </span>
          {index < steps.length - 1 && <span className="h-px flex-1 bg-neutral-border" />}
        </li>
      ))}
    </ol>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-solid border-neutral-border bg-white px-5 py-4 shadow-sm">
      <span className="text-caption-bold font-caption-bold text-subtext-color">{label}</span>
      <span
        className={cn(
          "text-heading-1 font-heading-1",
          tone === "success" && "text-success-700",
          tone === "warning" && "text-warning-700",
          tone === "neutral" && "text-default-font",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function IssueList({
  icon,
  title,
  items,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  items: Array<{ row: number; message: string }>;
  tone?: "neutral" | "warning";
}) {
  return (
    <section
      className={cn(
        "flex w-full flex-col gap-3 rounded-lg border border-solid p-6",
        tone === "warning" ? "border-warning-200 bg-warning-50" : "border-neutral-border bg-white",
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-heading-3 font-heading-3 text-default-font">{title}</span>
      </div>
      {/* Capped height rather than truncated: a 300-error file should still show
          every error, just without pushing the confirm button off-screen. */}
      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {items.map((item, i) => (
          <li key={`${item.row}-${i}`} className="text-body font-body text-subtext-color">
            <span className="text-body-bold font-body-bold text-default-font">Row {item.row}</span>
            {" — "}
            {item.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
