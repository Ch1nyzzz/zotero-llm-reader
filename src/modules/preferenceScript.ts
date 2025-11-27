import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
  testConnection,
  getProviderModels,
  getProviderDefaultURL,
  getProviderDefaultModel,
  type LLMProvider,
} from "./llmClient";
import { getPref, setPref } from "../utils/prefs";
import type { PrefKey } from "../utils/prefs";

export async function registerPrefsScripts(_window: Window) {
  addon.data.prefs = { window: _window };
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
  const provider = getPref("provider") as LLMProvider;

  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-provider`,
  ) as XUL.MenuList)!.value = provider;
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-api-key`,
  ) as HTMLInputElement)!.value = getPref("apiKey");

  // 更新模型列表并设置当前值
  updateModelList(provider);
  const model = getPref("model") || getProviderDefaultModel(provider);
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-model`,
  ) as XUL.MenuList)!.value = model;
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-output-lang`,
  ) as XUL.MenuList)!.value = getPref("outputLang") || "zh";
  (doc.getElementById(
    `zotero-prefpane-${config.addonRef}-prompt-rich`,
  ) as HTMLTextAreaElement)!.value = getPref("promptRich");
}

function updateModelList(provider: LLMProvider) {
  const doc = addon.data.prefs!.window.document;
  const popup = doc.getElementById(
    `zotero-prefpane-${config.addonRef}-model-popup`,
  ) as XUL.MenuPopup;
  if (!popup) return;

  // 清空现有选项
  while (popup.firstChild) {
    popup.removeChild(popup.firstChild);
  }

  // 添加新选项
  const models = getProviderModels(provider);
  for (const model of models) {
    const item = doc.createXULElement("menuitem");
    item.setAttribute("value", model);
    item.setAttribute("label", model);
    popup.appendChild(item);
  }

  // 如果是 custom，添加一个空选项让用户可以手动输入
  if (provider === "custom") {
    const item = doc.createXULElement("menuitem");
    item.setAttribute("value", "");
    item.setAttribute("label", "(custom)");
    popup.appendChild(item);
  }
}

function bindPrefEvents() {
  const doc = addon.data.prefs!.window.document;

  // Provider 选择变化时，更新 baseURL 和模型列表
  doc
    .getElementById(`zotero-prefpane-${config.addonRef}-provider`)
    ?.addEventListener("command", (e: any) => {
      const provider = e.target.value as LLMProvider;
      setPref("provider", provider);

      // 更新模型列表并选择默认模型
      updateModelList(provider);
      const defaultModel = getProviderDefaultModel(provider);
      const modelList = doc.getElementById(
        `zotero-prefpane-${config.addonRef}-model`,
      ) as XUL.MenuList;
      modelList.value = defaultModel;
      setPref("model", defaultModel);
    });

  // 模型选择
  doc
    .getElementById(`zotero-prefpane-${config.addonRef}-model`)
    ?.addEventListener("command", (e: any) => {
      setPref("model", e.target.value);
    });

  // 输出语言选择
  doc
    .getElementById(`zotero-prefpane-${config.addonRef}-output-lang`)
    ?.addEventListener("command", (e: any) => {
      setPref("outputLang", e.target.value);
    });

  // 为 API Key 输入框绑定事件确保保存
  const apiKeyEl = doc.getElementById(
    `zotero-prefpane-${config.addonRef}-api-key`,
  ) as HTMLInputElement | null;
  if (apiKeyEl) {
    const saveApiKey = () => setPref("apiKey", apiKeyEl.value);
    apiKeyEl.addEventListener("input", saveApiKey);
    apiKeyEl.addEventListener("change", saveApiKey);
    apiKeyEl.addEventListener("blur", saveApiKey);
  }
  // 使用防抖避免每次按键都保存导致卡顿
  let promptDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const promptRichEl = doc.getElementById(
    `zotero-prefpane-${config.addonRef}-prompt-rich`,
  ) as HTMLTextAreaElement | null;
  if (promptRichEl) {
    const savePrompt = () => setPref("promptRich", promptRichEl.value);
    promptRichEl.addEventListener("input", () => {
      if (promptDebounceTimer) clearTimeout(promptDebounceTimer);
      promptDebounceTimer = setTimeout(savePrompt, 500);
    });
    promptRichEl.addEventListener("blur", savePrompt);
  }

  doc
    .getElementById(`zotero-prefpane-${config.addonRef}-test`)
    ?.addEventListener("command", async () => {
      const win = addon.data.prefs!.window;
      const provider = getPref("provider") as LLMProvider;
      try {
        const result = await testConnection({
          provider,
          apiKey: getPref("apiKey"),
          baseURL: getProviderDefaultURL(provider),
          model: getPref("model") || getProviderDefaultModel(provider),
          timeoutMs: 30000,
        });
        win.alert(result.ok ? "OK" : `Failed: ${result.message}`);
      } catch (err: any) {
        win.alert(`Failed: ${err?.message || err}`);
      }
    });
}
