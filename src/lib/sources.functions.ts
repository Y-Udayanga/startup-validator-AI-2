import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TextInput = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(20).max(200_000),
});

const UrlInput = z.object({
  title: z.string().max(200).optional().default(""),
  url: z.string().url().max(2000),
});

const PdfInput = z.object({
  title: z.string().min(1).max(200),
  // Client extracts text from PDF via pdfjs-dist and posts plain text
  content: z.string().min(20).max(500_000),
});

async function ingestSource(
  supabase: ReturnType<typeof Object>,
  userId: string,
  sourceId: string,
  content: string,
) {
  const { chunkText, embedTexts } = await import("./embeddings.server");
  const chunks = chunkText(content);
  // Embed in batches of 16
  const allRows: { source_id: string; user_id: string; chunk_index: number; content: string; embedding: number[] }[] = [];
  for (let i = 0; i < chunks.length; i += 16) {
    const batch = chunks.slice(i, i + 16);
    const vectors = await embedTexts(batch);
    batch.forEach((c, j) => {
      allRows.push({
        source_id: sourceId,
        user_id: userId,
        chunk_index: i + j,
        content: c,
        embedding: vectors[j],
      });
    });
  }
  // Supabase accepts pgvector as number[] when column is vector
  // We need to stringify as "[...]" because supabase-js doesn't auto-cast vectors
  const rows = allRows.map((r) => ({
    ...r,
    embedding: `[${r.embedding.join(",")}]` as unknown as number[],
  }));
  // Insert in chunks of 100
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await (supabase as any).from("source_chunks").insert(rows.slice(i, i + 100));
    if (error) throw new Error(error.message);
  }
}

export const createTextSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => TextInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("sources")
      .insert({ user_id: userId, kind: "text", title: data.title, content: data.content, status: "processing" })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed");
    try {
      await ingestSource(supabase, userId, row.id, data.content);
      await supabase.from("sources").update({ status: "ready" }).eq("id", row.id);
    } catch (e) {
      await supabase.from("sources").update({ status: "failed", error: (e as Error).message }).eq("id", row.id);
      throw e;
    }
    return { id: row.id };
  });

export const createPdfSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => PdfInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("sources")
      .insert({ user_id: userId, kind: "pdf", title: data.title, content: data.content, status: "processing" })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed");
    try {
      await ingestSource(supabase, userId, row.id, data.content);
      await supabase.from("sources").update({ status: "ready" }).eq("id", row.id);
    } catch (e) {
      await supabase.from("sources").update({ status: "failed", error: (e as Error).message }).eq("id", row.id);
      throw e;
    }
    return { id: row.id };
  });

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export const createUrlSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => UrlInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Fetch URL on server
    let title = data.title;
    let content = "";
    try {
      const res = await fetch(data.url, {
        headers: { "User-Agent": "Mozilla/5.0 StartupValidatorAI/1.0" },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`Fetch ${data.url} returned ${res.status}`);
      const html = await res.text();
      content = htmlToText(html).slice(0, 200_000);
      if (!title) {
        const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        title = (m?.[1] ?? data.url).slice(0, 200);
      }
      if (content.length < 20) throw new Error("No readable content extracted from URL");
    } catch (e) {
      throw new Error(`Failed to fetch URL: ${(e as Error).message}`);
    }
    const { data: row, error } = await supabase
      .from("sources")
      .insert({ user_id: userId, kind: "url", title, url: data.url, content, status: "processing" })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed");
    try {
      await ingestSource(supabase, userId, row.id, content);
      await supabase.from("sources").update({ status: "ready" }).eq("id", row.id);
    } catch (e) {
      await supabase.from("sources").update({ status: "failed", error: (e as Error).message }).eq("id", row.id);
      throw e;
    }
    return { id: row.id };
  });

export const listSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sources")
      .select("id, kind, title, url, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
