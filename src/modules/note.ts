/**
 * Create or append a note under the given item.
 */
export async function savePlainNote(
  item: Zotero.Item,
  content: string,
  title = "LLM Summary (Plain)",
): Promise<number> {
  const note = new Zotero.Item("note");
  note.parentID = item.id;
  // Wrap content in minimal HTML to preserve formatting in Zotero notes
  const safe = escapeHTML(content).replace(/\n/g, "<br/>");
  note.setNote(`<p><b>${escapeHTML(title)}</b></p><p>${safe}</p>`);
  await note.saveTx();
  return note.id as number;
}

function escapeHTML(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
