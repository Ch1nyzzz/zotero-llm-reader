import { getString } from "../utils/locale";
import { getPref } from "../utils/prefs";
import type { ExtractMode } from "./extract";
import { extractContent } from "./extract";
import {
  summarizePlain,
  summarizeRich,
  type LLMOptions,
  type LLMProvider,
} from "./llmClient";
import { savePlainNote } from "./note";

const FALLBACK_PROMPT_RICH =
  "You are an assistant that renders a single self-contained HTML page. Return only HTML.";
const FALLBACK_PROMPT_PLAIN =
  "Summarize the paper concisely in plain text/Markdown. No HTML or scripts.";

export function registerReaderPanel(win: _ZoteroTypes.MainWindow) {
  const paneID = `${addon.data.config.addonRef}-reader`;
  Zotero.ItemPaneManager.registerSection({
    paneID,
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: "tabpanel-reader-tab-label",
      icon: "chrome://zotero/skin/16/universal/book.svg",
    },
    sidenav: {
      l10nID: "tabpanel-reader-tab-label",
      icon: "chrome://zotero/skin/20/universal/save.svg",
    },
    bodyXHTML:
      '<browser id="llmreader-browser" disableglobalhistory="true" remote="true" maychangeremoteness="true" type="content" flex="1" style="width: 100%; height: 480px"/>',
    onItemChange: ({ setEnabled, tabType }) => {
      setEnabled(tabType === "reader");
      return true;
    },
    onRender: ({ body, item, setSectionSummary }) => {
      const browser = body.querySelector("#llmreader-browser") as XUL.Browser;
      if (browser) {
        browser.setAttribute("src", "about:blank");
      }
      setSectionSummary(getString("panel-loading"));
    },
    onAsyncRender: async ({ body, item, setSectionSummary }) => {
      try {
        const fileURL = await generateAndLoadHTML(item, body);
        if (fileURL) {
          setSectionSummary(getString("panel-ready"));
        } else {
          setSectionSummary(getString("panel-error"));
        }
      } catch (err) {
        ztoolkit.log("render error", err);
        setSectionSummary(getString("panel-error"));
      }
    },
    sectionButtons: [
      {
        type: "refresh",
        label: getString("panel-button-refresh"),
        icon: "chrome://zotero/skin/16/universal/refresh.svg",
        onClick: async ({ item, body, setSectionSummary }) => {
          setSectionSummary(getString("panel-loading"));
          await generateAndLoadHTML(item, body);
          setSectionSummary(getString("panel-ready"));
        },
      },
      {
        type: "note",
        label: getString("panel-button-note"),
        icon: "chrome://zotero/skin/16/universal/save.svg",
        onClick: async ({ item, body, setSectionSummary }) => {
          try {
            setSectionSummary(getString("panel-loading"));
            const text = await generatePlainText(item);
            await savePlainNote(item, text);
            setSectionSummary(getString("panel-ready"));
            new ztoolkit.ProgressWindow(addon.data.config.addonName)
              .createLine({
                text: "Saved to note",
                type: "success",
              })
              .show();
          } catch (err: any) {
            setSectionSummary(getString("panel-error"));
            new ztoolkit.ProgressWindow(addon.data.config.addonName)
              .createLine({
                text: err?.message || "Failed to save note",
                type: "fail",
              })
              .show();
          }
        },
      },
    ],
  });
}

function loadPrefs() {
  const provider = getPref("provider") as LLMProvider;
  const scope = getPref("scope") as ExtractMode;
  const options: LLMOptions = {
    provider,
    apiKey: getPref("apiKey"),
    baseURL: getPref("baseURL"),
    model: getPref("model"),
    timeoutMs: Number(getPref("timeout")) * 1000,
    maxTokens: Number(getPref("maxTokens")),
    temperature: Number(getPref("temperature")),
    stream: !!getPref("stream"),
    log: !!getPref("log"),
  };
  const prompts = {
    rich: getPref("promptRich") || FALLBACK_PROMPT_RICH,
    plain: getPref("promptPlain") || FALLBACK_PROMPT_PLAIN,
  };
  return { options, prompts, scope };
}

async function generateAndLoadHTML(
  item: Zotero.Item,
  body: HTMLElement,
): Promise<string | undefined> {
  const browser = body.querySelector("#llmreader-browser") as XUL.Browser;
  if (!browser) return;
  const { options, prompts, scope } = loadPrefs();
  const payload = await extractContent(item, scope);
  const result = await summarizeRich(payload, prompts.rich, options);
  const fileURL = await writeTempHTML(result.text);
  browser.setAttribute("src", fileURL);
  addon.data.panel = {
    currentHTMLPath: fileURL,
    currentItemID: item.id,
  };
  return fileURL;
}

async function generatePlainText(item: Zotero.Item): Promise<string> {
  const { options, prompts, scope } = loadPrefs();
  const payload = await extractContent(item, scope);
  const result = await summarizePlain(payload, prompts.plain, options);
  return result.text;
}

async function writeTempHTML(html: string): Promise<string> {
  const tmp = Zotero.getTempDirectory();
  const file = tmp.clone();
  file.append(`${addon.data.config.addonRef}-view.html`);
  if (file.exists()) {
    file.remove(false);
  }
  Zotero.File.putContents(file.path, html);
  return Zotero.File.pathToFileURL(file.path);
}

export async function generatePlainNote(item: Zotero.Item) {
  const text = await generatePlainText(item);
  await savePlainNote(item, text);
}

export async function generateRichFile(item: Zotero.Item): Promise<string> {
  const { options, prompts, scope } = loadPrefs();
  const payload = await extractContent(item, scope);
  const result = await summarizeRich(payload, prompts.rich, options);
  return writeTempHTML(result.text);
}
