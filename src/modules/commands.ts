import { generatePlainNote, generateRichFile } from "./panel";

function getSelectedRegularItem(): Zotero.Item | undefined {
  const pane = Zotero.getActiveZoteroPane?.();
  const items: Zotero.Item[] = pane?.getSelectedItems?.() || [];
  return items.find((it) => it.isRegularItem?.());
}

export async function actionSavePlainNote() {
  const item = getSelectedRegularItem();
  if (!item) {
    ztoolkit.getGlobal("alert")("No regular item selected.");
    return;
  }
  const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName);
  pw.createLine({ text: "Saving note...", progress: 0 }).show();
  try {
    await generatePlainNote(item);
    pw.changeLine({ progress: 100, text: "Saved to note" });
  } catch (err: any) {
    pw.changeLine({
      progress: 100,
      type: "fail",
      text: err?.message || "Failed to save note",
    });
  }
  pw.startCloseTimer(2000);
}

export async function actionGenerateRichAndOpen() {
  const item = getSelectedRegularItem();
  if (!item) {
    ztoolkit.getGlobal("alert")("No regular item selected.");
    return;
  }
  const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName);
  pw.createLine({ text: "Generating HTML...", progress: 0 }).show();
  try {
    const fileURL = await generateRichFile(item);
    const filePath = Zotero.File.pathFromFileURL(fileURL);
    Zotero.launchFile(filePath);
    pw.changeLine({ progress: 100, text: "Opened HTML" });
  } catch (err: any) {
    pw.changeLine({
      progress: 100,
      type: "fail",
      text: err?.message || "Failed to generate",
    });
  }
  pw.startCloseTimer(2000);
}
