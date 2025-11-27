import { getString } from "../utils/locale";
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

const FALLBACK_PROMPT_RICH = `Return a self-contained HTML page.
IMPORTANT: Do NOT use LaTeX or MathJax for math formulas. Instead, render math using:
- HTML entities: &sum; &int; &infin; &alpha; &beta; &gamma; &delta; &pi; &theta; &lambda; &mu; &sigma; &phi; &psi; &omega; &nabla; &part; &radic; &ne; &le; &ge; &times; &divide; &plusmn; &sup2; &sup3;
- Unicode: × ÷ ± √ ∑ ∏ ∫ ∂ ∇ ∞ ≠ ≤ ≥ ≈ ∈ ∉ ⊂ ⊃ ∪ ∩ ∧ ∨ α β γ δ ε θ λ μ π σ φ ω
- CSS for fractions: <span style="display:inline-block;text-align:center;vertical-align:middle;"><span style="display:block;border-bottom:1px solid;">numerator</span><span style="display:block;">denominator</span></span>
- Subscript/superscript: <sub>n</sub> <sup>2</sup>`;

// 内联 SVG 图标 (data URI) - 彩色现代设计风格
// AI 文档解析面板 - 蓝色文档 + 金色星星(AI)
const ICON_DOCUMENT = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="#0071e3" fill-rule="evenodd" d="M3 2.5A1.5 1.5 0 0 1 4.5 1H9l4 4v8.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-11zM9 1.5v3a.5.5 0 0 0 .5.5h3L9 1.5zM5 8.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5z"/><path fill="#f5a623" d="M12.5 7.5l1 2 2 .5-1.5 1.5.5 2-2-1-2 1 .5-2L9.5 10l2-.5 1-2z"/></svg>')}`;
const ICON_DOCUMENT_20 = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="#0071e3" fill-rule="evenodd" d="M4 3a2 2 0 0 1 2-2h5l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3zm7-1v4a1 1 0 0 0 1 1h4l-5-5zM6.5 10a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7zm0 3a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1h-4z"/><path fill="#f5a623" d="M15 9l1.2 2.4 2.8.4-2 2 .5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-2 2.8-.4L15 9z"/></svg>')}`;

// 聊天对话图标
const ICON_CHAT = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="#3b82f6" d="M5 2a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3v2l2.5-2H9a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5zm0 1.5h4A1.5 1.5 0 0 1 10.5 5v3A1.5 1.5 0 0 1 9 9.5H7l-1.5 1.2V9.5H5A1.5 1.5 0 0 1 3.5 8V5A1.5 1.5 0 0 1 5 3.5z"/><path fill="#93c5fd" d="M11 6v2a3 3 0 0 1-3 3H6.5l-.5.4V12a2 2 0 0 0 2 2h2.5l2 1.5V14h.5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H11z"/></svg>')}`;
const ICON_CHAT_20 = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="#3b82f6" d="M6 3a3 3 0 0 0-3 3v4a3 3 0 0 0 3 3v2.5l3-2.5h2a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6zm0 1.5h5A1.5 1.5 0 0 1 12.5 6v4a1.5 1.5 0 0 1-1.5 1.5H8.5L6.5 13v-1.5H6A1.5 1.5 0 0 1 4.5 10V6A1.5 1.5 0 0 1 6 4.5z"/><path fill="#93c5fd" d="M13 7.5v2.5a3 3 0 0 1-3 3H8l-.5.4V15a2 2 0 0 0 2 2h3l2.5 2V17h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-3z"/></svg>')}`;

const DEFAULT_CHAT_PROMPT = `你是一位专业的学术论文助手。用户正在阅读一篇学术论文，你需要帮助他们理解论文内容、回答问题、解释概念。回答保持准确、简洁、专业，如不确定请直接说明。`;

function getLanguageInstruction(lang: OutputLang): string {
  return lang === "zh"
    ? "\n\nIMPORTANT: You MUST write ALL content in Simplified Chinese (简体中文)."
    : "\n\nIMPORTANT: You MUST write ALL content in English.";
}

// 存储对话历史
interface ChatState {
  itemID: number;
  messages: ChatMessage[];
  paperContext: string;
}

const chatStates = new Map<number, ChatState>();

// 记录面板状态 - 存储 HTML 内容而非路径
const panelStates = new Map<number, { analyzed: boolean; htmlContent?: string }>();

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

