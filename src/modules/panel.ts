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

const FALLBACK_PROMPT_RICH =
  "You are an assistant that renders a single self-contained HTML page. Return only HTML.";

// 内联 SVG 图标 (data URI) - 彩色现代设计风格
// AI 文档解析面板 - 蓝色文档 + 金色星星(AI)
const ICON_DOCUMENT = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="#0071e3" fill-rule="evenodd" d="M3 2.5A1.5 1.5 0 0 1 4.5 1H9l4 4v8.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-11zM9 1.5v3a.5.5 0 0 0 .5.5h3L9 1.5zM5 8.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5z"/><path fill="#f5a623" d="M12.5 7.5l1 2 2 .5-1.5 1.5.5 2-2-1-2 1 .5-2L9.5 10l2-.5 1-2z"/></svg>')}`;
const ICON_DOCUMENT_20 = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="#0071e3" fill-rule="evenodd" d="M4 3a2 2 0 0 1 2-2h5l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3zm7-1v4a1 1 0 0 0 1 1h4l-5-5zM6.5 10a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7zm0 3a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1h-4z"/><path fill="#f5a623" d="M15 9l1.2 2.4 2.8.4-2 2 .5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-2 2.8-.4L15 9z"/></svg>')}`;

// 聊天对话图标
const ICON_CHAT = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="#3b82f6" d="M5 2a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3v2l2.5-2H9a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5zm0 1.5h4A1.5 1.5 0 0 1 10.5 5v3A1.5 1.5 0 0 1 9 9.5H7l-1.5 1.2V9.5H5A1.5 1.5 0 0 1 3.5 8V5A1.5 1.5 0 0 1 5 3.5z"/><path fill="#93c5fd" d="M11 6v2a3 3 0 0 1-3 3H6.5l-.5.4V12a2 2 0 0 0 2 2h2.5l2 1.5V14h.5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H11z"/></svg>')}`;
const ICON_CHAT_20 = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="#3b82f6" d="M6 3a3 3 0 0 0-3 3v4a3 3 0 0 0 3 3v2.5l3-2.5h2a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6zm0 1.5h5A1.5 1.5 0 0 1 12.5 6v4a1.5 1.5 0 0 1-1.5 1.5H8.5L6.5 13v-1.5H6A1.5 1.5 0 0 1 4.5 10V6A1.5 1.5 0 0 1 6 4.5z"/><path fill="#93c5fd" d="M13 7.5v2.5a3 3 0 0 1-3 3H8l-.5.4V15a2 2 0 0 0 2 2h3l2.5 2V17h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-3z"/></svg>')}`;

const CHAT_SYSTEM_PROMPT = `你是一位专业的学术论文助手。用户正在阅读一篇学术论文，你需要帮助他们理解论文内容、回答问题、解释概念。

规则：
- 回答要准确、简洁、专业
- 如果用户引用了论文中的特定文本，请针对该内容进行解答
- 可以解释专业术语、数学公式、实验方法等
- 如果不确定，请如实说明`;

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

// 记录面板状态
const panelStates = new Map<number, { analyzed: boolean }>();

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
        <hbox id="llmreader-button-container" align="center" pack="center" style="padding: 20px;">
          <button id="llmreader-analyze-btn" style="padding: 8px 32px; font-size: 14px;">Analyze</button>
        </hbox>
        <browser id="llmreader-browser" disableglobalhistory="true" remote="false" type="content" flex="1" hidden="true" style="width: 100%; min-height: 600px;"/>
      </vbox>
    `,
    onItemChange: ({ setEnabled, tabType }) => {
      setEnabled(tabType === "reader");
      return true;
    },
    onRender: ({ body, item, setSectionSummary }) => {
      const container = body.querySelector("#llmreader-container");
      const buttonContainer = body.querySelector("#llmreader-button-container") as HTMLElement;
      const browser = body.querySelector("#llmreader-browser") as XULBrowserElement;
      const btn = body.querySelector("#llmreader-analyze-btn") as HTMLButtonElement;

      if (!container || !buttonContainer || !browser || !btn) return;

      // 检查是否已经解析过
      const state = panelStates.get(item.id);
      if (state?.analyzed && addon.data.panel?.currentHTMLPath) {
        buttonContainer.setAttribute("hidden", "true");
        browser.removeAttribute("hidden");
        browser.setAttribute("src", addon.data.panel.currentHTMLPath);
        setSectionSummary(getString("panel-ready"));
      } else {
        buttonContainer.removeAttribute("hidden");
        browser.setAttribute("hidden", "true");
        setSectionSummary(getString("panel-click-to-analyze"));

        btn.onclick = async () => {
          if (analyzingItemId === item.id) return;
          analyzingItemId = item.id;

          btn.disabled = true;
          btn.textContent = "Analyzing...";
          setSectionSummary(getString("panel-analyzing"));

          try {
            const fileURL = await generateAndLoadHTML(item, browser);
            if (fileURL) {
              panelStates.set(item.id, { analyzed: true });
              buttonContainer.setAttribute("hidden", "true");
              browser.removeAttribute("hidden");
              setSectionSummary(getString("panel-ready"));
            } else {
              btn.disabled = false;
              btn.textContent = "Analyze";
              setSectionSummary(getString("panel-error"));
            }
          } catch (err) {
            ztoolkit.log("analyze error", err);
            btn.disabled = false;
            btn.textContent = "Analyze";
            setSectionSummary(getString("panel-error"));
          } finally {
            analyzingItemId = null;
          }
        };
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
      <vbox id="llmreader-chat-container" style="width: 100%; height: 100%;">
        <hbox align="center" pack="center" style="padding: 20px;">
          <button id="llmreader-chat-btn" style="padding: 8px 32px; font-size: 14px;">Ask AI</button>
        </hbox>
      </vbox>
    `,
    onItemChange: ({ setEnabled, tabType }) => {
      setEnabled(tabType === "reader");
      return true;
    },
    onRender: ({ body, item, setSectionSummary }) => {
      const btn = body.querySelector("#llmreader-chat-btn") as HTMLButtonElement;
      if (!btn) return;

      setSectionSummary(getString("panel-chat-ready"));

      btn.onclick = async () => {
        await openChatDialog(item);
      };
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

  chatStates.set(item.id, {
    itemID: item.id,
    messages: [
      {
        role: "system",
        content: CHAT_SYSTEM_PROMPT + langInstruction + "\n\n论文信息:\n" + contextParts.join("\n"),
      },
    ],
    paperContext: contextParts.join("\n"),
  });
}

