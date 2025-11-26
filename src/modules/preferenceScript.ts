import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { testConnection } from "./llmClient";
import { getPref, setPref } from "../utils/prefs";
import type { PrefKey } from "../utils/prefs";

export async function registerPrefsScripts(_window: Window) {
  if (!addon.data.prefs) {
    addon.data.prefs = { window: _window, columns: [], rows: [] };
  } else {
    addon.data.prefs.window = _window;
  }
  bindPrefEvents();
  fillPrefValues();
}

export function registerPrefsPane() {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("pref-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });
}

function fillPrefValues() {
  const doc = addon.data.prefs!.window.document;
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-provider`,
  ) as XUL.Menulist)!.value = getPref("provider");
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-api-key`,
  ) as HTMLInputElement)!.value = getPref("apiKey");
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-base-url`,
  ) as HTMLInputElement)!.value = getPref("baseURL");
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-model`,
  ) as HTMLInputElement)!.value = getPref("model");
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-timeout`,
  ) as HTMLInputElement)!.value = String(getPref("timeout"));
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-max-tokens`,
  ) as HTMLInputElement)!.value = String(getPref("maxTokens"));
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-temperature`,
  ) as HTMLInputElement)!.value = String(getPref("temperature"));
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-scope`,
  ) as XUL.RadioGroup)!.value = getPref("scope");
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-stream`,
  ) as XUL.Checkbox)!.checked = getPref("stream");
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-log`,
  ) as XUL.Checkbox)!.checked = getPref("log");
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-prompt-rich`,
  ) as HTMLTextAreaElement)!.value = getPref("promptRich");
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-prompt-plain`,
  ) as HTMLTextAreaElement)!.value = getPref("promptPlain");
}

function bindPrefEvents() {
  const doc = addon.data.prefs!.window.document;
  const bindings: Array<[string, "input" | "change" | "command", PrefKey]> = [
    [`provider`, "command", "provider"],
    [`api-key`, "input", "apiKey"],
    [`base-url`, "input", "baseURL"],
    [`model`, "input", "model"],
    [`timeout`, "input", "timeout"],
    [`max-tokens`, "input", "maxTokens"],
    [`temperature`, "input", "temperature"],
  ];
  bindings.forEach(([name, evt, key]) => {
    doc
      .getElementById(`zotero-prefpane-${config.addonRef}-${name}`)
      ?.addEventListener(evt, (e: any) => {
        const value =
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
            ? e.target.value
            : e.target.value;
        const numericKeys: PrefKey[] = ["timeout", "maxTokens", "temperature"];
        setPref(key, numericKeys.includes(key) ? Number(value) : value);
      });
  });

  doc
    .getElementById(`zotero-prefpane-${config.addonRef}-stream`)
    ?.addEventListener("command", (e: any) => {
      setPref("stream", (e.target as XUL.Checkbox).checked);
    });
  doc
    .getElementById(`zotero-prefpane-${config.addonRef}-log`)
    ?.addEventListener("command", (e: any) => {
      setPref("log", (e.target as XUL.Checkbox).checked);
    });
  doc
    .getElementById(`zotero-prefpane-${config.addonRef}-scope`)
    ?.addEventListener("command", (e: any) => {
      setPref("scope", (e.target as XUL.RadioGroup).value);
    });
  doc
    .getElementById(`zotero-prefpane-${config.addonRef}-prompt-rich`)
    ?.addEventListener("input", (e: any) =>
      setPref("promptRich", (e.target as HTMLTextAreaElement).value),
    );
  doc
    .getElementById(`zotero-prefpane-${config.addonRef}-prompt-plain`)
    ?.addEventListener("input", (e: any) =>
      setPref("promptPlain", (e.target as HTMLTextAreaElement).value),
    );

  doc
    .getElementById(`zotero-prefpane-${config.addonRef}-test`)
    ?.addEventListener("command", async () => {
      const win = addon.data.prefs!.window;
      try {
        const result = await testConnection({
          provider: getPref("provider"),
          apiKey: getPref("apiKey"),
          baseURL: getPref("baseURL"),
          model: getPref("model"),
          timeoutMs: Number(getPref("timeout")) * 1000,
        });
        win.alert(result.ok ? "OK" : `Failed: ${result.message}`);
      } catch (err: any) {
        win.alert(`Failed: ${err?.message || err}`);
      }
    });
}
