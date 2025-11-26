# Zotero LLM Reader 插件 PRD

## 背景与目标
- 在 Zotero 内直接把选中文献或 PDF 交给 LLM（GPT/Gemini/自定义兼容接口），生成总结并可继续问答，减少切换成本。
- 提供统一的多厂商接入层：OpenAI/Gemini + PDF `api.pdf` 中列出的国内外主流兼容接口（Minimax、Kimi/Moonshot、智谱 GLM、DeepSeek、Qwen）。
- 保留可插入 Zotero 笔记的结构化总结与对话记录，便于检索和复用。

## 用户故事
- 我选中一篇论文，点击“LLM 总结”，几秒后得到结构化摘要，并能一键写入该条目笔记。
- 我在 PDF 中选中高亮，提问“这段的核心贡献是什么？”，获得基于高亮上下文的回答。
- 我能在偏好页配置自己的 API Key/模型/代理，并测试连通性和限流。
- 我想保留总结/对话历史，下次打开条目可快速查看或刷新。

## 范围
- Zotero 7 插件；支持主窗口与 Reader 面板。
- 交互：总结、一问一答、流式输出、插入笔记、历史查看/清除。
- 内容：元数据 + PDF 文本/高亮提取，分块/截断控制上下文大小。
- 配置：多 Provider 参数、默认 Prompt、调试日志。
- 不含：账号体系、本地模型部署。

## 功能需求
- Provider 统一接口：`summarize`、`chat`（可流式）。支持 OpenAI 兼容协议 + Gemini 原生 + 下列 API：
  - **Minimax (MiniMax-M2)**：`base_url=https://api.minimax.io/v1`，`model=MiniMax-M2` 或 `MiniMax-M2-Stable`，路径 `/chat/completions`（OpenAI 兼容）。
  - **Kimi / Moonshot**：`base_url=https://api.moonshot.ai/v1`，路径 `/chat/completions`，模型 `kimi-latest`、`kimi-k2-*`（含 `kimi-k2-thinking`）。
  - **智谱 GLM（z.ai）**：HTTP POST `https://api.z.ai/api/paas/v4/chat/completions`，`Authorization: Bearer <API_KEY>`，`model=glm-4.6`。
  - **DeepSeek**：`base_url=https://api.deepseek.com`，路径 `/chat/completions`，模型 `deepseek-chat`、`deepseek-reasoner`。
  - **Qwen（通义千问）**：兼容模式 `base_url=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`（国际）或 `https://dashscope.aliyuncs.com/compatible-mode/v1`（北京），路径 `/chat/completions`，模型 `qwen3-max`、`qwen-plus`、`qwen-flash`。
- 参数支持：API Key、Base URL（可自定义代理）、模型名、超时、最大 tokens、温度、是否流式、是否上传全文/仅元数据/仅高亮。
- 内容提取：元数据（题目/作者/摘要/标签）+ PDF 文本/高亮；过大时提示降级（仅元数据/高亮）。
- UI 入口：
  - 右键/工具栏：对选中条目触发“发送到 LLM 总结”。
  - Item Pane / Reader 自定义面板：展示总结、历史，输入框+发送/取消，Provider/模型下拉。
  - 结果操作：复制、刷新、插入到条目笔记（追加 “LLM Summary” 小节）。
- 流式与状态：支持流式增量渲染；显示加载/错误/取消；并发队列串行化，支持取消。
- 日志与测试：调试日志开关（默认关，日志不含正文，可选仅记录元数据和错误）；偏好页“测试连接”。
- 国际化：至少中/英字符串占位。

## 非功能需求
- 性能：常规总结响应目标 < 8 秒；大文档分块；UI 不阻塞主线程。
- 兼容：Zotero 7；macOS/Windows/Linux。
- 安全与隐私：API Key 仅本地存储；默认不把正文写入日志；上传全文需显式提示。
- 可维护性：模块化（提取/LLM/偏好/UI）；TypeScript 类型完备；错误分类明确（鉴权/超时/限流/内容过大/网络）。

## 关键接口设计（内部）
- `extractContent(item, mode)` -> `{ meta, textChunks?, highlights? }`
- `summarize(payload, options)` -> `summary`（可流式回调）
- `chat(payload, options)` -> `answer`（可流式）
- `saveNote(item, content)` -> `noteId`
- `testConnection(config)` -> `ok | error`

## 配置项（偏好页）
- Provider 选择：OpenAI / Gemini / Minimax / Kimi(Moonshot) / GLM(z.ai) / DeepSeek / Qwen / 自定义。
- API Key、Base URL、模型名、超时、最大 tokens、温度、流式开关。
- 上传范围：全文 / 仅元数据 / 仅高亮。
- 默认总结 Prompt；调试日志开关；“测试连接”按钮。

## 里程碑（建议）
- M1：清理模板、完成偏好页、多 Provider 客户端骨架（含上述 API）。
- M2：PDF/高亮提取、总结/聊天流程、UI 面板和右键入口、流式显示。
- M3：笔记写入、历史缓存、错误与隐私防护、双语文案。
- M4：测试与打包发布（`npm run build`/`release`），编写用户指南。