// 当前正在分析的 item（避免重复触发）
let analyzingItemId: number | null = null;

export function registerReaderPanel(_win: _ZoteroTypes.MainWindow) {
  registerSummaryPanel();
  registerChatPanel();
}

function registerSummaryPanel() {
  const paneID = `${addon.data.config.addonRef}-reader`;
  Zotero.ItemPaneManager.registerSection({
    paneID,
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: "tabpanel-reader-tab-label",
      icon: ICON_DOCUMENT,
    },
    sidenav: {
      l10nID: "tabpanel-reader-tab-label",
      icon: ICON_DOCUMENT_20,
    },
    bodyXHTML: `
      <vbox id="llmreader-container" style="width: 100%; height: 100%;">
        <vbox id="llmreader-loading" align="center" pack="center" style="flex: 1; padding: 40px; background: #ffffff;">
          <label style="font-size: 24px; margin-bottom: 16px;">⏳</label>
          <label id="llmreader-status-text" style="font-size: 16px; color: #1f2937;">正在分析论文...</label>
          <label style="font-size: 13px; color: #6b7280; margin-top: 12px;">AI 正在阅读并生成摘要，请稍候</label>
        </vbox>
        <hbox id="llmreader-button-container" align="center" pack="center" style="padding: 14px; display: none;">
          <button id="llmreader-analyze-btn" style="padding: 12px 40px; font-size: 14px; background: #3b82f6; color: #ffffff; border: none; border-radius: 10px; font-weight: bold;">Retry</button>
        </hbox>
        <html:iframe id="llmreader-browser" flex="1" hidden="true" style="width: 100%; min-height: 600px; border: none;"/>
      </vbox>
    `,
    onItemChange: ({ setEnabled, tabType }) => {
      setEnabled(tabType === "reader");
      return true;
    },
    onRender: ({ body, item, setSectionSummary }) => {
      const browser = body.querySelector("#llmreader-browser") as HTMLIFrameElement;
      const btn = body.querySelector("#llmreader-analyze-btn") as HTMLButtonElement;
      const btnContainer = body.querySelector("#llmreader-button-container") as HTMLElement;
      const loadingContainer = body.querySelector("#llmreader-loading") as HTMLElement;
      const statusText = body.querySelector("#llmreader-status-text") as HTMLElement;

      if (!browser || !btn) return;

      // 安全调用 setSectionSummary，避免 section 被销毁后出错
      const safeSummary = (text: string) => {
        try {
          setSectionSummary(text);
        } catch {
          // section 已被销毁，忽略
        }
      };

      const showLoading = () => {
        loadingContainer?.removeAttribute("hidden");
        btnContainer?.setAttribute("style", "display: none;");
        browser.setAttribute("hidden", "true");
      };

      const showBrowser = () => {
        loadingContainer?.setAttribute("hidden", "true");
        btnContainer?.setAttribute("style", "display: none;");
        browser.removeAttribute("hidden");
      };

      const showError = () => {
        loadingContainer?.setAttribute("hidden", "true");
        btnContainer?.setAttribute("style", "display: flex; padding: 14px;");
        browser.setAttribute("hidden", "true");
      };

      const triggerAnalyze = async () => {
        if (analyzingItemId === item.id) return;
        analyzingItemId = item.id;

        btn.disabled = true;
        if (statusText) statusText.textContent = "正在分析论文...";
        safeSummary(getString("panel-analyzing"));
        showLoading();

        try {
          const htmlContent = await generateAndLoadHTML(item, browser);
          if (htmlContent) {
            panelStates.set(item.id, { analyzed: true, htmlContent });
            // 重新获取 DOM 元素，因为异步操作后可能失效
            const currentBrowser = body.querySelector("#llmreader-browser") as HTMLIFrameElement;
            const currentLoading = body.querySelector("#llmreader-loading") as HTMLElement;
            const currentBtnContainer = body.querySelector("#llmreader-button-container") as HTMLElement;
            if (currentBrowser && currentLoading) {
              currentLoading.setAttribute("hidden", "true");
              currentBtnContainer?.setAttribute("style", "display: none;");
              currentBrowser.removeAttribute("hidden");
              currentBrowser.srcdoc = htmlContent;
            }
            safeSummary(getString("panel-ready"));
          } else {
            showError();
            btn.disabled = false;
            safeSummary(getString("panel-error"));
          }
        } catch (err) {
          ztoolkit.log("analyze error", err);
          showError();
          btn.disabled = false;
          safeSummary(getString("panel-error"));
        } finally {
          analyzingItemId = null;
        }
      };

      btn.onclick = () => void triggerAnalyze();

      const state = panelStates.get(item.id);
      if (state?.analyzed && state.htmlContent) {
        browser.srcdoc = state.htmlContent;
        showBrowser();
        safeSummary(getString("panel-ready"));
      } else {
        showLoading();
        safeSummary(getString("panel-analyzing"));
        void triggerAnalyze();
      }
    },
    sectionButtons: [],
  });
}

