import { config } from "../../package.json";
import { getString, getLocaleID } from "../utils/locale";
import { getPref, type OutputLang } from "../utils/prefs";
import {
  extractContent,
  getReaderSelectedText,
  getItemAnnotations,
} from "./extract";
import {
  summarize,
  chat,
  getProviderDefaultURL,
  getProviderDefaultModel,
  type LLMOptions,
  type LLMProvider,
  type ChatMessage,
} from "./llmClient";

const PANEL_ID = "llm-reader-panel";
const CHAT_PANEL_ID = "llm-reader-chat-panel";
const BROWSER_ID = "llm-reader-browser";

// chrome:// URLs for panel HTML templates
function getPanelURL(page: "loading" | "error" | "analysis"): string {
  return `chrome://${addon.data.config.addonRef}/content/panel/${page}.html`;
}

// 内联 SVG 图标 (data URI) - 笔形图标用于分析面板
const ICON_DOCUMENT = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="#0071e3" d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5z"/><path fill="#f5a623" d="M1.5 13.5l1-4 3 3-4 1z"/></svg>')}`;
const ICON_DOCUMENT_20 = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="#0071e3" d="M15.502.707a1 1 0 0 1 1.414 0l2.377 2.377a1 1 0 0 1 0 1.414L6.707 17.084a1 1 0 0 1-.39.242l-4.243 1.414a1 1 0 0 1-1.272-1.272l1.414-4.243a1 1 0 0 1 .242-.39L15.502.707zM14.5 3.914L16.086 5.5 17.5 4.086 15.914 2.5 14.5 3.914zM15.379 6.207L13.793 4.621 5 13.414V14h1v1h1v1h.586l8.793-8.793z"/><path fill="#f5a623" d="M2 17l1.5-4.5 3 3L2 17z"/></svg>')}`;

const ICON_CHAT = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="#3b82f6" d="M5 2a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3v2l2.5-2H9a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5zm0 1.5h4A1.5 1.5 0 0 1 10.5 5v3A1.5 1.5 0 0 1 9 9.5H7l-1.5 1.2V9.5H5A1.5 1.5 0 0 1 3.5 8V5A1.5 1.5 0 0 1 5 3.5z"/><path fill="#93c5fd" d="M11 6v2a3 3 0 0 1-3 3H6.5l-.5.4V12a2 2 0 0 0 2 2h2.5l2 1.5V14h.5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H11z"/></svg>')}`;
const ICON_CHAT_20 = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="#3b82f6" d="M6 3a3 3 0 0 0-3 3v4a3 3 0 0 0 3 3v2.5l3-2.5h2a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6zm0 1.5h5A1.5 1.5 0 0 1 12.5 6v4a1.5 1.5 0 0 1-1.5 1.5H8.5L6.5 13v-1.5H6A1.5 1.5 0 0 1 4.5 10V6A1.5 1.5 0 0 1 6 4.5z"/><path fill="#93c5fd" d="M13 7.5v2.5a3 3 0 0 1-3 3H8l-.5.4V15a2 2 0 0 0 2 2h3l2.5 2V17h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-3z"/></svg>')}`;

// 按钮图标 - 笔形（分析）和复制
const ICON_PEN_BTN = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="context-fill" d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>')}`;
const ICON_COPY_BTN = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="context-fill" d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path fill="context-fill" d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>')}`;

const DEFAULT_CHAT_PROMPT = `你是一位专业的学术论文助手。用户正在阅读一篇学术论文，你需要帮助他们理解论文内容、回答问题、解释概念。回答保持准确、简洁、专业，如不确定请直接说明。`;

interface PanelState {
  isGenerating: boolean;
  currentItemID: number | null;
  htmlContent: string | null;
  error: string | null;
}

interface ChatState {
  itemID: number;
  messages: ChatMessage[];
  paperContext: string;
}

const panelStates = new Map<number, PanelState>();
const chatStates = new Map<number, ChatState>();

function getState(itemID: number): PanelState {
  if (!panelStates.has(itemID)) {
    panelStates.set(itemID, {
      isGenerating: false,
      currentItemID: itemID,
      htmlContent: null,
      error: null,
    });
  }
  return panelStates.get(itemID)!;
}

function getLanguageInstruction(lang: OutputLang): string {
  return lang === "zh"
    ? "\n\nIMPORTANT: You MUST write ALL content in Simplified Chinese (简体中文)."
    : "\n\nIMPORTANT: You MUST write ALL content in English.";
}