async function openChatDialog(item: Zotero.Item) {
  await initChatContext(item);

  // 获取选中的文本作为引用
  const selectedText = getReaderSelectedText();

  // 使用原生 prompt 获取用户输入
  const promptMessage = selectedText
    ? `Selected: "${selectedText.slice(0, 80)}${selectedText.length > 80 ? "..." : ""}"\n\nAsk a question:`
    : "Ask a question about this paper:";

  const userQuestion = Zotero.getMainWindow().prompt(promptMessage, "");

  if (!userQuestion || !userQuestion.trim()) return;

  // 显示加载提示
  const pw = new ztoolkit.ProgressWindow(addon.data.config.addonName);
  pw.createLine({ text: "AI is thinking...", type: "default" }).show();

  try {
    const state = chatStates.get(item.id)!;

    let userContent = userQuestion.trim();
    if (selectedText) {
      userContent = `[引用论文内容]\n"${selectedText}"\n\n[问题]\n${userQuestion.trim()}`;
    }

    state.messages.push({ role: "user", content: userContent });

    const { options } = loadPrefs();
    const response = await chat(state.messages, options);

    state.messages.push({ role: "assistant", content: response.text });

    pw.changeLine({ text: "Done!", type: "success" });
    pw.startCloseTimer(1000);

    // 显示AI回复的弹窗
    showResponseDialog(response.text);

  } catch (err: any) {
    pw.changeLine({ text: `Error: ${err?.message || "Request failed"}`, type: "fail" });
    pw.startCloseTimer(3000);
    ztoolkit.log("chat error", err);
  }
}

function showResponseDialog(text: string) {
  const dialog = new ztoolkit.Dialog(1, 1);

  dialog
    .setDialogData({ text })
    .addCell(0, 0, {
      tag: "div",
      styles: {
        maxWidth: "600px",
        maxHeight: "400px",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        lineHeight: "1.5",
        padding: "10px",
      },
      properties: { textContent: text },
    })
    .addButton("OK", "ok")
    .open("AI Response", { centerscreen: true, resizable: true, width: 650, height: 450 });
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
  browser: XULBrowserElement,
): Promise<string | undefined> {
  const { options, prompts } = loadPrefs();
  const payload = await extractContent(item, "meta");
  const result = await summarize(payload, prompts.rich, options);
  const fileURL = await writeTempHTML(result.text);
  browser.setAttribute("src", fileURL);
  addon.data.panel = {
    currentHTMLPath: fileURL,
    currentItemID: item.id,
  };
  return fileURL;
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
  result = result.replace(/(\${1,2})([^$]+?)(\${1,2})/g, (match, open, content, close) => {
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

async function writeTempHTML(html: string): Promise<string> {
  const tmp = Zotero.getTempDirectory();
  const file = tmp.clone();
  file.append(`${addon.data.config.addonRef}-view.html`);
  if (file.exists()) {
    file.remove(false);
  }
  let processedHTML = preprocessMathHTML(html);
  const hasMathJax =
    /<script[^>]*mathjax/i.test(processedHTML) || /MathJax\s*=/.test(processedHTML);

  // 仅当缺少 MathJax 时才注入，避免重复加载或覆盖已有配置
  if (!hasMathJax) {
    if (processedHTML.includes('</head>')) {
      processedHTML = processedHTML.replace('</head>', MATHJAX_SCRIPT + '</head>');
    } else if (processedHTML.includes('<body')) {
      processedHTML = processedHTML.replace('<body', MATHJAX_SCRIPT + '<body');
    } else {
      // 如果没有标准 HTML 结构，在开头添加
      processedHTML = MATHJAX_SCRIPT + processedHTML;
    }
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