function registerChatPanel() {
  const paneID = `${addon.data.config.addonRef}-chat`;
  Zotero.ItemPaneManager.registerSection({
    paneID,
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: "tabpanel-chat-tab-label",
      icon: ICON_CHAT,
    },
    sidenav: {
      l10nID: "tabpanel-chat-tab-label",
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
            <button id="llmreader-chat-send" style="padding: 9px 18px; border-radius: 10px; border: none; background: linear-gradient(135deg, #0ea5e9, #0284c7); color: #ffffff; font-weight: bold; font-size: 13px; cursor: pointer; box-shadow: 0 10px 24px rgba(14, 165, 233, 0.35);">Send</button>
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
          const { options } = loadPrefs();
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

function loadPrefs() {
  const provider = getPref("provider") as LLMProvider;
  const outputLang = (getPref("outputLang") as OutputLang) || "zh";
  const langInstruction = getLanguageInstruction(outputLang);

  const options: LLMOptions = {
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
  const prompts = {
    rich: (getPref("promptRich") || FALLBACK_PROMPT_RICH) + langInstruction,
  };
  return { options, prompts };
}

async function generateAndLoadHTML(
  item: Zotero.Item,
  browser: HTMLIFrameElement,
): Promise<string | undefined> {
  try {
    ztoolkit.log("[LLM Reader] Starting analysis for item:", item.id);
    const { options, prompts } = loadPrefs();
    ztoolkit.log("[LLM Reader] Extracting content...");
    const payload = await extractContent(item, "meta");
    ztoolkit.log("[LLM Reader] Calling LLM API...");
    const result = await summarize(payload, prompts.rich, options);
    ztoolkit.log("[LLM Reader] Got response, processing HTML...");
    const htmlContent = processHTMLContent(result.text);
    // 使用 srcdoc 直接嵌入 HTML 内容，避免 file:// 安全限制
    browser.srcdoc = htmlContent;
    addon.data.panel = {
      currentHTMLContent: htmlContent,
      currentItemID: item.id,
    };
    ztoolkit.log("[LLM Reader] Analysis complete");
    return htmlContent;
  } catch (err) {
    ztoolkit.log("[LLM Reader] Error in generateAndLoadHTML:", err);
    throw err;
  }
}

// 强制浅色主题样式覆盖
const LIGHT_THEME_OVERRIDE = `
<style>
  :root { color-scheme: light !important; }
  html, body {
    background: linear-gradient(135deg, #f8fafc, #e2e8f0) !important;
    color: #1e293b !important;
  }
</style>
`;

/** 处理 HTML 内容，添加必要的包装 */
function processHTMLContent(rawHTML: string): string {
  const normalizedHTML = ensureHTMLDocument(rawHTML);
  let processedHTML = normalizedHTML;

  // 注入浅色主题覆盖样式
  if (processedHTML.includes("</head>")) {
    processedHTML = processedHTML.replace("</head>", LIGHT_THEME_OVERRIDE + "</head>");
  } else if (processedHTML.includes("<body")) {
    processedHTML = processedHTML.replace("<body", LIGHT_THEME_OVERRIDE + "<body");
  } else {
    processedHTML = LIGHT_THEME_OVERRIDE + processedHTML;
  }

  return processedHTML;
}

/**
 * 预处理 HTML 中的数学公式，修复常见格式问题
 */
function preprocessMathHTML(html: string): string {
  // 暂存 script 内容，避免对 MathJax 配置等脚本做替换
  const scriptPlaceholders: string[] = [];
  let result = html.replace(/<script[\s\S]*?<\/script>/gi, (match) => {
    const key = `__LLM_READER_SCRIPT_${scriptPlaceholders.length}__`;
    scriptPlaceholders.push(match);
    return key;
  });

  // 1. 将 \( \) 替换为 $ $（行内公式）
  result = result.replace(/\\\((.+?)\\\)/g, (_, content) => `$${content}$`);

  // 2. 将 \[ \] 替换为 $$ $$（块级公式）
  result = result.replace(/\\\[(.+?)\\\]/gs, (_, content) => `$$${content}$$`);

  // 3. 修复 HTML 中的 < 和 > 在公式内的问题
  result = result.replace(/(\${1,2})([^$]+?)(\${1,2})/g, (_match, open, content, close) => {
    let fixed = content
      .replace(/([^\\])(<)([^=])/g, '$1\\lt $3')
      .replace(/([^\\])(>)([^=])/g, '$1\\gt $3')
      .replace(/^(<)([^=])/g, '\\lt $2')
      .replace(/^(>)([^=])/g, '\\gt $2');
    return `${open}${fixed}${close}`;
  });

  // 4. 确保块级公式前后有适当的 HTML 结构
  result = result.replace(/([^\n>])\$\$/g, '$1\n$$');
  result = result.replace(/\$\$([^\n<])/g, '$$\n$1');

  // 恢复 script 内容
  result = result.replace(
    /__LLM_READER_SCRIPT_(\d+)__/g,
    (_, idx) => scriptPlaceholders[Number(idx)],
  );

  return result;
}

// MathJax 脚本注入
const MATHJAX_SCRIPT = `
<script>
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
    displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
    processEscapes: true
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
  }
};
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async></script>
`;

function wrapHTMLDocument(bodyContent: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Zotero LLM Reader</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      padding: 24px;
      background: linear-gradient(135deg, #f8fafc, #e2e8f0);
      color: #1e293b;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }
    .llmreader-shell {
      max-width: 1100px;
      margin: 0 auto;
    }
    .llmreader-fallback {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      line-height: 1.7;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="llmreader-shell">${bodyContent}</div>
</body>
</html>`;
}

function ensureHTMLDocument(rawHTML: string): string {
  const fallbackBody =
    '<div class="llmreader-fallback">AI 没有返回可渲染的 HTML 内容，请稍后重试。</div>';
  if (!rawHTML || !rawHTML.trim()) {
    return wrapHTMLDocument(fallbackBody);
  }

  const fenced = rawHTML.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const unwrapped = fenced ? fenced[1].trim() : rawHTML.trim();
  const hasHTMLTag = /<!doctype html/i.test(unwrapped) || /<html[\s>]/i.test(unwrapped);
  const hasBodyTag = /<body[\s>]/i.test(unwrapped);

  if (hasHTMLTag && hasBodyTag) {
    return unwrapped;
  }

  if (hasBodyTag) {
    return `<!doctype html><html>${unwrapped}</html>`;
  }

  return wrapHTMLDocument(unwrapped);
}

async function writeTempHTML(html: string): Promise<string> {
  const tmp = Zotero.getTempDirectory();
  const file = tmp.clone();
  file.append(`${addon.data.config.addonRef}-view.html`);
  if (file.exists()) {
    file.remove(false);
  }
  const normalizedHTML = ensureHTMLDocument(html);
  let processedHTML = preprocessMathHTML(normalizedHTML);
  const hasMathJax =
    /<script[^>]*mathjax/i.test(processedHTML) || /MathJax\s*=/.test(processedHTML);

  // 注入浅色主题覆盖和 MathJax
  const injections = LIGHT_THEME_OVERRIDE + (hasMathJax ? "" : MATHJAX_SCRIPT);

  if (processedHTML.includes('</head>')) {
    processedHTML = processedHTML.replace('</head>', injections + '</head>');
  } else if (processedHTML.includes('<body')) {
    processedHTML = processedHTML.replace('<body', injections + '<body');
  } else {
    processedHTML = injections + processedHTML;
  }

  Zotero.File.putContents(file, processedHTML);
  return Zotero.File.pathToFileURI(file.path);
}

export async function generateRichFile(item: Zotero.Item): Promise<string> {
  const { options, prompts } = loadPrefs();
  const payload = await extractContent(item, "meta");
  const result = await summarize(payload, prompts.rich, options);
  return writeTempHTML(result.text);
}
