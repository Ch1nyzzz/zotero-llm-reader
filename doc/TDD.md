# TDD / 方案说明：Zotero LLM Reader

目标：在 Zotero 7 中实现“PDF 分屏 + 富 HTML 展示 + 一键生成纯文本笔记”，支持多 LLM Provider（OpenAI、Gemini、Minimax、Kimi/Moonshot、智谱 GLM、DeepSeek、Qwen、自定义）。

## 需求拆分
1) 富版展示：LLM 返回单文件 HTML（Tailwind+MathJax），写入本地临时文件；在 Reader 自定义面板分屏加载并可刷新。  
2) 纯文本笔记：面板按钮触发二次请求，让 LLM 输出纯文本/Markdown，总结要点，安全写入条目笔记。  
3) 内容来源：选中文献/当前 Reader 的 PDF；可选择全文、仅高亮、仅元数据。  
4) 配置：API Key、Provider、Base URL、模型、超时、最大 tokens、温度、是否流式、上传范围、默认 Prompt（富版/纯文本各一）、日志开关。  
5) Provider 支持：  
   - OpenAI 兼容：`/chat/completions`。  
   - Gemini：REST。  
   - Minimax：`base_url=https://api.minimax.io/v1`，`model=MiniMax-M2(-Stable)`。  
   - Kimi/Moonshot：`base_url=https://api.moonshot.ai/v1`，模型 `kimi-latest`/`kimi-k2-*`。  
   - 智谱 GLM：`https://api.z.ai/api/paas/v4/chat/completions`，`model=glm-4.6`。  
   - DeepSeek：`https://api.deepseek.com/chat/completions`，模型 `deepseek-chat`/`deepseek-reasoner`。  
   - Qwen：`https://dashscope-intl.aliyuncs.com/compatible-mode/v1` 或 `https://dashscope.aliyuncs.com/compatible-mode/v1`，`/chat/completions`，模型 `qwen3-max`/`qwen-plus`/`qwen-flash`。  

## 模块设计
- `src/modules/llmClient.ts`：统一接口 `summarizeRich`, `summarizePlain`, `chat`; Provider 适配器；流式回调；错误分类。  
- `src/modules/extract.ts`：从条目/Reader 获取元数据、PDF 文本、高亮；分块/截断；模式：全文/高亮/元数据。  
- `src/modules/panel.ts`：注册 Reader Tab 面板，加载本地 HTML，提供“刷新富版”“保存为笔记(纯文本)”按钮；支持 reload。  
- `src/modules/prefs.ts`（基于现有 `preferenceScript` 扩展）：偏好项注册与 UI 逻辑，测试连接按钮。  
- `src/modules/note.ts`：将纯文本写入条目子笔记（`parentID` 指向条目），追加/创建。  
- `src/hooks.ts`：清理模板示例，挂载启动/卸载，注册面板、菜单、快捷入口。  

## 数据流（核心用例）
1. 用户选中条目或打开 PDF → 触发“生成富版”  
2. `extractContent` 生成 {meta, textChunks, highlights} → `llmClient.summarizeRich`（使用 `llm_read_prompt.md`）  
3. LLM 返回 HTML 字符串 → 写临时文件 → 面板 reload 展示 → 分屏查看  
4. 用户点击“保存为笔记(纯文本)” → `llmClient.summarizePlain`（安全 prompt） → 返回文本 → `note.save` 写笔记  
5. 错误/超长：提示用户改用“仅高亮/仅元数据”  

## API/接口约定
- `LLMClientOptions`: `{ provider, apiKey, baseURL, model, timeoutMs, maxTokens, temperature, stream }`  
- `summarizeRich({meta, text, highlights}, options, onDelta?) -> Promise<string>`  
- `summarizePlain({meta, text, highlights}, options, onDelta?) -> Promise<string>`  
- `extractContent(item, mode) -> { meta, textChunks?: string[], highlights?: string[] }`  
- `writeTempHtml(html) -> fileURL`  
- `saveNotePlain(item, text) -> noteId`  
- `testConnection(options) -> ok|error`  

## UI 设计
- Reader 面板：上方 toolbar（Provider/模型显示、刷新按钮、保存笔记按钮、状态），主体为 `<browser>`/`iframe` 指向临时 HTML 文件。  
- 状态提示：加载/成功/错误；流式时显示进度。  
- 入口：右键菜单/工具栏按钮触发“生成富版”；面板内按钮触发纯文本保存。  

## 错误与安全
- 错误分类：鉴权失败、超时、限流、内容过大、网络错误、解析错误。  
- 笔记安全：仅写纯文本/Markdown，不写脚本/样式；富版只存本地临时文件。  
- 隐私：API Key 本地存；日志默认不含正文；上传全文需显式提示。  

## 测试要点
- 提取：无高亮/有高亮/大文档截断。  
- Provider：参数拼装正确，Base URL/路径覆盖上述厂商；错误码映射。  
- UI：面板加载、刷新、按钮动作、错误提示。  
- 笔记：创建/追加笔记，HTML 过滤为纯文本。  

## 开发里程碑（执行顺序）
M1：清理模板示例，搭建偏好项，添加 Provider 列表和测试连接。  
M2：实现 `llmClient` 适配器（OpenAI/Gemini + Minimax/Kimi/GLM/DeepSeek/Qwen）。  
M3：实现 `extract`、临时文件写入、面板加载与刷新，右键/工具栏触发。  
M4：实现“保存为笔记(纯文本)”流程与二次 prompt；错误处理与提示。  
M5：联调与自测（`npm run build`），完善文案与双语字符串。  
