export type ExtractMode = "full" | "highlights" | "meta";

export interface ExtractedContent {
  meta: Record<string, any>;
  textChunks?: string[];
  highlights?: string[];
}

/**
 * Extract basic metadata and optional text/highlights.
 * PDF full-text extraction is intentionally minimal here; it can be extended with
 * Zotero.PDFWorker or other utilities when available.
 */
export async function extractContent(
  item: Zotero.Item,
  mode: ExtractMode,
): Promise<ExtractedContent> {
  const meta = {
    title: item.getField("title"),
    creators: item
      .getCreators()
      ?.map((c: any) => [c.firstName, c.lastName].filter(Boolean).join(" "))
      .join(", "),
    abstract: item.getField("abstractNote"),
    tags: item.getTags?.()?.map((t: any) => t.tag).join(", "),
    date: item.getField("date"),
    publicationTitle: item.getField("publicationTitle"),
    doi: item.getField("DOI"),
  };

  if (mode === "meta") {
    return { meta };
  }

  const highlights: string[] = [];
  // Basic attempt to collect annotation text if available
  if ((item as any).isAnnotation) {
    const text = (item as any).getNote ? (item as any).getNote() : "";
    if (text) {
      highlights.push(text);
    }
  }

  // Placeholder: full text extraction is not implemented in this pass.
  const textChunks: string[] = [];

  return { meta, textChunks, highlights };
}
