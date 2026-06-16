# neo 项目交接说明（截至 1.8.0 · 2026-06-16）

> 给下一个开发会话的上手文档。先读这份，再读 `DESIGN.md`。

## 一、neo 是什么（定位主轴，已与用户确认）
**带护栏的本地自主电脑代理（autonomous local computer agent, office-strong）**：用户给目标 → 自主规划并完成多步任务，必要时操作电脑；**最擅长本地文件与办公**（最可靠的基本盘），信息搜集 / 电脑操作是手段。自带模型（BYOM）、本地优先、可审计。自主与电脑操作能力**默认关、需显式开启 + 护栏**。
（定位写在 `DESIGN.md` 第 1 节；记忆见 `neo-product-direction`。）

## 二、已完成（1.0.0 → 1.8.0，测试 103 → 242 全绿）
- **1.1.0 加固**：网页中文乱码（GBK/GB2312 探测解码）、Bing 国内站搜索 + 中文优先排序 + 缓存重试、真实浏览器 UA、流式空闲超时、流内错误透出、web 工具 SSRF 守护、服务端历史兜底截断、verify 空表判失败、OOXML 转义测试。
- **1.2.0 信息搜集 + 流式**：`read_web_pages` 批量读、`extractMainContent` 主正文提取、`research` 技能、搜索 `site`/`freshness`、`save_research_report` 结构化简报；流式改为逐字平滑 + 打字光标（`createStreamTyper`，setTimeout 驱动以兼容后台）。
- **1.3.0 脚本操控**：`run_automation_script`（applescript/powershell/shell）、`systemControl` 权限、危险脚本黑名单、单次审批、`system-control` 技能。
- **1.4.0 看屏幕**：`screen_capture` + `screenView` 权限 + Electron `captureScreen`（desktopCapturer）+ 视觉注入贯穿 4 条 loop（`extractScreenshotFromResult`/`screenshotUserMessage`/`anthropicScreenshotBlocks`/`dropInjectedScreenshots`）+ `screen-view` 技能。修复了 `toAnthropicContent` 把 Claude 多轮 tool_use/tool_result 降级成文本的真 bug。
- **1.5.0 办公补缺**：`create_pdf_file`（Electron printToPDF）+ `markdownToPdfHtml`、`get_template` 办公模板库、`read_image_file`（OCR/看图，走视觉注入）、`create_word_file` 新增 `markdown` 参数（`markdownToDocxArgs`，md→Word）。
- **1.6.0 本地知识库**：`search_workspace`——跨工作区关键词检索，**能搜进 Excel/Word/PDF/PPT 内容**（旧 `search_files` 是 ripgrep 搜不进），接进「本地文件助手」技能做"先检索→读最相关→带出处回答"。**知识库做厚（同版追加）**：检索排序升级（log 阻尼词频 + 覆盖率打折 + 文件名/标题/短语加权 + 命中片段【】高亮，`searchWorkspace` 内重写，返回增 `matchedTerms`/`nameMatch`/`snippets`）；记忆按工作区隔离（app.js `memoryMatchesWorkspace`/`normalizeWorkspaceKey`，`selectRelevantMemories` 过滤、列表标「其他工作区」）；向量检索仍标"可选/待评估"暂未做。测试 198→202。
- **1.7.0 数据表格智能（新主题，第 1 批）**：`check_table`——对 xlsx/xlsm/csv/tsv 做**逐列数据质量体检**（缺失率、主类型+类型一致率、数值异常值[IQR，含 IQR=0 相对偏离兜底]、日期格式混用、首尾空格、Top 取值）+ 整表（重复行/全空行列），返回结构化报告 + 可保存的 `markdown`。**纯 JS、无 Python/联网**，只读（仅 `fileRead`）。函数在 tools.mjs（`checkTable`/`columnProfile`/`inferCellType`/`parseNumberLike`/`numericOutliersIQR`/`buildQualityFindings`/`qualityReportMarkdown`），接进 `spreadsheet-pro`/`finance-tables` 技能"先体检再清洗"。**表格出图 `chart_from_table`（同版追加）**：纯 JS 生成 SVG 折线/柱/饼图（`buildChartSvg`/`buildCartesianSvg`/`buildPieSvg`），选标签列+数值列（可自动识别），`.svg` 直接写盘、`.png/.jpg` 复用 `exportImage` 栅格化（桌面 Electron 文字完整，非桌面 canvas 兜底会丢字 → 故**默认 SVG**）；权限 `fileWrite`，进成果区/criticalToolNames/fileOutputToolNames。抽了共享 `loadTableRows`/`tableHeaders`。测试 202→223。
- **1.7.1 透视/分组汇总**：`pivot_table`——分组聚合（group_by + values + agg: sum/avg/count/min/max，自动识别数值列、不分组出总计）+ 交叉透视（pivot_column 行×列矩阵），结果默认按汇总值降序、另存 pivots/*.xlsx（或 csv，带 BOM）。函数 `pivotTable`/`aggregateNums`/`resolveColumnList`/`autoNumericColumns`/`finalizePivot`，复用 createExcelWorkbook 落盘。权限 `fileWrite`。测试 223→233。**1.7 三件套齐活**（check_table 体检 / chart_from_table 出图 / pivot_table 透视）→ 下一支柱 1.8.0 自主+护栏。
- **1.8.0 护栏支柱开张（操作日志 + 联网加固）**：护栏注入点是唯一咽喉 `runToolWithReceipt`（tool-integrity.mjs），不动主循环。①**操作日志（本地审计）**：新建 `server/operation-log.mjs`（`operationLogPath` 桌面端=dirname(appStatePath)，否则 工作区/.neo/operation-log.jsonl；`appendOperationLog` JSONL 超 2MB 裁到 1000 条；`readOperationLog` 倒序；`clearOperationLog`；`auditArgsSummary` **白名单字段、只记元数据不记正文**），接进 `runToolWithReceipt` 末尾（含被拒绝/失败的尝试），路由 `/api/operation-log`（GET 取最近 + DELETE 清空）。**前端新增工作台「日志」tab**（index.html `auditPanel` + app.js `loadOperationLog`/`renderOperationLog`/`clearOperationLog`，复用 `formatToolName` 中文标签，✓/✕ 状态 + 耗时 + 产出路径 + 失败原因；styles.css `.audit-*`）。②**SSRF 30x 逐跳校验**：`fetchUrlBuffer` 由 `redirect:"follow"` 改 `redirect:"manual"` + 手动跳转循环（≤5 跳），每跳 `assertFetchAllowed`，非 http(s) 跳转拒绝（补掉第五节技术债）。③**稳定性修复**：工具结果成功判定统一为 `toolResultOk()`（tool-integrity.mjs）——`list_files` 等返回裸数组的工具此前被回执误判为"失败"，导致审计日志/达上限计数把成功记成失败；现裸数组/无 ok 字段且无 error 一律按成功（api.mjs 达上限计数也改用 `receipt.ok`）。`.gitignore` 加 `.neo/`。测试 233→**242**（operation-log 6 例 + web-ssrf 30x 3 例）。前端已在浏览器实测（空态 + 三条样例渲染 + 无 console 错误）。**护栏后续仍归 1.8.x**：1.8.1 全局急停、1.8.2 任务级授权；之后才动 `sse.mjs` 自主主循环（最谨慎、小步走）。

## 三、关键工作约定（务必遵守）
1. **每次代码改动同步版本码 + 更新日志**（记忆 `release-version-sync`）。版本码单一来源 `package.json` **8 处**（version/displayVersion/shortVersionWindows + build.buildVersion/artifactName/mac.bundleShortVersion/mac.bundleVersion/nsis.uninstallDisplayName）；`public/index.html` **2 处**静态兜底（appVersionBadge、aboutVersionLabel）；写 `release-notes/<版本>.md`；"关于"页内嵌 changelog 加当前块、旧版降为历史。
2. **版本走慢、用 patch 小步升**（用户 2026-06-15 明确："版本更新太快，用再后一位"）：**每个功能批次升一位 patch**（如 1.7.0 → 下一批 pivot_table = **1.7.1** → 1.7.2…，同主题内每批也 +1 patch）；**只有上大支柱才升 minor**（自主引擎+护栏 → 1.8.0）；2.0 留给统一编排。主题→版本：1.1 加固 / 1.2 搜集+流式 / 1.3 脚本 / 1.4 看屏幕 / 1.5 办公补缺 / 1.6 知识库 / 1.7 数据表格智能（check_table+chart=1.7.0，pivot 起=1.7.x）。
3. **稳定性优先**（用户多次强调）：改动尽量纯新增、不动现有 agent 主循环；每批 `npm test` 全绿 + 改过的 JS 跑 `node --check` + `npm run smoke:office` + 校验 index.html 的 `<article>`/`<li>` 标签配平。
4. **流程**：先列函数级细则 → 用户确认 → 分批实现 → 测试 → 同步版本/日志。
5. **加一个新工具要"连线"很多处**：`agentTools` 定义 + `handleToolCall` dispatch + `toolPermissionRules` + `skillToolMap` + `serverSkillDefs` + `invoke_skill` 描述 + 前端 `skillLibrary` + 前端权限映射（`defaultToolConsent`/`normalizeToolConsent`/`consentForSkillIds`/`isToolNameAllowedByConsent`/`confirmToolConsent`，涉及新权限位时）+ `toolDescriptions` + 短标签 map + `criticalToolNames`/`fileOutputToolNames`（如涉及）+ 两处 `skillNames` map。前后端 `defaultToolConsent`/`normalizeToolConsent` 都要改。

## 四、架构 / 文件地图
- `server/tools.mjs`（巨大 ~150KB）：所有工具定义、`handleToolCall` 分发、实现、权限闸、技能映射。
- `server/sse.mjs`：流式 agent 循环（OpenAI/Anthropic/Gemini/Mock）、工具执行、视觉注入、命令确认器。
- `server/api.mjs`：非流式调用、内容转换（`toAnthropicContent`/`toGeminiParts`）、`capMessageHistory`、视觉注入助手、`providerSupportsImageInput`。
- `server/routes.mjs`：HTTP 路由、`handleChat`、`/api/health`（版本来自 package.json）。
- `server/tool-integrity.mjs`：`runToolWithReceipt`（审批门控：run_command + run_automation_script）。
- `server/command-approval.mjs`：单次审批代理。
- `server/context.mjs`：`ctx`（配置 + Electron 注入回调：captureScreen/renderPdfFile/renderImageFile…）。
- `electron/main.mjs`：主进程，`startServer({...callbacks})` 注入桌面能力。
- `public/app.js`（巨大 ~330KB）：前端——skillLibrary、权限映射、聊天/流式（createStreamTyper）、命令确认条、设置、版本显示。
- `public/index.html`：UI + 内嵌 changelog + 版本兜底。`public/styles.css`：样式。
- `tests/`：vitest，23 个文件 198 项。

权限位：`fileRead`(默认开)/`fileWrite`/`externalRead`/`externalWrite`/`web`/`desktop`/`command`/`systemControl`/`screenView`。

## 五、已知问题 / 技术债
- ~~**SSRF 守护只校验初始 URL**，`fetchUrlBuffer` 跟随的 30x 跳转目标未校验。~~ 1.8.0 已修（逐跳 `assertFetchAllowed`）。
- **巨型单文件**（tools.mjs / app.js / styles.css）需模块化拆分，越拖越贵。
- **Electron-only 功能**（screen_capture、create_pdf_file）单测用 mock，真实渲染/截屏要 `npm run desktop` 真机验收；视觉功能需图片模型，否则文本回退。
- 长跑的 dev 服务器会缓存启动时的 package.json 版本（徽标显示旧版本直到重启），仅 cosmetic。
- **2026-06-16 package.json 截断事件**：曾发现 `package.json` 被截断（只剩版本+依赖，丢了 `scripts`/`build`/`devDependencies`，疑似打包生成的精简版误覆盖源文件；已确认正常打包流程不会重现）。已用 HEAD + `outputs/desktop/builder-debug.yml` + lockfile 重建并实测（test 242 + mac/win 双包成功）。教训：`build` 段是 native-NSIS-on-mac 打包命脉，**勿丢**——`afterPack: scripts/after-pack.cjs`、`win.signAndEditExecutable: false`、`nsis.warningsAsErrors: false`（否则 Korean 等缺失 LangString 警告被当错误致 win 编译失败）、`package:win`→`scripts/package-win.cjs` 包装器（设 `ELECTRON_BUILDER_NSIS_DIR`）。

## 六、后续路线（按锁定主轴，建议顺序）
- 与用户确认：**A 知识库 / B 数据表格 / C 自主+护栏 三块都要**，按风险从低到高分版本推（A→1.6 / B→1.7 / C→1.8）。
1. ~~**知识库做厚**（1.6.0）：检索排序优化 ✓、工作区记忆隔离 ✓~~ 已完成；剩可选向量检索（embeddings 重排，默认关）待评估。
2. ~~**数据表格智能**（1.7.x）：check_table ✓ / chart_from_table ✓ / pivot_table ✓~~ 三件套已完成（可选后续：多表合并/连接）。
3. **自主引擎 + 护栏**（1.8.x）：**护栏先行**——操作日志 ✓（1.8.0，含前端「日志」tab）/ SSRF 30x 跳转校验 ✓（1.8.0）；剩 **全局急停（→1.8.1）/ 任务级授权（→1.8.2）**，再做 plan→act→观察→自我纠错主循环（动 `sse.mjs`，最谨慎、小步走）。
4. **GUI 操作（Phase C）**：截屏→点击/输入，最不稳、标实验性，**护栏到位后才做**。
5. **2.0**：统一自主编排。
- **已偏离修正**：1.3 脚本 / 1.4 看屏幕 当时偏向纯"电脑操作"；现重心回到"办公更擅长 + 受控自主"，那两块留作辅助、不再加码（除非护栏到位）。

## 七、常用命令 / 状态
- 测试 `npm test`（242 全绿）；办公冒烟 `npm run smoke:office`；语法 `node --check <file>`；真机 `npm run desktop`。打包 `npm run package:mac`（arm64 dmg）/ `npm run package:win`（本机原生 NSIS）→ `outputs/desktop/neo-1.8.0-{mac-arm64.dmg, win-x64.exe, win-x64.zip}`（本地临时签名、无公证）；Intel Mac 用 `npm run package:mac-x64`。**2026-06-16 已重打 mac+win，含「换模型」「遮罩」两修复。** 前端预览：`.claude/launch.json` 配 `neo`（node server.mjs，端口 4321）。
- Git：分支 `main`，user `amaook`；已提交 **`Release neo 1.8.0`**（领先 origin/main 2 个提交：0.9.7 + 1.8.0，**均未 push**）。残留旧副本 `api.mjs`/`main.mjs` 已删；`promo/`、`.claude/` 已入 `.gitignore`（不入库）。
- 记忆文件：`release-version-sync`、`neo-product-direction`（下个会话会自动加载 MEMORY.md 索引）。