function formatChatHistory(messages: ChatMessage[]): string {
  const visibleMessages = messages.filter((m) => m.role !== "system");
  if (!visibleMessages.length) return "等待你的问题...";
  return visibleMessages
    .map((m) => `${m.role === "user" ? "你" : "AI"}: ${m.content}`)
    .join("\n\n");
}

function composeUserMessage(question: string, selection?: string | null): string {
  if (selection?.trim()) {
    return `[引用论文内容]\n"${selection.trim()}"\n\n[问题]\n${question}`;
  }
  return question;
}

function getChatSystemPrompt(): string {
  const custom = getPref("promptChat");
  return (custom && typeof custom === "string" ? custom : DEFAULT_CHAT_PROMPT).trim();
}

/**
 * 注册 Reader 侧边栏面板
 */
export function registerReaderPanel(_win: _ZoteroTypes.MainWindow) {
  registerSummaryPanel();
  registerChatPanel();
}

function registerSummaryPanel() {
  Zotero.ItemPaneManager.registerSection({
    paneID: PANEL_ID,
    pluginID: config.addonID,
    header: {
      l10nID: getLocaleID("tabpanel-reader-tab-label"),
      icon: ICON_DOCUMENT,
    },
    sidenav: {
      l10nID: getLocaleID("tabpanel-reader-tab-label"),
      icon: ICON_DOCUMENT_20,
    },
    bodyXHTML: buildPanelXHTML(),
    onInit: ({ item }) => {
      ztoolkit.log("LLM Reader Panel init", item?.id);
    },
    onDestroy: () => {
      ztoolkit.log("LLM Reader Panel destroy");
    },
    onItemChange: ({ setEnabled, tabType }) => {
      setEnabled(tabType === "reader");
      return true;
    },
    onRender: ({ body, item, setSectionSummary }) => {
      if (!item) return;
      const state = getState(item.id);
      const statusEl = body.querySelector("#llm-status") as HTMLElement;
      const browserEl = body.querySelector(`#${BROWSER_ID}`) as any;

      if (state.isGenerating) {
        statusEl.textContent = getString("panel-analyzing");
        setSectionSummary(getString("panel-loading"));
      } else if (state.error) {
        statusEl.textContent = `${getString("panel-error")}: ${state.error}`;
        setSectionSummary(getString("panel-error"));
      } else if (state.htmlContent) {
        statusEl.textContent = getString("panel-ready");
        setSectionSummary(getString("panel-ready"));
        renderHTMLContent(browserEl, state.htmlContent);
      } else {
        statusEl.textContent = getString("panel-click-to-analyze");
        setSectionSummary("");
      }
    },
    onAsyncRender: async ({ body, item, setSectionSummary }) => {
      if (!item) return;
      const state = getState(item.id);
      if (state.htmlContent && !state.isGenerating) {
        const browserEl = body.querySelector(`#${BROWSER_ID}`) as any;
        renderHTMLContent(browserEl, state.htmlContent);
        setSectionSummary(getString("panel-ready"));
      }
    },
    sectionButtons: [
      {
        type: "analyze",
        icon: ICON_PEN_BTN,
        l10nID: getLocaleID("panel-button-analyze"),
        onClick: async ({ body, item }) => {
          if (!item) return;
          await handleAnalyze(body, item);
        },
      },
      {
        type: "copy",
        icon: ICON_COPY_BTN,
        l10nID: getLocaleID("panel-button-open"),
        onClick: ({ item }) => {
          if (!item) return;
          const state = getState(item.id);
          if (state.htmlContent) {
            copyHTMLToClipboard(state.htmlContent);
          }
        },
      },
    ],
  });
}

