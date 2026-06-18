// Client-only PDF text extraction using pdfjs-dist
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Use bundled worker via Vite ?url import
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  let full = "";
  const max = Math.min(doc.numPages, 50); // cap at 50 pages
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: unknown) => (it as { str?: string }).str ?? "").join(" ");
    full += text + "\n\n";
  }
  return full.trim();
}
