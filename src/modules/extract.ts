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
  // getNote() can only be called on notes and attachments, not on regular items
  if (item.isNote?.() || item.isAttachment?.()) {
    try {
      const text = item.getNote?.();
      if (text) {
        highlights.push(text);
      }
    } catch {
      // Ignore errors from getNote()
    }
  }

  // Placeholder: full text extraction is not implemented in this pass.
  const textChunks: string[] = [];

  return { meta, textChunks, highlights };
}

/**
 * 获取当前 PDF 阅读器中选中的文本
 */
export function getReaderSelectedText(): string | null {
  try {
    const tabs = (Zotero as any).getMainWindow?.()?.Zotero_Tabs;
    if (!tabs?.selectedID) return null;
    const reader = Zotero.Reader.getByTabID(tabs.selectedID) as any;
    if (!reader) return null;

    // 方法1: 通过 _state 获取选中文本 (Zotero 7+)
    if (reader._state?.selectedText) {
      return reader._state.selectedText.trim();
    }

    // 方法2: 通过 _primaryView 获取 (Zotero 7+)
    if (reader._primaryView?._iframeWindow) {
      const sel = reader._primaryView._iframeWindow.getSelection?.();
      if (sel && sel.toString().trim()) {
        return sel.toString().trim();
      }
    }

    // 方法3: 旧版方式通过 _iframeWindow
    if (reader._iframeWindow) {
      const selection = reader._iframeWindow.getSelection?.();
      if (selection && selection.toString().trim()) {
        return selection.toString().trim();
      }
    }

    // 方法4: 尝试从内部状态获取
    if (reader._internalReader?._state?.selectedText) {
      return reader._internalReader._state.selectedText.trim();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 获取论文的所有高亮注释
 */
export async function getItemAnnotations(
  item: Zotero.Item,
): Promise<string[]> {
  const annotations: string[] = [];
  try {
    // 获取 PDF 附件
    const attachments = item.isRegularItem()
      ? await Zotero.Items.getAsync(item.getAttachments())
      : [item];

    for (const att of attachments) {
      if (!att.isPDFAttachment?.()) continue;
      const annots = att.getAnnotations?.() || [];
      for (const annot of annots) {
        const text = annot.annotationText;
        const comment = annot.annotationComment;
        if (text) annotations.push(text);
        if (comment) annotations.push(`[Comment] ${comment}`);
      }
    }
  } catch {
    // Ignore errors
  }
  return annotations;
}