function registerChatPanel() {
  Zotero.ItemPaneManager.registerSection({
    paneID: CHAT_PANEL_ID,
    pluginID: config.addonID,
    header: {
      l10nID: getLocaleID("tabpanel-chat-tab-label"),
      icon: ICON_CHAT,
    },
    sidenav: {
      l10nID: getLocaleID("tabpanel-chat-tab-label"),
      icon: ICON_CHAT_20,
    },
    bodyXHTML: `
      <vbox id="llmreader-chat-container" flex="1" style="width: 100%; height: 100%; padding: 16px; box-sizing: border-box;">
        <vbox id="llmreader-chat-shell" flex="1" style="display: flex; flex-direction: column; gap: 12px; height: 100%;">
          <vbox style="padding: 12px; border-radius: 12px; background: #ffffff; border: 1px solid #d7e3f4; box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12); gap: 8px;">
            <label style="font-weight: bold; color: #0f172a; font-size: 14px;">Your question</label>
            <html:textarea id="llmreader-chat-question" rows="5" placeholder="在这里输入你的问题..." style="width: 100%; min-height: 140px; resize: vertical; border-radius: 10px; border: 1px solid #cbd5e1; padding: 10px 12px; font-size: 13px; line-height: 1.6; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #0f172a; background-color: #f8fafc; box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08); box-sizing: border-box;"></html:textarea>
          </vbox>
          <hbox align="center" pack="end" style="gap: 10px;">
            <spacer flex="1" />
            <button id="llmreader-chat-send" style="padding: 9px 18px; border-radius: 10px; border: 1px solid #0284c7; background: #e0f2fe; color: #0c4a6e; font-weight: bold; font-size: 13px; cursor: pointer;">Send</button>
          </hbox>
          <vbox flex="1" style="padding: 12px; border-radius: 12px; background: #0f172a; border: 1px solid #1f2937; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.35); gap: 8px; min-height: 180px;">
            <label style="font-weight: bold; color: #e2e8f0; font-size: 14px;">AI 回复</label>
            <html:textarea id="llmreader-chat-answer" rows="8" readonly="true" style="width: 100%; min-height: 170px; resize: vertical; border-radius: 10px; border: 1px solid #1f2937; padding: 10px 12px; font-size: 13px; line-height: 1.6; font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace; color: #e2e8f0; background-color: rgba(15, 23, 42, 0.85); box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35); box-sizing: border-box;"></html:textarea>
          </vbox>
        </vbox>
      </vbox>
    `,
    onItemChange: ({ setEnabled, tabType }) => {
      setEnabled(tabType === "reader");
      return true;
    },
    onRender: ({ body, item, setSectionSummary }) => {
      const questionInput = body.querySelector(
        "#llmreader-chat-question",
      ) as HTMLTextAreaElement | null;
      const answerInput = body.querySelector(
        "#llmreader-chat-answer",
      ) as HTMLTextAreaElement | null;
      const sendBtn = body.querySelector("#llmreader-chat-send") as HTMLButtonElement | null;
      if (!questionInput || !answerInput || !sendBtn) return;

      setSectionSummary(getString("panel-chat-ready"));

      const wireKey = "__llmreaderChatBinding__";
      const prevBinding = (body as any)[wireKey];
      if (prevBinding) {
        prevBinding.sendBtn?.removeEventListener("click", prevBinding.sendHandler);
        prevBinding.questionInput?.removeEventListener("keydown", prevBinding.keyHandler);
      }

      void initChatContext(item).then(() => {
        const state = chatStates.get(item.id);
        if (state) {
          answerInput.value = formatChatHistory(state.messages);
        }
      });

      const onEnterSubmit = (ev: KeyboardEvent) => {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
          ev.preventDefault();
          void handleSend();
        }
      };

      let sending = false;

      const refreshHistory = (pendingAssistant?: string) => {
        const state = chatStates.get(item.id);
        if (!state) return;
        const historyText = formatChatHistory(state.messages);
        answerInput.value = pendingAssistant
          ? `${historyText}\n\nAI: ${pendingAssistant}`
          : historyText;
        answerInput.scrollTop = answerInput.scrollHeight;
      };

      const handleSend = async () => {
        if (sending) return;
        const question = questionInput.value.trim();
        if (!question) return;

        sending = true;
        const originalLabel = sendBtn.textContent || "Send";
        sendBtn.disabled = true;
        sendBtn.textContent = "发送中...";

        const selectedText = getReaderSelectedText();
        const userContent = composeUserMessage(question, selectedText);
        const state = chatStates.get(item.id);
        if (!state) {
          sendBtn.disabled = false;
          sendBtn.textContent = originalLabel;
          sending = false;
          return;
        }

        state.messages.push({ role: "user", content: userContent });
        refreshHistory("正在思考...");

        try {
          const options = loadLLMOptions();
          const response = await chat(state.messages, options);
          const assistantText = response.text?.trim() || "(空响应)";
          state.messages.push({ role: "assistant", content: assistantText });
          refreshHistory();
          questionInput.value = "";
        } catch (err: any) {
          const assistantText = err?.message ? `请求失败: ${err.message}` : "请求失败";
          state.messages.push({ role: "assistant", content: assistantText });
          refreshHistory();
          ztoolkit.log("chat error", err);
        } finally {
          sendBtn.disabled = false;
          sendBtn.textContent = originalLabel;
          sending = false;
          questionInput.focus();
        }
      };

      const onSendClick = () => void handleSend();

      sendBtn.addEventListener("click", onSendClick);
      questionInput.addEventListener("keydown", onEnterSubmit);

      (body as any)[wireKey] = {
        sendBtn,
        questionInput,
        sendHandler: onSendClick,
        keyHandler: onEnterSubmit,
      };

      refreshHistory();
      questionInput.focus();
    },
    onAsyncRender: async ({ item }) => {
      await initChatContext(item);
    },
    sectionButtons: [],
  });
}

