import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listSources, createTextSource, createUrlSource, createPdfSource, deleteSource } from "@/lib/sources.functions";
import { toast } from "sonner";
import { FileText, Globe, Type, Loader2, Trash2, Upload, BookOpen, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sources")({
  component: SourcesPage,
});

function SourcesPage() {
  const list = useServerFn(listSources);
  const del = useServerFn(deleteSource);
  const qc = useQueryClient();
  const { data: sources, isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: () => list({}),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      toast.success("Source removed");
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <BookOpen className="h-4 w-4 text-primary" /> Knowledge sources
      </div>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        Strengthen your validation with <span className="text-gradient">market research</span>
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Upload PDFs, paste URLs, or drop in research notes. The AI uses your sources via RAG to
        improve competitor and market demand analysis on every new validation.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <UrlForm onDone={() => qc.invalidateQueries({ queryKey: ["sources"] })} />
        <PdfForm onDone={() => qc.invalidateQueries({ queryKey: ["sources"] })} />
        <TextForm onDone={() => qc.invalidateQueries({ queryKey: ["sources"] })} />
      </div>

      <div className="mt-12">
        <h2 className="font-display text-xl font-semibold">Your sources</h2>
        {isLoading ? (
          <div className="mt-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !sources || sources.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No sources yet. Add one above.</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-surface/40 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  {s.kind === "pdf" && <FileText className="h-4 w-4 text-primary shrink-0" />}
                  {s.kind === "url" && <Globe className="h-4 w-4 text-primary shrink-0" />}
                  {s.kind === "text" && <Type className="h-4 w-4 text-primary shrink-0" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    {s.url && <p className="truncate text-xs text-muted-foreground">{s.url}</p>}
                    <p className="text-xs text-muted-foreground">
                      {s.kind.toUpperCase()} · {s.status === "ready" ? "Indexed" : s.status === "failed" ? `Failed: ${s.error}` : "Processing…"}
                    </p>
                  </div>
                </div>
                <button onClick={() => remove.mutate(s.id)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ children, icon: Icon, title }: { children: React.ReactNode; icon: typeof FileText; title: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/40 p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold">{title}</h3>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

function UrlForm({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState("");
  const fn = useServerFn(createUrlSource);
  const mut = useMutation({
    mutationFn: () => fn({ data: { url, title: "" } }),
    onSuccess: () => { toast.success("URL indexed"); setUrl(""); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Card icon={Globe} title="From a URL">
      <input className={inputCls} placeholder="https://example.com/market-report" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button
        disabled={!url || mut.isPending}
        onClick={() => mut.mutate()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient px-3 py-2 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-50"
      >
        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scrape & index"}
      </button>
    </Card>
  );
}

function PdfForm({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const fn = useServerFn(createPdfSource);
  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Pick a PDF");
      setExtracting(true);
      const { extractPdfText } = await import("@/lib/pdf-extract");
      const text = await extractPdfText(file);
      setExtracting(false);
      if (text.trim().length < 20) throw new Error("Could not extract any text from this PDF");
      return fn({ data: { title: file.name.replace(/\.pdf$/i, "").slice(0, 200), content: text } });
    },
    onSuccess: () => { toast.success("PDF indexed"); setFile(null); onDone(); },
    onError: (e) => { setExtracting(false); toast.error(e instanceof Error ? e.message : "Failed"); },
  });
  return (
    <Card icon={FileText} title="Upload PDF">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-background/40 px-3 py-3 text-xs text-muted-foreground hover:border-primary/40">
        <Upload className="h-4 w-4" />
        {file ? file.name.slice(0, 30) : "Choose a PDF"}
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <button
        disabled={!file || mut.isPending}
        onClick={() => mut.mutate()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient px-3 py-2 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-50"
      >
        {mut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> {extracting ? "Extracting…" : "Indexing…"}</> : "Extract & index"}
      </button>
    </Card>
  );
}

function TextForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const fn = useServerFn(createTextSource);
  const mut = useMutation({
    mutationFn: () => fn({ data: { title, content } }),
    onSuccess: () => { toast.success("Text indexed"); setTitle(""); setContent(""); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Card icon={Type} title="Paste notes / research">
      <input className={inputCls} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className={`${inputCls} h-24 resize-none`} placeholder="Paste market data, articles, notes…" value={content} onChange={(e) => setContent(e.target.value)} />
      <button
        disabled={!title || content.length < 20 || mut.isPending}
        onClick={() => mut.mutate()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient px-3 py-2 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-50"
      >
        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Index notes"}
      </button>
    </Card>
  );
}
