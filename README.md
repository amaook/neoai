# neo

neo 是一个本地运行的类 Codex 智能体原型，支持自由配置国内外 API、切换模型、聊天、文件查看/编辑和本地命令运行。

## 启动

```bash
npm start
```

打开：

```text
http://localhost:4321
```

## API 支持

内置配置包括：

- 本地演示
- DeepSeek
- OpenAI
- 阿里云百炼
- Kimi
- 硅基流动
- Claude
- Gemini
- xAI
- Mistral AI

也可以新增自定义供应商。OpenAI 兼容接口会自动请求：

```text
{Base URL}/chat/completions
```

Anthropic 会请求：

```text
{Base URL}/messages
```

Gemini 会请求：

```text
{Base URL}/models/{model}:generateContent
```

## 使用

1. 在左侧选择供应商。
2. 填写 API Key、Base URL、模型列表后保存。
3. 顶部选择供应商和模型。
4. 输入任务并发送。
5. 打开“本地工具”后，OpenAI 兼容模型可以调用本地文件、Excel 和命令工具。

在“设置 → 供应商库”中可以查看按公开榜单综合参考排序的主流模型供应商，复制 API 地址、打开官方文档/Key 页面，或一键套用供应商配置。

API Key 保存在当前浏览器的 localStorage 中，只适合本地个人使用。

## 本地文件处理

桌面端的“工作台 → 文件”里可以点击“选择文件夹”，把任意本地文件夹设为当前工作区。开启“本地工具”后，模型只能读写这个工作区内的文件。

内置工具包括：

- `list_files`：列出工作区文件
- `read_file`：读取文本文件，Excel 会返回只读预览
- `read_excel_file`：读取真实 `.xlsx` / `.xlsm` 表格
- `write_file`：写入文本文件
- `create_excel_file`：生成真实 `.xlsx` / `.xlsm` 文件
- `clean_table_file`：用 Python 清洗 `.xlsx` / `.xlsm` / `.csv` / `.tsv` 表格并另存新文件
- `clean_table_files`：批量清洗多个表格文件
- `search_files`：搜索文件内容
- `search_web`：搜索网页结果
- `read_web_page`：读取网页正文并可保存为 Markdown
- `download_url`：下载网页文件到工作区
- `open_url`：在默认浏览器打开链接
- `open_workspace_item`：打开或定位工作区文件/文件夹
- `open_desktop_app`：打开本机应用
- `show_desktop_notification`：显示系统通知
- `run_command`：在工作区运行本地命令

## 技能库

设置里的“技能库”可以按需开启内置技能。技能开关会同时影响模型提示词和可见工具，推荐默认开启“本地文件助手”“表格处理”“文档阅读”。“网页助手”“电脑操作”“本地命令”默认关闭，需要时再启用。

## 桌面端

开发模式启动桌面端：

```bash
npm run desktop
```

生成可直接打开的应用目录：

```bash
npm run package:dir
```

生成 macOS `.dmg` 和 `.zip`：

```bash
npm run package:mac
```

输出位置：

```text
outputs/desktop/
```

桌面端会把可写工作区放在：

```text
~/Documents/neo Workspace
```

## 分发给他人

生成 macOS 安装包：

```bash
npm run package:mac
```

把 `outputs/desktop/neo-1.2.0-mac-arm64.dmg` 发给对方即可。对方安装后首次打开会自动进入部署检测：

- 自动检测 Shell、curl、Homebrew、Node.js、npm、Git、ripgrep、Python 表格环境和桌面依赖
- 缺少环境时可点击“一键补齐环境”，neo 会打开终端按顺序安装
- 默认开启本地工具，可在“工作台 → 文件”选择本地文件夹作为工作区
- 支持读取、生成、单文件清洗和批量清洗真实 `.xlsx` / `.csv` 文件

注意：当前构建使用本地临时签名，没有 Apple Developer ID 公证。发给其他 Mac 用户时，首次打开可能需要右键点击 App 选择“打开”，或在系统设置的安全性里允许打开。要做到完全无拦截分发，需要配置 Apple Developer ID 证书和 notarization。

## 环境检测

neo 启动后会自动检测本机环境，并在缺少必要项或推荐项时弹出检测面板。当前检测项包括：

- Shell 环境
- curl
- Homebrew
- Node.js 18+
- npm
- Git
- ripgrep
- Python 3
- Python 表格库 openpyxl
- CSV 编码识别库
- 桌面打包依赖

缺少可自动补充的项目时，界面会显示安装按钮。点击后会在 macOS 终端或 Windows PowerShell 中执行对应安装命令，安装完成后回到 neo 点击“重新检测”。