async function initChatContext(item: Zotero.Item) {
  if (chatStates.has(item.id)) return;

  const content = await extractContent(item, "meta");
  const annotations = await getItemAnnotations(item);

  const contextParts = [
    `论文标题: ${content.meta.title || "未知"}`,
    `作者: ${content.meta.creators || "未知"}`,
    `摘要: ${content.meta.abstract || "无"}`,
  ];

  if (annotations.length > 0) {
    contextParts.push(`\n用户的高亮和注释:\n${annotations.slice(0, 20).join("\n")}`);
  }

  const outputLang = (getPref("outputLang") as OutputLang) || "zh";
  const langInstruction = getLanguageInstruction(outputLang);
  const chatPrompt = getChatSystemPrompt();

  chatStates.set(item.id, {
    itemID: item.id,
    messages: [
      {
        role: "system",
        content: chatPrompt + langInstruction + "\n\n论文信息:\n" + contextParts.join("\n"),
      },
    ],
    paperContext: contextParts.join("\n"),
  });
}

function loadLLMOptions(): LLMOptions {
  const provider = getPref("provider") as LLMProvider;
  return {
    provider,
    apiKey: getPref("apiKey"),
    baseURL: getProviderDefaultURL(provider),
    model: getPref("model") || getProviderDefaultModel(provider),
    timeoutMs: 300000,
    maxTokens: 65536,
    temperature: 0.7,
    stream: false,
    log: false,
  };
}

function buildPanelXHTML(): string {
  return `
    <vbox id="llm-reader-container" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
      <hbox id="llm-toolbar" align="center" style="padding: 8px; gap: 8px; border-bottom: 1px solid var(--fill-quinary);">
        <html:span id="llm-status" style="flex: 1; font-size: 12px; color: var(--fill-secondary);"></html:span>
      </hbox>
      <browser
        id="${BROWSER_ID}"
        disableglobalhistory="true"
        type="content"
        remote="true"
        maychangeremoteness="true"
        flex="1"
        style="width: 100%; min-height: 400px; flex: 1;"
      />
    </vbox>
  `;
}

async function handleAnalyze(body: HTMLElement, item: Zotero.Item) {
  const state = getState(item.id);
  if (state.isGenerating) return;

  state.isGenerating = true;
  state.error = null;

  const statusEl = body.querySelector("#llm-status") as HTMLElement;
  const browserEl = body.querySelector(`#${BROWSER_ID}`) as any;

  statusEl.textContent = getString("panel-analyzing");
  renderLoadingHTML(browserEl);

  try {
    const html = await generateHTMLFromLLM(item);
    state.htmlContent = html;
    state.isGenerating = false;
    statusEl.textContent = getString("panel-ready");
    renderHTMLContent(browserEl, html);
  } catch (err: any) {
    state.isGenerating = false;
    const errorMsg = err?.message || String(err);
    state.error = errorMsg;
    statusEl.textContent = `${getString("panel-error")}: ${errorMsg}`;
    renderErrorHTML(browserEl, errorMsg);
  }
}

async function generateHTMLFromLLM(item: Zotero.Item): Promise<string> {
  const provider = getPref<LLMProvider>("provider");
  const apiKey = getPref<string>("apiKey");
  const baseURL = getPref<string>("baseURL");
  const model = getPref<string>("model");
  const timeout = getPref<number>("timeout") * 1000;
  const maxTokens = getPref<number>("maxTokens");
  const temperature = getPref<number>("temperature");

  if (!apiKey) {
    throw new Error("请在偏好设置中配置 API Key");
  }

  const options: LLMOptions = {
    provider,
    apiKey,
    baseURL: baseURL || undefined,
    model: model || undefined,
    timeoutMs: timeout,
    maxTokens,
    temperature,
    stream: false,
    log: getPref<boolean>("log"),
  };

  const content = await extractContent(item, "full");
  const annotations = await getItemAnnotations(item);
  content.highlights = annotations;

  const customPrompt = getPref<string>("promptRich");
  const prompt = customPrompt || getDefaultRichPrompt();

  const result = await summarize(content, prompt, options);
  let html = result.text;
  html = cleanHTMLResponse(html);
  return html;
}

function cleanHTMLResponse(text: string): string {
  let html = text.trim();
  if (html.startsWith("```html")) {
    html = html.slice(7);
  } else if (html.startsWith("```")) {
    html = html.slice(3);
  }
  if (html.endsWith("```")) {
    html = html.slice(0, -3);
  }
  return html.trim();
}

function renderHTMLContent(browserEl: any, html: string) {
  if (!browserEl) return;
  const fullHTML = ensureHTMLResources(html);

  try {
    const currentURI = browserEl.currentURI?.spec || "";
    const analysisURL = getPanelURL("analysis");

    // 如果已经在 analysis 页面，直接发送消息
    if (currentURI === analysisURL) {
      sendMessageToBrowser(browserEl, { type: "renderHTML", html: fullHTML });
    } else {
      // 先加载 analysis 页面，等页面准备好后再发送内容
      loadBrowserURL(browserEl, analysisURL);
      // 等待页面加载完成后发送内容
      waitForBrowserReady(browserEl, () => {
        sendMessageToBrowser(browserEl, { type: "renderHTML", html: fullHTML });
      });
    }
  } catch (err) {
    ztoolkit.log("Failed to render HTML content:", err);
    // 降级到 data URI 方式
    const dataURI = `data:text/html;charset=utf-8,${encodeURIComponent(fullHTML)}`;
    loadBrowserURL(browserEl, dataURI);
  }
}

function loadBrowserURL(browserEl: any, url: string) {
  try {
    // Zotero 7 / Firefox 115+ 需要 nsIURI 对象
    const uri = Services.io.newURI(url);
    browserEl.loadURI(uri, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
  } catch (err) {
    ztoolkit.log("Failed to load URL:", url, err);
    // 降级方案：直接设置 src 属性
    try {
      browserEl.src = url;
    } catch (e) {
      ztoolkit.log("Fallback src also failed:", e);
    }
  }
}

function sendMessageToBrowser(browserEl: any, message: any) {
  try {
    browserEl.contentWindow?.postMessage(message, "*");
  } catch (err) {
    ztoolkit.log("Failed to send message to browser:", err);
  }
}

function waitForBrowserReady(browserEl: any, callback: () => void, timeout = 5000) {
  const startTime = Date.now();

  const checkReady = () => {
    try {
      if (browserEl.contentWindow?.document?.readyState === "complete") {
        // 额外延迟确保脚本执行完成
        setTimeout(callback, 100);
        return;
      }
    } catch {
      // 页面可能还没加载
    }

    if (Date.now() - startTime < timeout) {
      setTimeout(checkReady, 50);
    } else {
      // 超时后仍然尝试执行
      callback();
    }
  };

  checkReady();
}

function ensureHTMLResources(html: string): string {
  const hasMathJax = html.includes("mathjax");
  const hasTailwind = html.includes("tailwindcss") || html.includes("tailwind");

  if (html.includes("<!DOCTYPE") || html.includes("<html")) {
    if (!hasMathJax || !hasTailwind) {
      const resources = buildResourceTags(!hasMathJax, !hasTailwind);
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${resources}</head>`);
      }
    }
    return html;
  }
  return wrapHTMLContent(html);
}

function buildResourceTags(addMathJax: boolean, addTailwind: boolean): string {
  let tags = "";
  if (addTailwind) {
    tags += '<script src="https://cdn.tailwindcss.com"></script>\n';
  }
  if (addMathJax) {
    tags += `
<script>
MathJax = {
  tex: {
    inlineMath: [['$', '$']],
    displayMath: [['$$', '$$']],
    processEscapes: true,
    processEnvironments: true,
    tags: 'ams'
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
  },
  startup: {
    pageReady: () => {
      return MathJax.startup.defaultPageReady();
    }
  }
};
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async></script>
`;
  }
  return tags;
}

function wrapHTMLContent(content: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LLM Reader</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
MathJax = {
  tex: {
    inlineMath: [['$', '$']],
    displayMath: [['$$', '$$']],
    processEscapes: true,
    processEnvironments: true,
    tags: 'ams'
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
  },
  startup: {
    pageReady: () => {
      return MathJax.startup.defaultPageReady();
    }
  }
};
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 20px;
    }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

function renderLoadingHTML(browserEl: any) {
  if (!browserEl) return;
  const loadingURL = getPanelURL("loading");
  loadBrowserURL(browserEl, loadingURL);

  // 页面加载后设置本地化文本
  waitForBrowserReady(browserEl, () => {
    sendMessageToBrowser(browserEl, {
      type: "setLoading",
      title: getString("tab-loading-title"),
      subtitle: getString("tab-loading-subtitle"),
    });
  });
}

function renderErrorHTML(browserEl: any, error: string) {
  if (!browserEl) return;
  const errorURL = getPanelURL("error");
  loadBrowserURL(browserEl, errorURL);

  // 页面加载后设置错误信息
  waitForBrowserReady(browserEl, () => {
    sendMessageToBrowser(browserEl, {
      type: "setError",
      title: getString("panel-error"),
      message: error,
    });
  });
}


function copyHTMLToClipboard(html: string) {
  try {
    new ztoolkit.Clipboard()
      .addText(html, "text/unicode")
      .addText(html, "text/html")
      .copy();

    new ztoolkit.ProgressWindow(config.addonName)
      .createLine({
        text: "HTML 已复制到剪贴板",
        type: "success",
        progress: 100,
      })
      .show()
      .startCloseTimer(2000);
  } catch (err) {
    ztoolkit.log("Failed to copy to clipboard:", err);
  }
}

function getDefaultRichPrompt(): string {
  const outputLang = getPref<string>("outputLang") || "zh";
  const langInstruction =
    outputLang === "zh" ? "所有内容使用中文" : "All content in English";

  return `# Role
你是一位顶级的 AI researcher 以及全栈开发者，同时也是一位精通学术内容解读与数据可视化的信息设计师。你的任务是将一篇复杂的学术论文，转化为一个符合苹果官网设计美学、交互流畅、信息层级分明的动态HTML网页。

# Task
请将以下指定的学术论文，严格按照要求，生成一个单一、完整的 index.html 文件。网页需深度解析并重点展示论文的：

- **研究背景**：这篇论文是在什么领域，这个领域的背景是什么
- **研究动机**：发现了什么问题，为什么需要解决这个问题
- **研究结论**：通过实验发现了什么结论，或者设计了什么方法
- **数学表示及建模**：从符号到公式，以及公式推导和算法流程
- **实验方法与实验设计**：系统性整理实验细节
- **实验结果及核心结论**：对比了那些baseline，达到了什么效果
- **你的评论**：作为reviewer，整体锐评这篇工作
- **One More Thing**：其他你认为重要的内容

# MathJax 数学公式规范

## 必须在 head 中包含 MathJax 配置：
- 行内公式使用 $...$
- 块级公式使用 $$...$$
- $ 符号必须紧贴公式内容
- HTML 特殊字符转义：小于号用 \\\\lt，大于号用 \\\\gt

# Technical Constraints

1. Single File：CSS 和 JS 必须全部内嵌在 HTML 中
2. External Libs：仅允许引入 Tailwind CSS (CDN) 和 MathJax (CDN)
3. 表格：关键实验表格必须用 HTML table 渲染
4. 直接输出 HTML 代码，不要输出解释性文字或 markdown 代码块标记
5. ${langInstruction}

# Design Requirements

1. 整体风格：参考 Apple 官网的简洁、留白、高级感设计美学
2. 配色方案：主背景 #0a0a0a，卡片背景 #1a1a1a
3. 字体排版：行高 1.6-1.8
4. 交互效果：卡片 hover 时有微妙的上浮和阴影变化
5. 响应式：适配桌面端和移动端

请直接输出完整的 HTML 代码。`;
}
