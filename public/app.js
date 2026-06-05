const qwenModelPresets = [
  "qwen3.7-max",
  "qwen3.7-max-2026-05-20",
  "qwen3.7-max-preview",
  "qwen3.7-max-2026-05-17",
  "qwen3.7-plus",
  "qwen3.7-plus-2026-05-26",
  "qwen3.6-max-preview",
  "qwen3.6-plus",
  "qwen3.6-plus-2026-04-02",
  "qwen3.6-flash",
  "qwen3.6-flash-2026-04-16",
  "qwen3.6-35b-a3b",
  "qwen3.5-plus",
  "qwen3.5-plus-2026-02-15",
  "qwen3.5-flash",
  "qwen3.5-flash-2026-02-23",
  "qwen3.5-397b-a17b",
  "qwen3.5-122b-a10b",
  "qwen3.5-35b-a3b",
  "qwen3.5-27b",
  "qwen3-max",
  "qwen3-max-2026-01-23",
  "qwen3-max-preview",
  "qwen3-max-2025-09-23",
  "qwen3-next-80b-a3b-thinking",
  "qwen3-next-80b-a3b-instruct",
  "qwen3-235b-a22b-thinking-2507",
  "qwen3-235b-a22b-instruct-2507",
  "qwen3-30b-a3b-thinking-2507",
  "qwen3-30b-a3b-instruct-2507",
  "qwen3-235b-a22b",
  "qwen3-32b",
  "qwen3-30b-a3b",
  "qwen3-14b",
  "qwen3-8b",
  "qwen3-vl-plus",
  "qwen3-vl-flash",
  "qwen-vl-ocr",
  "qwen3-omni-flash",
  "qwen3.5-omni-plus",
  "qwen3.5-omni-flash",
  "qwen3-coder-plus",
  "qwen3-coder-plus-2025-07-22",
  "qwen3-coder-flash",
  "qwen3-coder-flash-2025-07-28",
  "qwen-coder-plus",
  "qwen-coder-turbo",
  "qwen-max",
  "qwen-max-latest",
  "qwen-plus",
  "qwen-plus-latest",
  "qwen-plus-2024-12-20",
  "qwen-flash",
  "qwen-flash-2025-07-28",
  "qwen-turbo",
  "qwen-long",
  "qwen-long-latest",
  "qwen-long-2025-01-25",
  "qwq-plus",
  "qwen-math-plus",
  "qwen-math-plus-latest",
  "qwen-math-turbo",
  "kimi-k2.6",
  "deepseek-v4-pro",
  "deepseek-v4-flash",
  "glm-5.1",
  "MiniMax-M2.5",
  "MiniMax-M2.7",
  "mimo-v2.5-pro"
];

const kimiModelPresets = [
  "kimi-k2.6"
];

const defaultModelRouting = {
  enabled: true,
  textProviderId: "deepseek",
  textModel: "deepseek-v4-flash",
  visionProviderId: "qwen",
  visionModel: "qwen3-vl-plus"
};

const appearancePresetId = "codex-v1";
const defaultAppearance = {
  globalOpacity: 1,
  glassBlur: 20,
  leftColor: "#eef0f4",
  leftOpacity: 0.9,
  centerColor: "#ffffff",
  centerOpacity: 0.98,
  rightColor: "#f7f7f5",
  rightOpacity: 0.9
};
const legacyDefaultAppearance = {
  globalOpacity: 1,
  glassBlur: 30,
  leftColor: "#e3dcd8",
  leftOpacity: 0.76,
  centerColor: "#ffffff",
  centerOpacity: 0.84,
  rightColor: "#ffffff",
  rightOpacity: 0.84
};
const glassOpacityScale = 1;
const glassOpacityMax = 0.98;

const providerPresets = [
  {
    id: "neo-local",
    name: "本地演示",
    protocol: "mock",
    baseUrl: "",
    apiKey: "",
    models: ["neo-mock"]
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://api.deepseek.com",
    apiKey: "",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"]
  },
  {
    id: "openai",
    name: "OpenAI",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    models: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"]
  },
  {
    id: "qwen",
    name: "阿里云百炼",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: "",
    models: qwenModelPresets
  },
  {
    id: "kimi",
    name: "Kimi",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://api.moonshot.ai/v1",
    apiKey: "",
    models: kimiModelPresets
  },
  {
    id: "anthropic",
    name: "Claude",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: "",
    models: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"]
  },
  {
    id: "gemini",
    name: "Gemini",
    protocol: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "",
    models: ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-pro"]
  },
  {
    id: "xai",
    name: "xAI",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://api.x.ai/v1",
    apiKey: "",
    models: ["grok-4.3", "grok-build-0.1"]
  },
  {
    id: "mistral",
    name: "Mistral AI",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://api.mistral.ai/v1",
    apiKey: "",
    models: ["mistral-medium-3-5", "mistral-large-2512", "mistral-small-2603"]
  }
];

const deprecatedBuiltInProviderIds = new Set(["siliconflow"]);

const providerLibrary = [
  {
    rank: 1,
    id: "openai",
    name: "OpenAI",
    family: "GPT / o 系列",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"],
    docsUrl: "https://platform.openai.com/docs/api-reference",
    keyUrl: "https://platform.openai.com/api-keys",
    rankNote: "综合榜单第一梯队，通用、代码和工具生态强。"
  },
  {
    rank: 2,
    id: "anthropic",
    name: "Anthropic Claude",
    family: "Claude Opus / Sonnet / Haiku 系列",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    models: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
    docsUrl: "https://docs.anthropic.com/en/api/overview",
    keyUrl: "https://console.anthropic.com/settings/keys",
    rankNote: "综合榜单第一梯队，长文、代码审查和稳健输出表现好。"
  },
  {
    rank: 3,
    id: "gemini",
    name: "Google Gemini",
    family: "Gemini 系列",
    protocol: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-pro"],
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    keyUrl: "https://aistudio.google.com/apikey",
    rankNote: "综合榜单第一梯队，长上下文和多模态能力突出。"
  },
  {
    rank: 4,
    id: "deepseek",
    name: "DeepSeek",
    family: "DeepSeek V4 系列",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
    docsUrl: "https://api-docs.deepseek.com/",
    keyUrl: "https://platform.deepseek.com/api_keys",
    rankNote: "性价比和中文/代码能力强，支持 OpenAI 兼容工具调用。"
  },
  {
    rank: 5,
    id: "qwen",
    name: "阿里云百炼 / Qwen",
    family: "通义千问 Qwen3 系列",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: qwenModelPresets,
    docsUrl: "https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope",
    keyUrl: "https://bailian.console.aliyun.com/",
    rankNote: "国产第一梯队，中文、代码和企业云集成方便。"
  },
  {
    rank: 6,
    id: "kimi",
    name: "Moonshot Kimi",
    family: "Kimi K2.6 系列",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://api.moonshot.ai/v1",
    models: kimiModelPresets,
    docsUrl: "https://platform.kimi.ai/docs",
    keyUrl: "https://platform.kimi.ai/",
    rankNote: "长上下文和中文任务常用，OpenAI 兼容迁移成本低。"
  },
  {
    rank: 7,
    id: "xai",
    name: "xAI Grok",
    family: "Grok 系列",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://api.x.ai/v1",
    models: ["grok-4.3", "grok-build-0.1"],
    docsUrl: "https://docs.x.ai/docs",
    keyUrl: "https://console.x.ai/",
    rankNote: "公开榜单靠前，推理模型和 OpenAI 兼容接口完善。"
  },
  {
    rank: 8,
    id: "mistral",
    name: "Mistral AI",
    family: "Mistral Medium / Large / Small 系列",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://api.mistral.ai/v1",
    models: ["mistral-medium-3-5", "mistral-large-2512", "mistral-small-2603"],
    docsUrl: "https://docs.mistral.ai/api/",
    keyUrl: "https://console.mistral.ai/api-keys",
    rankNote: "欧洲主流供应商，开放模型和企业部署生态较强。"
  }
];

const rolePrompts = {
  coder:
    "你运行在 neo 桌面应用中，是面向本地开发的助手。你像一个懂技术的朋友一样说话：先听懂用户要什么，再直接给能做的下一步。需要改代码时，先理解现有结构，保持改动聚焦。",
  analyst:
    "你运行在 neo 桌面应用中，是数据分析助手。你擅长处理 Excel、CSV 和业务数据，先把关键结论说清楚，再补充字段含义、异常值、趋势和口径差异。",
  finance:
    "你运行在 neo 桌面应用中，是财务与账单助手。你擅长对账、工资表、报价单、平台账单和金额校验。处理数字时严谨，但表达要像在认真帮用户核账，不要像写审计报告。",
  product:
    "你运行在 neo 桌面应用中，是产品助手。你擅长把模糊想法拆成需求、流程、优先级和可落地版本。先给判断，再把关键取舍讲明白。",
  operations:
    "你运行在 neo 桌面应用中，是运营助手。你擅长活动方案、内容规划、表格整理、用户沟通和执行清单。回答要可直接拿去用，但普通聊天不要摆成方案稿。",
  support:
    "你运行在 neo 桌面应用中，是客服助手。你擅长售前售后话术、FAQ、投诉安抚和问题排查。语气专业、耐心，先安抚和解决问题，再给下一步动作。",
  reviewer:
    "你运行在 neo 桌面应用中，负责代码审查。优先指出 bug、回归风险、安全问题和缺失测试。先说最重要的问题，再给建议。",
  planner:
    "你运行在 neo 桌面应用中，负责任务规划。把模糊目标拆成可以执行的步骤，说明关键取舍。计划要清楚，但不要把每句话都写成模板。",
  writer:
    "你运行在 neo 桌面应用中，负责写作。根据目标受众调整语气，输出自然、清楚、可直接使用的内容。"
};

const responseStylePrompts = {
  direct: "回复风格：简洁直接。像当面聊天一样先回答用户的问题，少铺垫，别写成汇报。",
  teacher: "回复风格：耐心教学。适合新手，步骤清楚，解释关键概念，但语气要自然。",
  rigorous: "回复风格：严谨审查。主动检查边界条件、风险、遗漏和反例，但先把结论说成人话。",
  creative: "回复风格：创意脑暴。可以发散，多给可选方案，但先说最推荐的方向。",
  warm: "回复风格：温柔陪伴。语气轻柔、有耐心，先接住用户情绪，再给清晰可做的下一步。",
  business: "回复风格：商务正式。表达克制、专业，适合对外邮件、方案、合同沟通和正式汇报。"
};

const naturalConversationPrompt = [
  "表达方式：像一个真实的人在和用户说话。",
  "普通聊天默认用短句和自然段，不要写成报告、复盘、自我评估或能力清单。",
  "除非用户明确要大纲、文档、代码、表格或执行清单，否则不要用 Markdown 标题、复杂编号或双星号加粗标记。",
  "如果用户只是闲聊、吐槽或问一句话，直接自然回应，不要套模板。"
].join("\n");

const legacyRolePromptTemplates = {
  coder: "你运行在 neo 桌面应用中，是面向本地开发的智能体。你回答简洁、先判断风险，再给出可执行步骤。需要改代码时，优先理解现有结构，保持改动聚焦。",
  analyst: "你运行在 neo 桌面应用中，是数据分析师。你擅长处理 Excel、CSV 和业务数据，优先识别字段含义、异常值、趋势、口径差异，并给出可复核的结论。",
  finance: "你运行在 neo 桌面应用中，是财务与账单助手。你擅长对账、工资表、报价单、平台账单和金额校验，处理数字时要严谨，主动提示可能的口径和风险。",
  product: "你运行在 neo 桌面应用中，是产品经理。你擅长把模糊想法拆成需求、流程、优先级和可落地版本，输出结构清晰，关注用户体验和实施成本。",
  operations: "你运行在 neo 桌面应用中，是运营助手。你擅长活动方案、内容规划、表格整理、用户沟通和执行清单，输出要可直接拿去执行。",
  support: "你运行在 neo 桌面应用中，是客服助手。你擅长售前售后话术、FAQ、投诉安抚和问题排查，语气专业、耐心，并尽量给用户下一步动作。",
  reviewer: "你运行在 neo 桌面应用中，负责代码审查。优先指出 bug、回归风险、安全问题和缺失测试。先给结论，再给建议。",
  planner: "你运行在 neo 桌面应用中，负责任务规划。把模糊目标拆成可以执行的步骤，说明关键取舍，并保持输出简洁。",
  writer: "你运行在 neo 桌面应用中，负责写作。根据目标受众调整语气，输出结构清晰、自然、可直接使用的内容。"
};

const legacyResponseStylePromptTemplates = {
  direct: "回复风格：简洁直接。少铺垫，先给结论和可执行结果，必要时再补充关键原因。",
  teacher: "回复风格：耐心教学。适合新手，步骤清楚，解释关键概念，但避免啰嗦。",
  rigorous: "回复风格：严谨审查。主动检查边界条件、风险、遗漏和反例，明确区分事实、推测和建议。",
  creative: "回复风格：创意脑暴。多给可选方案，允许发散，但要把最推荐方案放在前面。",
  warm: "回复风格：温柔陪伴。语气轻柔、有耐心，先接住用户情绪，再给清晰可做的下一步。",
  business: "回复风格：商务正式。表达克制、专业，适合对外邮件、方案、合同沟通和正式汇报。"
};

const legacyRolePrompts = new Set([
  "你是 neo，本地开发智能体。你回答简洁、先判断风险，再给出可执行步骤。需要改代码时，优先理解现有结构，保持改动聚焦。",
  "你是 neo，代码审查智能体。优先指出 bug、回归风险、安全问题和缺失测试。先给结论，再给建议。",
  "你是 neo，任务规划智能体。把模糊目标拆成可以执行的步骤，说明关键取舍，并保持输出简洁。",
  "你是 neo，写作智能体。根据目标受众调整语气，输出结构清晰、自然、可直接使用的内容。"
]);

const thinkingOptions = {
  fast: { label: "快速", prompt: "优先快速响应，先给可执行结论，避免不必要的长推理。", temperature: 0.4 },
  balanced: { label: "平衡", prompt: "在速度和质量之间保持平衡，必要时简要说明判断依据。", temperature: null },
  deep: { label: "深度", prompt: "更仔细地分析问题，主动检查边界条件、风险和替代方案。", temperature: 0.7 }
};

const taskTemplates = [
  {
    id: "folder-summary",
    icon: "▤",
    label: "总结文件夹",
    prompt: "请扫描当前工作区，列出主要文件和文件夹，并总结它们分别用来做什么。需要时请调用 list_files 和 read_file。",
    tools: true,
    skills: ["local-files"]
  },
  {
    id: "excel-check",
    icon: "▦",
    label: "检查表格",
    prompt: "请检查我刚上传或当前选中的 Excel/CSV 表格，说明字段含义、异常数据、公式/金额可能的问题，并给出修正建议。需要时请先调用 inspect_office_file 或 read_excel_file。",
    tools: true,
    skills: ["spreadsheet-pro"]
  },
  {
    id: "table-clean",
    icon: "◇",
    label: "清洗表格",
    prompt: "请清洗我刚上传或当前选中的表格文件，默认删除空行空列、裁剪文本空格、去除重复行，并另存为新的 .xlsx 文件。需要时请调用 clean_table_file，不要覆盖原文件。",
    tools: true,
    skills: ["spreadsheet-pro"]
  },
  {
    id: "batch-table-clean",
    icon: "≡",
    label: "批量洗表",
    prompt: "请列出当前工作区里的 Excel/CSV 表格，选择需要清洗的文件后批量清洗：默认删除空行空列、裁剪文本空格、去重，并输出到 cleaned 文件夹。需要时请调用 clean_table_files。",
    tools: true,
    skills: ["spreadsheet-pro", "local-files"]
  },
  {
    id: "excel-create",
    icon: "＋",
    label: "生成 Excel",
    prompt: "请根据我的需求生成一个真实的 .xlsx 文件，包含清晰表头、合适的工作表名称和示例数据。生成时请调用 create_excel_file。",
    tools: true,
    skills: ["spreadsheet-pro"]
  },
  {
    id: "image-export",
    icon: "▧",
    label: "导出图片",
    prompt: "请根据我的需求生成 HTML 或 SVG 视觉稿，并调用 export_image 导出为真实 PNG/JPG 图片文件保存到工作区。不要让我手动截图。",
    tools: true,
    skills: ["local-files"]
  },
  {
    id: "batch-rename",
    icon: "↻",
    label: "批量整理",
    prompt: "请查看当前工作区文件，给出批量重命名或整理方案。执行任何改名、覆盖或删除前，先把计划列出来等我确认。",
    tools: true,
    skills: ["local-files"]
  },
  {
    id: "pdf-extract",
    icon: "□",
    label: "提取文档",
    prompt: "请读取我上传的 PDF、Word 或 PPT 文档，提取关键信息、表格线索和待办事项，并整理成清晰摘要。需要时请调用 inspect_office_file。",
    tools: true,
    skills: ["document-reader"]
  },
  {
    id: "quote-sheet",
    icon: "¥",
    label: "报价单",
    prompt: "请帮我生成一份报价单 Excel，字段包含品名、规格、数量、单价、金额、备注，并自动计算合计。生成时请调用 create_excel_file。",
    tools: true,
    skills: ["spreadsheet-pro", "finance-tables"]
  }
];

const skillLibrary = [
  {
    id: "local-files",
    icon: "▤",
    name: "本地文件助手",
    category: "文件",
    recommendation: "推荐 5.0",
    defaultEnabled: true,
    tools: ["list_files", "read_file", "write_file", "export_image", "search_files", "verify_office_file"],
    summary: "读取、搜索、写入工作区文件，适合整理项目、生成文档和查找内容。",
    prompt: "技能：本地文件助手。优先使用工作区相对路径；写入文件前确认路径清晰；用户要海报、封面、卡片、图片版结果时，先生成 HTML/SVG，再调用 export_image 导出真实 PNG/JPG；不要删除或覆盖用户未明确要求修改的文件。"
  },
  {
    id: "spreadsheet-pro",
    icon: "▦",
    name: "表格处理",
    category: "Excel / CSV",
    recommendation: "推荐 5.0",
    defaultEnabled: true,
    tools: ["inspect_office_file", "read_excel_file", "create_excel_file", "clean_table_file", "clean_table_files", "verify_office_file"],
    summary: "读取、生成、清洗 Excel/CSV，支持去空行、去重、金额日期规范化和批量洗表。",
    prompt: "技能：表格处理。遇到 Excel/CSV 时先读取结构和字段，再处理；清洗表格默认另存新文件；批量任务优先使用 clean_table_files。"
  },
  {
    id: "document-reader",
    icon: "□",
    name: "文档阅读",
    category: "PDF / Word",
    recommendation: "推荐 4.8",
    defaultEnabled: true,
    tools: ["inspect_office_file", "read_file", "create_word_file", "create_ppt_file", "verify_office_file"],
    summary: "解析 PDF、Word、PPT 和文本文件，提取摘要、待办、表格线索，也能生成基础 Word/PPT。",
    prompt: "技能：文档阅读。读取 Word/PDF/PPT 时先调用 inspect_office_file；生成 Word 用 create_word_file，生成 PPT 用 create_ppt_file；完成后以校验结果为准。"
  },
  {
    id: "finance-tables",
    icon: "¥",
    name: "财务表格",
    category: "财务",
    recommendation: "推荐 4.8",
    defaultEnabled: false,
    tools: ["inspect_office_file", "read_excel_file", "create_excel_file", "clean_table_file", "clean_table_files", "verify_office_file"],
    summary: "适合工资表、报价单、账单、对账和金额校验。",
    prompt: "技能：财务表格。处理金额、税费、合计和对账时必须严谨，主动说明口径、异常值和复核建议。"
  },
  {
    id: "code-review",
    icon: "⌘",
    name: "代码审查",
    category: "开发",
    recommendation: "推荐 4.7",
    defaultEnabled: false,
    tools: ["list_files", "read_file", "search_files"],
    summary: "阅读代码、定位风险、检查回归和缺失测试。",
    prompt: "技能：代码审查。先列问题和风险，再给改法；重点关注 bug、安全、回归和测试缺口。"
  },
  {
    id: "web-browser",
    icon: "◎",
    name: "网页助手",
    category: "网页",
    recommendation: "推荐 4.6",
    defaultEnabled: false,
    tools: ["search_web", "read_web_page", "download_url", "open_url"],
    summary: "搜索网页、读取网页正文、下载网页文件，并在默认浏览器打开链接。",
    prompt: "技能：网页助手。需要最新网页信息时先搜索或读取网页；引用网页内容时说明来源 URL；下载文件默认保存到工作区 Downloads。"
  },
  {
    id: "desktop-control",
    icon: "⌂",
    name: "电脑操作",
    category: "桌面",
    recommendation: "谨慎开启",
    defaultEnabled: false,
    tools: ["open_url", "open_desktop_app", "open_workspace_item", "show_desktop_notification"],
    summary: "打开网页、应用、本地文件/文件夹，并显示系统通知；暂不自动点击软件界面。",
    prompt: "技能：电脑操作。可以打开应用、网页和本地文件，但不能声称已经点击或操作软件内部界面；涉及发送、删除、购买、安装、权限修改等高风险动作必须先让用户确认。"
  },
  {
    id: "local-command",
    icon: "›",
    name: "本地命令",
    category: "高级",
    recommendation: "谨慎开启",
    defaultEnabled: false,
    tools: ["run_command"],
    summary: "允许模型在工作区运行命令，适合测试、构建和自动化，风险更高。",
    prompt: "技能：本地命令。运行命令前说明目的；涉及删除、覆盖、安装、联网、权限提升时必须先征求确认。"
  }
];

const defaultToolConsent = Object.freeze({
  fileRead: true,
  fileWrite: false,
  externalRead: false,
  externalWrite: false,
  externalPaths: [],
  web: false,
  desktop: false,
  command: false
});

const readToolNames = new Set(["list_files", "read_file", "inspect_office_file", "read_excel_file", "verify_office_file", "search_files"]);
const writeToolNames = new Set(["write_file", "export_image", "create_excel_file", "create_word_file", "create_ppt_file", "clean_table_file", "clean_table_files", "download_url"]);
const webToolNames = new Set(["search_web", "read_web_page", "download_url"]);
const desktopToolNames = new Set(["open_url", "open_workspace_item", "open_desktop_app", "show_desktop_notification"]);

const toolDescriptions = {
  list_files: "list_files(path)：列出目录内容",
  read_file: "read_file(path)：读取工作区文件或已授权外部路径，支持文本、PDF、Word 预览和部分结构化文件",
  inspect_office_file: "inspect_office_file(path)：检查 Excel/CSV/Word/PDF/PPT，返回解析状态、行列/页数、质量检查和任务步骤",
  read_excel_file: "read_excel_file(path)：读取工作区内或已授权外部路径的真实 .xlsx/.xlsm/.csv/.tsv 表格内容",
  write_file: "write_file(path, content)：写入或创建文本文件（.json、.md、.py、.html、.csv 等）",
  export_image: "export_image(input_path/html/svg, output_path, width, height, format)：把 HTML/SVG 渲染成真实 PNG/JPG 图片文件",
  create_excel_file: "create_excel_file(path, sheet_name, columns, rows, sheets)：生成真实 .xlsx/.xlsm 文件",
  create_word_file: "create_word_file(path, title, paragraphs, sections, tables)：生成真实 .docx Word 文件并回读校验",
  create_ppt_file: "create_ppt_file(path, title, subtitle, slides, sections)：生成真实 .pptx PPT 文件并回读校验",
  clean_table_file: "clean_table_file(path, output_path, sheet, operations, options)：用 Python 清洗 .xlsx/.xlsm/.csv/.tsv 表格，默认另存新 .xlsx，不覆盖原文件",
  clean_table_files: "clean_table_files(paths, output_dir, operations, options)：批量清洗多个表格文件，并为每个文件另存清洗结果",
  verify_office_file: "verify_office_file(path)：按文件类型回读校验 Excel/CSV/Word/PDF/PPT 输出文件",
  search_files: "search_files(query, glob)：搜索文件内容",
  search_web: "search_web(query, limit)：搜索网页并返回标题、链接和简要结果",
  read_web_page: "read_web_page(url, output_path, max_chars)：读取网页正文和链接，可保存为工作区 Markdown",
  download_url: "download_url(url, output_path)：把网页文件下载到本地工作区",
  open_url: "open_url(url)：在默认浏览器打开网页",
  open_workspace_item: "open_workspace_item(path, reveal)：打开或定位工作区里的文件/文件夹",
  open_desktop_app: "open_desktop_app(app)：打开本机应用，但不自动点击软件内部界面",
  show_desktop_notification: "show_desktop_notification(title, message)：显示系统通知",
  run_command: "run_command(command)：执行本地 shell 命令"
};

const memoryTypes = {
  preference: { label: "用户偏好", prompt: "用户长期偏好、称呼、语气、默认工作方式" },
  project: { label: "项目规则", prompt: "当前项目或工作区的规则、历史决策、版本约定" },
  file: { label: "文件线索", prompt: "文件位置、字段含义、处理记录或重要文件说明" },
  tool: { label: "工具经验", prompt: "遇到某类任务时应使用的工具、流程或注意事项" },
  conversation: { label: "对话摘要", prompt: "较长对话压缩后的目标、结论和待办" },
  fact: { label: "事实背景", prompt: "稳定背景信息、业务信息或用户确认过的事实" }
};

const memoryScopes = {
  global: "全局",
  workspace: "当前工作区",
  conversation: "当前对话"
};

const memoryStatuses = {
  active: "已启用",
  pending: "待确认",
  archived: "已忽略"
};

const memoryInjectionLimit = 12;
const memoryContentLimit = 1200;

const storageKey = "neo-ai-state-v2";
const legacyStorageKey = "neo-ai-state-v1";
const onboardingStorageKey = "neo-ai-onboarding-complete-v1";
const environmentPromptMutedStorageKey = "neo-environment-prompt-muted-v1";
const agentProfileChannelName = "neo-agent-profile-v1";
const defaultAgentAvatar = "/assets/logo.png";
const chatRequestTimeoutMs = 70000;
const apiTestTimeoutMs = 35000;
let agentProfileChannel = null;

const els = {
  appShell: document.querySelector(".app-shell"),
  sidebar: document.querySelector("#sidebar"),
  sidebarToggleBtn: document.querySelector("#sidebarToggleBtn"),
  leftResizeHandle: document.querySelector("#leftResizeHandle"),
  rightResizeHandle: document.querySelector("#rightResizeHandle"),
  workspaceToggleBtn: document.querySelector("#workspaceToggleBtn"),
  collapseWorkspaceBtn: document.querySelector("#collapseWorkspaceBtn"),
  workspacePanel: document.querySelector("#workspacePanel"),
  workspacePanelStatus: document.querySelector("#workspacePanelStatus"),
  workspaceStatusVersion: document.querySelector("#workspaceStatusVersion"),
  ambientMotionCanvas: document.querySelector("#ambientMotionCanvas"),
  workspaceTabs: document.querySelectorAll("[data-panel-tab]"),
  workspaceSections: document.querySelectorAll("[data-panel-section]"),
  templateStrip: document.querySelector("#templateStrip"),
  templateButtons: document.querySelector("#templateButtons"),
  taskRunTitle: document.querySelector("#taskRunTitle"),
  taskRunDetail: document.querySelector("#taskRunDetail"),
  taskEventList: document.querySelector("#taskEventList"),
  clearTaskEventsBtn: document.querySelector("#clearTaskEventsBtn"),
  retryTaskBtn: document.querySelector("#retryTaskBtn"),
  taskMetrics: document.querySelector("#taskMetrics"),
  toolSteps: document.querySelector("#toolSteps"),
  artifactList: document.querySelector("#artifactList"),
  clearArtifactsBtn: document.querySelector("#clearArtifactsBtn"),
  selectWorkspaceBtn: document.querySelector("#selectWorkspaceBtn"),
  fileRootBtn: document.querySelector("#fileRootBtn"),
  filePathLabel: document.querySelector("#filePathLabel"),
  fileTree: document.querySelector("#fileTree"),
  fileEditorTitle: document.querySelector("#fileEditorTitle"),
  fileEditorInput: document.querySelector("#fileEditorInput"),
  saveFileBtn: document.querySelector("#saveFileBtn"),
  fileFeedback: document.querySelector("#fileFeedback"),
  terminalForm: document.querySelector("#terminalForm"),
  terminalInput: document.querySelector("#terminalInput"),
  terminalOutput: document.querySelector("#terminalOutput"),
  historyPane: document.querySelector(".history-pane"),
  conversationList: document.querySelector("#conversationList"),
  toggleHistoryBtn: document.querySelector("#toggleHistoryBtn"),
  newChatBtn: document.querySelector("#newChatBtn"),
  settingsToggleBtn: document.querySelector("#settingsToggleBtn"),
  settingsSheet: document.querySelector("#settingsSheet"),
  settingsBackdrop: document.querySelector("#settingsBackdrop"),
  settingsReturnBtn: document.querySelector("#settingsReturnBtn"),
  closeSettingsBtn: document.querySelector("#closeSettingsBtn"),
  checkUpdatesBtn: document.querySelector("#checkUpdatesBtn"),
  updateFeedback: document.querySelector("#updateFeedback"),
  updateProgressPanel: document.querySelector("#updateProgressPanel"),
  updateProgressPercent: document.querySelector("#updateProgressPercent"),
  updateProgressTrack: document.querySelector(".update-progress-track"),
  updateProgressFill: document.querySelector("#updateProgressFill"),
  aboutVersionLabel: document.querySelector("#aboutVersionLabel"),
  healthText: document.querySelector("#healthText"),
  appVersionBadge: document.querySelector("#appVersionBadge"),
  messageList: document.querySelector("#messageList"),
  heroBlock: document.querySelector("#heroBlock"),
  chatForm: document.querySelector("#chatForm"),
  quoteBar: document.querySelector("#quoteBar"),
  promptInput: document.querySelector("#promptInput"),
  sendBtn: document.querySelector("#sendBtn"),
  sendStatusToast: document.querySelector("#sendStatusToast"),
  sendStatusIcon: document.querySelector("#sendStatusIcon"),
  sendStatus: document.querySelector("#sendStatus"),
  sendStatusDetail: document.querySelector("#sendStatusDetail"),
  inlineSendStatus: document.querySelector("#inlineSendStatus"),
  dismissStatusBtn: document.querySelector("#dismissStatusBtn"),
  activeProviderButton: document.querySelector("#activeProviderButton"),
  activeModelButton: document.querySelector("#activeModelButton"),
  thinkingButton: document.querySelector("#thinkingButton"),
  activeProviderName: document.querySelector("#activeProviderName"),
  activeModelName: document.querySelector("#activeModelName"),
  activeThinkingName: document.querySelector("#activeThinkingName"),
  modelSettingsActiveProviderName: document.querySelector("#modelSettingsActiveProviderName"),
  modelSettingsActiveModelName: document.querySelector("#modelSettingsActiveModelName"),
  modelSettingsRouteState: document.querySelector("#modelSettingsRouteState"),
  modelSettingsRouteSummary: document.querySelector("#modelSettingsRouteSummary"),
  modelSettingsKeyState: document.querySelector("#modelSettingsKeyState"),
  modelSettingsEndpoint: document.querySelector("#modelSettingsEndpoint"),
  modelPopover: document.querySelector("#modelPopover"),
  providerPickerPane: document.querySelector("#providerPickerPane"),
  modelPickerPane: document.querySelector("#modelPickerPane"),
  providerPickerList: document.querySelector("#providerPickerList"),
  modelPickerList: document.querySelector("#modelPickerList"),
  pickerBackBtn: document.querySelector("#pickerBackBtn"),
  pickerBackLabel: document.querySelector("#pickerBackLabel"),
  thinkingSelect: document.querySelector("#thinkingSelect"),
  modelOverview: document.querySelector("#modelOverview"),
  providerLibraryList: document.querySelector("#providerLibraryList"),
  providerLibraryFeedback: document.querySelector("#providerLibraryFeedback"),
  skillLibraryList: document.querySelector("#skillLibraryList"),
  skillLibraryFeedback: document.querySelector("#skillLibraryFeedback"),
  enableRecommendedSkillsBtn: document.querySelector("#enableRecommendedSkillsBtn"),
  providerList: document.querySelector("#providerList"),
  addProviderBtn: document.querySelector("#addProviderBtn"),
  saveSettingsBtn: document.querySelector("#saveSettingsBtn"),
  saveFeedback: document.querySelector("#saveFeedback"),
  providerNameInput: document.querySelector("#providerNameInput"),
  protocolSelect: document.querySelector("#protocolSelect"),
  apiModeSelect: document.querySelector("#apiModeSelect"),
  baseUrlInput: document.querySelector("#baseUrlInput"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  modelsInput: document.querySelector("#modelsInput"),
  activeProviderSelect: document.querySelector("#activeProviderSelect"),
  activeModelSelect: document.querySelector("#activeModelSelect"),
  customModelInput: document.querySelector("#customModelInput"),
  autoModelRoutingSelect: document.querySelector("#autoModelRoutingSelect"),
  textRouteProviderSelect: document.querySelector("#textRouteProviderSelect"),
  textRouteModelSelect: document.querySelector("#textRouteModelSelect"),
  visionRouteProviderSelect: document.querySelector("#visionRouteProviderSelect"),
  visionRouteModelSelect: document.querySelector("#visionRouteModelSelect"),
  autoRouteHint: document.querySelector("#autoRouteHint"),
  appearanceGlobalOpacity: document.querySelector("#appearanceGlobalOpacity"),
  appearanceGlobalOpacityValue: document.querySelector("#appearanceGlobalOpacityValue"),
  appearanceBlur: document.querySelector("#appearanceBlur"),
  appearanceBlurValue: document.querySelector("#appearanceBlurValue"),
  appearanceLeftColor: document.querySelector("#appearanceLeftColor"),
  appearanceLeftColorValue: document.querySelector("#appearanceLeftColorValue"),
  appearanceLeftOpacity: document.querySelector("#appearanceLeftOpacity"),
  appearanceLeftOpacityValue: document.querySelector("#appearanceLeftOpacityValue"),
  appearanceCenterColor: document.querySelector("#appearanceCenterColor"),
  appearanceCenterColorValue: document.querySelector("#appearanceCenterColorValue"),
  appearanceCenterOpacity: document.querySelector("#appearanceCenterOpacity"),
  appearanceCenterOpacityValue: document.querySelector("#appearanceCenterOpacityValue"),
  appearanceRightColor: document.querySelector("#appearanceRightColor"),
  appearanceRightColorValue: document.querySelector("#appearanceRightColorValue"),
  appearanceRightOpacity: document.querySelector("#appearanceRightOpacity"),
  appearanceRightOpacityValue: document.querySelector("#appearanceRightOpacityValue"),
  resetAppearanceBtn: document.querySelector("#resetAppearanceBtn"),
  testApiBtn: document.querySelector("#testApiBtn"),
  apiTestOutput: document.querySelector("#apiTestOutput"),
  saveAgentProfileBtn: document.querySelector("#saveAgentProfileBtn"),
  agentProfileFeedback: document.querySelector("#agentProfileFeedback"),
  memoryInput: document.querySelector("#memoryInput"),
  memoryTypeInput: document.querySelector("#memoryTypeInput"),
  memoryScopeInput: document.querySelector("#memoryScopeInput"),
  memoryTagsInput: document.querySelector("#memoryTagsInput"),
  memorySearchInput: document.querySelector("#memorySearchInput"),
  addMemoryBtn: document.querySelector("#addMemoryBtn"),
  candidateMemoryList: document.querySelector("#candidateMemoryList"),
  memoryList: document.querySelector("#memoryList"),
  memoryStats: document.querySelector("#memoryStats"),
  memoryFeedback: document.querySelector("#memoryFeedback"),
  roleSelect: document.querySelector("#roleSelect"),
  responseStyleSelect: document.querySelector("#responseStyleSelect"),
  systemPromptInput: document.querySelector("#systemPromptInput"),
  toolSettingsFeedback: document.querySelector("#toolSettingsFeedback"),
  temperatureInput: document.querySelector("#temperatureInput"),
  maxTokensInput: document.querySelector("#maxTokensInput"),
  agentToolsToggle: document.querySelector("#agentToolsToggle"),
  externalReadToggle: document.querySelector("#externalReadToggle"),
  externalPathsInput: document.querySelector("#externalPathsInput"),
  selectExternalPathsBtn: document.querySelector("#selectExternalPathsBtn"),
  environmentBtn: document.querySelector("#environmentBtn"),
  environmentModal: document.querySelector("#environmentModal"),
  closeEnvironmentBtn: document.querySelector("#closeEnvironmentBtn"),
  environmentNoPromptCheck: document.querySelector("#environmentNoPromptCheck"),
  installMissingEnvironmentBtn: document.querySelector("#installMissingEnvironmentBtn"),
  copyEnvironmentCommandBtn: document.querySelector("#copyEnvironmentCommandBtn"),
  recheckEnvironmentBtn: document.querySelector("#recheckEnvironmentBtn"),
  environmentSummary: document.querySelector("#environmentSummary"),
  environmentList: document.querySelector("#environmentList"),
  environmentOutput: document.querySelector("#environmentOutput"),
  environmentModalSummary: document.querySelector("#environmentModalSummary"),
  environmentModalList: document.querySelector("#environmentModalList"),
  environmentModalOutput: document.querySelector("#environmentModalOutput"),
  modalInstallMissingEnvironmentBtn: document.querySelector("#modalInstallMissingEnvironmentBtn"),
  modalCopyEnvironmentCommandBtn: document.querySelector("#modalCopyEnvironmentCommandBtn"),
  modalRecheckEnvironmentBtn: document.querySelector("#modalRecheckEnvironmentBtn"),
  // 定时任务
  scheduleEntryBtn: document.querySelector("#scheduleEntryBtn"),
  scheduleSidePanel: document.querySelector("#scheduleSidePanel"),
  newScheduleBtn: document.querySelector("#newScheduleBtn"),
  scheduleForm: document.querySelector("#scheduleForm"),
  scheduleNameInput: document.querySelector("#scheduleNameInput"),
  schedulePromptInput: document.querySelector("#schedulePromptInput"),
  scheduleExprInput: document.querySelector("#scheduleExprInput"),
  scheduleExprHint: document.querySelector("#scheduleExprHint"),
  scheduleProviderSelect: document.querySelector("#scheduleProviderSelect"),
  scheduleModelInput: document.querySelector("#scheduleModelInput"),
  scheduleOutputInput: document.querySelector("#scheduleOutputInput"),
  scheduleToolsCheck: document.querySelector("#scheduleToolsCheck"),
  scheduleNotifyCheck: document.querySelector("#scheduleNotifyCheck"),
  saveScheduleBtn: document.querySelector("#saveScheduleBtn"),
  cancelScheduleBtn: document.querySelector("#cancelScheduleBtn"),
  scheduleFormFeedback: document.querySelector("#scheduleFormFeedback"),
  scheduleList: document.querySelector("#scheduleList")
};

let state = loadState();
let appStateReady = false;
let appStateSaveTimer = null;
let busy = false;
let stillWaitingTimer = null;
let activeChatController = null;
let modelPopoverAnchor = null;
let pendingAttachments = [];
let pendingReferences = [];
let draftAgentName = "";
let draftAgentAvatar = "";
let agentProfileDirty = false;
let lastEnvironmentData = null;
let updateReadyToInstall = false;
let updateManualInstallRequired = false;
let updateStatusPollTimer = null;

// ── 文件处理 ──

const DEFAULT_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
const OFFICE_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
const OFFICE_ATTACHMENT_EXTS = new Set(["xlsx", "xlsm", "csv", "tsv", "docx", "pdf", "pptx", "xls", "doc", "ppt"]);

function fileIcon(kind) {
  if (kind === "image") return "🖼";
  if (kind === "pdf") return "📄";
  if (kind === "sheet") return "▦";
  if (kind === "doc") return "📝";
  if (kind === "ppt") return "▣";
  return "📎";
}

function attachmentKindLabel(kind) {
  return {
    image: "图片",
    pdf: "PDF",
    sheet: "表格",
    doc: "文档",
    ppt: "PPT",
    text: "文本"
  }[kind] || "文件";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function attachmentMaxBytesForExt(ext = "") {
  return OFFICE_ATTACHMENT_EXTS.has(String(ext || "").toLowerCase())
    ? OFFICE_ATTACHMENT_MAX_BYTES
    : DEFAULT_ATTACHMENT_MAX_BYTES;
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("头像图片读取失败"));
    image.src = dataUrl;
  });
}

async function createAvatarDataUrl(dataUrl, size = 256) {
  if (!dataUrl) throw new Error("缺少头像图片");
  const image = await loadImageDataUrl(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前环境无法处理头像图片");

  const sourceSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sourceX = Math.max(0, ((image.naturalWidth || image.width) - sourceSize) / 2);
  const sourceY = Math.max(0, ((image.naturalHeight || image.height) - sourceSize) / 2);
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
  return canvas.toDataURL("image/png");
}

async function readPdf(file) {
  if (!window.pdfjsLib) return "[PDF 解析库未加载]";
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const parts = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((item) => item.str).join(" "));
  }
  return parts.join("\n");
}

async function readExcel(file) {
  if (!window.XLSX) return "[Excel 解析库未加载]";
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const parts = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) parts.push(`## Sheet: ${sheetName}\n${csv}`);
  }
  return parts.join("\n\n");
}

async function readDocx(file) {
  if (!window.mammoth) return "[DOCX 解析库未加载]";
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

const TEXT_EXTS = new Set([
  "txt","md","csv","json","yaml","yml","xml","html","css","js","ts","jsx","tsx",
  "py","go","rs","java","c","cpp","h","sh","bash","sql","toml","env","ini","log","diff"
]);

async function processFile(file) {
  const extFromType = String(file.type || "").split("/")[1] || "png";
  const name = file.name || `pasted-image-${Date.now()}.${extFromType.replace("jpeg", "jpg")}`;
  const ext = name.split(".").pop().toLowerCase();
  const size = file.size;

  const maxBytes = attachmentMaxBytesForExt(ext);
  if (size > maxBytes) {
    const hint = OFFICE_ATTACHMENT_EXTS.has(ext)
      ? "请放入工作区或授权路径后再处理更大的办公文件。"
      : "请压缩后再上传。";
    alert(`「${name}」超过 ${formatBytes(maxBytes)}，已跳过。\n${hint}`);
    return null;
  }

  const dataUrl = await readAsDataUrl(file);

  if (file.type.startsWith("image/")) {
    return { name, kind: "image", dataUrl, mediaType: file.type, size };
  }

  if (ext === "pdf" || file.type === "application/pdf") {
    let content = await readPdf(file);
    if (content.length > 60000) content = content.slice(0, 60000) + "\n…[内容过长已截断]";
    return { name, kind: "pdf", content, dataUrl, mediaType: file.type || "application/pdf", size };
  }

  if (["xlsx", "xls", "xlsm"].includes(ext)) {
    let content = await readExcel(file);
    if (content.length > 60000) content = content.slice(0, 60000) + "\n…[内容过长已截断]";
    return { name, kind: "sheet", content, dataUrl, mediaType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size };
  }

  if (ext === "tsv") {
    let content = await readAsText(file);
    if (content.length > 60000) content = content.slice(0, 60000) + "\n…[内容过长已截断]";
    return { name, kind: "sheet", content, dataUrl, mediaType: file.type || "text/tab-separated-values", size };
  }

  if (ext === "docx" || ext === "doc") {
    let content = await readDocx(file);
    if (content.length > 60000) content = content.slice(0, 60000) + "\n…[内容过长已截断]";
    return { name, kind: "doc", content, dataUrl, mediaType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size };
  }

  if (ext === "pptx" || ext === "ppt") {
    return { name, kind: "ppt", content: ext === "ppt" ? "旧版 .ppt 已保存，但当前内置解析器不能直接读取，请先另存为 .pptx。" : "", dataUrl, mediaType: file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation", size };
  }

  if (TEXT_EXTS.has(ext) || file.type.startsWith("text/")) {
    let content = await readAsText(file);
    if (content.length > 60000) content = content.slice(0, 60000) + "\n…[内容过长已截断]";
    return { name, kind: "text", content, dataUrl, mediaType: file.type || "text/plain", size };
  }

  alert(`「${name}」格式暂不支持，已跳过`);
  return null;
}

async function handleFiles(fileList) {
  const before = pendingAttachments.length;
  for (const file of Array.from(fileList)) {
    const attachment = await processFile(file);
    if (attachment) pendingAttachments.push(attachment);
  }
  renderAttachmentChips();
  const added = pendingAttachments.length - before;
  if (added > 0) setStatus(`已添加 ${added} 个附件`, "可以继续输入或直接发送", "complete");
}

async function handlePasteIntoPrompt(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const imageFiles = items
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (!imageFiles.length) return;
  event.preventDefault();
  await handleFiles(imageFiles);
}

function renderAttachmentChips() {
  const bar = document.getElementById("attachmentBar");
  if (!bar) return;
  if (!pendingAttachments.length) {
    bar.classList.add("hidden");
    bar.innerHTML = "";
    return;
  }
  bar.classList.remove("hidden");
  bar.innerHTML = "";
  pendingAttachments.forEach((att, index) => {
    const chip = document.createElement("div");
    const kindClass = att.kind === "image" ? "image-chip" : att.kind === "pdf" ? "pdf-chip" : att.kind === "sheet" ? "sheet-chip" : att.kind === "doc" ? "doc-chip" : att.kind === "ppt" ? "ppt-chip" : "";
    chip.className = `attachment-chip ${kindClass}`;
    const previewHtml = att.kind === "image" && att.dataUrl
      ? `<img class="chip-thumb" src="${escapeAttr(att.dataUrl)}" alt="" />`
      : `<span class="chip-icon">${fileIcon(att.kind)}</span>`;
    chip.innerHTML = `
      ${previewHtml}
      <span class="chip-name">${escapeHtml(att.name)}</span>
      <span class="chip-size">${escapeHtml(attachmentKindLabel(att.kind))} · ${formatBytes(att.size)}</span>
      <button class="chip-remove" data-index="${index}" type="button" title="移除">×</button>
    `;
    chip.querySelector(".chip-remove").addEventListener("click", () => {
      pendingAttachments.splice(index, 1);
      renderAttachmentChips();
    });
    bar.append(chip);
  });
}

async function importAttachmentToWorkspace(attachment) {
  const { response, data } = await postJsonWithTimeout(
    "/api/attachments/import",
    {
      name: attachment.name,
      kind: attachment.kind,
      size: attachment.size,
      mediaType: attachment.mediaType,
      dataUrl: attachment.dataUrl,
      content: attachment.content || ""
    },
    {
      timeoutMs: 60000,
      timeoutMessage: `保存附件「${attachment.name}」超过 60 秒，已停止。`
    }
  );
  if (!response.ok || !data.ok) throw new Error(data.error || `保存附件「${attachment.name}」失败`);
  return {
    ...data.attachment,
    dataUrl: attachment.kind === "image" ? attachment.dataUrl : "",
    mediaType: data.attachment.mediaType || attachment.mediaType || ""
  };
}

async function importPendingAttachments(attachments) {
  const imported = [];
  for (const attachment of attachments) {
    setStatus("正在保存附件", attachment.name, "running");
    addTaskEvent("保存附件", attachment.name, "running", { persist: false });
    const importedAttachment = await importAttachmentToWorkspace(attachment);
    imported.push(importedAttachment);
    recordOfficeTaskEvents(importedAttachment.officeTask);
  }
  return imported;
}

function recordOfficeTaskEvents(officeTask) {
  if (!officeTask || !Array.isArray(officeTask.steps)) return;
  const prefix = officeTask.action ? `Office: ${officeTask.action}` : "Office 任务";
  for (const step of officeTask.steps) {
    if (!step.status || step.status === "pending") continue;
    addTaskEvent(`${prefix} · ${step.name}`, step.detail || step.error || "", step.status === "failed" ? "error" : "complete", { persist: false });
  }
}

// 解析模型回复中的文件代码块并自动保存
// 支持两种格式：
//   ```path/to/file.csv\n内容\n```
//   <write_file path="file.csv">内容</write_file>
async function autoSaveFileBlocks(content) {
  const saved = [];

  // 格式1: ```文件名.扩展名\n内容\n```
  const fenceRe = /```([\w\-.\/]+\.\w+)\n([\s\S]*?)```/g;
  let m;
  while ((m = fenceRe.exec(content)) !== null) {
    const filePath = m[1].trim();
    const fileContent = m[2];
    if (!filePath || filePath.includes("..")) continue;
    try {
      const response = await fetch("/api/workspace/generate-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: fileContent })
      });
      const data = await response.json();
      if (response.ok && data.ok) saved.push(data.path || filePath);
    } catch {}
  }

  // 格式2: <write_file path="...">内容</write_file>
  const tagRe = /<write_file\s+path="([^"]+)">([\s\S]*?)<\/write_file>/g;
  while ((m = tagRe.exec(content)) !== null) {
    const filePath = m[1].trim();
    const fileContent = m[2];
    if (!filePath || filePath.includes("..")) continue;
    try {
      const response = await fetch("/api/workspace/generate-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: fileContent })
      });
      const data = await response.json();
      if (response.ok && data.ok) saved.push(data.path || filePath);
    } catch {}
  }

  if (saved.length) {
    setStatus(`已保存 ${saved.length} 个文件`, saved.join("、"), "complete");
  }
  return saved;
}

function openAICompatibleSupportsImageInput(provider = {}, model = "") {
  const normalizedModel = String(model || "").trim().toLowerCase();
  const providerText = [
    provider.id,
    provider.name,
    provider.baseUrl,
    model
  ].filter(Boolean).join(" ").toLowerCase();

  if (provider.supportsImages === true || provider.vision === true) return true;
  if (provider.supportsImages === false || provider.vision === false) return false;
  if (providerText.includes("deepseek")) return false;
  if (providerText.includes("api.openai.com")) return /gpt-4o|gpt-4\.1|gpt-5|o3|o4/.test(String(model).toLowerCase());
  if (providerText.includes("dashscope") || providerText.includes("qwen") || providerText.includes("百炼")) {
    if (/^qwen3-coder|^qwen-coder|coder/.test(normalizedModel)) return false;
    if (/^qwen3\.(7|6|5)-(max|plus|flash)(-|$)/.test(normalizedModel)) return true;
    if (/^qwen3-vl-(plus|flash)(-|$)/.test(normalizedModel)) return true;
    if (/^qwen-vl|^qvq|omni/.test(normalizedModel)) return true;
  }
  if (providerText.includes("moonshot") || providerText.includes("kimi")) {
    if (/^kimi-k2\.(6|5)(-|$)/.test(normalizedModel)) return true;
    if (/^moonshot-v1-(8k|32k|128k)-vision-preview$/.test(normalizedModel)) return true;
  }
  if (providerText.includes("api.x.ai") || providerText.includes("xai") || providerText.includes("grok")) {
    return /^grok-(4\.3|build-0\.1)(-|$)/.test(normalizedModel);
  }
  if (providerText.includes("mistral")) {
    return /^mistral-(medium-3-5|large-2512|small-2603)(-|$)/.test(normalizedModel);
  }
  return /vision|vl|omni|multimodal|llava/.test(providerText);
}

function providerSupportsImageInput(provider = activeProvider(), model = state.activeModel) {
  const protocol = provider?.protocol || "openai";
  if (protocol === "anthropic" || protocol === "gemini") return true;
  if (protocol === "openai") return openAICompatibleSupportsImageInput(provider, model);
  return false;
}

function attachmentContextText(attachments = [], provider = activeProvider(), model = state.activeModel) {
  if (!attachments.length) return "";
  const canSendImages = providerSupportsImageInput(provider, model);
  return attachments.map((attachment, index) => {
    const lines = [
      `<attachment index="${index + 1}" name="${escapeAttr(attachment.name)}" path="${escapeAttr(attachment.path || "")}" kind="${escapeAttr(attachment.kind || "file")}">`,
      `文件名：${attachment.name}`,
      `工作区路径：${attachment.path || "未保存"}`,
      `大小：${formatBytes(Number(attachment.size || 0))}`,
      `摘要：${attachment.summary || "已附加"}`
    ];
    if (attachment.officeImport) {
      lines.push(
        `文件类型：${attachment.officeImport.fileType || attachment.kind || "file"}`,
        `解析状态：${attachment.officeImport.parseStatus || "unknown"}`,
        `支持处理：${attachment.officeImport.supported === false ? "否" : "是"}`,
        `是否截断：${attachment.officeImport.truncated ? "是" : "否"}`
      );
    }

    if (attachment.kind === "sheet") {
      lines.push("读取建议：如需完整检查表格，请调用 read_excel_file(path)。");
    } else if (attachment.kind !== "image") {
      lines.push("读取建议：如需重新读取原文件，请调用 read_file(path)。");
    }

    if (attachment.content) {
      lines.push("内容预览：", attachment.content);
    } else if (attachment.kind === "image") {
      lines.push(canSendImages
        ? "图片已作为附件保存；当前模型支持多模态，会同时收到图片数据。"
        : "图片已作为附件保存；当前模型不支持直接识别图片，本次只发送文件名、路径和摘要。需要看图时请切换到支持视觉的模型。");
    }

    lines.push("</attachment>");
    return lines.join("\n");
  }).join("\n\n");
}

function cleanReferenceText(value = "", limit = 1800) {
  return String(value || "")
    .replace(/<attachment[\s\S]*?<\/attachment>/g, "[附件]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function roleLabel(role = "") {
  if (role === "user") return "用户";
  if (role === "assistant") return state.agentName || "助手";
  return "对话";
}

function referenceContextText(references = []) {
  if (!Array.isArray(references) || !references.length) return "";
  const blocks = references.slice(0, 6).map((ref, index) => [
    `<quoted_context index="${index + 1}" source="${escapeAttr(ref.sourceTitle || "对话")}" type="${escapeAttr(ref.type || "message")}">`,
    `来源：${ref.sourceTitle || "对话"}`,
    ref.role ? `角色：${roleLabel(ref.role)}` : "",
    `内容：${cleanReferenceText(ref.content, 2200)}`,
    "</quoted_context>"
  ].filter(Boolean).join("\n"));
  return [
    "以下是用户本次明确引用的上下文。回答时优先结合这些引用，不要把引用误认为用户的新指令：",
    blocks.join("\n\n")
  ].join("\n");
}

function modelContentForMessage(message, provider, model = state.activeModel) {
  const text = String(message.content || "").trim();
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const references = Array.isArray(message.references) ? message.references : [];
  const referenceText = referenceContextText(references);
  const contextText = attachmentContextText(attachments, provider, model);
  const fullText = [text, referenceText, contextText].filter(Boolean).join("\n\n");
  const imageAttachments = attachments.filter((attachment) => attachment.kind === "image" && attachment.dataUrl);
  const supportsImages = providerSupportsImageInput(provider, model);

  if (!imageAttachments.length || !supportsImages) return fullText;

  const contentArray = [{ type: "text", text: fullText || "请查看附件。" }];
  for (const img of imageAttachments) {
    if (provider.protocol === "anthropic") {
      const base64 = img.dataUrl.split(",")[1] || "";
      contentArray.unshift({ type: "image", source: { type: "base64", media_type: img.mediaType || "image/png", data: base64 } });
    } else {
      contentArray.unshift({ type: "image_url", image_url: { url: img.dataUrl } });
    }
  }
  return contentArray;
}

function messagesForModel(messages, provider = activeProvider(), model = state.activeModel) {
  return messages
    .filter((message) => ["user", "assistant"].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: message.role === "user" ? modelContentForMessage(message, provider, model) : String(message.content || "")
    }))
    .filter((message) => {
      if (Array.isArray(message.content)) return message.content.length > 0;
      return String(message.content || "").trim();
    });
}

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createConversation(title = "新对话") {
  const time = nowIso();
  return {
    id: id("chat"),
    title,
    messages: [],
    createdAt: time,
    updatedAt: time
  };
}

function defaultState() {
  const firstConversation = createConversation();
  return {
    providers: structuredClone(providerPresets),
    selectedProviderId: "neo-local",
    activeProviderId: "neo-local",
    activeModel: "neo-mock",
    customModel: "",
    autoModelRouting: defaultModelRouting.enabled,
    textRouteProviderId: defaultModelRouting.textProviderId,
    textRouteModel: defaultModelRouting.textModel,
    visionRouteProviderId: defaultModelRouting.visionProviderId,
    visionRouteModel: defaultModelRouting.visionModel,
    thinking: "balanced",
    temperature: 0.7,
    maxTokens: 2048,
    agentTools: false,
    toolConsent: structuredClone(defaultToolConsent),
    agentName: "neo",
    agentAvatar: "",
    memories: [],
    enabledSkills: defaultEnabledSkillIds(),
    appearance: structuredClone(defaultAppearance),
    appearancePreset: appearancePresetId,
    historyCollapsed: false,
    sidebarOpen: true,
    workspaceOpen: true,
    workspaceTab: "tasks",
    workspacePath: ".",
    workspaceRoot: "",
    onboardingComplete: localStorage.getItem(onboardingStorageKey) === "1",
    toolSteps: [],
    taskEvents: [],
    artifacts: [],
    currentFile: null,
    role: "coder",
    responseStyle: "direct",
    systemPrompt: generatedSystemPrompt("coder", "direct"),
    conversations: [firstConversation],
    activeConversationId: firstConversation.id,
    layout: { sidebarWidth: 300, rightWidth: 300 },
    petdexSlug: "",
    petdexPet: null
  };
}

function defaultEnabledSkillIds() {
  return skillLibrary.filter((skill) => skill.defaultEnabled).map((skill) => skill.id);
}

function normalizeEnabledSkills(enabledSkills) {
  const valid = new Set(skillLibrary.map((skill) => skill.id));
  if (!Array.isArray(enabledSkills)) return defaultEnabledSkillIds();
  return enabledSkills.filter((skillId, index) => valid.has(skillId) && enabledSkills.indexOf(skillId) === index);
}

function normalizeToolConsent(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const externalPaths = Array.isArray(input.externalPaths)
    ? [...new Set(input.externalPaths.map((item) => String(item || "").trim()).filter(Boolean))]
      .slice(0, 80)
    : [];
  return {
    fileRead: input.fileRead !== false,
    fileWrite: input.fileWrite === true,
    externalRead: input.externalRead === true,
    externalWrite: input.externalWrite === true,
    externalPaths,
    web: input.web === true,
    desktop: input.desktop === true,
    command: input.command === true
  };
}

function uniqueExternalPaths(paths = []) {
  return [...new Set((paths || []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 80);
}

function externalPathsFromInput() {
  return uniqueExternalPaths(String(els.externalPathsInput?.value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean));
}

function syncExternalConsentFromControls(baseConsent = state.toolConsent) {
  const next = normalizeToolConsent(baseConsent);
  if (els.externalReadToggle) next.externalRead = els.externalReadToggle.checked;
  if (els.externalPathsInput) next.externalPaths = externalPathsFromInput();
  return next;
}

function mergeExternalPaths(paths = []) {
  const next = normalizeToolConsent(state.toolConsent || defaultToolConsent);
  next.externalPaths = uniqueExternalPaths([...(next.externalPaths || []), ...paths]);
  if (next.externalPaths.length) next.externalRead = true;
  state.toolConsent = next;
  if (els.externalReadToggle) els.externalReadToggle.checked = next.externalRead;
  if (els.externalPathsInput) els.externalPathsInput.value = next.externalPaths.join("\n");
  return next;
}

function normalizePathForCompare(value = "") {
  return String(value || "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
}

function externalPathCovered(candidate = "", roots = []) {
  const target = normalizePathForCompare(candidate);
  if (!target) return false;
  return (roots || []).some((rootPath) => {
    const root = normalizePathForCompare(rootPath);
    return root && (target === root || target.startsWith(`${root}/`));
  });
}

function trimDetectedPath(value = "") {
  return String(value || "")
    .trim()
    .replace(/[，。；;、,.!?！？）)】\]]+$/g, "");
}

function extractAbsolutePathsFromPrompt(prompt = "") {
  const text = String(prompt || "");
  const paths = [];
  const addPath = (value) => {
    const cleaned = trimDetectedPath(value);
    if (/^(\/[^/\s]|\/Users\/|\/Volumes\/|\/Applications\/|\/tmp\/|\/private\/|\/var\/|\/opt\/|\/home\/|[A-Za-z]:[\\/])/.test(cleaned)) paths.push(cleaned);
  };
  const quotedRe = /["'“”‘’]([^"'“”‘’]+)["'“”‘’]/g;
  let match;
  while ((match = quotedRe.exec(text))) addPath(match[1]);
  const pathRe = /(?:\/(?:Users|Volumes|Applications|tmp|private|var|opt|home|Library|System)\/[^\s，。；;、"'“”‘’<>]+|[A-Za-z]:[\\/][^\s，。；;、"'“”‘’<>]+)/g;
  while ((match = pathRe.exec(text))) addPath(match[0]);
  return uniqueExternalPaths(paths);
}

function promptSuggestsExternalFile(prompt = "") {
  const text = String(prompt || "");
  return /(工作区外|非工作区|桌面|下载目录|下载文件夹|Downloads|Desktop|Documents|访问外部文件|本机文件|电脑上的文件|\/Users\/|\/Volumes\/|[A-Za-z]:[\\/])/i.test(text);
}

function consentForSkillIds(skillIds = []) {
  const next = normalizeToolConsent(state?.toolConsent || defaultToolConsent);
  for (const skillId of skillIds) {
    const skill = skillLibrary.find((item) => item.id === skillId);
    for (const toolName of skill?.tools || []) {
      if (readToolNames.has(toolName)) next.fileRead = true;
      if (writeToolNames.has(toolName)) next.fileWrite = true;
      if (webToolNames.has(toolName)) next.web = true;
      if (desktopToolNames.has(toolName)) next.desktop = true;
      if (toolName === "run_command") next.command = true;
    }
  }
  return next;
}

function toolConsentForChat() {
  return normalizeToolConsent(state.toolConsent || defaultToolConsent);
}

function isToolNameAllowedByConsent(toolName, consent = toolConsentForChat()) {
  const required = [];
  if (readToolNames.has(toolName)) required.push("fileRead");
  if (writeToolNames.has(toolName)) required.push("fileWrite");
  if (webToolNames.has(toolName)) required.push("web");
  if (desktopToolNames.has(toolName)) required.push("desktop");
  if (toolName === "run_command") required.push("command");
  if (!required.length) return false;
  return required.every((key) => consent[key] === true);
}

function confirmToolConsent(nextConsent) {
  const next = normalizeToolConsent(nextConsent);
  const scopes = [];
  if (next.fileRead) scopes.push("读取工作区文件");
  if (next.fileWrite) scopes.push("写入或生成工作区文件");
  if (next.externalRead) scopes.push("读取已授权的工作区外路径");
  if (next.externalWrite) scopes.push("写入已授权的工作区外路径");
  if (next.web) scopes.push("访问网页");
  if (next.desktop) scopes.push("打开本地应用、网页或文件");
  if (next.command) scopes.push("运行本地命令");
  return window.confirm(`开启本地工具后，模型可在授权范围内操作：\n\n${scopes.join("\n")}\n\n高风险操作仍建议你在聊天里明确确认。`);
}

function enableAgentToolsForSkills(skillIds = state.enabledSkills, { ask = true } = {}) {
  const nextConsent = consentForSkillIds(skillIds);
  if (ask && !confirmToolConsent(nextConsent)) return false;
  state.agentTools = true;
  state.toolConsent = nextConsent;
  return true;
}

function localToolIntentForPrompt(prompt = "") {
  const text = String(prompt || "").trim();
  if (!text) return null;
  const skills = new Set();
  const reasons = [];
  const externalPaths = extractAbsolutePathsFromPrompt(text);
  let needsExternalRead = false;

  if (/(保存|创建|新建|写入|生成|导出|另存|存成|输出).{0,24}(文件|文档|资料|记录|报告|md|txt|json|csv|tsv|docx|pptx|html|svg|png|jpg|jpeg|图片|海报|封面|卡片)/i.test(text)) {
    skills.add("local-files");
    reasons.push("需要写入或导出工作区文件");
  }
  if (/(excel|xlsx|xlsm|csv|tsv|表格|报价单|工资表|账单|对账|清洗|洗表)/i.test(text) && /(生成|创建|保存|导出|清洗|整理|读取|分析|处理)/i.test(text)) {
    skills.add("spreadsheet-pro");
    reasons.push("需要读取、生成或处理表格");
  }
  if (/(word|docx|ppt|pptx|pdf|幻灯片|演示文稿)/i.test(text) && /(保存|创建|生成|导出|转换|读取|提取|摘要|处理|分析)/i.test(text)) {
    skills.add("document-reader");
    if (/(保存|创建|生成|导出|转换)/i.test(text)) skills.add("local-files");
    reasons.push("需要处理本地文档");
  }
  if (/(运行|执行|命令|终端|shell|脚本|npm|node|python|pip|安装|构建|打包|测试|启动服务|重启|检查环境)/i.test(text)) {
    skills.add("local-command");
    reasons.push("需要运行本地命令");
  }
  if (/(下载|读取网页|打开网页|搜索网页|访问链接|抓取网页)/i.test(text)) {
    skills.add("web-browser");
    reasons.push("需要访问网页或下载文件");
  }
  if ((externalPaths.length || promptSuggestsExternalFile(text)) && /(读取|打开|查看|访问|分析|处理|整理|导入|提取|看看|看下|帮我看|文件|表格|文档|xlsx|xlsm|csv|tsv|docx|pptx|pdf)/i.test(text)) {
    skills.add("local-files");
    needsExternalRead = true;
    reasons.push("需要读取工作区外文件");
  }
  if (needsExternalRead && /(excel|xlsx|xlsm|csv|tsv|表格|报价单|工资表|账单|对账|清洗|洗表)/i.test(text)) {
    skills.add("spreadsheet-pro");
  }
  if (needsExternalRead && /(word|docx|ppt|pptx|pdf)/i.test(text)) {
    skills.add("document-reader");
  }

  if (!skills.size) return null;
  return { skillIds: [...skills], reason: [...new Set(reasons)].join("、"), needsExternalRead, externalPaths };
}

async function requestExternalPathsFromDesktop() {
  const response = await fetch("/api/workspace/select-external-paths", { method: "POST" });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "无法申请外部文件权限");
  return Array.isArray(data.paths) ? data.paths : [];
}

async function ensureLocalToolsBeforeSend(prompt = "") {
  const intent = localToolIntentForPrompt(prompt);
  if (!intent) return true;
  const nextSkills = [...new Set([...normalizeEnabledSkills(state.enabledSkills), ...intent.skillIds])];
  const nextConsent = consentForSkillIds(nextSkills);
  const currentConsent = toolConsentForChat();
  if (intent.needsExternalRead) {
    nextConsent.externalRead = true;
    nextConsent.externalPaths = uniqueExternalPaths([...(nextConsent.externalPaths || []), ...(intent.externalPaths || [])]);
  }
  const requiredConsentKeys = ["fileRead", "fileWrite", "externalRead", "externalWrite", "web", "desktop", "command"];
  const consentReady = requiredConsentKeys.every((key) => !nextConsent[key] || currentConsent[key] === true);
  const externalReady = !intent.needsExternalRead
    || (currentConsent.externalRead && (intent.externalPaths?.length
      ? intent.externalPaths.every((item) => externalPathCovered(item, currentConsent.externalPaths))
      : currentConsent.externalPaths.length > 0));
  const alreadyReady = state.agentTools && nextSkills.every((skillId) => state.enabledSkills.includes(skillId)) && consentReady && externalReady;
  if (alreadyReady) return true;

  const skillNames = intent.skillIds
    .map((skillId) => skillLibrary.find((skill) => skill.id === skillId)?.name || skillId)
    .join("、");
  const lines = [
    "这个任务需要本地工具才能真实执行。",
    "",
    `原因：${intent.reason}`,
    `将开启：${skillNames}`,
  ];
  if (intent.needsExternalRead) {
    lines.push("");
    if (intent.externalPaths?.length) {
      lines.push("将授权读取这些工作区外路径：");
      lines.push(...intent.externalPaths.map((item) => `- ${item}`));
    } else {
      lines.push("还需要你在系统窗口里选择要授权读取的文件或文件夹。");
    }
  }
  lines.push("", "不开启的话，模型只能输出文字，不能真的读取或处理本地文件。是否现在开启并继续？");
  const ok = window.confirm(lines.join("\n"));
  if (!ok) return false;

  if (intent.needsExternalRead && !intent.externalPaths?.length && !externalReady) {
    try {
      const selectedPaths = await requestExternalPathsFromDesktop();
      if (!selectedPaths.length) return false;
      nextConsent.externalPaths = uniqueExternalPaths([...(nextConsent.externalPaths || []), ...selectedPaths]);
    } catch (error) {
      window.alert(`${error.message}\n\n你也可以在设置里的“外部文件读取”中手动加入授权路径。`);
      return false;
    }
  }

  state.enabledSkills = nextSkills;
  state.agentTools = true;
  state.toolConsent = nextConsent;
  if (els.agentToolsToggle) els.agentToolsToggle.checked = true;
  if (els.externalReadToggle) els.externalReadToggle.checked = nextConsent.externalRead;
  if (els.externalPathsInput) els.externalPathsInput.value = (nextConsent.externalPaths || []).join("\n");
  renderSkillLibrary();
  saveState();
  addTaskEvent(intent.needsExternalRead ? "已开启本地工具和外部读取" : "已开启本地工具", skillNames, "complete", { persist: false });
  return true;
}

function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

function normalizeAppearanceNumber(value, min, max, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, min, max) : fallback;
}

function isCloseAppearanceNumber(value, expected) {
  return Math.abs(Number(value) - expected) < 0.005;
}

function isLegacyDefaultAppearance(appearance = {}) {
  if (!appearance || typeof appearance !== "object") return false;
  return (
    isCloseAppearanceNumber(appearance.globalOpacity, legacyDefaultAppearance.globalOpacity) &&
    isCloseAppearanceNumber(appearance.glassBlur, legacyDefaultAppearance.glassBlur) &&
    normalizeHexColor(appearance.leftColor, "") === legacyDefaultAppearance.leftColor &&
    isCloseAppearanceNumber(appearance.leftOpacity, legacyDefaultAppearance.leftOpacity) &&
    normalizeHexColor(appearance.centerColor, "") === legacyDefaultAppearance.centerColor &&
    isCloseAppearanceNumber(appearance.centerOpacity, legacyDefaultAppearance.centerOpacity) &&
    normalizeHexColor(appearance.rightColor, "") === legacyDefaultAppearance.rightColor &&
    isCloseAppearanceNumber(appearance.rightOpacity, legacyDefaultAppearance.rightOpacity)
  );
}

function normalizeAppearance(appearance = {}) {
  if (isLegacyDefaultAppearance(appearance)) return structuredClone(defaultAppearance);
  const rightColor = normalizeHexColor(appearance.rightColor, defaultAppearance.rightColor);
  return {
    globalOpacity: normalizeAppearanceNumber(appearance.globalOpacity, 0.35, 1, defaultAppearance.globalOpacity),
    glassBlur: normalizeAppearanceNumber(appearance.glassBlur, 8, 46, defaultAppearance.glassBlur),
    leftColor: normalizeHexColor(appearance.leftColor, defaultAppearance.leftColor),
    leftOpacity: normalizeAppearanceNumber(appearance.leftOpacity, 0.25, 1, defaultAppearance.leftOpacity),
    centerColor: normalizeHexColor(appearance.centerColor, defaultAppearance.centerColor),
    centerOpacity: normalizeAppearanceNumber(appearance.centerOpacity, 0.25, 1, defaultAppearance.centerOpacity),
    rightColor: rightColor === "#f6f9f7" ? defaultAppearance.rightColor : rightColor,
    rightOpacity: normalizeAppearanceNumber(appearance.rightOpacity, 0.25, 1, defaultAppearance.rightOpacity)
  };
}

function normalizePetdexPetSelection(value, fallbackSlug = "") {
  const slug = String(value?.slug || fallbackSlug || "").trim();
  if (!slug) return null;
  const spritesheetUrl = String(value?.spritesheetUrl || "").trim();
  return {
    slug,
    displayName: String(value?.displayName || value?.name || slug).trim(),
    kind: String(value?.kind || "").trim(),
    submittedBy: String(value?.submittedBy || "").trim(),
    spritesheetUrl,
    petJsonUrl: String(value?.petJsonUrl || "").trim(),
    zipUrl: String(value?.zipUrl || "").trim()
  };
}

function normalizeSavedState(saved = {}) {
  const base = defaultState();
  try {
    const providers = mergeProviders(providerPresets, saved.providers || []);
    const conversations = migrateConversations(saved);
    const activeConversationId =
      conversations.find((conversation) => conversation.id === saved.activeConversationId)?.id || conversations[0].id;
    const role = rolePrompts[saved.role] ? saved.role : "coder";
    const responseStyle = responseStylePrompts[saved.responseStyle] ? saved.responseStyle : "direct";

    const hasSavedToolConsent = saved.toolConsent && typeof saved.toolConsent === "object";

    return {
      ...base,
      ...saved,
      providers,
      role,
      responseStyle,
      systemPrompt: normalizeSystemPrompt(saved.systemPrompt, role, responseStyle),
      conversations,
      activeConversationId,
      historyCollapsed: Boolean(saved.historyCollapsed),
      sidebarOpen: saved.sidebarOpen !== false,
      workspaceOpen: saved.workspaceOpen !== false,
      workspaceTab: ["tasks", "artifacts", "files", "terminal"].includes(saved.workspaceTab) ? saved.workspaceTab : "tasks",
      schedulePanelOpen: Boolean(saved.schedulePanelOpen),
      workspacePath: saved.workspacePath || ".",
      onboardingComplete: Boolean(saved.onboardingComplete || localStorage.getItem(onboardingStorageKey) === "1"),
      agentName: saved.agentName || "neo",
      agentAvatar: saved.agentAvatar || "",
      memories: normalizeMemories(saved.memories || []),
      enabledSkills: normalizeEnabledSkills(saved.enabledSkills),
      appearance: saved.appearancePreset === appearancePresetId
        ? normalizeAppearance(saved.appearance)
        : structuredClone(defaultAppearance),
      appearancePreset: appearancePresetId,
      agentTools: hasSavedToolConsent ? Boolean(saved.agentTools) : base.agentTools,
      toolConsent: normalizeToolConsent(saved.toolConsent || base.toolConsent),
      autoModelRouting: saved.autoModelRouting === undefined ? base.autoModelRouting : Boolean(saved.autoModelRouting),
      textRouteProviderId: saved.textRouteProviderId || base.textRouteProviderId,
      textRouteModel: saved.textRouteModel || base.textRouteModel,
      visionRouteProviderId: saved.visionRouteProviderId || base.visionRouteProviderId,
      visionRouteModel: saved.visionRouteModel || base.visionRouteModel,
      toolSteps: Array.isArray(saved.toolSteps) ? saved.toolSteps.slice(-12) : [],
      taskEvents: Array.isArray(saved.taskEvents) ? saved.taskEvents.slice(-40) : [],
      artifacts: Array.isArray(saved.artifacts) ? saved.artifacts.slice(0, 80) : [],
      currentFile: saved.currentFile || null,
      thinking: saved.thinking || "balanced",
      layout: {
        sidebarWidth: clamp(Number(saved.layout?.sidebarWidth || saved.sidebarWidth || 300), 220, 430),
        rightWidth: clamp(Number(saved.layout?.rightWidth || saved.rightWidth || 300), 260, 440)
      },
      petdexSlug: typeof saved.petdexSlug === "string" ? saved.petdexSlug : "",
      petdexPet: normalizePetdexPetSelection(saved.petdexPet, typeof saved.petdexSlug === "string" ? saved.petdexSlug : "")
    };
  } catch {
    return base;
  }
}

function loadState() {
  try {
    return normalizeSavedState(JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey) || "{}"));
  } catch {
    return defaultState();
  }
}

function migrateConversations(saved) {
  if (Array.isArray(saved.conversations) && saved.conversations.length) {
    return saved.conversations.map((conversation) => ({
      id: conversation.id || id("chat"),
      title: conversation.title || titleFromMessages(conversation.messages || []),
      messages: Array.isArray(conversation.messages) ? conversation.messages : [],
      createdAt: conversation.createdAt || nowIso(),
      updatedAt: conversation.updatedAt || conversation.createdAt || nowIso()
    }));
  }

  if (Array.isArray(saved.messages) && saved.messages.length) {
    return [
      {
        id: id("chat"),
        title: titleFromMessages(saved.messages),
        messages: saved.messages,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ];
  }

  return [createConversation()];
}

function mergeProviders(presets, saved) {
  const byId = new Map(presets.map((provider) => [provider.id, { ...provider }]));
  for (const provider of saved) {
    const preset = byId.get(provider.id) || {};
    if (!preset.id && deprecatedBuiltInProviderIds.has(provider.id) && !String(provider.apiKey || "").trim()) continue;
    const merged = { ...preset, ...provider };
    if (Array.isArray(preset.models)) {
      merged.models = [...preset.models];
    } else if (Array.isArray(provider.models)) {
      merged.models = [...new Set(provider.models)];
    }
    byId.set(provider.id, normalizeProviderApiMode(merged));
  }
  return [...byId.values()].map((provider) => normalizeProviderApiMode(provider));
}

function isOfficialOpenAIProvider(provider = {}) {
  const text = [provider.id, provider.name, provider.baseUrl].filter(Boolean).join(" ").toLowerCase();
  return provider.protocol === "openai-responses"
    || provider.id === "openai"
    || text.includes("api.openai.com");
}

function normalizedApiMode(provider = {}) {
  if (provider.protocol === "openai-responses") return "responses";
  return provider.apiMode === "responses" ? "responses" : "chat_completions";
}

function apiModeLabel(provider = {}) {
  return normalizedApiMode(provider) === "responses" ? "Responses 增强" : "Chat 兼容";
}

function normalizeProviderApiMode(provider = {}) {
  if (provider.protocol === "openai" || provider.protocol === "openai-responses") {
    provider.apiMode = isOfficialOpenAIProvider(provider) ? normalizedApiMode(provider) : "chat_completions";
  } else {
    provider.apiMode = "chat_completions";
  }
  return provider;
}

function generatedSystemPrompt(role, responseStyle) {
  return [
    rolePrompts[role] || rolePrompts.coder,
    responseStylePrompts[responseStyle] || responseStylePrompts.direct,
    naturalConversationPrompt
  ].filter(Boolean).join("\n\n");
}

function generatedPromptSet() {
  const values = new Set([...legacyRolePrompts, ...Object.values(rolePrompts)]);
  Object.values(legacyRolePromptTemplates).forEach((prompt) => values.add(prompt));
  for (const rolePrompt of Object.values(legacyRolePromptTemplates)) {
    for (const stylePrompt of Object.values(legacyResponseStylePromptTemplates)) {
      values.add([rolePrompt, stylePrompt].filter(Boolean).join("\n\n"));
    }
  }
  for (const role of Object.keys(rolePrompts)) {
    for (const style of Object.keys(responseStylePrompts)) {
      values.add(generatedSystemPrompt(role, style));
    }
  }
  return values;
}

function normalizeSystemPrompt(savedPrompt, role, responseStyle = "direct") {
  if (!savedPrompt || generatedPromptSet().has(savedPrompt)) return generatedSystemPrompt(role, responseStyle);
  return savedPrompt;
}

function normalizeMemoryTags(tags = []) {
  const raw = Array.isArray(tags) ? tags : String(tags || "").split(/[,，、\s]+/);
  return raw
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index)
    .slice(0, 10);
}

function inferMemoryType(content = "") {
  const text = String(content);
  if (/excel|xlsx|csv|表格|工资|账单|报价|字段|公式/i.test(text)) return "file";
  if (/工具|调用|命令|python|代码层级|自动化|流程/i.test(text)) return "tool";
  if (/项目|版本|工作区|目录|文件夹|代码库/i.test(text)) return "project";
  if (/喜欢|不喜欢|偏好|语气|默认|以后|每次|不要|必须/i.test(text)) return "preference";
  return "fact";
}

function inferMemoryScope(content = "") {
  const text = String(content);
  if (/本项目|这个项目|当前项目|工作区|目录|文件夹|代码库|文件/i.test(text)) return "workspace";
  if (/这次对话|当前对话|刚才|上面/i.test(text)) return "conversation";
  return "global";
}

function inferMemoryTags(content = "", type = "fact", scope = "global") {
  const tags = [memoryTypes[type]?.label, memoryScopes[scope]];
  const text = String(content).toLowerCase();
  const candidates = [
    ["Excel", /excel|xlsx|表格|工资|账单|报价/],
    ["CSV", /csv|编码|分隔符/],
    ["文件", /文件|目录|路径|工作区/],
    ["工具", /工具|调用|命令|python/],
    ["项目", /项目|版本|代码库/],
    ["偏好", /喜欢|不喜欢|默认|以后|每次/]
  ];
  for (const [tag, pattern] of candidates) {
    if (pattern.test(text)) tags.push(tag);
  }
  return normalizeMemoryTags(tags);
}

function memoryFingerprint(content = "") {
  return String(content).toLowerCase().replace(/\s+/g, "").slice(0, 220);
}

function normalizeMemoryStatus(status) {
  return memoryStatuses[status] ? status : "active";
}

function normalizeMemories(memories = []) {
  if (!Array.isArray(memories)) return [];
  const byFingerprint = new Map();

  for (const memory of memories) {
    const content = String(memory?.content || memory || "").trim().slice(0, memoryContentLimit);
    if (!content) continue;
    const type = memoryTypes[memory?.type] ? memory.type : inferMemoryType(content);
    const scope = memoryScopes[memory?.scope] ? memory.scope : inferMemoryScope(content);
    const status = normalizeMemoryStatus(memory?.status);
    const normalized = {
      id: memory?.id || id("memory"),
      content,
      type,
      scope,
      status,
      source: memory?.source || (status === "pending" ? "auto" : "manual"),
      confidence: clamp(Number(memory?.confidence || (status === "pending" ? 0.62 : 0.95)), 0, 1),
      tags: normalizeMemoryTags(memory?.tags?.length ? memory.tags : inferMemoryTags(content, type, scope)),
      project: memory?.project || "",
      createdAt: memory?.createdAt || nowIso(),
      updatedAt: memory?.updatedAt || memory?.createdAt || nowIso(),
      lastUsedAt: memory?.lastUsedAt || "",
      useCount: Number(memory?.useCount || 0),
      fingerprint: memory?.fingerprint || memoryFingerprint(content)
    };
    const existing = byFingerprint.get(normalized.fingerprint);
    if (!existing || (existing.status === "pending" && normalized.status === "active")) {
      byFingerprint.set(normalized.fingerprint, normalized);
    }
  }

  return [...byFingerprint.values()]
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : b.status === "active" ? 1 : 0;
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    })
    .slice(0, 300);
}

// localStorage 安全写入：超过 4MB 时自动截断最旧的对话，防止静默失败
const STORAGE_WARN_BYTES = 4 * 1024 * 1024;   // 4MB 警告线
const STORAGE_HARD_BYTES = 4.5 * 1024 * 1024; // 4.5MB 强制截断线

function trimStateForStorage(stateObj) {
  // 按 updatedAt 从旧到新排序，每次删最旧的一条对话
  const trimmed = { ...stateObj, conversations: [...(stateObj.conversations || [])] };
  while (trimmed.conversations.length > 1) {
    const serialized = JSON.stringify(trimmed);
    if (new Blob([serialized]).size <= STORAGE_HARD_BYTES) break;
    trimmed.conversations.sort((a, b) => (a.updatedAt || "") < (b.updatedAt || "") ? -1 : 1);
    trimmed.conversations.shift();
    // 若活跃对话被删，切换到最新一条
    if (!trimmed.conversations.find((c) => c.id === trimmed.activeConversationId)) {
      trimmed.activeConversationId = trimmed.conversations[trimmed.conversations.length - 1]?.id;
    }
  }
  return trimmed;
}

function saveState() {
  let serialized = JSON.stringify(state);
  const size = new Blob([serialized]).size;
  if (size > STORAGE_HARD_BYTES) {
    const trimmed = trimStateForStorage(state);
    serialized = JSON.stringify(trimmed);
    console.warn(`[neo] localStorage 超过 ${(STORAGE_HARD_BYTES / 1024 / 1024).toFixed(1)}MB，已自动截断旧对话。当前对话数：${trimmed.conversations.length}`);
  } else if (size > STORAGE_WARN_BYTES) {
    console.warn(`[neo] localStorage 已使用 ${(size / 1024 / 1024).toFixed(1)}MB，接近上限。`);
  }
  try {
    localStorage.setItem(storageKey, serialized);
  } catch (err) {
    // 极端情况：即使截断后仍写入失败（如隐私模式容量极小）
    console.error("[neo] localStorage 写入失败：", err.message);
  }
  queueAppStateSave();
}

function queueAppStateSave() {
  if (!appStateReady) return;
  clearTimeout(appStateSaveTimer);
  appStateSaveTimer = setTimeout(() => {
    persistAppState();
  }, 250);
}

async function persistAppState() {
  try {
    await fetch("/api/app-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state })
    });
  } catch {
    // 本地文件持久化失败时，保留浏览器存储作为兜底。
  }
}

function hasSavedAppState(value) {
  return value && typeof value === "object" && Object.keys(value).length > 0;
}

function currentLocalAppState() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey) || "{}");
  } catch {
    return {};
  }
}

async function hydrateAppState() {
  try {
    const response = await fetch("/api/app-state");
    const data = await response.json();
    if (response.ok && hasSavedAppState(data.state)) {
      state = normalizeSavedState(data.state);
      localStorage.setItem(storageKey, JSON.stringify(state));
    }
  } catch {
    // 纯浏览器模式或旧服务端没有这个接口时，继续使用 localStorage。
  } finally {
    appStateReady = true;
    if (!hasSavedAppState(currentLocalAppState())) {
      saveState();
    } else {
      queueAppStateSave();
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex, "#ffffff").slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbaFromHex(hex, opacity) {
  const { r, g, b } = hexToRgb(hex);
  const alpha = clamp(Number(opacity), 0, 1);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

function mixedOpacity(regionOpacity, offset = 0) {
  const appearance = normalizeAppearance(state.appearance);
  return clamp((appearance.globalOpacity * regionOpacity * glassOpacityScale) + offset, 0.05, glassOpacityMax);
}

function percentText(value) {
  return `${Math.round(clamp(Number(value), 0, 1) * 100)}%`;
}

function applyAppearance() {
  state.appearance = normalizeAppearance(state.appearance);
  const appearance = state.appearance;
  const rootStyle = document.documentElement.style;
  const leftAlpha = mixedOpacity(appearance.leftOpacity);
  const centerAlpha = mixedOpacity(appearance.centerOpacity);
  const rightAlpha = mixedOpacity(appearance.rightOpacity);

  rootStyle.setProperty("--glass-blur", `blur(${Math.round(appearance.glassBlur)}px) saturate(1.42)`);
  rootStyle.setProperty("--appearance-left-bg", rgbaFromHex(appearance.leftColor, leftAlpha));
  rootStyle.setProperty("--appearance-center-bg", rgbaFromHex(appearance.centerColor, centerAlpha));
  rootStyle.setProperty("--appearance-right-bg", rgbaFromHex(appearance.rightColor, rightAlpha));
  rootStyle.setProperty("--appearance-left-soft", rgbaFromHex(appearance.leftColor, mixedOpacity(appearance.leftOpacity, -0.18)));
  rootStyle.setProperty("--appearance-center-soft", rgbaFromHex(appearance.centerColor, mixedOpacity(appearance.centerOpacity, -0.18)));
  rootStyle.setProperty("--appearance-right-soft", rgbaFromHex(appearance.rightColor, mixedOpacity(appearance.rightOpacity, -0.18)));
  rootStyle.setProperty("--appearance-title-bg", rgbaFromHex(appearance.centerColor, mixedOpacity(0.34)));
  rootStyle.setProperty("--sidebar-bg", rgbaFromHex(appearance.leftColor, leftAlpha));
}

function setRangeValue(input, output, value, formatter = percentText) {
  if (input) input.value = String(value);
  if (output) output.textContent = formatter(value);
}

function setColorValue(input, output, value) {
  if (input) input.value = value;
  if (output) output.textContent = value;
}

function renderAppearanceSettings() {
  state.appearance = normalizeAppearance(state.appearance);
  const appearance = state.appearance;
  setRangeValue(els.appearanceGlobalOpacity, els.appearanceGlobalOpacityValue, appearance.globalOpacity);
  setRangeValue(els.appearanceBlur, els.appearanceBlurValue, appearance.glassBlur, (value) => `${Math.round(Number(value))}px`);
  setColorValue(els.appearanceLeftColor, els.appearanceLeftColorValue, appearance.leftColor);
  setRangeValue(els.appearanceLeftOpacity, els.appearanceLeftOpacityValue, appearance.leftOpacity);
  setColorValue(els.appearanceCenterColor, els.appearanceCenterColorValue, appearance.centerColor);
  setRangeValue(els.appearanceCenterOpacity, els.appearanceCenterOpacityValue, appearance.centerOpacity);
  setColorValue(els.appearanceRightColor, els.appearanceRightColorValue, appearance.rightColor);
  setRangeValue(els.appearanceRightOpacity, els.appearanceRightOpacityValue, appearance.rightOpacity);
}

function updateAppearance(key, value) {
  const next = { ...normalizeAppearance(state.appearance) };
  if (key.endsWith("Color")) {
    next[key] = normalizeHexColor(value, next[key]);
  } else if (key === "glassBlur") {
    next[key] = normalizeAppearanceNumber(value, 8, 46, next[key]);
  } else if (key === "globalOpacity") {
    next[key] = normalizeAppearanceNumber(value, 0.35, 1, next[key]);
  } else {
    next[key] = normalizeAppearanceNumber(value, 0.25, 1, next[key]);
  }
  state.appearance = next;
  state.appearancePreset = appearancePresetId;
  applyAppearance();
  renderAppearanceSettings();
  saveState();
}

function resetAppearance() {
  state.appearance = structuredClone(defaultAppearance);
  state.appearancePreset = appearancePresetId;
  applyAppearance();
  renderAppearanceSettings();
  saveState();
}

function activeConversation() {
  let conversation = state.conversations.find((item) => item.id === state.activeConversationId);
  if (!conversation) {
    conversation = state.conversations[0] || createConversation();
    if (!state.conversations.length) state.conversations.push(conversation);
    state.activeConversationId = conversation.id;
  }
  return conversation;
}

function currentProvider() {
  return state.providers.find((provider) => provider.id === state.selectedProviderId) || activeProvider();
}

function activeProvider() {
  return state.providers.find((provider) => provider.id === state.activeProviderId) || state.providers[0];
}

function providerById(providerId) {
  return state.providers.find((provider) => provider.id === providerId);
}

function activeModels() {
  return activeProvider().models || [];
}

function effectiveModel() {
  return state.customModel.trim() || state.activeModel || activeModels()[0] || "";
}

function providerModel(provider, preferredModel = "") {
  const models = provider?.models || [];
  if (preferredModel && (!models.length || models.includes(preferredModel))) return preferredModel;
  return models[0] || preferredModel || "";
}

function providerVisionModel(provider, preferredModel = "") {
  const models = provider?.models || [];
  if (preferredModel && models.includes(preferredModel) && providerSupportsImageInput(provider, preferredModel)) return preferredModel;
  return models.find((model) => providerSupportsImageInput(provider, model)) || providerModel(provider, preferredModel);
}

function routeConfig(kind) {
  if (kind === "vision") {
    return {
      providerKey: "visionRouteProviderId",
      modelKey: "visionRouteModel",
      defaultProviderId: defaultModelRouting.visionProviderId,
      defaultModel: defaultModelRouting.visionModel
    };
  }
  return {
    providerKey: "textRouteProviderId",
    modelKey: "textRouteModel",
    defaultProviderId: defaultModelRouting.textProviderId,
    defaultModel: defaultModelRouting.textModel
  };
}

function routeProvider(kind) {
  const config = routeConfig(kind);
  return providerById(state[config.providerKey]) || providerById(config.defaultProviderId) || activeProvider();
}

function routeModel(kind) {
  const config = routeConfig(kind);
  const provider = routeProvider(kind);
  const preferredModel = state[config.modelKey] || config.defaultModel;
  return kind === "vision" ? providerVisionModel(provider, preferredModel) : providerModel(provider, preferredModel);
}

function hasImageAttachment(attachments = []) {
  return attachments.some((attachment) => attachment.kind === "image");
}

function resolveModelRoute(attachments = []) {
  if (!state.autoModelRouting) {
    return {
      provider: activeProvider(),
      model: effectiveModel(),
      auto: false,
      kind: "manual",
      label: "当前模型"
    };
  }

  const kind = hasImageAttachment(attachments) ? "vision" : "text";
  const provider = routeProvider(kind);
  const model = routeModel(kind);
  return {
    provider,
    model,
    auto: true,
    kind,
    label: kind === "vision" ? "图片任务" : "文字任务"
  };
}

function currentTemperature() {
  const override = thinkingOptions[state.thinking]?.temperature;
  return override ?? Number(state.temperature || 0.7);
}

function memorySearchCorpus(memory) {
  return [
    memory.content,
    memoryTypes[memory.type]?.label,
    memoryScopes[memory.scope],
    memory.project,
    ...(memory.tags || [])
  ].filter(Boolean).join(" ").toLowerCase();
}

function memoryQueryTokens(query = "") {
  return String(query)
    .toLowerCase()
    .split(/[^a-z0-9_\u4e00-\u9fa5./-]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 80);
}

function memoryIntentBoost(memory, query = "") {
  const text = String(query).toLowerCase();
  let score = 0;
  if (/excel|xlsx|csv|表格|工资|账单|报价|字段|公式/.test(text) && ["file", "tool", "project"].includes(memory.type)) score += 7;
  if (/文件|目录|路径|工作区|项目|代码/.test(text) && ["project", "file", "tool"].includes(memory.type)) score += 5;
  if (/风格|语气|称呼|偏好|喜欢|默认|以后|每次/.test(text) && memory.type === "preference") score += 6;
  if (/怎么做|工具|调用|命令|自动化|python/.test(text) && memory.type === "tool") score += 5;
  if (state.workspaceRoot && memory.scope === "workspace") score += 3;
  return score;
}

function scoreMemory(memory, query = "") {
  const corpus = memorySearchCorpus(memory);
  const tokens = memoryQueryTokens(query);
  let score = memory.source === "manual" ? 8 : 4;
  score += memory.scope === "global" ? 2 : 0;
  score += memory.confidence * 4;
  score += memoryIntentBoost(memory, query);

  for (const tag of memory.tags || []) {
    if (String(query).includes(tag)) score += 8;
  }
  for (const token of tokens) {
    if (corpus.includes(token)) score += token.length > 4 ? 4 : 2;
  }

  if (memory.lastUsedAt) score += Math.max(0, 2 - (Date.now() - new Date(memory.lastUsedAt).getTime()) / 86400000 / 14);
  return score;
}

function selectRelevantMemories(query = "", limit = memoryInjectionLimit) {
  const activeMemories = normalizeMemories(state.memories || []).filter((memory) => memory.status === "active");
  if (!activeMemories.length) return [];
  const scored = activeMemories
    .map((memory) => ({ memory, score: scoreMemory(memory, query) }))
    .filter((item) => item.score >= 8 || item.memory.source === "manual")
    .sort((a, b) => b.score - a.score || new Date(b.memory.updatedAt) - new Date(a.memory.updatedAt));
  return scored.slice(0, limit).map((item) => item.memory);
}

function markMemoriesUsed(memories = []) {
  if (!memories.length) return;
  const usedIds = new Set(memories.map((memory) => memory.id));
  const time = nowIso();
  state.memories = normalizeMemories(state.memories || []).map((memory) =>
    usedIds.has(memory.id)
      ? { ...memory, lastUsedAt: time, useCount: Number(memory.useCount || 0) + 1 }
      : memory
  );
}

function memoryPromptText(query = "", selectedMemories = null) {
  const memories = selectedMemories || selectRelevantMemories(query);
  if (!memories.length) return "";
  return [
    "长期记忆策略：neo 会在本机全量保存记忆，但本轮只注入与当前任务最相关的少量记忆。当前用户明确要求优先级最高；如记忆冲突，以用户当前要求为准。",
    ...memories.map((memory, index) => {
      const type = memoryTypes[memory.type]?.label || "记忆";
      const scope = memoryScopes[memory.scope] || "全局";
      const tags = memory.tags?.length ? `；标签：${memory.tags.join("、")}` : "";
      return `${index + 1}. [${type} / ${scope}] ${memory.content}${tags}`;
    })
  ].join("\n");
}

function conversationSummaryPromptText(conversation = activeConversation()) {
  if (!conversation?.summary || conversation.messages.length < 12) return "";
  return `当前对话摘要：${conversation.summary}`;
}

function enabledSkillItems() {
  const enabled = new Set(normalizeEnabledSkills(state.enabledSkills));
  return skillLibrary.filter((skill) => enabled.has(skill.id));
}

function enabledToolIds() {
  const names = new Set();
  const consent = toolConsentForChat();
  for (const skill of enabledSkillItems()) {
    for (const toolName of skill.tools || []) {
      if (isToolNameAllowedByConsent(toolName, consent)) names.add(toolName);
    }
  }
  return [...names];
}

function enabledSkillPromptText() {
  const skills = enabledSkillItems();
  if (!skills.length) return "";
  return [
    "已启用技能：",
    ...skills.map((skill) => `- ${skill.name}：${skill.prompt}`)
  ].join("\n");
}

function localToolPromptText() {
  const tools = enabledToolIds();
  if (!tools.length) return "";
  const consent = toolConsentForChat();
  const toolLines = tools.map((toolName) => `- ${toolDescriptions[toolName] || toolName}`).join("\n");
  const notes = [
    "当前工作区是用户在 neo 桌面端选择的本地文件夹。路径参数使用工作区内的相对路径。",
    "用户上传的文件会保存在工作区的 neo Attachments 目录；当用户说\"这个文件\"\"刚才的表格\"时，优先指代最近一条用户消息里的附件 path。"
  ];
  if (consent.externalRead && consent.externalPaths.length) {
    notes.push(`已授权读取以下工作区外路径，可直接把这些绝对路径传给 read_file/read_excel_file：${consent.externalPaths.join("；")}。未列出的工作区外路径不能读取，应请用户授权。`);
  } else {
    notes.push("工作区外文件需要用户授权后才能读取；如果用户让你读取桌面、下载目录或绝对路径文件，先要求授权，不要声称已经读取。");
  }
  if (tools.includes("create_excel_file")) {
    notes.push("当用户要求\"生成 Excel\"\"创建 xlsx\"\"保存表格文件\"时，必须调用 create_excel_file 生成真实 .xlsx 文件，不要输出 Markdown/CSV 冒充文件。");
  }
  if (tools.includes("create_word_file")) {
    notes.push("当用户要求\"生成 Word\"\"创建 docx\"\"导出 Word 文档\"时，必须调用 create_word_file 生成真实 .docx 文件，不要用 write_file 写 Markdown 冒充 Word。");
  }
  if (tools.includes("create_ppt_file")) {
    notes.push("当用户要求\"生成 PPT\"\"创建 pptx\"\"做演示文稿\"时，必须调用 create_ppt_file 生成真实 .pptx 文件；先做基础封面、目录、内容页、总结页即可。");
  }
  if (tools.includes("export_image")) {
    notes.push("当用户要求\"生成图片\"\"输出 PNG/JPG\"\"做海报/封面/卡片/图片版\"时，先用 write_file 写入 HTML 或 SVG 源文件，再调用 export_image 导出真实 PNG/JPG；不要让用户手动截图或另存。");
  }
  if (tools.includes("clean_table_file") || tools.includes("clean_table_files")) {
    notes.push("当用户要求\"清洗表格\"\"洗表\"\"整理 CSV/Excel\"\"去重/去空行/修正金额日期\"时，优先调用表格清洗工具，并默认输出新文件，不要覆盖原始表格。");
  }
  if (tools.includes("read_excel_file")) {
    notes.push("当用户要求读取或分析 Excel/CSV 文件时，优先调用 inspect_office_file 或 read_excel_file。");
  }
  if (tools.includes("inspect_office_file")) {
    notes.push("处理 Excel、CSV、Word、PDF、PPT 附件时，先查看附件 path 和摘要；需要完整结构时调用 inspect_office_file，并根据 officeTask 的失败步骤说明未完成原因。");
  }
  if (tools.includes("search_web") || tools.includes("read_web_page")) {
    notes.push("当用户要求查询网页、读取链接或获取网页资料时，可以使用 search_web 和 read_web_page；回答中保留来源 URL。");
  }
  if (tools.includes("download_url")) {
    notes.push("当用户要求下载网页文件时，使用 download_url 保存到工作区，并告诉用户保存路径。");
  }
  if (tools.includes("open_desktop_app")) {
    notes.push("电脑操作当前支持打开应用、网页、工作区文件和通知；不要声称可以自动点击软件界面内部按钮。");
  }
  if (tools.includes("run_command")) {
    notes.push("本地命令工具的真实名称是 run_command；不要输出 run_local_command、DSML、tool_calls 或 invoke 标记给用户看。生成文件时优先使用专用文件工具，除非用户明确要求运行命令。");
  }
  if (tools.some((toolName) => ["write_file", "export_image", "create_excel_file", "create_word_file", "create_ppt_file", "clean_table_file", "clean_table_files"].includes(toolName))) {
    notes.push("当你生成、清洗或修改文件后，在回复最后用一句话列出文件路径，方便 neo 放进成果区。");
    notes.push("只有本轮工具结果返回 ok:true 且输出文件通过验证后，才能说“已保存/已导出/已创建”。如果工具失败或没有回执，必须如实说未完成。");
  }
  return [
    "本地工具能力：你现在可以调用以下已启用工具直接操作用户本地工作区，无需解释\"无法生成文件\"：",
    toolLines,
    "",
    ...notes
  ].join("\n");
}

function buildSystemPrompt(provider, model, memoryQuery = "", selectedMemories = null) {
  const thinking = thinkingOptions[state.thinking] || thinkingOptions.balanced;
  return [
    `运行时上下文：neo 正在通过「${provider.name || '未命名供应商'}」调用模型「${model}」。`,
    `运行时上下文优先级最高：即使历史消息、旧回复或自定义提示提到其他供应商/模型，也必须以本次运行时上下文为准。`,
    `当前思考强度：${thinking.label}。${thinking.prompt}`,
    `当用户询问"你是什么模型""调用了哪个 API""当前模型是什么"时，必须直接说明当前供应商和模型，不要只回答 neo。neo 是桌面应用外壳，不是底层模型名称。`,
    `工具调用真实性：只有 neo 工具事件返回成功才算已执行。禁止在回复正文中输出 DSML、tool_calls、invoke、run_local_command 等伪工具调用；如果没有本轮真实工具回执，不要声称已经创建、保存、导出或运行。文件任务必须以工具结果和文件验证为准。`,
    `文件处理：当用户消息中出现 <attachment name="..." path="...">...</attachment> 标签时，说明文件已经被 neo 保存到本地工作区。标签内会包含文件名、工作区相对路径、解析摘要和内容预览。你可以直接根据这些内容回答，不要说"无法访问本地文件"。如果需要更完整内容，Excel/CSV/Word/PDF/PPT 优先调用 inspect_office_file，表格也可调用 read_excel_file。图片附件在模型支持多模态时会同时包含图片数据。`,
    state.agentTools ? localToolPromptText() : "",
    enabledSkillPromptText(),
    conversationSummaryPromptText(),
    memoryPromptText(memoryQuery, selectedMemories),
    state.systemPrompt || ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function renderAll() {
  applyAppearance();
  applyLayout();
  renderTaskTemplates();
  renderConversations();
  renderHistoryState();
  renderMessages();
  renderProviderList();
  renderSettingsForm();
  renderSelectors();
  renderModelOverview();
  renderProviderLibrary();
  renderSkillLibrary();
  renderMemoryList();
  renderWorkspacePanel();
}

function applyLayout() {
  const compactSidebar = window.matchMedia("(max-width: 680px)").matches;
  const compactWorkspace = window.matchMedia("(max-width: 900px)").matches;
  const sidebarWidth = compactSidebar ? 64 : state.layout.sidebarWidth;
  const showSidebar = state.sidebarOpen !== false;
  const showWorkspace = state.workspaceOpen && !compactWorkspace;
  document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
  document.documentElement.style.setProperty("--right-width", `${state.layout.rightWidth}px`);
  els.appShell.classList.toggle("sidebar-closed", !showSidebar);
  els.appShell.classList.toggle("workspace-closed", !showWorkspace);
  document.body.classList.toggle("sidebar-closed", !showSidebar);
  document.body.classList.toggle("workspace-closed", !showWorkspace);
  els.sidebarToggleBtn?.classList.toggle("active", showSidebar);
  els.sidebarToggleBtn?.setAttribute("aria-pressed", String(showSidebar));
  els.sidebarToggleBtn?.setAttribute("title", showSidebar ? "收起左侧栏" : "展开左侧栏");
  els.sidebarToggleBtn?.setAttribute("aria-label", showSidebar ? "收起左侧栏" : "展开左侧栏");
  els.workspaceToggleBtn?.classList.toggle("active", state.workspaceOpen);
  els.workspaceToggleBtn?.setAttribute("aria-pressed", String(state.workspaceOpen));
  if (!document.body.classList.contains("layout-ready")) {
    requestAnimationFrame(() => document.body.classList.add("layout-ready"));
  }
}

function renderConversations() {
  const sorted = [...state.conversations]
    .filter((c) => !c.archived)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  els.conversationList.innerHTML = "";
  for (const conversation of sorted) {
    const item = document.createElement("div");
    item.className = `conversation-item${conversation.id === state.activeConversationId ? " active" : ""}`;
    item.innerHTML = `
      <span class="conversation-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h.01M9 7h10M5 12h.01M9 12h10M5 17h.01M9 17h10"/></svg></span>
      <span class="conversation-title">${escapeHtml(conversation.title || "新对话")}</span>
      <span class="conversation-time">${escapeHtml(relativeTime(conversation.updatedAt))}</span>
      <button class="conv-quote-btn" type="button" title="引用此对话" data-id="${escapeAttr(conversation.id)}">↩</button>
      <button class="conv-archive-btn" type="button" title="归档" data-id="${escapeAttr(conversation.id)}">⬇</button>
    `;
    item.addEventListener("click", (e) => {
      if (e.target.closest(".conv-archive-btn, .conv-quote-btn")) return;
      state.activeConversationId = conversation.id;
      saveState();
      renderConversations();
      renderMessages();
    });
    item.querySelector(".conv-quote-btn").addEventListener("click", () => {
      quoteConversation(conversation.id);
    });
    item.querySelector(".conv-archive-btn").addEventListener("click", () => {
      archiveConversation(conversation.id);
    });
    els.conversationList.append(item);
  }
}

function archiveConversation(id) {
  const conv = state.conversations.find((c) => c.id === id);
  if (!conv) return;
  conv.archived = true;
  if (state.activeConversationId === id) {
    const next = state.conversations.find((c) => !c.archived);
    if (next) {
      state.activeConversationId = next.id;
    } else {
      const newConv = createConversation();
      state.conversations.unshift(newConv);
      state.activeConversationId = newConv.id;
    }
    renderMessages();
  }
  saveState();
  renderConversations();
  renderArchiveList();
}

function unarchiveConversation(id) {
  const conv = state.conversations.find((c) => c.id === id);
  if (!conv) return;
  conv.archived = false;
  saveState();
  renderConversations();
  renderArchiveList();
}

function deleteConversation(id) {
  state.conversations = state.conversations.filter((c) => c.id !== id);
  if (!state.conversations.length) {
    const newConv = createConversation();
    state.conversations.push(newConv);
    state.activeConversationId = newConv.id;
  } else if (state.activeConversationId === id) {
    const next = state.conversations.find((c) => !c.archived) || state.conversations[0];
    state.activeConversationId = next.id;
  }
  saveState();
  renderConversations();
  renderArchiveList();
  renderMessages();
}

function renderArchiveList() {
  const list = document.getElementById("archiveList");
  if (!list) return;
  const archived = state.conversations.filter((c) => c.archived);
  list.innerHTML = "";
  if (!archived.length) {
    list.innerHTML = `<div class="archive-empty">暂无归档对话</div>`;
    return;
  }
  for (const conv of archived) {
    const item = document.createElement("div");
    item.className = "archive-item";
    item.innerHTML = `
      <span class="archive-title">${escapeHtml(conv.title || "新对话")}</span>
      <div class="archive-actions">
        <button class="ghost-button" data-action="unarchive" data-id="${escapeAttr(conv.id)}" type="button">取消归档</button>
        <button class="ghost-button danger" data-action="delete" data-id="${escapeAttr(conv.id)}" type="button">删除</button>
      </div>
    `;
    item.querySelector("[data-action='unarchive']").addEventListener("click", () => unarchiveConversation(conv.id));
    item.querySelector("[data-action='delete']").addEventListener("click", () => {
      if (window.confirm(`确认删除「${conv.title || "新对话"}」？此操作不可撤销。`)) deleteConversation(conv.id);
    });
    list.append(item);
  }
}

function renderHistoryState() {
  const collapsed = Boolean(state.historyCollapsed);
  els.historyPane.classList.toggle("collapsed", collapsed);
  els.toggleHistoryBtn.textContent = collapsed ? "展开" : "收起";
  els.toggleHistoryBtn.setAttribute("aria-expanded", String(!collapsed));
}

function toggleHistory() {
  state.historyCollapsed = !state.historyCollapsed;
  saveState();
  renderHistoryState();
}

function renderMessages() {
  const messages = activeConversation().messages;
  const workspaceCard = document.querySelector(".workspace-card");
  workspaceCard.classList.toggle("empty", messages.length === 0);
  workspaceCard.classList.toggle("has-messages", messages.length > 0);
  els.heroBlock.classList.toggle("hidden", messages.length > 0);
  els.messageList.innerHTML = "";
  for (const message of messages) appendMessageElement(message);
  els.messageList.scrollTop = els.messageList.scrollHeight;
}

function agentAvatarHtml() {
  const avatarUrl = state.agentAvatar || defaultAgentAvatar;
  const defaultClass = state.agentAvatar ? "" : " default-agent-logo";
  return `<img class="${defaultClass.trim()}" src="${escapeAttr(avatarUrl)}" alt="avatar" />`;
}

function messageAttachmentsHtml(attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length) return "";
  const cards = attachments.map((attachment) => {
    const previewHtml = attachment.kind === "image" && attachment.dataUrl
      ? `<img class="message-attachment-thumb" src="${escapeAttr(attachment.dataUrl)}" alt="" />`
      : `<span class="message-attachment-icon">${fileIcon(attachment.kind)}</span>`;
    return `
    <div class="message-attachment-card${attachment.kind === "image" ? " image-card" : ""}">
      ${previewHtml}
      <span class="message-attachment-main">
        <strong>${escapeHtml(attachment.name || "附件")}</strong>
        <small>${escapeHtml([attachment.path, formatBytes(Number(attachment.size || 0))].filter(Boolean).join(" · "))}</small>
        ${attachment.summary ? `<em>${escapeHtml(attachment.summary)}</em>` : ""}
      </span>
    </div>
  `;
  }).join("");
  return `<div class="message-attachments">${cards}</div>`;
}

function messageReferencesHtml(references = []) {
  if (!Array.isArray(references) || !references.length) return "";
  const cards = references.slice(0, 6).map((ref) => `
    <div class="message-reference-card">
      <span>${escapeHtml(ref.sourceTitle || "引用")}</span>
      <small>${escapeHtml(cleanReferenceText(ref.content, 120))}</small>
    </div>
  `).join("");
  return `<div class="message-references">${cards}</div>`;
}

function conversationReferenceContent(conversation) {
  if (!conversation) return "";
  if (conversation.summary) return conversation.summary;
  return (conversation.messages || [])
    .filter((message) => ["user", "assistant"].includes(message.role))
    .slice(-8)
    .map((message) => `${roleLabel(message.role)}：${cleanReferenceText(message.content, 240)}`)
    .join("\n");
}

function addPendingReference(reference) {
  const content = cleanReferenceText(reference.content, 2200);
  if (!content) return;
  const normalized = {
    id: reference.id || id("ref"),
    type: reference.type || "message",
    sourceTitle: reference.sourceTitle || "对话引用",
    role: reference.role || "",
    content
  };
  pendingReferences = [normalized, ...pendingReferences.filter((item) => item.id !== normalized.id)].slice(0, 6);
  renderQuoteBar();
  els.promptInput?.focus();
  setStatus("已加入引用", normalized.sourceTitle, "complete");
}

function removePendingReference(referenceId) {
  pendingReferences = pendingReferences.filter((item) => item.id !== referenceId);
  renderQuoteBar();
}

function renderQuoteBar() {
  if (!els.quoteBar) return;
  if (!pendingReferences.length) {
    els.quoteBar.classList.add("hidden");
    els.quoteBar.innerHTML = "";
    return;
  }
  els.quoteBar.classList.remove("hidden");
  els.quoteBar.innerHTML = pendingReferences.map((ref) => `
    <button class="quote-chip" data-ref-id="${escapeAttr(ref.id)}" type="button" title="移除此引用">
      <strong>${escapeHtml(ref.sourceTitle || "引用")}</strong>
      <span>${escapeHtml(cleanReferenceText(ref.content, 64))}</span>
      <em>×</em>
    </button>
  `).join("");
  els.quoteBar.querySelectorAll(".quote-chip").forEach((button) => {
    button.addEventListener("click", () => removePendingReference(button.dataset.refId));
  });
}

function quoteConversation(conversationId) {
  const conversation = state.conversations.find((item) => item.id === conversationId);
  if (!conversation) return;
  addPendingReference({
    id: `conversation:${conversation.id}:${conversation.updatedAt || ""}`,
    type: "conversation",
    sourceTitle: conversation.title || "历史对话",
    content: conversationReferenceContent(conversation)
  });
}

function quoteMessage(messageIndex) {
  const conversation = activeConversation();
  const message = conversation.messages[messageIndex];
  if (!message || !["user", "assistant"].includes(message.role)) return;
  addPendingReference({
    id: `message:${conversation.id}:${messageIndex}:${message.role}`,
    type: "message",
    sourceTitle: `${conversation.title || "当前对话"} · ${roleLabel(message.role)}`,
    role: message.role,
    content: message.content || ""
  });
}

function appendMessageElement(message) {
  const role = message.role;
  const wrapper = document.createElement("article");
  wrapper.className = `message ${role}`;
  const requestLine = message.request ? requestModelText(message.request) : "";
  const attachmentsHtml = messageAttachmentsHtml(message.attachments);
  const referencesHtml = messageReferencesHtml(message.references);
  const currentMessages = activeConversation().messages || [];
  const messageIndex = currentMessages.indexOf(message);
  const quoteAction = ["user", "assistant"].includes(role) && messageIndex >= 0
    ? `<button class="message-quote-btn" data-message-index="${messageIndex}" type="button" title="引用这条消息">引用</button>`
    : "";

  if (role === "assistant") {
    const agentLabel = state.agentName || "neo";
    if (message._streaming) wrapper.classList.add("_streaming");
    const content = cleanVisibleText(message.content || "");
    const isStreaming = Boolean(message._streaming);
    const isWaitingForStream = isStreaming && !content.trim();
    const bubbleClass = `bubble${isStreaming && !isWaitingForStream ? " has-streamed-content" : ""}`;
    const liveAttr = isStreaming ? ' aria-live="polite"' : "";
    const bubbleContent = isWaitingForStream
      ? `<span class="streaming-dots" aria-hidden="true"><span></span><span></span><span></span></span>`
      : renderAssistantMarkdown(content);
    wrapper.innerHTML = `
      <div class="msg-avatar">${agentAvatarHtml()}</div>
      <div class="msg-body">
        <div class="meta"><span>${escapeHtml(agentLabel)}</span>${quoteAction}</div>
        <div class="${bubbleClass}"${liveAttr}>${bubbleContent}</div>
        ${referencesHtml}
        ${requestLine ? `<div class="request-meta">${escapeHtml(requestLine)}</div>` : ""}
      </div>
    `;
  } else {
    const label = role === "user" ? "你" : "错误";
    wrapper.innerHTML = `
      <div class="meta"><span>${label}</span>${quoteAction}</div>
      <div class="bubble">${escapeHtml(message.content || (message.attachments?.length ? "已发送附件" : ""))}</div>
      ${referencesHtml}
      ${attachmentsHtml}
      ${requestLine ? `<div class="request-meta">${escapeHtml(requestLine)}</div>` : ""}
    `;
  }
  wrapper.querySelector(".message-quote-btn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    quoteMessage(Number(event.currentTarget.dataset.messageIndex));
  });
  els.messageList.append(wrapper);
}

function renderProviderList() {
  els.providerList.innerHTML = "";
  for (const provider of state.providers) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `provider-item${provider.id === state.selectedProviderId ? " active" : ""}`;
    const hasKey = Boolean(provider.apiKey || provider.protocol === "mock");
    button.title = provider.baseUrl || provider.protocol || "";
    button.innerHTML = `
      <span class="provider-item-main">
        <strong>${escapeHtml(provider.name)}</strong>
      </span>
      <span class="key-state${hasKey ? "" : " missing"}">${hasKey ? "可用" : "不可用"}</span>
    `;
    button.addEventListener("click", () => selectProviderForEditing(provider.id));
    els.providerList.append(button);
  }
}

function selectProviderForEditing(providerId) {
  state.selectedProviderId = providerId;
  if (!state.activeProviderId) state.activeProviderId = providerId;
  saveState();
  renderProviderList();
  renderSettingsForm();
}

function renderSettingsForm() {
  const provider = currentProvider();
  normalizeProviderApiMode(provider);
  els.providerNameInput.value = provider.name || "";
  els.protocolSelect.value = provider.protocol || "openai";
  if (els.apiModeSelect) {
    const supportsResponses = isOfficialOpenAIProvider(provider);
    els.apiModeSelect.value = normalizedApiMode(provider);
    els.apiModeSelect.disabled = !supportsResponses;
    els.apiModeSelect.title = supportsResponses
      ? "OpenAI 官方接口可切换到 Responses API 增强模式"
      : "国内 OpenAI-compatible 供应商默认继续使用 Chat Completions 兼容模式";
  }
  els.baseUrlInput.value = provider.baseUrl || "";
  els.apiKeyInput.value = provider.apiKey || "";
  els.modelsInput.value = (provider.models || []).join("\n");
  const agentNameInput = document.getElementById("agentNameInput");
  if (!agentProfileDirty) {
    draftAgentName = state.agentName || "neo";
    draftAgentAvatar = state.agentAvatar || "";
  }
  if (agentNameInput) agentNameInput.value = draftAgentName || "neo";
  updateAvatarPreview(draftAgentAvatar);
  setAgentProfileFeedback(agentProfileDirty ? "有未保存的形象更改" : "");
  renderMemoryList();
  renderArchiveList();
  els.roleSelect.value = state.role;
  if (els.responseStyleSelect) els.responseStyleSelect.value = state.responseStyle || "direct";
  els.systemPromptInput.value = state.systemPrompt;
  els.temperatureInput.value = state.temperature;
  els.maxTokensInput.value = state.maxTokens || "";
  els.agentToolsToggle.checked = state.agentTools;
  const consent = toolConsentForChat();
  if (els.externalReadToggle) els.externalReadToggle.checked = consent.externalRead;
  if (els.externalPathsInput) els.externalPathsInput.value = (consent.externalPaths || []).join("\n");
  renderRoutingControls();
  renderAppearanceSettings();
  renderSkillLibrary();
}

function providerSelectOptions(selectedProviderId) {
  return state.providers
    .map((provider) => `<option value="${escapeAttr(provider.id)}"${provider.id === selectedProviderId ? " selected" : ""}>${escapeHtml(provider.name || provider.id)}</option>`)
    .join("");
}

function modelSelectOptions(providerId, selectedModel, kind = "text") {
  const provider = providerById(providerId) || activeProvider();
  const rawModels = provider.models || [];
  const visionModels = kind === "vision" ? rawModels.filter((model) => providerSupportsImageInput(provider, model)) : [];
  const models = visionModels.length ? visionModels : rawModels;
  if (!models.length) return `<option value="">无预设模型</option>`;
  const normalizedModel = kind === "vision" ? providerVisionModel(provider, selectedModel) : providerModel(provider, selectedModel);
  return models
    .map((model) => `<option value="${escapeAttr(model)}"${model === normalizedModel ? " selected" : ""}>${escapeHtml(model)}</option>`)
    .join("");
}

function routeSummaryText() {
  const textProvider = routeProvider("text");
  const visionProvider = routeProvider("vision");
  return state.autoModelRouting
    ? `文字/本地任务用 ${textProvider.name || "未命名"} · ${routeModel("text")}；图片任务用 ${visionProvider.name || "未命名"} · ${routeModel("vision")}`
    : "已关闭自动切换，发送时使用上方当前模型。";
}

function compactEndpointText(provider = {}) {
  if (!provider.baseUrl) return provider.protocol === "mock" ? "本地演示" : "local";
  try {
    return new URL(provider.baseUrl).host || provider.baseUrl;
  } catch {
    return provider.baseUrl;
  }
}

function renderModelSettingsSummary() {
  const provider = activeProvider();
  const textProvider = routeProvider("text");
  const visionProvider = routeProvider("vision");
  const hasKey = Boolean(provider.apiKey || provider.protocol === "mock");
  const model = effectiveModel() || "未选择模型";
  if (els.modelSettingsActiveProviderName) els.modelSettingsActiveProviderName.textContent = provider.name || "未命名供应商";
  if (els.modelSettingsActiveModelName) els.modelSettingsActiveModelName.textContent = model;
  if (els.modelSettingsRouteState) els.modelSettingsRouteState.textContent = state.autoModelRouting === false ? "关闭" : "开启";
  if (els.modelSettingsRouteSummary) {
    els.modelSettingsRouteSummary.textContent = state.autoModelRouting === false
      ? "所有请求使用当前模型"
      : `文字 ${textProvider.name || "未命名"} / 图片 ${visionProvider.name || "未命名"}`;
  }
  if (els.modelSettingsKeyState) {
    els.modelSettingsKeyState.textContent = provider.protocol === "mock" ? "本地演示" : hasKey ? "Key 已配置" : "缺少 API Key";
  }
  if (els.modelSettingsEndpoint) els.modelSettingsEndpoint.textContent = compactEndpointText(provider);
}

function renderRoutingControls() {
  if (!els.autoModelRoutingSelect) return;
  const textProvider = routeProvider("text");
  const visionProvider = routeProvider("vision");
  state.textRouteProviderId = textProvider.id;
  state.visionRouteProviderId = visionProvider.id;
  state.textRouteModel = routeModel("text");
  state.visionRouteModel = routeModel("vision");

  els.autoModelRoutingSelect.value = state.autoModelRouting === false ? "false" : "true";
  els.textRouteProviderSelect.innerHTML = providerSelectOptions(state.textRouteProviderId);
  els.visionRouteProviderSelect.innerHTML = providerSelectOptions(state.visionRouteProviderId);
  els.textRouteModelSelect.innerHTML = modelSelectOptions(state.textRouteProviderId, state.textRouteModel, "text");
  els.visionRouteModelSelect.innerHTML = modelSelectOptions(state.visionRouteProviderId, state.visionRouteModel, "vision");
  els.textRouteProviderSelect.disabled = !state.autoModelRouting;
  els.textRouteModelSelect.disabled = !state.autoModelRouting;
  els.visionRouteProviderSelect.disabled = !state.autoModelRouting;
  els.visionRouteModelSelect.disabled = !state.autoModelRouting;
  els.autoRouteHint.textContent = routeSummaryText();
  renderModelSettingsSummary();
}

function renderSelectors() {
  const provider = activeProvider();
  const models = provider.models || [];
  if (!state.activeModel || !models.includes(state.activeModel)) state.activeModel = models[0] || "";

  const providerOptions = state.providers
    .map((item) => `<option value="${escapeAttr(item.id)}"${item.id === state.activeProviderId ? " selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
  const modelOptions = models.length
    ? models
        .map((model) => `<option value="${escapeAttr(model)}"${model === state.activeModel ? " selected" : ""}>${escapeHtml(model)}</option>`)
        .join("")
    : `<option value="">无预设模型</option>`;

  els.activeProviderSelect.innerHTML = providerOptions;
  els.activeModelSelect.innerHTML = modelOptions;
  els.customModelInput.value = state.customModel;
  if (els.thinkingSelect) els.thinkingSelect.value = state.thinking;
  els.activeProviderName.textContent = provider.name || "未命名";
  els.activeModelName.textContent = effectiveModel() || "未选择";
  if (els.activeThinkingName) els.activeThinkingName.textContent = thinkingOptions[state.thinking]?.label || "平衡";
  renderRoutingControls();
  renderModelSettingsSummary();
  saveState();
}

function renderModelOverview() {
  els.modelOverview.innerHTML = "";
  for (const provider of state.providers) {
    const card = document.createElement("div");
    card.className = `model-card${provider.id === state.activeProviderId ? " active" : ""}`;
    const models = provider.models || [];
    card.innerHTML = `
      <div class="model-card-head">
        <strong>${escapeHtml(provider.name || "未命名")}</strong>
        <span class="key-state${provider.apiKey || provider.protocol === "mock" ? "" : " missing"}">${provider.apiKey || provider.protocol === "mock" ? "Key 已配置" : "缺少 Key"}</span>
      </div>
      <div class="model-card-meta">${escapeHtml(provider.protocol || "openai")} · ${escapeHtml(apiModeLabel(provider))} · ${escapeHtml(provider.baseUrl || "local")} · ${models.length} 个模型</div>
      <div class="model-card-models">${escapeHtml(models.join("、") || "未配置模型")}</div>
    `;
    els.modelOverview.append(card);
  }
}

function renderProviderLibrary() {
  if (!els.providerLibraryList) return;
  els.providerLibraryList.innerHTML = "";
  for (const provider of [...providerLibrary].sort((a, b) => a.rank - b.rank)) {
    const configured = state.providers.some((item) => item.id === provider.id);
    const active = state.activeProviderId === provider.id;
    const card = document.createElement("article");
    card.className = `provider-library-card${active ? " active" : ""}`;
    card.innerHTML = `
      <div class="provider-rank">#${provider.rank}</div>
      <div class="provider-library-main">
        <div class="provider-library-head">
          <div>
            <strong>${escapeHtml(provider.name)}</strong>
            <span>${escapeHtml(provider.family)}</span>
          </div>
          <span class="provider-pill">${escapeHtml(provider.protocol === "openai" ? apiModeLabel(provider) : provider.protocol)}</span>
        </div>
        <div class="provider-library-url">
          <span>${escapeHtml(provider.baseUrl)}</span>
          <button class="ghost-button small" data-action="copy-url" data-provider="${escapeAttr(provider.id)}" type="button">复制</button>
        </div>
        <div class="provider-library-models">${escapeHtml(provider.models.join("、"))}</div>
        <p>${escapeHtml(provider.rankNote)}</p>
        <div class="provider-library-actions">
          <a class="ghost-button small" href="${escapeAttr(provider.docsUrl)}" target="_blank" rel="noreferrer">API 文档</a>
          <a class="ghost-button small" href="${escapeAttr(provider.keyUrl)}" target="_blank" rel="noreferrer">获取 Key</a>
          <button class="primary-button small" data-action="apply-provider" data-provider="${escapeAttr(provider.id)}" type="button">
            ${active ? "当前使用" : configured ? "套用配置" : "添加并套用"}
          </button>
        </div>
      </div>
    `;
    card.querySelector("[data-action='copy-url']").addEventListener("click", () => copyProviderBaseUrl(provider));
    card.querySelector("[data-action='apply-provider']").addEventListener("click", () => applyProviderFromLibrary(provider));
    els.providerLibraryList.append(card);
  }
}

function providerFromLibraryTemplate(template, existing = {}) {
  return {
    id: template.id,
    name: template.name.replace(/^Google\s+/, "").replace(/\s*\/\s*Qwen$/, ""),
    protocol: template.protocol,
    apiMode: template.apiMode || "chat_completions",
    baseUrl: template.baseUrl,
    apiKey: existing.apiKey || "",
    models: [...template.models]
  };
}

async function copyProviderBaseUrl(provider) {
  try {
    await navigator.clipboard.writeText(provider.baseUrl);
    setProviderLibraryFeedback(`已复制 ${provider.name} 的 API 地址`, "ok");
  } catch {
    setProviderLibraryFeedback("复制失败，请手动选择地址复制", "error");
  }
}

function applyProviderFromLibrary(template) {
  const index = state.providers.findIndex((provider) => provider.id === template.id);
  const provider = providerFromLibraryTemplate(template, index >= 0 ? state.providers[index] : {});
  if (index >= 0) state.providers[index] = { ...state.providers[index], ...provider };
  else state.providers.push(provider);

  state.selectedProviderId = provider.id;
  state.activeProviderId = provider.id;
  state.activeModel = provider.models[0] || "";
  state.customModel = "";
  saveState();
  renderAll();
  setProviderLibraryFeedback(`已套用 ${template.name}，请填写或确认 API Key`, "ok");
  setSaveFeedback("已从供应商库套用配置", "ok");
}

function setProviderLibraryFeedback(text, type = "") {
  if (!els.providerLibraryFeedback) return;
  els.providerLibraryFeedback.textContent = text;
  els.providerLibraryFeedback.className = `provider-library-feedback ${type}`;
}

function setSkillLibraryFeedback(text, type = "") {
  if (!els.skillLibraryFeedback) return;
  els.skillLibraryFeedback.textContent = text;
  els.skillLibraryFeedback.className = `provider-library-feedback ${type}`;
}

function renderSkillLibrary() {
  if (!els.skillLibraryList) return;
  const enabled = new Set(normalizeEnabledSkills(state.enabledSkills));
  state.enabledSkills = [...enabled];
  els.skillLibraryList.innerHTML = "";
  for (const skill of skillLibrary) {
    const checked = enabled.has(skill.id);
    const card = document.createElement("article");
    card.className = `skill-card${checked ? " active" : ""}${skill.id === "local-command" ? " caution" : ""}`;
    card.innerHTML = `
      <label class="skill-toggle">
        <input type="checkbox" data-skill-id="${escapeAttr(skill.id)}"${checked ? " checked" : ""} />
        <span class="skill-icon">${escapeHtml(skill.icon)}</span>
        <span class="skill-main">
          <span class="skill-head">
            <strong>${escapeHtml(skill.name)}</strong>
            <em>${escapeHtml(skill.recommendation)}</em>
          </span>
          <span class="skill-meta">${escapeHtml(skill.category)} · ${escapeHtml((skill.tools || []).map(formatToolName).join("、") || "提示词")}</span>
          <span class="skill-summary">${escapeHtml(skill.summary)}</span>
        </span>
      </label>
    `;
    card.querySelector("input").addEventListener("change", (event) => toggleSkill(skill.id, event.target.checked));
    els.skillLibraryList.append(card);
  }
}

function toggleSkill(skillId, enabled) {
  const current = new Set(normalizeEnabledSkills(state.enabledSkills));
  if (enabled) current.add(skillId);
  else current.delete(skillId);
  if (enabled && !enableAgentToolsForSkills([...current], { ask: true })) {
    renderSkillLibrary();
    return;
  }
  state.enabledSkills = [...current];
  saveState();
  renderSettingsForm();
  setSkillLibraryFeedback(enabled ? "已启用技能" : "已关闭技能", "ok");
}

function enableRecommendedSkills() {
  const recommendedSkills = defaultEnabledSkillIds();
  if (!enableAgentToolsForSkills(recommendedSkills, { ask: true })) return;
  state.enabledSkills = recommendedSkills;
  saveState();
  renderSettingsForm();
  setSkillLibraryFeedback("已启用推荐技能组合", "ok");
}

function updateSelectedProviderFromForm() {
  try {
    const provider = currentProvider();
    provider.name = els.providerNameInput.value.trim() || "未命名";
    provider.protocol = els.protocolSelect.value;
    provider.baseUrl = els.baseUrlInput.value.trim();
    provider.apiKey = els.apiKeyInput.value.trim();
    provider.apiMode = isOfficialOpenAIProvider(provider) ? (els.apiModeSelect?.value || "chat_completions") : "chat_completions";
    normalizeProviderApiMode(provider);
    provider.models = els.modelsInput.value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (provider.id === state.activeProviderId && provider.models.length && !provider.models.includes(state.activeModel)) {
      state.activeModel = provider.models[0];
      state.customModel = "";
    }
    setSaveFeedback("已保存配置", "ok");
    flashButton(els.saveSettingsBtn, "已保存");
    saveState();
    renderAll();
  } catch (error) {
    setSaveFeedback(error.message, "error");
  }
}

function setSaveFeedback(text, type = "") {
  els.saveFeedback.textContent = text;
  els.saveFeedback.className = `save-feedback ${type}`;
}

function setAgentProfileFeedback(text, type = "") {
  if (!els.agentProfileFeedback) return;
  els.agentProfileFeedback.textContent = text;
  els.agentProfileFeedback.className = `save-feedback ${type}`;
}

function getAgentProfileChannel() {
  if (agentProfileChannel || typeof BroadcastChannel === "undefined") return agentProfileChannel;
  try {
    agentProfileChannel = new BroadcastChannel(agentProfileChannelName);
  } catch {
    agentProfileChannel = null;
  }
  return agentProfileChannel;
}

function broadcastAgentProfile(source = "main") {
  const channel = getAgentProfileChannel();
  if (!channel) return;
  channel.postMessage({
    type: "agent-profile",
    source,
    agentName: state.agentName || "neo",
    agentAvatar: state.agentAvatar || ""
  });
}

function applyExternalAgentProfile(profile = {}) {
  const nextName = typeof profile.agentName === "string" ? (profile.agentName.trim() || "neo") : state.agentName;
  const nextAvatar = typeof profile.agentAvatar === "string" ? profile.agentAvatar : state.agentAvatar;
  if ((state.agentName || "neo") === nextName && (state.agentAvatar || "") === nextAvatar) return;

  state.agentName = nextName;
  state.agentAvatar = nextAvatar || "";
  draftAgentName = state.agentName;
  draftAgentAvatar = state.agentAvatar;
  agentProfileDirty = false;
  saveState();
  renderMessages();
  updateAvatarPreview(state.agentAvatar);
  if (agentNameInput) agentNameInput.value = state.agentName;
  setAgentProfileFeedback("已同步桌宠形象", "ok");
}

function setupAgentProfileSync() {
  const channel = getAgentProfileChannel();
  if (channel) {
    channel.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === "agent-profile" && data.source !== "main") {
        applyExternalAgentProfile(data);
      }
    };
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== legacyStorageKey) return;
    try {
      const nextState = JSON.parse(event.newValue || "{}");
      applyExternalAgentProfile({
        agentName: nextState.agentName,
        agentAvatar: nextState.agentAvatar
      });
    } catch {
      // 忽略无法解析的旧状态。
    }
  });
}

function markAgentProfileDirty() {
  agentProfileDirty = true;
  setAgentProfileFeedback("有未保存的形象更改");
}

function saveAgentProfile() {
  state.agentName = (draftAgentName || "").trim() || "neo";
  state.agentAvatar = draftAgentAvatar || "";
  agentProfileDirty = false;
  saveState();
  renderMessages();
  updateAvatarPreview(state.agentAvatar);
  broadcastAgentProfile("main");
  setAgentProfileFeedback("已保存", "ok");
  flashButton(els.saveAgentProfileBtn, "已保存");
}

function setMemoryFeedback(text, type = "") {
  if (!els.memoryFeedback) return;
  els.memoryFeedback.textContent = text;
  els.memoryFeedback.className = `save-feedback ${type}`;
}

function memoryTypeLabel(type) {
  return memoryTypes[type]?.label || "记忆";
}

function memoryScopeLabel(scope) {
  return memoryScopes[scope] || "全局";
}

function memoryMetaHtml(memory) {
  const tags = normalizeMemoryTags(memory.tags || []);
  return `
    <div class="memory-meta">
      <span class="memory-pill">${escapeHtml(memoryTypeLabel(memory.type))}</span>
      <span class="memory-pill">${escapeHtml(memoryScopeLabel(memory.scope))}</span>
      <span class="memory-pill">${escapeHtml(memoryStatuses[memory.status] || "已启用")}</span>
      ${tags.map((tag) => `<span class="memory-pill">${escapeHtml(tag)}</span>`).join("")}
    </div>
  `;
}

function renderMemoryStats(memories) {
  if (!els.memoryStats) return;
  const active = memories.filter((memory) => memory.status === "active").length;
  const pending = memories.filter((memory) => memory.status === "pending").length;
  const workspace = memories.filter((memory) => memory.scope === "workspace" && memory.status === "active").length;
  els.memoryStats.innerHTML = `
    <span class="memory-stat">已启用 ${active}</span>
    <span class="memory-stat">待确认 ${pending}</span>
    <span class="memory-stat">项目 ${workspace}</span>
    <span class="memory-stat">本轮最多注入 ${memoryInjectionLimit}</span>
  `;
}

function memoryMatchesSearch(memory, query = "") {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  return memorySearchCorpus(memory).includes(text);
}

function renderMemoryItems(container, memories, mode) {
  if (!container) return;
  container.innerHTML = "";
  if (!memories.length) {
    container.innerHTML = `<div class="archive-empty">${mode === "pending" ? "暂无待确认记忆" : "暂无记忆"}</div>`;
    return;
  }

  for (const memory of memories) {
    const item = document.createElement("article");
    item.className = `memory-item ${memory.status === "pending" ? "pending" : ""}`;
    const used = memory.useCount ? ` · 已注入 ${memory.useCount} 次` : "";
    item.innerHTML = `
      <div class="memory-main">
        <strong>${escapeHtml(relativeTime(memory.updatedAt || memory.createdAt))}${escapeHtml(used)}</strong>
        ${memoryMetaHtml(memory)}
        <p>${escapeHtml(memory.content)}</p>
      </div>
      <div class="memory-actions"></div>
    `;
    const actions = item.querySelector(".memory-actions");
    if (mode === "pending") {
      const approveBtn = document.createElement("button");
      approveBtn.className = "primary-button small";
      approveBtn.type = "button";
      approveBtn.textContent = "保存";
      approveBtn.addEventListener("click", () => approveMemory(memory.id));
      const ignoreBtn = document.createElement("button");
      ignoreBtn.className = "ghost-button danger small";
      ignoreBtn.type = "button";
      ignoreBtn.textContent = "忽略";
      ignoreBtn.addEventListener("click", () => archiveMemory(memory.id));
      actions.append(approveBtn, ignoreBtn);
    } else {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "ghost-button danger small";
      deleteBtn.type = "button";
      deleteBtn.textContent = "删除";
      deleteBtn.addEventListener("click", () => deleteMemory(memory.id));
      actions.append(deleteBtn);
    }
    container.append(item);
  }
}

function renderMemoryList() {
  if (!els.memoryList) return;
  const memories = normalizeMemories(state.memories || []);
  state.memories = memories;
  const search = els.memorySearchInput?.value || "";
  renderMemoryStats(memories);
  renderMemoryItems(
    els.candidateMemoryList,
    memories.filter((memory) => memory.status === "pending"),
    "pending"
  );
  renderMemoryItems(
    els.memoryList,
    memories.filter((memory) => memory.status === "active" && memoryMatchesSearch(memory, search)),
    "active"
  );
}

function createMemoryObject({ content, type, scope, tags, status = "active", source = "manual", confidence = 0.95 }) {
  const trimmed = String(content || "").trim().slice(0, memoryContentLimit);
  const memoryType = memoryTypes[type] ? type : inferMemoryType(trimmed);
  const memoryScope = memoryScopes[scope] ? scope : inferMemoryScope(trimmed);
  return {
    id: id("memory"),
    content: trimmed,
    type: memoryType,
    scope: memoryScope,
    status,
    source,
    confidence: clamp(Number(confidence), 0, 1),
    tags: normalizeMemoryTags(tags?.length ? tags : inferMemoryTags(trimmed, memoryType, memoryScope)),
    project: memoryScope === "workspace" ? state.workspaceRoot || "" : "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastUsedAt: "",
    useCount: 0,
    fingerprint: memoryFingerprint(trimmed)
  };
}

function upsertMemory(memory) {
  if (!memory?.content) return false;
  const normalized = createMemoryObject(memory);
  const memories = normalizeMemories(state.memories || []);
  const existing = memories.find((item) => item.fingerprint === normalized.fingerprint);
  if (existing) {
    if (existing.status === "pending" && normalized.status === "active") {
      Object.assign(existing, {
        ...normalized,
        id: existing.id,
        createdAt: existing.createdAt,
        source: normalized.source || existing.source,
        updatedAt: nowIso()
      });
      state.memories = normalizeMemories(memories);
      return true;
    }
    return false;
  }
  state.memories = normalizeMemories([normalized, ...memories]);
  return true;
}

function addMemory() {
  const content = (els.memoryInput?.value || "").trim();
  if (!content) {
    setMemoryFeedback("请先输入要记住的内容", "error");
    return;
  }
  const added = upsertMemory({
    content,
    type: els.memoryTypeInput?.value || "preference",
    scope: els.memoryScopeInput?.value || "global",
    tags: normalizeMemoryTags(els.memoryTagsInput?.value || ""),
    status: "active",
    source: "manual",
    confidence: 1
  });
  if (els.memoryInput) els.memoryInput.value = "";
  if (els.memoryTagsInput) els.memoryTagsInput.value = "";
  saveState();
  renderMemoryList();
  setMemoryFeedback(added ? "已保存，后续对话会按相关性自动带上" : "这条记忆已经存在", added ? "ok" : "");
}

function approveMemory(memoryId) {
  state.memories = normalizeMemories(state.memories || []).map((memory) =>
    memory.id === memoryId
      ? { ...memory, status: "active", source: "manual", confidence: Math.max(memory.confidence || 0, 0.9), updatedAt: nowIso() }
      : memory
  );
  saveState();
  renderMemoryList();
  setMemoryFeedback("候选记忆已保存", "ok");
}

function archiveMemory(memoryId) {
  state.memories = normalizeMemories(state.memories || []).map((memory) =>
    memory.id === memoryId ? { ...memory, status: "archived", updatedAt: nowIso() } : memory
  );
  saveState();
  renderMemoryList();
  setMemoryFeedback("已忽略候选记忆", "ok");
}

function deleteMemory(memoryId) {
  state.memories = (state.memories || []).filter((memory) => memory.id !== memoryId);
  saveState();
  renderMemoryList();
  setMemoryFeedback("已删除", "ok");
}

function extractMemoryCandidatesFromTurn(prompt = "", attachments = []) {
  const text = String(prompt || "").trim();
  const candidates = [];
  if (text) {
    const explicit = /记住|保存为记忆|长期记忆|以后记得/.test(text);
    const stableRule = /以后|之后|默认|每次|总是|不要|必须|规则|偏好|习惯|我的|我喜欢|我不喜欢|处理.+时/.test(text);
    if (explicit || stableRule) {
      candidates.push({
        content: text.replace(/^(请|帮我)?(记住|保存为记忆)[:：，,\s]*/i, "").slice(0, 420),
        type: inferMemoryType(text),
        scope: inferMemoryScope(text),
        tags: inferMemoryTags(text),
        status: explicit ? "active" : "pending",
        source: explicit ? "manual" : "auto",
        confidence: explicit ? 0.98 : 0.68
      });
    }
  }

  for (const attachment of attachments || []) {
    if (!attachment?.path) continue;
    const wantsFileMemory = /记住|以后|这个文件|这份表|这个表格|当前文件/.test(text);
    if (!wantsFileMemory) continue;
    candidates.push({
      content: `文件线索：${attachment.name || "附件"} 已保存到工作区路径 ${attachment.path}。用户可能会用“这个文件/刚才的表格”指代它。`,
      type: "file",
      scope: "workspace",
      tags: ["文件", attachment.kind === "workbook" ? "Excel" : "附件"],
      status: "pending",
      source: "auto",
      confidence: 0.64
    });
  }
  return candidates;
}

function captureMemoryCandidates(prompt = "", attachments = []) {
  const candidates = extractMemoryCandidatesFromTurn(prompt, attachments);
  let added = 0;
  for (const candidate of candidates) {
    if (upsertMemory(candidate)) added += 1;
  }
  return added;
}

function updateConversationSummary(conversation) {
  if (!conversation) return;
  const turns = conversation.messages
    .filter((message) => ["user", "assistant"].includes(message.role))
    .slice(-10)
    .map((message) => {
      const label = message.role === "user" ? "用户" : "助手";
      return `${label}：${String(message.content || "").replace(/<attachment[\s\S]*?<\/attachment>/g, "[附件]").replace(/\s+/g, " ").slice(0, 140)}`;
    });
  if (turns.length >= 6) {
    conversation.summary = turns.join(" / ").slice(0, 1000);
  }
}

function flashButton(button, text) {
  if (!button) return;
  const original = button.textContent;
  button.textContent = text;
  setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

function createNewConversation() {
  const conversation = createConversation();
  state.conversations.unshift(conversation);
  state.activeConversationId = conversation.id;
  saveState();
  renderConversations();
  renderMessages();
  setStatus("新对话", "可以开始输入", "complete");
}

function renderTaskTemplates() {
  if (!els.templateButtons) return;
  els.templateButtons.innerHTML = "";
  for (const template of taskTemplates) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "template-button";
    button.innerHTML = `<span>${escapeHtml(template.icon)}</span>${escapeHtml(template.label)}`;
    button.addEventListener("click", () => applyTaskTemplate(template.id));
    els.templateButtons.append(button);
  }
}

function applyTaskTemplate(templateId) {
  const template = taskTemplates.find((item) => item.id === templateId);
  if (!template) return;
  els.promptInput.value = template.prompt;
  els.promptInput.focus();
  if (template.tools) {
    const templateSkills = new Set(normalizeEnabledSkills(state.enabledSkills));
    if (Array.isArray(template.skills)) {
      for (const skillId of template.skills) templateSkills.add(skillId);
    }
    if (enableAgentToolsForSkills([...templateSkills], { ask: true })) {
      state.enabledSkills = [...templateSkills];
      if (els.agentToolsToggle) els.agentToolsToggle.checked = true;
      renderSkillLibrary();
      saveState();
    }
  }
  setWorkspaceOpen(true);
  selectWorkspaceTab("tasks");
  addTaskEvent("已套用模板", template.label, "complete", { persist: false });
}

async function postJsonWithTimeout(url, body, options = {}) {
  const timeoutMs = options.timeoutMs || chatRequestTimeoutMs;
  const controller = options.controller || new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = { ok: false, error: "接口返回内容不是有效 JSON" };
    }
    return { response, data };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        timedOut
          ? options.timeoutMessage || `请求超过 ${Math.round(timeoutMs / 1000)} 秒仍未响应，已自动停止。`
          : options.cancelMessage || "请求已停止"
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function cancelActiveRequest() {
  if (!busy || !activeChatController) return;
  activeChatController.abort();
  setStatus("正在停止", "已发送停止请求", "running");
}

function assistantContentFromResponse(data) {
  if (data.content && String(data.content).trim()) return cleanVisibleText(data.content);
  const reason = data.emptyReason || {};
  const details = [
    reason.finishReason ? `finish_reason: ${reason.finishReason}` : "",
    reason.hasToolCalls ? "返回里包含工具调用，但没有最终文本" : "",
    reason.hasReasoningContent ? "返回里包含 reasoning_content，但没有最终正文" : "",
    Array.isArray(reason.messageKeys) && reason.messageKeys.length ? `message 字段: ${reason.messageKeys.join(", ")}` : ""
  ].filter(Boolean);
  return [
    "模型返回了空文本，neo 已拦截为诊断信息。",
    details.length ? details.join("\n") : "接口成功返回，但没有可显示的正文。",
    "可以重试一次，或换用同供应商的标准对话模型。"
  ].join("\n");
}

const pseudoToolMarkerRe = /<\s*\/?\s*\|\s*\|\s*DSML\s*\|\s*\|\s*(?:tool_calls|invoke|parameter)\b[^>]*>|<\s*invoke\b[^>]*\bname\s*=\s*["'][^"']+["'][^>]*>/i;

function stripPseudoToolText(value = "") {
  const text = String(value || "");
  const markerIndex = text.search(pseudoToolMarkerRe);
  return markerIndex >= 0 ? text.slice(0, markerIndex).trimEnd() : text;
}

function cleanVisibleText(value = "", options = {}) {
  const trim = options.trim !== false;
  const lines = stripPseudoToolText(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  let inFence = false;
  const cleaned = [];
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      cleaned.push(line);
      continue;
    }
    if (!inFence && /^\s*-{2,}\s*$/.test(line)) continue;
    cleaned.push(line.replace(/[ \t]+$/g, ""));
  }
  const text = cleaned.join("\n").replace(/\n{4,}/g, "\n\n\n");
  return trim ? text.trim() : text;
}

function renderInlineMarkdown(value = "") {
  const tokens = [];
  const tokenFor = (html) => {
    const token = `@@NEO_MD_${tokens.length}@@`;
    tokens.push([token, html]);
    return token;
  };
  const withCode = String(value || "").replace(/`([^`\n]+)`/g, (_, code) => tokenFor(`<code>${escapeHtml(code)}</code>`));
  const withLinks = withCode.replace(/\[([^\]\n]+)]\((https?:\/\/[^\s)]+)\)/g, (_, label, href) => (
    tokenFor(`<a href="${escapeAttr(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`)
  ));
  let html = escapeHtml(withLinks)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(（])\*([^*\n]+)\*(?=[\s).,!?;:，。！？；：）]|$)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(（])_([^_\n]+)_(?=[\s).,!?;:，。！？；：）]|$)/g, "$1<em>$2</em>");
  for (const [token, tokenHtml] of tokens) html = html.replaceAll(token, tokenHtml);
  return html;
}

function renderAssistantMarkdown(value = "", options = {}) {
  const text = cleanVisibleText(value, options);
  if (!text.trim()) return "";
  const lines = text.split("\n");
  const html = [];
  const paragraph = [];
  let listType = "";
  let inCodeBlock = false;
  let codeLines = [];

  const closeParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${paragraph.map((line) => renderInlineMarkdown(line.trim())).join("<br>")}</p>`);
    paragraph.length = 0;
  };
  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = "";
  };
  const ensureList = (type) => {
    if (listType === type) return;
    closeList();
    listType = type;
    html.push(`<${type}>`);
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        closeParagraph();
        closeList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      closeParagraph();
      closeList();
      continue;
    }
    const heading = line.match(/^\s{0,3}#{1,3}\s+(.+)$/);
    if (heading) {
      closeParagraph();
      closeList();
      html.push(`<h3>${renderInlineMarkdown(heading[1].trim())}</h3>`);
      continue;
    }
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      closeParagraph();
      ensureList("ul");
      html.push(`<li>${renderInlineMarkdown(unordered[1].trim())}</li>`);
      continue;
    }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      closeParagraph();
      ensureList("ol");
      html.push(`<li>${renderInlineMarkdown(ordered[1].trim())}</li>`);
      continue;
    }
    closeList();
    paragraph.push(line);
  }

  if (inCodeBlock) html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  closeParagraph();
  closeList();
  return html.join("");
}

function memoryQueryFromTurn(prompt = "", attachments = []) {
  const attachmentText = (attachments || [])
    .map((item) => `${item.name || ""} ${item.path || ""} ${item.summary || ""}`)
    .join("\n");
  return [prompt, attachmentText, activeConversation()?.title || ""].filter(Boolean).join("\n");
}

// ── sendPrompt 子函数 ──────────────────────────────────────────────────

/** 从 UI 元素读取最新设置并写回 state */
function syncStateFromUI() {
  state.temperature = Number(els.temperatureInput.value || 0.7);
  state.maxTokens = Number(els.maxTokensInput.value || 0);
  state.agentTools = els.agentToolsToggle.checked;
  state.toolConsent = syncExternalConsentFromControls(state.toolConsent);
  state.systemPrompt = els.systemPromptInput.value;
  state.role = els.roleSelect.value;
  state.responseStyle = els.responseStyleSelect?.value || state.responseStyle || "direct";
  state.customModel = els.customModelInput.value.trim();
  state.enabledSkills = normalizeEnabledSkills(state.enabledSkills);
}

function isAvatarChangeIntent(prompt = "") {
  const text = String(prompt || "").trim();
  if (!text) return false;
  const hasAvatarWord = /(头像|头图|形象|avatar|profile\s*(picture|photo)?)/i.test(text);
  const hasSetAction = /(设为|设置为|设成|设置成|改成|换成|换为|更换|替换|当成|作为|新头像|做.*头像|当.*头像|用.+(做|当|作为)|change|set|use|replace)/i.test(text);
  const targetsAgent = /(你|你的|neo|助手|智能体|AI|机器人|agent|bot)/i.test(text);
  const refersToAttachment = /(这张|这个|这幅|这|图片|照片|图|附件|刚才|上传)/i.test(text);
  return hasAvatarWord && hasSetAction && (targetsAgent || refersToAttachment);
}

async function applyAvatarChangeFromAttachment(prompt = "", attachments = []) {
  if (!isAvatarChangeIntent(prompt)) return null;
  const imageAttachment = [...attachments].reverse().find((attachment) => attachment.kind === "image" && attachment.dataUrl);
  if (!imageAttachment) return null;

  const avatarDataUrl = await createAvatarDataUrl(imageAttachment.dataUrl);
  state.agentAvatar = avatarDataUrl;
  draftAgentAvatar = avatarDataUrl;
  draftAgentName = state.agentName || "neo";
  agentProfileDirty = false;
  saveState();
  updateAvatarPreview(avatarDataUrl);
  broadcastAgentProfile("main");
  setAgentProfileFeedback("已通过对话更新头像", "ok");
  return {
    path: imageAttachment.path || imageAttachment.name || "图片附件",
    content: `已换好了，我现在就用这张图做头像。\n\n来源：${imageAttachment.path || imageAttachment.name || "刚才上传的图片"}`
  };
}

function commitLocalAssistantResponse(conversation, content, requestPatch = {}) {
  conversation.messages.push({
    role: "assistant",
    content: cleanVisibleText(content),
    request: {
      provider: "neo 本地动作",
      protocol: "local",
      model: "profile-avatar",
      endpoint: "local://profile/avatar",
      thinking: "",
      calledAt: nowIso(),
      ...requestPatch
    },
    usage: null
  });
  updateConversationSummary(conversation);
  conversation.updatedAt = nowIso();
  saveState();
  renderConversations();
  renderMessages();
  renderWorkspacePanel();
}

/** 处理附件导入并记录事件，返回 importedAttachments */
async function prepareAttachments(attachmentsToSend, provider, model) {
  if (!attachmentsToSend.length) return [];
  const importedAttachments = await importPendingAttachments(attachmentsToSend);
  addTaskEvent("附件已保存", importedAttachments.map((a) => a.path).join("、"), "complete");
  recordArtifacts(artifactsFromAttachments(importedAttachments));
  const imageCount = importedAttachments.filter((a) => a.kind === "image").length;
  if (imageCount && !providerSupportsImageInput(provider, model)) {
    addTaskEvent("图片已转为附件信息", "当前模型不支持直接看图，已改为发送文件路径和摘要。", "complete");
  }
  return importedAttachments;
}

/** 把用户消息推入对话，更新标题并保存渲染 */
function commitUserMessage(conversation, prompt, importedAttachments, references = []) {
  conversation.messages.push({
    role: "user",
    content: prompt || (references.length ? "请结合引用继续。" : "请查看附件"),
    attachments: importedAttachments,
    references
  });
  if (!conversation.title || conversation.title === "新对话") {
    conversation.title = titleFromMessages(conversation.messages);
  }
  conversation.updatedAt = nowIso();
  saveState();
  renderConversations();
  renderMessages();
}

/** 选取相关记忆并注入，返回 { memoryQuery, selectedMemories, messages } */
function buildRequestMessages(conversation, prompt, importedAttachments, provider, model) {
  const memoryQuery = memoryQueryFromTurn(prompt, importedAttachments);
  const selectedMemories = selectRelevantMemories(memoryQuery);
  markMemoriesUsed(selectedMemories);
  if (selectedMemories.length) {
    addTaskEvent("注入记忆", `${selectedMemories.length} 条相关记忆`, "complete");
    saveState();
  }
  const messages = [
    { role: "system", content: buildSystemPrompt(provider, model, memoryQuery, selectedMemories) },
    ...messagesForModel(conversation.messages, provider, model).slice(-24)
  ];
  return messages;
}

/** 调用 /api/chat 并返回 data */
/** SSE 流式调用 /api/chat，边接收边更新气泡，返回最终 data 对象 */
async function callChatApi(provider, model, messages, { onDelta, onToolStart, onToolEnd, onSkillStart, onSkillStep, onSkillEnd, onPseudoToolBlocked, onUnverifiedCompletionBlocked, onToolArgFuse } = {}) {
  const controller = new AbortController();
  activeChatController = controller;

  const timeoutMs = chatRequestTimeoutMs;
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        model,
        messages,
        temperature: currentTemperature(),
        maxTokens: state.maxTokens,
        thinking: state.thinking,
        enableTools: state.agentTools,
        enabledSkills: state.enabledSkills,
        toolConsent: toolConsentForChat(),
        stream: true
      }),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(timedOut
        ? `模型响应超过 ${Math.round(timeoutMs / 1000)} 秒，已自动停止。请检查网络/API 或换用更快模型。`
        : "请求已停止，没有继续等待模型响应。");
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let errMsg = "请求失败";
    try { const d = await response.json(); errMsg = d.error || errMsg; } catch {}
    throw new Error(errMsg);
  }

  // 解析 SSE 流
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finalData = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        let event;
        try { event = JSON.parse(trimmed.slice(5).trim()); } catch { continue; }

        if (event.type === "delta" && event.text) {
          onDelta?.(event.text);
        } else if (event.type === "tool_start") {
          onToolStart?.(event.name, event.args);
        } else if (event.type === "tool_end") {
          onToolEnd?.(event.name, event.result);
        } else if (event.type === "skill_start") {
          onSkillStart?.(event.skill, event.task);
        } else if (event.type === "skill_step") {
          onSkillStep?.(event.skill, event.phase, event.name, event.args, event.result);
        } else if (event.type === "skill_end") {
          onSkillEnd?.(event.skill, event.ok, event.steps, event.content);
        } else if (event.type === "pseudo_tool_blocked") {
          onPseudoToolBlocked?.(event.names || []);
        } else if (event.type === "unverified_completion_blocked") {
          onUnverifiedCompletionBlocked?.(event.claim || {});
        } else if (event.type === "tool_arg_fuse") {
          onToolArgFuse?.(event);
        } else if (event.type === "done") {
          finalData = { ok: true, ...event };
          delete finalData.type;
        } else if (event.type === "error") {
          throw new Error(event.error || "流式请求失败");
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!finalData) throw new Error("流式响应未返回完成事件");
  return finalData;
}

const criticalToolNames = new Set(["write_file", "export_image", "create_excel_file", "create_word_file", "create_ppt_file", "clean_table_file", "clean_table_files", "download_url", "read_web_page", "run_command"]);
const fileOutputToolNames = new Set(["write_file", "export_image", "create_excel_file", "create_word_file", "create_ppt_file", "clean_table_file", "clean_table_files", "download_url"]);

function hasVerifiedOutputArtifact(steps = []) {
  return (steps || []).some((step) => {
    if (step?.result?.verified === true) return true;
    const artifacts = step?.verification?.artifacts || step?.receipt?.verification?.artifacts || step?.result?.verification?.artifacts || [];
    return Array.isArray(artifacts) && artifacts.some((item) => item?.ok && item.exists && Number(item.size || 0) > 0);
  });
}

function responseCompletionState(data = {}) {
  const steps = Array.isArray(data.steps) ? data.steps : [];
  if (data.toolArgFuse) {
    return { ok: false, title: "未完成", detail: `模型没有传入 ${data.toolArgFuse.toolName || "工具"} 的必要参数` };
  }
  if (data.hitToolLimit) return { ok: false, title: "需要继续", detail: "工具调用轮次已达上限，任务可能未完成" };
  if (data.pseudoToolBlocked) return { ok: false, title: "未完成", detail: "模型输出了伪工具调用，已被拦截" };
  if (data.unverifiedCompletionBlocked) return { ok: false, title: "未完成", detail: "没有真实工具回执，已拦截完成声明" };

  const failedCritical = steps.find((step) => criticalToolNames.has(step?.name) && step?.result && !step.result.ok);
  if (failedCritical) {
    return { ok: false, title: "未完成", detail: failedCritical.result.error || `${failedCritical.name} 执行失败` };
  }

  const attemptedOutput = steps.some((step) => fileOutputToolNames.has(step?.name));
  if (attemptedOutput && !hasVerifiedOutputArtifact(steps)) {
    return { ok: false, title: "未完成", detail: "没有检测到通过校验的输出文件" };
  }

  return { ok: true, title: "运行完成", detail: "任务已成功完成" };
}

/** 把 assistant 回复写入对话，处理工具步骤、制品、渲染 */
async function commitAssistantResponse(conversation, data, provider, model) {
  const shouldAutoSaveBlocks = !data.pseudoToolBlocked && !data.unverifiedCompletionBlocked;
  const savedPaths = shouldAutoSaveBlocks && data.content ? await autoSaveFileBlocks(data.content) : [];
  if (savedPaths.length) {
    addTaskEvent("保存回复文件", savedPaths.join("、"), "complete");
    recordArtifacts(artifactsFromSavedPaths(savedPaths, "回复"));
  }

  conversation.messages.push({
    role: "assistant",
    content: assistantContentFromResponse(data),
    steps: data.steps || [],
    request: data.request || {
      provider: provider.name || "未命名供应商",
      protocol: provider.protocol || "openai",
      model,
      endpoint: provider.baseUrl || "",
      thinking: state.thinking
    },
    usage: data.usage || null
  });

  state.toolSteps = data.steps || [];
  if (state.toolSteps.length) {
    const failed = state.toolSteps.filter((step) => step?.result && !step.result.ok).length;
    addTaskEvent(failed ? "工具调用未完全完成" : "工具调用完成", failed ? `${failed} 个步骤失败` : `${state.toolSteps.length} 个步骤`, failed ? "error" : "complete");
    recordArtifacts(artifactsFromToolSteps(state.toolSteps));
    state.workspaceOpen = true;
    state.workspaceTab = "tasks";
  }
  if (data.toolArgFuse) {
    addTaskEvent("工具参数缺失，已停止", data.toolArgFuse.lastError || "模型没有传入必要工具参数", "error");
    state.workspaceOpen = true;
    state.workspaceTab = "tasks";
  }
  if (data.hitToolLimit) {
    addTaskEvent("工具轮次已达上限", "任务可能未全部完成，请查看回复详情", "error");
  }
  if (data.pseudoToolBlocked) {
    const names = Array.isArray(data.pseudoToolNames) && data.pseudoToolNames.length
      ? data.pseudoToolNames.join("、")
      : "伪工具调用";
    addTaskEvent("已拦截伪工具调用", names, "error");
    state.workspaceOpen = true;
    state.workspaceTab = "tasks";
  }
  if (data.unverifiedCompletionBlocked) {
    addTaskEvent("已拦截未验证完成声明", data.completionClaim?.label || "没有真实工具回执", "error");
    state.workspaceOpen = true;
    state.workspaceTab = "tasks";
  }

  updateConversationSummary(conversation);
  conversation.updatedAt = nowIso();
  saveState();
  renderConversations();
  renderMessages();
  renderWorkspacePanel();
}

// ── 主入口 ──────────────────────────────────────────────────────────────

async function sendPrompt(event) {
  event.preventDefault();
  if (busy) return;

  const prompt = els.promptInput.value.trim();
  const attachmentsToSend = [...pendingAttachments];
  const referencesToSend = [...pendingReferences];
  if (!prompt && !attachmentsToSend.length && !referencesToSend.length) return;

  syncStateFromUI();
  if (!(await ensureLocalToolsBeforeSend(prompt))) {
    setStatus("需要本地工具", "这个任务要开启本地工具后才能真实执行", "error");
    addTaskEvent("已取消发送", "未开启本地工具，无法真实操作本地文件或命令", "error", { persist: false });
    return;
  }
  const conversation = activeConversation();
  els.promptInput.value = "";
  setBusy(true);
  notifyPet("thinking");
  setStatus(attachmentsToSend.length ? "正在处理附件" : "正在连接 API", "准备发送请求", "running");
  addTaskEvent("任务开始", prompt || (referencesToSend.length ? "处理引用上下文" : `处理 ${attachmentsToSend.length} 个附件`), "running");

  const waitTimer = setTimeout(() => {
    if (busy) setStatus("模型思考中", "仍在等待模型响应", "running");
  }, 10000);

  try {
    const localAvatarRequest = isAvatarChangeIntent(prompt) && attachmentsToSend.some((attachment) => attachment.kind === "image");
    const route = localAvatarRequest
      ? { provider: activeProvider(), model: effectiveModel(), auto: false, kind: "local-avatar", label: "本地头像" }
      : resolveModelRoute(attachmentsToSend);
    const { provider, model } = route;
    if (localAvatarRequest) {
      addTaskEvent("识别头像指令", "将使用上传图片更新 neo 头像，不调用模型。", "running");
    } else {
      addTaskEvent(
        route.auto ? "自动切换模型" : "确认模型",
        `${route.label} → ${provider.name || "未命名供应商"} · ${model}`,
        "complete"
      );
    }

    const importedAttachments = await prepareAttachments(attachmentsToSend, provider, model);
    pendingAttachments = [];
    renderAttachmentChips();
    if (referencesToSend.length) {
      pendingReferences = [];
      renderQuoteBar();
      addTaskEvent("带入对话引用", `${referencesToSend.length} 条引用`, "complete");
    }

    const avatarChange = await applyAvatarChangeFromAttachment(prompt, importedAttachments);

    const capturedMemories = captureMemoryCandidates(prompt, importedAttachments);
    if (capturedMemories) {
      addTaskEvent("记忆候选", `${capturedMemories} 条已进入记忆策略`, "complete");
      renderMemoryList();
    }

    commitUserMessage(conversation, prompt, importedAttachments, referencesToSend);

    if (avatarChange) {
      addTaskEvent("头像已更新", avatarChange.path, "complete");
      commitLocalAssistantResponse(conversation, avatarChange.content);
      setStatus("头像已更新", "已保存到 neo 形象设置", "complete");
      return;
    }

    const messages = buildRequestMessages(conversation, prompt, importedAttachments, provider, model);
    setStatus("正在生成回复", `${route.label} · ${provider.name} · ${model}`, "running");
    addTaskEvent("调用模型", `${provider.name || "未命名供应商"} · ${model}`, "running");

    // 在消息列表末尾插入一个流式占位气泡
    const streamingMsg = { role: "assistant", content: "", _streaming: true };
    conversation.messages.push(streamingMsg);
    renderMessages();
    // 找到刚插入的最后一个 assistant 气泡的 .bubble 元素，用于实时追加文字
    const bubbles = els.messageList.querySelectorAll(".message.assistant .bubble");
    const streamBubble = bubbles[bubbles.length - 1] || null;

    let streamedContent = "";

    const data = await callChatApi(provider, model, messages, {
      onDelta(text) {
        streamedContent += text;
        if (streamBubble) {
          if (streamedContent.trim()) {
            streamBubble.innerHTML = renderAssistantMarkdown(streamedContent, { trim: false });
            streamBubble.classList.add("has-streamed-content");
          }
          els.messageList.scrollTop = els.messageList.scrollHeight;
        }
      },
      onToolStart(name, args) {
        notifyPet("working");
        addTaskEvent(`工具调用: ${name}`, JSON.stringify(args || {}).slice(0, 120), "running");
      },
      onToolEnd(name, result) {
        addTaskEvent(`工具完成: ${name}`, result?.ok ? (result.path || "成功") : (result?.error || "失败"), result?.ok ? "complete" : "error");
        recordOfficeTaskEvents(result?.officeTask);
      },
      onSkillStart(skill, task) {
        const skillNames = { "local-files": "本地文件助手", "spreadsheet-pro": "表格处理", "document-reader": "文档阅读", "finance-tables": "财务表格", "code-review": "代码审查", "web-browser": "网页助手", "desktop-control": "电脑操作", "local-command": "本地命令" };
        addTaskEvent(`▶ 技能子智能体: ${skillNames[skill] || skill}`, (task || "").slice(0, 120), "running");
      },
      onSkillStep(skill, phase, name, args, result) {
        if (phase === "start") {
          addTaskEvent(`  ↳ ${name}`, JSON.stringify(args || {}).slice(0, 80), "running");
        } else if (phase === "end") {
          addTaskEvent(`  ✓ ${name}`, result?.ok ? (result.path || "完成") : (result?.error || "失败"), result?.ok ? "complete" : "error");
          recordOfficeTaskEvents(result?.officeTask);
        }
      },
      onSkillEnd(skill, ok, steps, content) {
        addTaskEvent(`◼ 技能完成: ${skill}`, ok ? ((content || "").slice(0, 80) || "已完成") : "技能执行失败", ok ? "complete" : "error");
      },
      onPseudoToolBlocked(names) {
        addTaskEvent("已拦截伪工具调用", (names || []).join("、") || "模型输出了未执行的工具文本", "error");
      },
      onUnverifiedCompletionBlocked(claim) {
        addTaskEvent("已拦截未验证完成声明", claim?.label || "没有真实工具回执", "error");
      },
      onToolArgFuse(event) {
        addTaskEvent("工具参数缺失，已停止", event?.error || `${event?.tool || "工具"} 缺少必要参数`, "error");
      }
    });

    // 移除占位消息，交给 commitAssistantResponse 写入真实消息
    conversation.messages.pop();
    await commitAssistantResponse(conversation, data, provider, model);

    const completion = responseCompletionState(data);
    notifyPet(completion.ok ? "done" : "error");
    addTaskEvent(completion.ok ? "任务完成" : "任务未完成", completion.detail, completion.ok ? "complete" : "error");
    setStatus(completion.title, completion.detail, completion.ok ? "complete" : "error");
  } catch (error) {
    notifyPet("error");
    addTaskEvent("任务失败", error.message, "error");
    conversation.messages.push({ role: "error", content: error.message });
    conversation.updatedAt = nowIso();
    saveState();
    renderConversations();
    renderMessages();
    setStatus("请求失败", error.message, "error");
  } finally {
    clearTimeout(waitTimer);
    activeChatController = null;
    setBusy(false);
  }
}

function setBusy(isBusy) {
  busy = isBusy;
  els.sendBtn.disabled = false;
  els.sendBtn.textContent = isBusy ? "×" : "↑";
  els.sendBtn.classList.toggle("cancel", isBusy);
  els.sendBtn.setAttribute("aria-label", isBusy ? "停止生成" : "发送");
  els.sendBtn.title = isBusy ? "停止生成" : "发送";
}

function setStatus(title, detail, type = "complete") {
  els.sendStatus.textContent = title;
  els.sendStatusDetail.textContent = detail || "";
  els.inlineSendStatus.textContent = title;
  els.inlineSendStatus.className = `inline-send-status ${type === "running" ? "running" : type === "error" ? "error" : ""}`;
  els.sendStatusIcon.textContent = type === "error" ? "!" : type === "running" ? "…" : "✓";
  els.sendStatusToast.className = `status-toast ${type === "running" ? "running" : type === "error" ? "error" : ""}`;
  window.clearTimeout(stillWaitingTimer);
  if (type === "complete") {
    stillWaitingTimer = window.setTimeout(() => els.sendStatusToast.classList.add("hidden"), 2600);
  }
}

function setToolSettingsFeedback(message, type = "ok") {
  if (!els.toolSettingsFeedback) return;
  els.toolSettingsFeedback.textContent = message || "";
  els.toolSettingsFeedback.className = `inline-settings-feedback ${type || ""}`.trim();
}

async function testCurrentApi() {
  state.temperature = Number(els.temperatureInput.value || 0.7);
  state.maxTokens = Number(els.maxTokensInput.value || 0);
  state.customModel = els.customModelInput.value.trim();
  const provider = activeProvider();
  const model = effectiveModel();
  els.testApiBtn.disabled = true;
  els.apiTestOutput.textContent = "正在测试当前 API...";

  try {
    const { response, data } = await postJsonWithTimeout(
      "/api/chat",
      {
        provider,
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(provider, model) },
          { role: "user", content: "请只回复 API_OK，并说明当前供应商和模型。" }
        ],
        temperature: 0,
        maxTokens: Math.min(state.maxTokens || 128, 128),
        thinking: state.thinking,
        enableTools: false
      },
      {
        timeoutMs: apiTestTimeoutMs,
        timeoutMessage: `API 测试超过 ${Math.round(apiTestTimeoutMs / 1000)} 秒未响应，已自动停止。`
      }
    );
    if (!response.ok || !data.ok) throw new Error(data.error || "API 测试失败");
    els.apiTestOutput.textContent = ["测试成功", requestInfoText(data.request, data.usage), "", cleanVisibleText(data.content || "(空响应)")].join("\n");
  } catch (error) {
    els.apiTestOutput.textContent = `测试失败\n${error.message}`;
  } finally {
    els.testApiBtn.disabled = false;
  }
}

function openPopoverPane(pane) {
  if (pane === "provider") {
    renderProviderPickerList();
    els.providerPickerPane.classList.remove("hidden");
    els.modelPickerPane.classList.add("hidden");
  } else {
    renderModelPickerList();
    els.providerPickerPane.classList.add("hidden");
    els.modelPickerPane.classList.remove("hidden");
    els.pickerBackLabel.textContent = activeProvider().name || "供应商";
    if (els.thinkingSelect) els.thinkingSelect.value = state.thinking;
  }
}

function renderProviderPickerList() {
  els.providerPickerList.innerHTML = "";
  for (const provider of state.providers) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `picker-item${provider.id === state.activeProviderId ? " active" : ""}`;
    btn.innerHTML = `<span>${escapeHtml(provider.name)}</span><span class="picker-meta">${escapeHtml(provider.protocol)}</span>`;
    btn.addEventListener("click", () => {
      selectActiveProvider(provider.id);
      openPopoverPane("model");
    });
    els.providerPickerList.append(btn);
  }
}

function renderModelPickerList() {
  els.modelPickerList.innerHTML = "";
  const models = activeProvider().models || [];
  if (!models.length) {
    els.modelPickerList.innerHTML = `<div style="padding:10px 10px;color:var(--muted);font-size:12px;">无预设模型，请在设置中添加</div>`;
    return;
  }
  for (const model of models) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `picker-item${model === effectiveModel() ? " active" : ""}`;
    btn.textContent = model;
    btn.addEventListener("click", () => {
      selectActiveModel(model);
      closeModelPopover();
    });
    els.modelPickerList.append(btn);
  }
}

function toggleModelPopover(event, pane = "provider") {
  const anchor = event?.currentTarget || modelPopoverAnchor || els.activeProviderButton;
  if (!els.modelPopover.classList.contains("hidden") && modelPopoverAnchor === anchor) {
    closeModelPopover();
    return;
  }
  modelPopoverAnchor = anchor;
  positionModelPopover(anchor);
  openPopoverPane(pane);
  els.modelPopover.classList.remove("hidden");
}

function closeModelPopover() {
  els.modelPopover.classList.add("hidden");
}

function positionModelPopover(anchor) {
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(280, window.innerWidth - 24);
  const maxTop = Math.max(12, window.innerHeight - 260);
  const left = clamp(rect.right - width, 12, window.innerWidth - width - 12);
  const top = clamp(rect.bottom + 8, 12, maxTop);
  els.modelPopover.style.width = `${width}px`;
  els.modelPopover.style.left = `${left}px`;
  els.modelPopover.style.top = `${top}px`;
}

function selectActiveProvider(providerId) {
  state.activeProviderId = providerId;
  state.selectedProviderId = providerId;
  state.activeModel = activeProvider().models?.[0] || "";
  state.customModel = "";
  saveState();
  renderAll();
}

function selectActiveModel(model) {
  state.activeModel = model;
  state.customModel = "";
  saveState();
  renderSelectors();
  renderModelOverview();
}

function setRouteProvider(kind, providerId) {
  const config = routeConfig(kind);
  const provider = providerById(providerId) || routeProvider(kind);
  state[config.providerKey] = provider.id;
  state[config.modelKey] = kind === "vision" ? providerVisionModel(provider, config.defaultModel) : providerModel(provider, config.defaultModel);
  saveState();
  renderRoutingControls();
}

function setRouteModel(kind, model) {
  const config = routeConfig(kind);
  state[config.modelKey] = model;
  saveState();
  renderRoutingControls();
}

function addProvider() {
  const provider = {
    id: id("custom"),
    name: "自定义",
    protocol: "openai",
    apiMode: "chat_completions",
    baseUrl: "",
    apiKey: "",
    models: ["custom-model"]
  };
  state.providers.push(provider);
  state.selectedProviderId = provider.id;
  state.activeProviderId = provider.id;
  state.activeModel = provider.models[0];
  state.customModel = "";
  saveState();
  renderAll();
  setSaveFeedback("已新增供应商，请填写配置", "ok");
}

function setWorkspaceOpen(open) {
  state.workspaceOpen = Boolean(open);
  saveState();
  applyLayout();
}

function setSidebarOpen(open) {
  state.sidebarOpen = Boolean(open);
  saveState();
  applyLayout();
}

function selectWorkspaceTab(tab) {
  if (!["tasks", "artifacts", "files", "terminal"].includes(tab)) return;
  state.workspaceTab = tab;
  saveState();
  renderWorkspacePanel();
  if (tab === "files" && !els.fileTree.children.length) loadWorkspaceTree(state.workspacePath || ".");
}

function addTaskEvent(title, detail = "", type = "complete", options = {}) {
  const event = {
    id: id("event"),
    title,
    detail: detail || "",
    type,
    createdAt: nowIso()
  };
  state.taskEvents = [...(state.taskEvents || []), event].slice(-40);
  if (options.open !== false) {
    state.workspaceOpen = true;
    state.workspaceTab = "tasks";
  }
  renderWorkspacePanel();
  if (options.persist !== false) saveState();
  return event;
}

function clearTaskEvents() {
  state.taskEvents = [];
  state.toolSteps = [];
  saveState();
  renderWorkspacePanel();
}

function rerunLastUserTask() {
  const messages = activeConversation().messages || [];
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  if (!lastUser) {
    setStatus("没有可重试任务", "先发送一次任务后再重试", "error");
    return;
  }
  const attachmentLines = (lastUser.attachments || [])
    .map((attachment) => `附件：${attachment.name || "文件"}，路径：${attachment.path || "未保存"}`)
    .join("\n");
  els.promptInput.value = [
    lastUser.content || "请继续处理上次附件",
    attachmentLines,
    "请重新执行这个任务，并在失败时说明失败步骤。"
  ].filter(Boolean).join("\n\n");
  els.promptInput.focus();
  setWorkspaceOpen(true);
  selectWorkspaceTab("tasks");
  addTaskEvent("已填入重试任务", "检查输入框后发送", "complete", { persist: false });
}

function renderWorkspacePanel() {
  const activeTab = state.workspaceTab || "tasks";
  for (const tabButton of els.workspaceTabs) {
    const active = tabButton.dataset.panelTab === activeTab;
    tabButton.classList.toggle("active", active);
    tabButton.setAttribute("aria-selected", String(active));
  }
  for (const section of els.workspaceSections) {
    section.classList.toggle("active", section.dataset.panelSection === activeTab);
  }
  const rootName = workspaceRootName();
  const tabLabel =
    activeTab === "files"
      ? "工作区文件"
      : activeTab === "terminal"
        ? "本地命令"
        : activeTab === "artifacts"
          ? "结果文件"
          : "任务过程";
  els.workspacePanelStatus.textContent = rootName ? `${tabLabel} · ${rootName}` : tabLabel;
  els.workspacePanelStatus.title = state.workspaceRoot || "";
  renderTaskEvents();
  renderTaskMetrics();
  renderToolSteps();
  renderArtifacts();
}

function renderTaskMetrics() {
  if (!els.taskMetrics) return;
  const events = state.taskEvents || [];
  const running = events.filter((event) => event.type === "running").length;
  const errors = events.filter((event) => event.type === "error").length;
  const tools = state.toolSteps?.length || 0;
  const artifacts = state.artifacts?.length || 0;
  const latestType = events[events.length - 1]?.type || "complete";
  const statusText = latestType === "error" ? "异常" : running && latestType === "running" ? "运行中" : events.length ? "完成" : "待命";
  els.taskMetrics.innerHTML = [
    ["状态", statusText],
    ["过程", `${events.length} 条`],
    ["工具", `${tools} 步`],
    ["成果", `${artifacts} 个`],
    errors ? ["错误", `${errors} 条`] : null
  ].filter(Boolean).map(([label, value]) => `
    <span class="${label === "错误" ? "danger" : ""}">
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(label)}</small>
    </span>
  `).join("");
}

function renderTaskEvents() {
  if (!els.taskEventList) return;
  const events = state.taskEvents || [];
  const latest = events[events.length - 1];
  if (els.taskRunTitle) els.taskRunTitle.textContent = latest?.title || "等待任务";
  if (els.taskRunDetail) els.taskRunDetail.textContent = latest?.detail || "就绪";
  els.taskEventList.innerHTML = "";
  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "empty-panel compact";
    empty.innerHTML = `<strong>暂无过程记录</strong>`;
    els.taskEventList.append(empty);
    return;
  }

  for (const event of events) {
    const item = document.createElement("article");
    item.className = `task-event ${event.type || ""}`;
    item.innerHTML = `
      <span class="task-event-dot"></span>
      <div>
        <strong>${escapeHtml(event.title)}</strong>
        ${event.detail ? `<small>${escapeHtml(event.detail)}</small>` : ""}
      </div>
      <time>${escapeHtml(shortTime(event.createdAt))}</time>
    `;
    els.taskEventList.append(item);
  }
  els.taskEventList.scrollTop = els.taskEventList.scrollHeight;
}

function receiptSummary(step = {}) {
  const receipt = step.receipt || {};
  if (!receipt.startedAt && !receipt.status) return "";
  const bits = [];
  bits.push(receipt.ok ? "真实回执：成功" : "真实回执：失败");
  if (Number.isFinite(Number(receipt.durationMs))) bits.push(`${Math.round(Number(receipt.durationMs))}ms`);
  if (receipt.verified === true) bits.push("文件已验证");
  if (receipt.verified === false) bits.push("文件验证失败");
  return bits.join(" · ");
}

function verificationSummary(step = {}) {
  const verification = step.verification || step.receipt?.verification || step.result?.verification;
  const artifacts = Array.isArray(verification?.artifacts) ? verification.artifacts : [];
  if (!artifacts.length) return "";
  return artifacts
    .map((item) => `${item.ok ? "✓" : "!"} ${item.path || "输出文件"}${item.size !== undefined ? ` · ${formatBytes(item.size)}` : ""}${item.reason ? ` · ${item.reason}` : ""}`)
    .join("\n");
}

function officeTaskSummaryHtml(officeTask) {
  if (!officeTask || !Array.isArray(officeTask.steps)) return "";
  const rows = officeTask.steps.map((step) => {
    const status = step.status === "failed" ? "失败" : step.status === "complete" ? "完成" : step.status === "running" ? "运行中" : "等待";
    return `<div class="office-task-step ${escapeAttr(step.status || "pending")}"><span>${escapeHtml(status)}</span><strong>${escapeHtml(step.name || "")}</strong><small>${escapeHtml(step.detail || step.error || "")}</small></div>`;
  }).join("");
  const file = officeTask.file || {};
  const meta = [file.fileType, file.path, file.size ? formatBytes(file.size) : ""].filter(Boolean).join(" · ");
  return `<div class="office-task-mini"><div class="office-task-mini-head"><strong>${escapeHtml(officeTask.action || "Office 任务")}</strong><small>${escapeHtml(meta)}</small></div>${rows}</div>`;
}

function renderToolSteps() {
  const steps = state.toolSteps || [];
  els.toolSteps.innerHTML = "";
  if (!steps.length) {
    const empty = document.createElement("div");
    empty.className = "empty-panel";
    empty.innerHTML = `
      <strong>暂无任务步骤</strong>
      <small>开启"本地工具"后，模型调用文件或命令工具时会显示在这里。</small>
    `;
    els.toolSteps.append(empty);
    return;
  }

  const skillNames = { "local-files": "本地文件助手", "spreadsheet-pro": "表格处理", "document-reader": "文档阅读", "finance-tables": "财务表格", "code-review": "代码审查", "web-browser": "网页助手", "desktop-control": "电脑操作", "local-command": "本地命令" };

  for (const [index, step] of steps.entries()) {
    const item = document.createElement("article");

    if (step.name === "invoke_skill") {
      // 技能调用：特殊渲染，显示子步骤
      const skillId = step.args?.skill || "";
      const skillLabel = skillNames[skillId] || skillId;
      const subSteps = Array.isArray(step.result?.steps) ? step.result.steps : [];
      const ok = step.result?.ok !== false;
      item.className = `tool-step tool-step-skill${ok ? "" : " tool-step-error"}`;
      const subStepsHtml = subSteps.length
        ? subSteps.map((sub) => `<div class="skill-sub-step"><span>${escapeHtml(formatToolName(sub.name))}</span><small>${escapeHtml(safeJsonPreview(sub.result || {}, 200))}</small></div>`).join("")
        : "<small style='opacity:.5'>（无子步骤）</small>";
      const receiptText = receiptSummary(step);
      item.innerHTML = `
        <strong>${index + 1}. ▶ 技能子智能体：${escapeHtml(skillLabel)}</strong>
        <small>${escapeHtml((step.args?.task || "").slice(0, 160))}</small>
        ${receiptText ? `<small>${escapeHtml(receiptText)}</small>` : ""}
        <div class="skill-sub-steps">${subStepsHtml}</div>
        <pre>${escapeHtml((step.result?.content || "").slice(0, 600))}</pre>
      `;
    } else {
      const ok = step.result?.ok !== false;
      const receiptText = receiptSummary(step);
      const verificationText = verificationSummary(step);
      const officeTaskHtml = officeTaskSummaryHtml(step.result?.officeTask);
      item.className = `tool-step${ok ? "" : " tool-step-error"}`;
      item.innerHTML = `
        <strong>${index + 1}. ${escapeHtml(formatToolName(step.name))}</strong>
        <small>${escapeHtml(safeJsonPreview(step.args || {}, 220))}</small>
        ${receiptText ? `<small>${escapeHtml(receiptText)}</small>` : ""}
        ${verificationText ? `<pre>${escapeHtml(verificationText)}</pre>` : ""}
        ${officeTaskHtml}
        <pre>${escapeHtml(safeJsonPreview(step.result || {}, 900))}</pre>
      `;
    }
    els.toolSteps.append(item);
  }
}

function artifactKindFromPath(filePath = "", fallback = "file") {
  const ext = String(filePath).split(".").pop()?.toLowerCase() || "";
  if (["xlsx", "xlsm", "xls", "csv", "tsv"].includes(ext)) return "sheet";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "heic"].includes(ext)) return "image";
  return fallback || "file";
}

function artifactNameFromPath(filePath = "") {
  return String(filePath || "未命名文件").split(/[\\/]/).filter(Boolean).pop() || filePath || "未命名文件";
}

function workspaceRootName() {
  return state.workspaceRoot ? state.workspaceRoot.split(/[\\/]/).filter(Boolean).pop() : "";
}

function workspaceFullPath(relPath = ".") {
  if (!state.workspaceRoot) return "";
  const root = String(state.workspaceRoot).replace(/[\\/]+$/, "");
  const clean = String(relPath || ".").replace(/^[/\\]+/, "");
  if (!clean || clean === ".") return root;
  return `${root}/${clean}`;
}

function workspacePathLabel(relPath = ".") {
  const clean = String(relPath || ".").trim();
  return !clean || clean === "." ? "工作区根目录" : clean;
}

function normalizeArtifact(artifact = {}) {
  const path = String(artifact.path || "").trim();
  if (!path) return null;
  return {
    id: artifact.id || id("artifact"),
    name: artifact.name || artifactNameFromPath(path),
    path,
    kind: artifactKindFromPath(path, artifact.kind),
    size: Number(artifact.size || 0),
    source: artifact.source || "结果",
    summary: artifact.summary || "",
    createdAt: artifact.createdAt || nowIso()
  };
}

function recordArtifacts(artifacts = []) {
  const normalized = artifacts.map(normalizeArtifact).filter(Boolean);
  if (!normalized.length) return;
  const byPath = new Map((state.artifacts || []).map((artifact) => [artifact.path, artifact]));
  for (const artifact of normalized) {
    byPath.set(artifact.path, { ...(byPath.get(artifact.path) || {}), ...artifact, id: byPath.get(artifact.path)?.id || artifact.id });
  }
  state.artifacts = [...byPath.values()]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 80);
  renderArtifacts();
  saveState();
}

function artifactsFromAttachments(attachments = []) {
  return attachments
    .filter((attachment) => attachment.path)
    .map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      path: attachment.path,
      kind: attachment.kind,
      size: attachment.size,
      source: "上传",
      summary: attachment.summary,
      createdAt: attachment.savedAt || nowIso()
    }));
}

function artifactsFromSavedPaths(paths = [], source = "生成") {
  return paths.map((filePath) => ({
    path: filePath,
    kind: artifactKindFromPath(filePath),
    source,
    summary: "已保存到工作区"
  }));
}

function cleanTableSummary(result = {}) {
  const sheetSummaries = Array.isArray(result.summary?.sheets) ? result.summary.sheets : [];
  const first = sheetSummaries[0] || result.summary || {};
  const beforeRows = first.beforeRows;
  const afterRows = first.afterRows;
  const beforeColumns = first.beforeColumns;
  const afterColumns = first.afterColumns;
  const ops = Array.isArray(first.operations) ? first.operations.filter(Boolean).join("、") : "";
  const changes = [];
  if (beforeRows !== undefined && afterRows !== undefined) changes.push(`${beforeRows}→${afterRows} 行`);
  if (beforeColumns !== undefined && afterColumns !== undefined) changes.push(`${beforeColumns}→${afterColumns} 列`);
  if (sheetSummaries.length > 1) changes.push(`${sheetSummaries.length} 个工作表`);
  if (ops) changes.push(ops);
  return changes.length ? `表格清洗完成：${changes.join(" · ")}` : "表格清洗完成";
}

function artifactsFromToolSteps(steps = []) {
  const artifacts = [];
  for (const step of steps) {
    if (!step.result?.ok) continue;
    if (step.name === "clean_table_files") {
      for (const result of step.result.results || []) {
        if (!result.ok || !result.path) continue;
        artifacts.push({
          path: result.path,
          kind: "sheet",
          size: result.size || 0,
          source: "批量清洗",
          summary: cleanTableSummary(result)
        });
      }
      continue;
    }
    if (step.name === "download_url" && step.result.path) {
      artifacts.push({
        path: step.result.path,
        kind: artifactKindFromPath(step.result.path),
        size: step.result.size || 0,
        source: "下载",
        summary: "网页文件已下载"
      });
      continue;
    }
    if (step.name === "read_web_page" && step.result.path) {
      artifacts.push({
        path: step.result.path,
        kind: artifactKindFromPath(step.result.path),
        size: 0,
        source: "网页",
        summary: step.result.title ? `已保存网页：${step.result.title}` : "网页内容已保存"
      });
      continue;
    }
    if (!["write_file", "export_image", "create_excel_file", "create_word_file", "create_ppt_file", "clean_table_file"].includes(step.name) || !step.result.path) continue;
    artifacts.push({
      path: step.result.path,
      kind: ["create_excel_file", "clean_table_file"].includes(step.name) ? "sheet" : artifactKindFromPath(step.result.path),
      size: step.result.size || 0,
      source: step.name === "create_excel_file" ? "Excel" : step.name === "create_word_file" ? "Word" : step.name === "create_ppt_file" ? "PPT" : step.name === "clean_table_file" ? "清洗" : step.name === "export_image" ? "图片" : "写入",
      summary: step.name === "create_excel_file"
        ? `生成 ${step.result.sheets?.length || 1} 个工作表`
        : step.name === "create_word_file"
          ? "生成 Word 文档并通过回读校验"
          : step.name === "create_ppt_file"
            ? `生成 ${step.result.slideCount || step.result.verification?.details?.slideCount || 0} 页 PPT 并通过回读校验`
        : step.name === "clean_table_file"
          ? cleanTableSummary(step.result)
          : step.name === "export_image"
            ? `导出 ${step.result.width || ""}x${step.result.height || ""} ${String(step.result.format || "").toUpperCase()} 图片`.trim()
            : "模型通过本地工具写入"
    });
  }
  return artifacts;
}

function clearArtifacts() {
  state.artifacts = [];
  saveState();
  renderArtifacts();
}

function renderArtifacts() {
  if (!els.artifactList) return;
  const artifacts = state.artifacts || [];
  els.artifactList.innerHTML = "";
  if (!artifacts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-panel";
    empty.innerHTML = `
      <strong>暂无结果文件</strong>
      <small>上传、生成或写入的文件会出现在这里。</small>
    `;
    els.artifactList.append(empty);
    return;
  }

  for (const artifact of artifacts) {
    const item = document.createElement("article");
    const fullPath = workspaceFullPath(artifact.path);
    const pathTitle = fullPath || artifact.path || "";
    item.className = "artifact-item";
    item.title = pathTitle;
    item.innerHTML = `
      <span class="artifact-icon">${fileIcon(artifact.kind)}</span>
      <div class="artifact-main">
        <strong>${escapeHtml(artifact.name || artifactNameFromPath(artifact.path))}</strong>
        <small title="${escapeAttr(pathTitle)}">${escapeHtml([`工作区内：${artifact.path}`, artifact.size ? formatBytes(artifact.size) : ""].filter(Boolean).join(" · "))}</small>
        ${fullPath ? `<em title="${escapeAttr(fullPath)}">${escapeHtml(fullPath)}</em>` : ""}
        ${artifact.summary ? `<em>${escapeHtml(artifact.summary)}</em>` : ""}
      </div>
      <span class="artifact-source">${escapeHtml(artifact.source || "结果")}</span>
      <div class="artifact-actions">
        <button class="ghost-button small" data-action="open" type="button">打开</button>
        <button class="ghost-button small" data-action="reveal" type="button">定位</button>
      </div>
    `;
    item.querySelector("[data-action='open']").addEventListener("click", () => openArtifact(artifact.path));
    item.querySelector("[data-action='reveal']").addEventListener("click", () => revealArtifact(artifact.path));
    els.artifactList.append(item);
  }
}

async function openArtifact(filePath) {
  await postWorkspacePathAction("/api/workspace/open", filePath, "正在打开文件", "打开失败");
}

async function revealArtifact(filePath) {
  await postWorkspacePathAction("/api/workspace/reveal", filePath, "正在定位文件", "定位失败");
}

async function postWorkspacePathAction(url, filePath, runningTitle, errorTitle) {
  setStatus(runningTitle, filePath, "running");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || errorTitle);
    setStatus("已完成", filePath, "complete");
  } catch (error) {
    setStatus(errorTitle, error.message, "error");
  }
}

function formatToolName(name) {
  return (
    {
      list_files: "列出文件",
      read_file: "读取文件",
      inspect_office_file: "检查 Office",
      read_excel_file: "读取表格",
      write_file: "写入文件",
      export_image: "导出图片",
      create_excel_file: "生成 Excel",
      create_word_file: "生成 Word",
      create_ppt_file: "生成 PPT",
      clean_table_file: "清洗表格",
      clean_table_files: "批量清洗表格",
      verify_office_file: "校验 Office",
      search_files: "搜索文件",
      search_web: "搜索网页",
      read_web_page: "读取网页",
      download_url: "下载网页文件",
      open_url: "打开网页",
      open_workspace_item: "打开本地文件",
      open_desktop_app: "打开应用",
      show_desktop_notification: "系统通知",
      run_command: "运行命令"
    }[name] || name || "工具"
  );
}

function safeJsonPreview(value, limit = 500) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

async function loadWorkspaceTree(path = ".") {
  state.workspacePath = path || ".";
  saveState();
  els.filePathLabel.textContent = workspacePathLabel(state.workspacePath);
  els.filePathLabel.title = workspaceFullPath(state.workspacePath);
  els.fileTree.innerHTML = `<div class="empty-panel"><strong>正在读取文件</strong></div>`;
  try {
    const response = await fetch(`/api/workspace/tree?path=${encodeURIComponent(state.workspacePath)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "文件列表读取失败");
    renderFileTree(data.entries || []);
  } catch (error) {
    els.fileTree.innerHTML = `<div class="empty-panel"><strong>${escapeHtml(error.message)}</strong></div>`;
  }
}

async function chooseWorkspaceFolder() {
  if (!els.selectWorkspaceBtn) return;
  els.selectWorkspaceBtn.disabled = true;
  setStatus("选择工作区", "请在系统窗口中选择本地文件夹", "running");
  try {
    const response = await fetch("/api/workspace/select-folder", { method: "POST" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "无法选择文件夹");
    if (data.canceled) {
      setStatus("已取消", "仍使用当前工作区", "complete");
      return;
    }

    state.workspaceRoot = data.workspace || "";
    state.workspacePath = ".";
    state.currentFile = null;
    state.workspaceOpen = true;
    state.workspaceTab = "files";
    els.fileEditorTitle.textContent = "未选择文件";
    els.fileEditorTitle.title = "";
    els.fileEditorInput.value = "";
    els.saveFileBtn.disabled = true;
    saveState();
    renderWorkspacePanel();
    await loadWorkspaceTree(".");
    setStatus("已切换工作区", data.workspace || "", "complete");
  } catch (error) {
    setStatus("选择失败", error.message, "error");
  } finally {
    els.selectWorkspaceBtn.disabled = false;
  }
}

async function chooseExternalPaths() {
  if (!els.selectExternalPathsBtn) return;
  els.selectExternalPathsBtn.disabled = true;
  setStatus("申请外部文件权限", "请在系统窗口中选择文件或文件夹", "running");
  try {
    const selectedPaths = await requestExternalPathsFromDesktop();
    if (!selectedPaths.length) {
      setStatus("已取消", "没有新增授权路径", "complete");
      return;
    }
    mergeExternalPaths(selectedPaths);
    saveState();
    renderSettingsForm();
    setToolSettingsFeedback("授权路径已更新");
    setStatus("已授权外部读取", selectedPaths.join("、"), "complete");
    addTaskEvent("已授权外部读取", selectedPaths.join("、"), "complete", { persist: false });
  } catch (error) {
    setStatus("授权失败", error.message, "error");
  } finally {
    els.selectExternalPathsBtn.disabled = false;
  }
}

function renderFileTree(entries) {
  els.fileTree.innerHTML = "";
  if (state.workspacePath && state.workspacePath !== ".") {
    const parent = document.createElement("button");
    parent.type = "button";
    parent.className = "file-item";
    parent.innerHTML = `<span>↖</span><span>上一级</span>`;
    parent.addEventListener("click", () => loadWorkspaceTree(parentPath(state.workspacePath)));
    els.fileTree.append(parent);
  }
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-panel";
    empty.innerHTML = `<strong>这里没有文件</strong>`;
    els.fileTree.append(empty);
    return;
  }
  for (const entry of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "file-item";
    button.innerHTML = `<span>${entry.type === "directory" ? "▸" : "□"}</span><span>${escapeHtml(entry.name)}</span>`;
    button.addEventListener("click", () => {
      if (entry.type === "directory") loadWorkspaceTree(entry.path);
      else openWorkspaceFile(entry.path);
    });
    els.fileTree.append(button);
  }
}

function parentPath(path) {
  const parts = String(path || ".")
    .split("/")
    .filter(Boolean);
  parts.pop();
  return parts.join("/") || ".";
}

async function openWorkspaceFile(path) {
  els.fileFeedback.textContent = "正在打开文件...";
  els.saveFileBtn.disabled = true;
  try {
    const response = await fetch(`/api/workspace/file?path=${encodeURIComponent(path)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "文件打开失败");
    state.currentFile = data.readonly ? null : data.path;
    saveState();
    els.fileEditorTitle.textContent = data.readonly ? `${data.path}（只读预览）` : data.path;
    els.fileEditorTitle.title = workspaceFullPath(data.path);
    els.fileEditorInput.value = data.content || "";
    els.saveFileBtn.disabled = Boolean(data.readonly);
    setFileFeedback(data.readonly ? "已打开只读预览" : "已打开");
  } catch (error) {
    setFileFeedback(error.message, "error");
  }
}

async function saveCurrentFile() {
  if (!state.currentFile) return;
  els.saveFileBtn.disabled = true;
  setFileFeedback("正在保存...");
  try {
    const response = await fetch("/api/workspace/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: state.currentFile, content: els.fileEditorInput.value })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "保存失败");
    setFileFeedback("已保存", "ok");
  } catch (error) {
    setFileFeedback(error.message, "error");
  } finally {
    els.saveFileBtn.disabled = false;
  }
}

function setFileFeedback(text, type = "") {
  els.fileFeedback.textContent = text;
  els.fileFeedback.className = type;
}

async function runTerminalCommand(event) {
  event.preventDefault();
  const command = els.terminalInput.value.trim();
  if (!command) return;
  if (!window.confirm(`将在当前工作区运行本地命令：\n\n${command}\n\n确认继续吗？`)) {
    els.terminalOutput.textContent = "已取消运行。";
    return;
  }
  els.terminalOutput.textContent = "正在运行...";
  try {
    const response = await fetch("/api/shell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, confirmed: true })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "命令运行失败");
    const result = data.result || {};
    els.terminalOutput.textContent = [
      `$ ${command}`,
      result.stdout || "",
      result.stderr ? `\n${result.stderr}` : "",
      result.error ? `\n${result.error}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  } catch (error) {
    els.terminalOutput.textContent = error.message;
  }
}

function openSettings() {
  els.settingsSheet.classList.add("open");
  els.settingsBackdrop.classList.remove("hidden");
}

function closeSettings() {
  els.settingsSheet.classList.remove("open");
  els.settingsBackdrop.classList.add("hidden");
}

function toggleSettings() {
  els.settingsSheet.classList.contains("open") ? closeSettings() : openSettings();
}

function bindResizer(handle, side) {
  if (!handle) return;
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (side === "left" && window.matchMedia("(max-width: 680px)").matches) return;
    if (side === "right" && (!state.workspaceOpen || window.matchMedia("(max-width: 900px)").matches)) return;
    document.body.classList.add("resizing");
    const startX = event.clientX;
    const start = side === "left" ? state.layout.sidebarWidth : state.layout.rightWidth;
    const onMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      if (side === "left") {
        state.layout.sidebarWidth = clamp(start + delta, 220, 430);
      } else {
        state.layout.rightWidth = clamp(start - delta, 260, 440);
      }
      applyLayout();
    };
    const onUp = () => {
      document.body.classList.remove("resizing");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      saveState();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function requestInfoText(request, usage) {
  const endpoint = request.endpoint ? safeHost(request.endpoint) : "";
  const usageText = formatUsage(usage);
  const thinking = request.thinking ? thinkingOptions[request.thinking]?.label : "";
  return [request.provider, request.model, endpoint, thinking, usageText].filter(Boolean).join(" · ");
}

function requestModelText(request = {}) {
  return String(request.model || "").trim();
}

function safeHost(value) {
  if (String(value).startsWith("local://")) return value;
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function formatUsage(usage) {
  if (!usage || typeof usage !== "object") return "";
  const input = usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount;
  const output = usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount;
  const total = usage.total_tokens ?? usage.totalTokenCount;
  if (total !== undefined) return `${total} tokens`;
  if (input !== undefined || output !== undefined) return `${input ?? 0} in / ${output ?? 0} out`;
  return "";
}

function titleFromMessages(messages) {
  const first = messages.find((message) => message.role === "user" && message.content?.trim());
  const firstAttachment = messages
    .find((message) => message.role === "user" && Array.isArray(message.attachments) && message.attachments.length)
    ?.attachments?.[0];
  const title = first?.content?.trim() || firstAttachment?.name || "新对话";
  return title.length > 18 ? `${title.slice(0, 18)}…` : title;
}

function relativeTime(value) {
  const diff = Date.now() - new Date(value).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  return `${Math.floor(diff / day)} 天前`;
}

function shortTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    if (data.platform) {
      document.documentElement.classList.toggle("platform-win", data.platform === "win32");
    }
    els.healthText && (els.healthText.textContent = data.ok ? "已连接" : "离线");
    if (els.appVersionBadge && data.version) els.appVersionBadge.textContent = `v${data.version}`;
    if (els.aboutVersionLabel && data.version) els.aboutVersionLabel.textContent = `v${data.version}`;
    if (els.workspaceStatusVersion && data.version) els.workspaceStatusVersion.textContent = `neo-core v${data.version}`;
    if (data.workspace) {
      state.workspaceRoot = data.workspace;
      saveState();
      renderWorkspacePanel();
    }
  } catch {
    els.healthText && (els.healthText.textContent = "离线");
  }
}

function initAmbientMotion() {
  const canvas = els.ambientMotionCanvas;
  if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let particles = [];
  let rafId = 0;
  const mouse = { x: -1000, y: -1000, active: false };

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.max(26, Math.min(64, Math.round((width * height) / 26000)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      size: 0.6 + Math.random() * 1.2,
      alpha: 0.05 + Math.random() * 0.11
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, width, height);
    for (const dot of particles) {
      dot.x += dot.vx;
      dot.y += dot.vy;
      if (dot.x < -4) dot.x = width + 4;
      if (dot.x > width + 4) dot.x = -4;
      if (dot.y < -4) dot.y = height + 4;
      if (dot.y > height + 4) dot.y = -4;

      if (mouse.active) {
        const dx = mouse.x - dot.x;
        const dy = mouse.y - dot.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 180) {
          const force = (180 - distance) / 180;
          dot.x += dx * force * 0.008;
          dot.y += dy * force * 0.008;
        }
      }

      ctx.fillStyle = `rgba(1, 105, 204, ${dot.alpha})`;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
      ctx.fill();
    }
    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("mousemove", (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.active = true;
  }, { passive: true });
  window.addEventListener("mouseleave", () => { mouse.active = false; }, { passive: true });

  resize();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

function setUpdateFeedback(message, type = "") {
  if (!els.updateFeedback) return;
  els.updateFeedback.textContent = message || "";
  els.updateFeedback.className = `sheet-feedback ${type}`.trim();
}

function clampProgress(value) {
  return clamp(Number(value || 0), 0, 100);
}

function shouldShowUpdateProgress(data = {}) {
  return Boolean(
    data.readyToInstall ||
    data.status === "downloading" ||
    data.status === "downloaded" ||
    data.status === "installing"
  );
}

function renderUpdateProgress(data = {}) {
  const fallbackProgress = data.status === "checking" ? 8 : data.status === "downloading" ? 35 : 0;
  const progress = clampProgress(Number.isFinite(Number(data.progress)) ? data.progress : fallbackProgress);
  const title = data.message || "检查更新";
  const visible = shouldShowUpdateProgress(data);

  els.updateProgressPanel?.classList.toggle("visible", visible);
  els.updateProgressPanel?.classList.toggle("error", data.status === "error");
  els.updateProgressPanel?.setAttribute("aria-hidden", String(!visible));
  if (els.updateProgressPercent) els.updateProgressPercent.textContent = `${Math.round(progress)}%`;
  if (els.updateProgressFill) els.updateProgressFill.style.width = `${progress}%`;
  if (els.updateProgressTrack) {
    els.updateProgressTrack.setAttribute("aria-valuenow", String(Math.round(progress)));
    els.updateProgressTrack.setAttribute("aria-label", `${title} ${Math.round(progress)}%`);
  }
}

function setUpdateButtonMode(readyToInstall, manualInstallRequired = false) {
  updateReadyToInstall = Boolean(readyToInstall);
  updateManualInstallRequired = Boolean(manualInstallRequired);
  if (!els.checkUpdatesBtn) return;
  els.checkUpdatesBtn.textContent = updateManualInstallRequired ? "打开下载页" : updateReadyToInstall ? "重启安装" : "检查更新";
}

function updateFeedbackType(data = {}) {
  if (data.status === "error" || data.ok === false) return "error";
  if (data.readyToInstall || data.status === "downloaded" || data.status === "not-available") return "ok";
  return "";
}

function shouldPollUpdateStatus(data = {}) {
  return Boolean(data.checking || data.status === "checking" || data.status === "downloading");
}

function stopUpdateStatusPolling() {
  window.clearInterval(updateStatusPollTimer);
  updateStatusPollTimer = null;
}

function startUpdateStatusPolling() {
  if (updateStatusPollTimer) return;
  updateStatusPollTimer = window.setInterval(() => refreshUpdateStatus({ silent: true }), 2000);
}

function applyUpdateStatus(data = {}, options = {}) {
  const message = data.message || (data.supported ? "已开始检查更新" : "检查更新只在安装包版本生效");
  renderUpdateProgress({ ...data, message });
  setUpdateButtonMode(data.readyToInstall || data.status === "downloaded" || data.status === "manual-install", data.manualInstallRequired);
  if (!options.silent || data.readyToInstall || data.status === "downloaded" || data.status === "error") {
    setUpdateFeedback(message, updateFeedbackType(data));
  }
  if (shouldPollUpdateStatus(data)) startUpdateStatusPolling();
  else stopUpdateStatusPolling();
}

async function refreshUpdateStatus(options = {}) {
  try {
    const response = await fetch("/api/desktop/update-status");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "更新状态读取失败");
    applyUpdateStatus(data, options);
  } catch (error) {
    stopUpdateStatusPolling();
    if (!options.silent) setUpdateFeedback(error.message || "更新状态读取失败", "error");
  }
}

async function installAppUpdate() {
  if (!els.checkUpdatesBtn) return;
  els.checkUpdatesBtn.disabled = true;
  setUpdateFeedback(updateManualInstallRequired ? "正在打开下载页..." : "正在重启安装更新...");
  renderUpdateProgress({
    ok: true,
    supported: true,
    status: updateManualInstallRequired ? "manual-install" : "installing",
    progress: 100,
    message: updateManualInstallRequired ? "正在打开下载页" : "正在重启安装更新",
    detail: updateManualInstallRequired ? "请下载最新版后手动覆盖安装" : "正在退出 neo 并交给安装器"
  });
  try {
    const response = await fetch("/api/desktop/install-update", { method: "POST" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || data.message || "重启安装失败");
    applyUpdateStatus(data);
  } catch (error) {
    setUpdateFeedback(error.message || "重启安装失败", "error");
    els.checkUpdatesBtn.disabled = false;
  }
}

async function checkAppUpdate() {
  if (!els.checkUpdatesBtn) return;
  if (updateReadyToInstall) {
    await installAppUpdate();
    return;
  }
  els.checkUpdatesBtn.disabled = true;
  setUpdateFeedback("正在检查更新...");
  renderUpdateProgress({
    ok: true,
    supported: true,
    status: "checking",
    progress: 8,
    message: "正在检查更新...",
    detail: "正在连接更新源"
  });
  try {
    const response = await fetch("/api/desktop/check-update", { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "检查更新失败");
    applyUpdateStatus(data);
  } catch (error) {
    setUpdateFeedback(error.message || "检查更新失败", "error");
  } finally {
    els.checkUpdatesBtn.disabled = false;
  }
}

function environmentStatusLabel(status) {
  if (status === "ok") return "正常";
  if (status === "missing") return "缺失";
  if (status === "outdated") return "需更新";
  return "建议";
}

function environmentTargets() {
  return [
    {
      summary: els.environmentSummary,
      list: els.environmentList,
      output: els.environmentOutput,
      installBtn: els.installMissingEnvironmentBtn,
      copyBtn: els.copyEnvironmentCommandBtn,
      recheckBtn: els.recheckEnvironmentBtn
    },
    {
      summary: els.environmentModalSummary,
      list: els.environmentModalList,
      output: els.environmentModalOutput,
      installBtn: els.modalInstallMissingEnvironmentBtn,
      copyBtn: els.modalCopyEnvironmentCommandBtn,
      recheckBtn: els.modalRecheckEnvironmentBtn
    }
  ].filter((target) => target.summary || target.list || target.output);
}

function setEnvironmentSummary(text = "") {
  for (const target of environmentTargets()) {
    if (target.summary) target.summary.textContent = text;
  }
}

function setEnvironmentOutput(text = "") {
  for (const target of environmentTargets()) {
    if (target.output) target.output.textContent = text;
  }
}

function setEnvironmentActionState({ disabled = false, installableItems = null } = {}) {
  for (const target of environmentTargets()) {
    if (target.installBtn) {
      if (installableItems) target.installBtn.hidden = installableItems.length === 0;
      target.installBtn.disabled = disabled || (installableItems ? installableItems.length === 0 : false);
    }
    if (target.copyBtn) {
      if (installableItems) target.copyBtn.hidden = installableItems.length === 0;
      target.copyBtn.disabled = disabled || (installableItems ? installableItems.length === 0 : false);
    }
    if (target.recheckBtn) target.recheckBtn.disabled = disabled;
  }
}

function isEnvironmentPromptMuted() {
  try {
    return localStorage.getItem(environmentPromptMutedStorageKey) === "1";
  } catch {
    return false;
  }
}

function setEnvironmentPromptMuted(value) {
  try {
    if (value) localStorage.setItem(environmentPromptMutedStorageKey, "1");
    else localStorage.removeItem(environmentPromptMutedStorageKey);
  } catch {}
  if (els.environmentNoPromptCheck) els.environmentNoPromptCheck.checked = Boolean(value);
}

function showEnvironmentModal() {
  if (els.environmentNoPromptCheck) els.environmentNoPromptCheck.checked = isEnvironmentPromptMuted();
  els.environmentModal.classList.remove("hidden");
}

function hideEnvironmentModal() {
  setEnvironmentPromptMuted(Boolean(els.environmentNoPromptCheck?.checked));
  els.environmentModal.classList.add("hidden");
  state.onboardingComplete = true;
  localStorage.setItem(onboardingStorageKey, "1");
  saveState();
}

async function checkEnvironment(options = {}) {
  const { show = false, suppressPrompt = false } = options;
  const firstRun = !state.onboardingComplete;
  if (show) showEnvironmentModal();
  setEnvironmentSummary(firstRun ? "正在进行首次部署检测" : "正在检测 neo 运行环境");
  for (const target of environmentTargets()) {
    if (target.list) target.list.innerHTML = "";
  }
  setEnvironmentOutput("");
  setEnvironmentActionState({ disabled: true });

  try {
    const response = await fetch("/api/environment/check");
    const data = await response.json();
    if (!response.ok || !data.items) throw new Error(data.error || "环境检测失败");
    renderEnvironment(data);
    const shouldPrompt = !isEnvironmentPromptMuted()
      && (firstRun || data.summary.missingRequired > 0 || data.summary.recommendedMissing > 0);
    if (show || (!suppressPrompt && shouldPrompt)) showEnvironmentModal();
  } catch (error) {
    setEnvironmentSummary(error.message);
    setEnvironmentActionState({ disabled: false, installableItems: [] });
    if (show || (!suppressPrompt && !isEnvironmentPromptMuted())) showEnvironmentModal();
  }
}

function renderEnvironment(data) {
  lastEnvironmentData = data;
  const missing = data.summary.missingRequired;
  const recommended = data.summary.recommendedMissing;
  const firstRun = !state.onboardingComplete;
  const summary = missing
    ? `缺少 ${missing} 个必要环境，建议先补齐`
    : recommended
      ? `必要环境正常，还有 ${recommended} 个推荐环境可补充`
      : firstRun
        ? "部署检测完成，环境正常，可以直接使用"
        : "环境正常，可以直接使用";
  setEnvironmentSummary(summary);
  for (const target of environmentTargets()) {
    if (target.list) target.list.innerHTML = "";
  }
  const installableItems = data.items.filter((item) => item.installable);
  setEnvironmentActionState({ disabled: false, installableItems });

  const createEnvironmentRow = (item) => {
    const row = document.createElement("div");
    row.className = `environment-item ${item.status}`;
    row.innerHTML = `
      <div class="environment-main">
        <div class="environment-name">
          <span>${escapeHtml(item.label)}</span>
          <span class="status-pill ${escapeAttr(item.status)}">${environmentStatusLabel(item.status)}</span>
          <span class="status-pill">${item.required ? "必要" : "推荐"}</span>
        </div>
        <div class="environment-detail">${escapeHtml(item.description || "")}</div>
        <div class="environment-detail">${escapeHtml([item.version, item.path].filter(Boolean).join(" · ") || "未检测到")}</div>
        ${item.installCommand ? `<div class="environment-command">${escapeHtml(item.installCommand)}</div>` : ""}
      </div>
    `;
    if (item.installable) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "primary-button";
      button.textContent = item.status === "outdated" ? "更新" : "安装";
      button.addEventListener("click", () => installEnvironmentItem(item));
      row.append(button);
    }
    return row;
  };

  for (const target of environmentTargets()) {
    if (!target.list) continue;
    for (const item of data.items) {
      target.list.append(createEnvironmentRow(item));
    }
  }
}

function environmentInstallCommandText(data = lastEnvironmentData) {
  const commands = [];
  const seen = new Set();
  for (const item of data?.items || []) {
    if (!item.installable || !item.installCommand || seen.has(item.installCommand)) continue;
    seen.add(item.installCommand);
    commands.push(`# ${item.label}\n${item.installCommand}`);
  }
  return commands.join("\n\n");
}

async function copyEnvironmentCommands() {
  const command = environmentInstallCommandText();
  if (!command) {
    setEnvironmentOutput("当前没有需要复制的安装命令。");
    return;
  }
  try {
    await navigator.clipboard.writeText(command);
    setEnvironmentOutput("已复制可补齐环境的命令。");
  } catch {
    setEnvironmentOutput(command);
  }
}

async function installMissingEnvironment() {
  const confirmed = window.confirm("neo 将打开终端，按顺序安装缺失的必要/推荐环境。继续吗？");
  if (!confirmed) return;
  setEnvironmentActionState({ disabled: true });
  setEnvironmentOutput("正在准备一键补齐环境...");
  try {
    const response = await fetch("/api/environment/install-missing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeRecommended: true })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || data.message || "启动失败");
    setEnvironmentOutput(data.command
      ? `${data.message}\n\n已打开终端执行环境补齐脚本。完成后请点击“重新检测”。`
      : data.message);
  } catch (error) {
    setEnvironmentOutput(error.message);
  } finally {
    setEnvironmentActionState({ disabled: false });
  }
}

async function installEnvironmentItem(item) {
  const confirmed = window.confirm(`neo 将打开终端执行：\n\n${item.installCommand}\n\n继续吗？`);
  if (!confirmed) return;
  setEnvironmentOutput("正在准备安装...");
  try {
    const response = await fetch("/api/environment/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || data.message || "安装启动失败");
    setEnvironmentOutput(`${data.message}\n\n${data.command}`);
  } catch (error) {
    setEnvironmentOutput(error.message);
  }
}

els.newChatBtn.addEventListener("click", createNewConversation);
els.toggleHistoryBtn.addEventListener("click", toggleHistory);
els.sidebarToggleBtn?.addEventListener("click", () => setSidebarOpen(state.sidebarOpen === false));
els.workspaceToggleBtn.addEventListener("click", () => setWorkspaceOpen(!state.workspaceOpen));
els.collapseWorkspaceBtn.addEventListener("click", () => setWorkspaceOpen(false));
els.workspaceTabs.forEach((tabButton) => {
  tabButton.addEventListener("click", () => selectWorkspaceTab(tabButton.dataset.panelTab));
});
els.clearTaskEventsBtn?.addEventListener("click", clearTaskEvents);
els.retryTaskBtn?.addEventListener("click", rerunLastUserTask);
els.clearArtifactsBtn?.addEventListener("click", clearArtifacts);
els.selectWorkspaceBtn?.addEventListener("click", chooseWorkspaceFolder);
els.fileRootBtn.addEventListener("click", () => loadWorkspaceTree("."));
els.saveFileBtn.addEventListener("click", saveCurrentFile);
els.terminalForm.addEventListener("submit", runTerminalCommand);
els.settingsToggleBtn.addEventListener("click", toggleSettings);
els.settingsBackdrop.addEventListener("click", closeSettings);
els.settingsReturnBtn?.addEventListener("click", closeSettings);
els.closeSettingsBtn?.addEventListener("click", closeSettings);
els.checkUpdatesBtn?.addEventListener("click", checkAppUpdate);

document.querySelectorAll("[data-settings-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.settingsTab;
    document.querySelectorAll("[data-settings-tab]").forEach((t) => {
      t.classList.toggle("active", t.dataset.settingsTab === target);
      t.setAttribute("aria-selected", String(t.dataset.settingsTab === target));
    });
    document.querySelectorAll("[data-settings-pane]").forEach((pane) => {
      pane.classList.toggle("active", pane.dataset.settingsPane === target);
    });
    if (target === "providers") renderProviderLibrary();
    if (target === "appearance") renderAppearanceSettings();
    if (target === "skills") renderSkillLibrary();
    if (target === "memory") renderMemoryList();
    if (target === "archive") renderArchiveList();
    if (target === "environment") checkEnvironment({ show: false, suppressPrompt: true });
    if (target === "petdex") initPetdexPanel();
  });
});
els.saveSettingsBtn.addEventListener("click", updateSelectedProviderFromForm);
els.addProviderBtn.addEventListener("click", addProvider);
els.enableRecommendedSkillsBtn?.addEventListener("click", enableRecommendedSkills);
els.testApiBtn.addEventListener("click", testCurrentApi);
els.dismissStatusBtn.addEventListener("click", () => els.sendStatusToast.classList.add("hidden"));
els.sendBtn.addEventListener("click", (event) => {
  if (!busy) return;
  event.preventDefault();
  cancelActiveRequest();
});
els.activeProviderButton?.addEventListener("click", (e) => toggleModelPopover(e, "provider"));
els.activeModelButton.addEventListener("click", (e) => toggleModelPopover(e, "model"));
els.thinkingButton?.addEventListener("click", (e) => toggleModelPopover(e, "model"));
els.pickerBackBtn?.addEventListener("click", () => openPopoverPane("provider"));
els.thinkingSelect?.addEventListener("change", (event) => {
  state.thinking = event.target.value;
  saveState();
  renderSelectors();
});
els.activeProviderSelect.addEventListener("change", (event) => selectActiveProvider(event.target.value));
els.activeModelSelect.addEventListener("change", (event) => selectActiveModel(event.target.value));
els.customModelInput.addEventListener("input", (event) => {
  state.customModel = event.target.value;
  saveState();
  renderSelectors();
});
els.autoModelRoutingSelect?.addEventListener("change", (event) => {
  state.autoModelRouting = event.target.value !== "false";
  saveState();
  renderRoutingControls();
});
els.textRouteProviderSelect?.addEventListener("change", (event) => setRouteProvider("text", event.target.value));
els.textRouteModelSelect?.addEventListener("change", (event) => setRouteModel("text", event.target.value));
els.visionRouteProviderSelect?.addEventListener("change", (event) => setRouteProvider("vision", event.target.value));
els.visionRouteModelSelect?.addEventListener("change", (event) => setRouteModel("vision", event.target.value));
[
  [els.appearanceGlobalOpacity, "globalOpacity"],
  [els.appearanceBlur, "glassBlur"],
  [els.appearanceLeftColor, "leftColor"],
  [els.appearanceLeftOpacity, "leftOpacity"],
  [els.appearanceCenterColor, "centerColor"],
  [els.appearanceCenterOpacity, "centerOpacity"],
  [els.appearanceRightColor, "rightColor"],
  [els.appearanceRightOpacity, "rightOpacity"]
].forEach(([input, key]) => {
  input?.addEventListener("input", (event) => updateAppearance(key, event.target.value));
});
els.resetAppearanceBtn?.addEventListener("click", resetAppearance);
els.roleSelect.addEventListener("change", (event) => {
  state.role = event.target.value;
  state.systemPrompt = generatedSystemPrompt(state.role, state.responseStyle || "direct");
  saveState();
  renderSettingsForm();
});
els.responseStyleSelect?.addEventListener("change", (event) => {
  state.responseStyle = event.target.value;
  state.systemPrompt = generatedSystemPrompt(state.role || "coder", state.responseStyle);
  saveState();
  renderSettingsForm();
});
els.systemPromptInput.addEventListener("input", (event) => {
  state.systemPrompt = event.target.value;
  saveState();
});
els.temperatureInput.addEventListener("change", (event) => {
  state.temperature = Number(event.target.value || 0.7);
  saveState();
  setToolSettingsFeedback("参数已更新");
});
els.maxTokensInput.addEventListener("change", (event) => {
  state.maxTokens = Number(event.target.value || 0);
  saveState();
  setToolSettingsFeedback("参数已更新");
});
els.agentToolsToggle.addEventListener("change", (event) => {
  if (event.target.checked) {
    if (!enableAgentToolsForSkills(state.enabledSkills, { ask: true })) {
      event.target.checked = false;
      setToolSettingsFeedback("已取消本地工具授权", "error");
      return;
    }
  } else {
    state.agentTools = false;
    state.toolConsent = normalizeToolConsent(state.toolConsent);
  }
  saveState();
  renderSettingsForm();
  setToolSettingsFeedback(event.target.checked ? "本地工具已开启" : "本地工具已关闭");
});
els.externalReadToggle?.addEventListener("change", () => {
  state.toolConsent = syncExternalConsentFromControls(state.toolConsent);
  saveState();
  setToolSettingsFeedback(els.externalReadToggle.checked ? "外部文件读取已开启" : "外部文件读取已关闭");
});
els.externalPathsInput?.addEventListener("input", () => {
  state.toolConsent = syncExternalConsentFromControls(state.toolConsent);
  saveState();
  setToolSettingsFeedback("授权路径已更新");
});
els.selectExternalPathsBtn?.addEventListener("click", chooseExternalPaths);
const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");
const workspaceCard = document.querySelector(".workspace-card");

attachBtn?.addEventListener("click", () => fileInput?.click());
fileInput?.addEventListener("change", (e) => { handleFiles(e.target.files); fileInput.value = ""; });

workspaceCard?.addEventListener("dragover", (e) => { e.preventDefault(); workspaceCard.classList.add("drop-active"); });
workspaceCard?.addEventListener("dragleave", (e) => { if (!workspaceCard.contains(e.relatedTarget)) workspaceCard.classList.remove("drop-active"); });
workspaceCard?.addEventListener("drop", (e) => {
  e.preventDefault();
  workspaceCard.classList.remove("drop-active");
  if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});

els.chatForm.addEventListener("submit", sendPrompt);
els.promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.chatForm.requestSubmit();
  }
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    els.chatForm.requestSubmit();
  }
});
els.promptInput.addEventListener("paste", handlePasteIntoPrompt);
els.environmentBtn?.addEventListener("click", () => checkEnvironment({ show: true }));
els.closeEnvironmentBtn.addEventListener("click", hideEnvironmentModal);
els.environmentNoPromptCheck?.addEventListener("change", (event) => setEnvironmentPromptMuted(event.target.checked));
els.installMissingEnvironmentBtn?.addEventListener("click", installMissingEnvironment);
els.copyEnvironmentCommandBtn?.addEventListener("click", copyEnvironmentCommands);
els.recheckEnvironmentBtn?.addEventListener("click", () => checkEnvironment({ show: false, suppressPrompt: true }));
els.modalInstallMissingEnvironmentBtn?.addEventListener("click", installMissingEnvironment);
els.modalCopyEnvironmentCommandBtn?.addEventListener("click", copyEnvironmentCommands);
els.modalRecheckEnvironmentBtn?.addEventListener("click", () => checkEnvironment({ show: true }));
document.addEventListener("click", (event) => {
  const clickedProvider = els.activeProviderButton?.contains(event.target) || false;
  const clickedThinking = els.thinkingButton?.contains(event.target) || false;
  if (!els.modelPopover.contains(event.target) && !clickedProvider && !els.activeModelButton.contains(event.target) && !clickedThinking) {
    closeModelPopover();
  }
});

function updateAvatarPreview(value = draftAgentAvatar || state.agentAvatar || "") {
  const preview = document.getElementById("avatarPreview");
  if (!preview) return;
  const avatarUrl = value || defaultAgentAvatar;
  const defaultClass = value ? "" : " default-agent-logo";
  preview.innerHTML = `<img class="${defaultClass.trim()}" src="${escapeAttr(avatarUrl)}" alt="头像" />`;
}

const avatarBtn = document.getElementById("avatarBtn");
const avatarFileInput = document.getElementById("avatarFileInput");
const agentNameInput = document.getElementById("agentNameInput");

avatarBtn?.addEventListener("click", () => avatarFileInput?.click());
els.saveAgentProfileBtn?.addEventListener("click", saveAgentProfile);
els.addMemoryBtn?.addEventListener("click", addMemory);
els.memorySearchInput?.addEventListener("input", renderMemoryList);

avatarFileInput?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      draftAgentAvatar = await createAvatarDataUrl(ev.target.result);
      updateAvatarPreview(draftAgentAvatar);
      markAgentProfileDirty();
    } catch (error) {
      setAgentProfileFeedback(error.message || "头像图片处理失败", "error");
    }
  };
  reader.readAsDataURL(file);
});

agentNameInput?.addEventListener("input", (e) => {
  draftAgentName = e.target.value;
  markAgentProfileDirty();
});

bindResizer(els.leftResizeHandle, "left");
bindResizer(els.rightResizeHandle, "right");
window.addEventListener("resize", () => {
  applyLayout();
  if (!els.modelPopover.classList.contains("hidden")) positionModelPopover(modelPopoverAnchor);
});

async function initializeApp() {
  await hydrateAppState();
  renderAll();
  initAmbientMotion();
  if (state.workspaceTab === "files") loadWorkspaceTree(state.workspacePath || ".");
  checkHealth();
  refreshUpdateStatus({ silent: true });
  checkEnvironment();
}

// ── 桌宠状态通知 ──────────────────────────────────────────────────
function notifyPet(state) {
  // 非阻塞，忽略错误（桌宠不在或服务未启动时静默失败）
  fetch("/api/pet/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state })
  }).catch(() => {});
}

setupAgentProfileSync();
initializeApp();

// ════════════════════════════════════════════════════════════════
// 定时自动化
// ════════════════════════════════════════════════════════════════

let scheduleEditingId = null; // 当前正在编辑的任务 id（null = 新建）

// ── API ──────────────────────────────────────────────────────────

async function fetchSchedules() {
  try {
    const res = await fetch("/api/schedules");
    const data = await res.json();
    return data.schedules || [];
  } catch { return []; }
}

async function apiCreateSchedule(body) {
  const res = await fetch("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

async function apiUpdateSchedule(id, body) {
  const res = await fetch(`/api/schedules/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

async function apiDeleteSchedule(id) {
  const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
  return res.json();
}

async function apiRunSchedule(id) {
  const res = await fetch(`/api/schedules/${id}/run`, { method: "POST" });
  return res.json();
}

// ── 渲染 ─────────────────────────────────────────────────────────

function scheduleStatusLabel(s) {
  if (!s.enabled) return "已暂停";
  if (s.lastResult?.ok === false) return "上次失败";
  if (s.lastRun) return `上次 ${relativeTime(s.lastRun)}`;
  return "未运行";
}

async function renderScheduleList() {
  if (!els.scheduleList) return;
  const schedules = await fetchSchedules();
  if (!schedules.length) {
    els.scheduleList.innerHTML = `<div class="schedule-empty">暂无定时任务<br><small>点击"＋ 新建"创建第一个</small></div>`;
    return;
  }
  els.scheduleList.innerHTML = "";
  for (const s of schedules) {
    const item = document.createElement("div");
    item.className = `schedule-item${s.enabled ? "" : " schedule-disabled"}`;
    const statusClass = s.lastResult?.ok === false ? "schedule-status-error" : s.lastRun ? "schedule-status-ok" : "";
    item.innerHTML = `
      <div class="schedule-item-main">
        <strong class="schedule-item-name">${escapeHtml(s.name)}</strong>
        <span class="schedule-item-expr">${escapeHtml(s.scheduleLabel || s.schedule)} · 内置调度</span>
        <span class="schedule-item-status ${statusClass}">${escapeHtml(scheduleStatusLabel(s))}</span>
      </div>
      <div class="schedule-item-actions">
        <button class="schedule-btn" data-action="run" data-id="${s.id}" title="立即运行">▶</button>
        <button class="schedule-btn" data-action="toggle" data-id="${s.id}" data-enabled="${s.enabled}" title="${s.enabled ? "暂停" : "启用"}">${s.enabled ? "⏸" : "⏵"}</button>
        <button class="schedule-btn" data-action="edit" data-id="${s.id}" title="编辑">✎</button>
        <button class="schedule-btn schedule-btn-del" data-action="delete" data-id="${s.id}" title="删除">✕</button>
      </div>
    `;
    els.scheduleList.append(item);
  }

  els.scheduleList.addEventListener("click", handleScheduleItemAction, { once: true });
  // Re-attach after re-render
}

async function handleScheduleItemAction(event) {
  const btn = event.target.closest("[data-action]");
  if (!btn) { renderScheduleList(); return; }
  const { action, id, enabled } = btn.dataset;

  if (action === "run") {
    btn.textContent = "…";
    btn.disabled = true;
    const res = await apiRunSchedule(id);
    await renderScheduleList();
    if (!res.ok) alert(`运行失败：${res.error || "未知错误"}`);
  } else if (action === "toggle") {
    await apiUpdateSchedule(id, { enabled: enabled === "true" ? false : true });
    await renderScheduleList();
  } else if (action === "edit") {
    const schedules = await fetchSchedules();
    const s = schedules.find((x) => x.id === id);
    if (s) openScheduleForm(s);
  } else if (action === "delete") {
    if (!confirm(`确认删除定时任务「${btn.closest(".schedule-item")?.querySelector(".schedule-item-name")?.textContent || id}」？`)) { renderScheduleList(); return; }
    await apiDeleteSchedule(id);
    await renderScheduleList();
  } else {
    renderScheduleList();
  }
}

// ── 表单 ─────────────────────────────────────────────────────────

function openScheduleForm(existing = null) {
  scheduleEditingId = existing?.id || null;
  if (els.scheduleNameInput) els.scheduleNameInput.value = existing?.name || "";
  if (els.schedulePromptInput) els.schedulePromptInput.value = existing?.prompt || "";
  if (els.scheduleExprInput) els.scheduleExprInput.value = existing?.schedule || "daily 09:00";
  if (els.scheduleModelInput) els.scheduleModelInput.value = existing?.model || "";
  if (els.scheduleOutputInput) els.scheduleOutputInput.value = existing?.outputFile || "schedules/{date}-{name}.md";
  if (els.scheduleToolsCheck) els.scheduleToolsCheck.checked = Boolean(existing?.enableTools);
  if (els.scheduleNotifyCheck) els.scheduleNotifyCheck.checked = existing?.notify !== false;
  if (els.scheduleFormFeedback) els.scheduleFormFeedback.textContent = "";
  updateScheduleExprHint();
  // Fill provider select
  populateScheduleProviderSelect(existing?.providerId);
  if (els.scheduleForm) els.scheduleForm.style.display = "";
  els.scheduleNameInput?.focus();
}

function populateScheduleProviderSelect(selectedId) {
  if (!els.scheduleProviderSelect) return;
  els.scheduleProviderSelect.innerHTML = "";
  for (const p of state.providers || []) {
    if (!p.apiKey) continue; // 没有 key 的跳过
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name || p.id;
    if (p.id === selectedId) opt.selected = true;
    els.scheduleProviderSelect.append(opt);
  }
  if (!selectedId && els.scheduleProviderSelect.options.length) {
    // 默认选当前活跃供应商
    const activeId = state.activeProviderId || "";
    const opt = [...els.scheduleProviderSelect.options].find((o) => o.value === activeId);
    if (opt) opt.selected = true;
  }
}

function updateScheduleExprHint() {
  if (!els.scheduleExprHint || !els.scheduleExprInput) return;
  const expr = els.scheduleExprInput.value.trim();
  const hints = {
    "daily": "每天指定时刻，例：daily 09:00",
    "weekly": "每周指定星期，例：weekly 1 09:00（0=周日）",
    "hourly": "每小时整点执行",
    "interval": "固定间隔，例：interval 30m（分钟）/ interval 2h（小时）"
  };
  const type = expr.split(" ")[0].toLowerCase();
  // 尝试解析并展示下次运行时间
  const labels = {
    "daily 09:00": "每天上午 9:00",
    "daily 08:30": "每天上午 8:30",
    "hourly": "每小时整点",
    "weekly 1 09:00": "每周一上午 9:00",
    "interval 30m": "每 30 分钟",
    "interval 1h": "每 1 小时",
    "interval 2h": "每 2 小时"
  };
  els.scheduleExprHint.textContent = labels[expr.toLowerCase()] || hints[type] || "支持：daily HH:MM / weekly N HH:MM / hourly / interval Nm/Nh";
}

async function saveScheduleForm() {
  const name = els.scheduleNameInput?.value.trim();
  const prompt = els.schedulePromptInput?.value.trim();
  const schedule = els.scheduleExprInput?.value.trim();
  const providerId = els.scheduleProviderSelect?.value;
  const model = els.scheduleModelInput?.value.trim();
  const outputFile = els.scheduleOutputInput?.value.trim() || "schedules/{date}-{name}.md";
  const enableTools = Boolean(els.scheduleToolsCheck?.checked);
  const notify = Boolean(els.scheduleNotifyCheck?.checked);
  const enabledSkills = normalizeEnabledSkills(state.enabledSkills);
  let toolConsent = normalizeToolConsent({});

  if (!name) { if (els.scheduleFormFeedback) els.scheduleFormFeedback.textContent = "请填写名称"; return; }
  if (!prompt) { if (els.scheduleFormFeedback) els.scheduleFormFeedback.textContent = "请填写任务描述"; return; }
  if (!schedule) { if (els.scheduleFormFeedback) els.scheduleFormFeedback.textContent = "请填写调度时间"; return; }
  if (!providerId) { if (els.scheduleFormFeedback) els.scheduleFormFeedback.textContent = "请选择供应商（需先填写 API Key）"; return; }
  if (enableTools) {
    toolConsent = consentForSkillIds(enabledSkills);
    if (!confirmToolConsent(toolConsent)) {
      if (els.scheduleFormFeedback) els.scheduleFormFeedback.textContent = "已取消本地工具授权";
      return;
    }
  }

  if (els.scheduleFormFeedback) els.scheduleFormFeedback.textContent = "保存中…";
  if (els.saveScheduleBtn) els.saveScheduleBtn.disabled = true;

  try {
    const body = { name, prompt, schedule, providerId, model, outputFile, enableTools, enabledSkills, toolConsent, notify };
    const res = scheduleEditingId
      ? await apiUpdateSchedule(scheduleEditingId, body)
      : await apiCreateSchedule(body);

    if (!res.ok) throw new Error(res.error || "保存失败");
    closeScheduleForm();
    await renderScheduleList();
  } catch (err) {
    if (els.scheduleFormFeedback) els.scheduleFormFeedback.textContent = err.message;
  } finally {
    if (els.saveScheduleBtn) els.saveScheduleBtn.disabled = false;
  }
}

function closeScheduleForm() {
  scheduleEditingId = null;
  if (els.scheduleForm) els.scheduleForm.style.display = "none";
  if (els.scheduleFormFeedback) els.scheduleFormFeedback.textContent = "";
}

// ── 面板开关 ──────────────────────────────────────────────────────

function toggleSchedulePanel() {
  const open = els.scheduleSidePanel?.style.display === "none";
  if (els.scheduleSidePanel) els.scheduleSidePanel.style.display = open ? "" : "none";
  if (els.scheduleEntryBtn) els.scheduleEntryBtn.classList.toggle("active", open);
  state.schedulePanelOpen = open;
  if (open) renderScheduleList();
}

// ── 事件绑定 ──────────────────────────────────────────────────────

els.scheduleEntryBtn?.addEventListener("click", toggleSchedulePanel);
els.newScheduleBtn?.addEventListener("click", () => openScheduleForm());
els.saveScheduleBtn?.addEventListener("click", saveScheduleForm);
els.cancelScheduleBtn?.addEventListener("click", closeScheduleForm);
els.scheduleExprInput?.addEventListener("input", updateScheduleExprHint);

// 初始化：恢复面板开关状态
if (state.schedulePanelOpen && els.scheduleSidePanel) {
  els.scheduleSidePanel.style.display = "";
  els.scheduleEntryBtn?.classList.add("active");
  renderScheduleList();
}

// ═══════════════════════════════════════════════════
// Petdex 桌宠设置面板
// ═══════════════════════════════════════════════════

const PETDEX_PAGE_SIZE = 30;
const PETDEX_API = "/api/petdex/pets";
const PETDEX_LEGACY_SPRITE_BASE = "https://petdex.crafter.run/pets";
const PETDEX_DEFAULT_ANIMATION = { row: 0, frames: 6, durationMs: 1100 };
const PETDEX_STATE_ANIMATIONS = {
  idle:      { row: 0, frames: 6, durationMs: 1100 },
  listening: { row: 3, frames: 4, durationMs: 700 },
  thinking:  { row: 8, frames: 6, durationMs: 1030 },
  working:   { row: 7, frames: 6, durationMs: 820 },
  done:      { row: 4, frames: 5, durationMs: 840 },
  error:     { row: 5, frames: 8, durationMs: 1220 }
};

let petdexAllPets = [];       // 全量宠物列表
let petdexFiltered = [];      // 过滤后列表
let petdexPage = 0;
let petdexLoaded = false;
let petdexLoading = false;
let petdexSortMode = "source";
let petdexCurrentSlug = "";   // 当前使用中的 slug
let petdexPreviewSlug = "";   // 预览中的 slug
let petdexPreviewPet = null;   // 预览中的宠物
let petdexPreviewState = "idle";
let petdexPreviewTimer = null;
let petdexCurrentTimer = null;

// ── 精灵图动画辅助 ──────────────────────────────────

const petdexImgCache = {};    // slug → HTMLImageElement

function normalizePetdexSourcePet(value, sourceIndex = 0) {
  const slug = String(value?.slug || "").trim();
  if (!slug) return null;
  return {
    slug,
    displayName: String(value.displayName || value.name || slug).trim(),
    kind: String(value.kind || "").trim(),
    submittedBy: String(value.submittedBy || "").trim(),
    spritesheetUrl: String(value.spritesheetUrl || "").trim(),
    petJsonUrl: String(value.petJsonUrl || "").trim(),
    zipUrl: String(value.zipUrl || "").trim(),
    sourceIndex: Number.isFinite(value.sourceIndex) ? value.sourceIndex : sourceIndex,
    animation: value.animation || PETDEX_DEFAULT_ANIMATION
  };
}

function findPetdexPet(slug) {
  if (!slug) return null;
  return petdexAllPets.find((pet) => pet.slug === slug) || null;
}

function getSelectedPetdexPet() {
  const slug = state.petdexSlug || "";
  if (!slug) return null;
  return findPetdexPet(slug) || normalizePetdexSourcePet(state.petdexPet, -1) || normalizePetdexSourcePet({ slug }, -1);
}

function getPetdexPetName(pet) {
  return pet?.displayName || pet?.name || pet?.slug || "";
}

function getPetdexSpriteUrl(petOrSlug) {
  const pet = typeof petOrSlug === "string" ? findPetdexPet(petOrSlug) : petOrSlug;
  const slug = typeof petOrSlug === "string" ? petOrSlug : pet?.slug;
  return pet?.spritesheetUrl || (slug ? `${PETDEX_LEGACY_SPRITE_BASE}/${slug}/spritesheet.webp` : "");
}

function getPetdexAnimation(state = "idle") {
  const animation = PETDEX_STATE_ANIMATIONS[state] || PETDEX_DEFAULT_ANIMATION;
  return {
    row: Number.isFinite(animation.row) ? animation.row : PETDEX_DEFAULT_ANIMATION.row,
    frames: Number.isFinite(animation.frames) ? animation.frames : PETDEX_DEFAULT_ANIMATION.frames,
    durationMs: Number.isFinite(animation.durationMs) ? animation.durationMs : PETDEX_DEFAULT_ANIMATION.durationMs
  };
}

function petdexSearchText(pet) {
  return [
    pet.slug,
    getPetdexPetName(pet),
    pet.kind,
    pet.submittedBy
  ].join(" ").toLowerCase();
}

function loadPetdexSprite(petOrSlug) {
  const spriteUrl = getPetdexSpriteUrl(petOrSlug);
  if (!spriteUrl) return Promise.reject(new Error("缺少精灵图地址"));
  if (petdexImgCache[spriteUrl]) return Promise.resolve(petdexImgCache[spriteUrl]);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const fallbackUrl = spriteUrl.includes(PETDEX_LEGACY_SPRITE_BASE) && spriteUrl.endsWith(".webp")
      ? spriteUrl.replace(/\.webp$/, ".png")
      : "";
    img.onload = () => { petdexImgCache[spriteUrl] = img; resolve(img); };
    img.onerror = () => {
      if (fallbackUrl && img.src !== fallbackUrl) {
        img.src = fallbackUrl;
        return;
      }
      reject(new Error("精灵图加载失败"));
    };
    img.src = spriteUrl;
  });
}

/**
 * 在 canvas 上播放 petdex 精灵图的 idle 动画 (第 0 行)。
 * 返回 clearInterval 用的 timerId。
 */
function animatePetdexIdle(canvas, img, animation = PETDEX_DEFAULT_ANIMATION) {
  const ctx = canvas.getContext("2d");
  // petdex 标准：9 行 × 8 列，每格 192×208
  const cols = 8;
  const rows = 9;
  const frameW = img.naturalWidth / cols;
  const frameH = img.naturalHeight / rows;
  const row = Math.max(0, Math.min(rows - 1, Number(animation.row || 0)));
  const idleFrames = Math.max(1, Math.min(cols, Number(animation.frames || PETDEX_DEFAULT_ANIMATION.frames)));
  const frameMs = Number(animation.durationMs || PETDEX_DEFAULT_ANIMATION.durationMs) / idleFrames;
  let frame = 0;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      img,
      frame * frameW, row * frameH, frameW, frameH,
      0, 0, canvas.width, canvas.height
    );
    frame = (frame + 1) % idleFrames;
  };
  draw();
  return setInterval(draw, Math.max(80, frameMs));
}

// ── 当前桌宠预览 ────────────────────────────────────

function renderPetdexCurrentDisplay() {
  const canvas = document.getElementById("petdexCurrentCanvas");
  const nameEl = document.getElementById("petdexCurrentName");
  const slugEl = document.getElementById("petdexCurrentSlug");
  if (!canvas) return;

  if (petdexCurrentTimer) { clearInterval(petdexCurrentTimer); petdexCurrentTimer = null; }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pet = getSelectedPetdexPet();
  const slug = pet?.slug || "";
  petdexCurrentSlug = slug;

  if (!slug) {
    if (nameEl) nameEl.textContent = "默认 (🤖 表情)";
    if (slugEl) slugEl.textContent = "";
    return;
  }

  if (nameEl) nameEl.textContent = getPetdexPetName(pet);
  if (slugEl) slugEl.textContent = slug;

  loadPetdexSprite(pet).then((img) => {
    canvas.width = 96; canvas.height = 112;
    petdexCurrentTimer = animatePetdexIdle(canvas, img, getPetdexAnimation("idle"));
  }).catch(() => {
    if (nameEl) nameEl.textContent = `${slug} (图片加载失败)`;
  });
}

// ── 网格卡片 ────────────────────────────────────────

function buildPetdexCards(pets) {
  const grid = document.getElementById("petdexGrid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!pets.length) {
    grid.innerHTML = '<p style="color:#888;font-size:12px">没有找到匹配的宠物</p>';
    return;
  }

  pets.forEach((pet) => {
    const card = document.createElement("div");
    card.className = "petdex-card" + (pet.slug === petdexCurrentSlug ? " selected" : "");
    card.dataset.slug = pet.slug;

    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 56;

    const nameEl = document.createElement("span");
    nameEl.className = "petdex-card-name";
    nameEl.title = getPetdexPetName(pet);
    nameEl.textContent = getPetdexPetName(pet);

    const metaEl = document.createElement("span");
    metaEl.className = "petdex-card-meta";
    metaEl.title = [pet.kind, pet.submittedBy].filter(Boolean).join(" · ");
    metaEl.textContent = pet.kind || pet.submittedBy || pet.slug;

    card.appendChild(canvas);
    card.appendChild(nameEl);
    card.appendChild(metaEl);
    grid.appendChild(card);

    // 异步加载精灵图缩略图（只画第一帧）
    loadPetdexSprite(pet).then((img) => {
      const ctx = canvas.getContext("2d");
      const frameW = img.naturalWidth / 8;
      const frameH = img.naturalHeight / 9;
      ctx.drawImage(img, 0, 0, frameW, frameH, 0, 0, canvas.width, canvas.height);
    }).catch(() => {
      const ctx = canvas.getContext("2d");
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🐾", 24, 34);
    });

    card.addEventListener("click", () => openPetdexPreview(pet));
  });
}

// ── 分页渲染 ────────────────────────────────────────

function renderPetdexPage() {
  const start = petdexPage * PETDEX_PAGE_SIZE;
  const pageItems = petdexFiltered.slice(start, start + PETDEX_PAGE_SIZE);
  buildPetdexCards(pageItems);

  const pageLabel = document.getElementById("petdexPageLabel");
  const prevBtn = document.getElementById("petdexPrevBtn");
  const nextBtn = document.getElementById("petdexNextBtn");
  const totalPages = Math.max(1, Math.ceil(petdexFiltered.length / PETDEX_PAGE_SIZE));

  if (pageLabel) pageLabel.textContent = `第 ${petdexPage + 1} / ${totalPages} 页`;
  if (prevBtn) prevBtn.disabled = petdexPage === 0;
  if (nextBtn) nextBtn.disabled = (petdexPage + 1) >= totalPages;

  const statusEl = document.getElementById("petdexStatus");
  if (statusEl && !petdexLoading) statusEl.textContent = `共 ${petdexFiltered.length} / ${petdexAllPets.length} 只宠物`;
}

// ── 搜索过滤 ────────────────────────────────────────

function sortPetdexPets(pets) {
  const collator = new Intl.Collator("zh-Hans", { numeric: true, sensitivity: "base" });
  const sorted = [...pets];
  if (petdexSortMode === "name") {
    sorted.sort((a, b) => collator.compare(getPetdexPetName(a), getPetdexPetName(b)) || collator.compare(a.slug, b.slug));
  } else if (petdexSortMode === "slug") {
    sorted.sort((a, b) => collator.compare(a.slug, b.slug));
  } else if (petdexSortMode === "kind") {
    sorted.sort((a, b) => collator.compare(a.kind || "未分类", b.kind || "未分类") || collator.compare(getPetdexPetName(a), getPetdexPetName(b)));
  } else if (petdexSortMode === "author") {
    sorted.sort((a, b) => collator.compare(a.submittedBy || "未知", b.submittedBy || "未知") || collator.compare(getPetdexPetName(a), getPetdexPetName(b)));
  } else {
    sorted.sort((a, b) => (a.sourceIndex ?? 0) - (b.sourceIndex ?? 0));
  }
  return sorted;
}

function applyPetdexFilter(q, options = {}) {
  const query = (q || "").trim().toLowerCase();
  const filtered = query
    ? petdexAllPets.filter((pet) => petdexSearchText(pet).includes(query))
    : [...petdexAllPets];
  petdexFiltered = sortPetdexPets(filtered);
  if (!options.keepPage) petdexPage = 0;
  const totalPages = Math.max(1, Math.ceil(petdexFiltered.length / PETDEX_PAGE_SIZE));
  petdexPage = Math.min(petdexPage, totalPages - 1);
  renderPetdexPage();
}

// ── 预览弹层 ────────────────────────────────────────

function openPetdexPreview(pet) {
  petdexPreviewPet = normalizePetdexSourcePet(pet, -1);
  petdexPreviewSlug = petdexPreviewPet?.slug || "";
  petdexPreviewState = "idle";
  const overlay = document.getElementById("petdexPreviewOverlay");
  const canvas = document.getElementById("petdexPreviewCanvas");
  const nameEl = document.getElementById("petdexPreviewName");
  const slugEl = document.getElementById("petdexPreviewSlugLabel");
  if (!overlay || !canvas) return;

  if (petdexPreviewTimer) { clearInterval(petdexPreviewTimer); petdexPreviewTimer = null; }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (nameEl) nameEl.textContent = getPetdexPetName(petdexPreviewPet);
  if (slugEl) slugEl.textContent = [petdexPreviewSlug, petdexPreviewPet?.kind].filter(Boolean).join(" · ");
  updatePetdexPreviewStateButtons();
  overlay.classList.remove("hidden");

  renderPetdexPreviewAnimation();
}

function updatePetdexPreviewStateButtons() {
  document.querySelectorAll("[data-petdex-state]").forEach((button) => {
    button.classList.toggle("active", button.dataset.petdexState === petdexPreviewState);
  });
}

function renderPetdexPreviewAnimation() {
  const canvas = document.getElementById("petdexPreviewCanvas");
  const nameEl = document.getElementById("petdexPreviewName");
  if (!canvas || !petdexPreviewPet) return;

  if (petdexPreviewTimer) { clearInterval(petdexPreviewTimer); petdexPreviewTimer = null; }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  loadPetdexSprite(petdexPreviewPet).then((img) => {
    canvas.width = 192; canvas.height = 208;
    petdexPreviewTimer = animatePetdexIdle(canvas, img, getPetdexAnimation(petdexPreviewState));
  }).catch(() => {
    const ctx2 = canvas.getContext("2d");
    ctx2.font = "40px sans-serif";
    ctx2.textAlign = "center";
    ctx2.fillText("❌", 96, 120);
    if (nameEl) nameEl.textContent = `${petdexPreviewSlug} — 加载失败`;
  });
}

function closePetdexPreview() {
  if (petdexPreviewTimer) { clearInterval(petdexPreviewTimer); petdexPreviewTimer = null; }
  petdexPreviewPet = null;
  petdexPreviewState = "idle";
  const overlay = document.getElementById("petdexPreviewOverlay");
  if (overlay) overlay.classList.add("hidden");
}

// ── 应用选中的宠物 ──────────────────────────────────

function applyPetdexSlug(petOrSlug) {
  const pet = typeof petOrSlug === "string"
    ? (findPetdexPet(petOrSlug) || normalizePetdexSourcePet({ slug: petOrSlug }, -1))
    : normalizePetdexSourcePet(petOrSlug, -1);
  state.petdexSlug = pet?.slug || "";
  state.petdexPet = pet ? {
    slug: pet.slug,
    displayName: getPetdexPetName(pet),
    kind: pet.kind || "",
    submittedBy: pet.submittedBy || "",
    spritesheetUrl: pet.spritesheetUrl || "",
    petJsonUrl: pet.petJsonUrl || "",
    zipUrl: pet.zipUrl || ""
  } : null;
  saveState();
  // 通知 pet 窗口更新
  try {
    const ch = new BroadcastChannel("neo-agent-profile-v1");
    ch.postMessage({ type: "petdex-selection", slug: state.petdexSlug, pet: state.petdexPet });
    ch.close();
  } catch {}
  renderPetdexCurrentDisplay();
  // 刷新网格选中状态
  document.querySelectorAll(".petdex-card").forEach((c) => {
    c.classList.toggle("selected", c.dataset.slug === state.petdexSlug);
  });
}

// ── 从 Petdex 源加载宠物列表 ─────────────────────

function setPetdexControlsLoading(loading) {
  const searchBtn = document.getElementById("petdexSearchBtn");
  const refreshBtn = document.getElementById("petdexRefreshBtn");
  if (searchBtn) searchBtn.disabled = loading;
  if (refreshBtn) refreshBtn.disabled = loading;
}

async function loadPetdexPets({ refresh = false } = {}) {
  const statusEl = document.getElementById("petdexStatus");
  const searchInput = document.getElementById("petdexSearch");
  if (statusEl) statusEl.textContent = "正在从 Petdex 源加载宠物列表…";
  petdexLoading = true;
  setPetdexControlsLoading(true);
  try {
    const res = await fetch(`${PETDEX_API}${refresh ? "?refresh=1" : ""}`);
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || "Petdex 源加载失败");
    petdexAllPets = Array.isArray(data.pets)
      ? data.pets.map(normalizePetdexSourcePet).filter(Boolean)
      : [];
    petdexLoaded = true;
    applyPetdexFilter(searchInput?.value || "");
    const sourceHint = data.stale ? " · 使用缓存" : "";
    if (statusEl) statusEl.textContent = `共 ${petdexFiltered.length} / ${petdexAllPets.length} 只宠物${sourceHint}`;
  } catch (err) {
    petdexLoaded = false;
    petdexAllPets = [];
    petdexFiltered = [];
    renderPetdexPage();
    if (statusEl) statusEl.textContent = `加载失败：${err.message}`;
  } finally {
    petdexLoading = false;
    setPetdexControlsLoading(false);
  }
}

// ── 面板初始化（每次切换到桌宠 tab 时调用）─────────

async function initPetdexPanel() {
  renderPetdexCurrentDisplay();

  // 绑定事件（第一次调用时注册，重复调用无副作用）
  const searchInput = document.getElementById("petdexSearch");
  const searchBtn = document.getElementById("petdexSearchBtn");
  const sortSelect = document.getElementById("petdexSort");
  const refreshBtn = document.getElementById("petdexRefreshBtn");
  const prevBtn = document.getElementById("petdexPrevBtn");
  const nextBtn = document.getElementById("petdexNextBtn");
  const resetBtn = document.getElementById("petdexResetBtn");
  const useBtn = document.getElementById("petdexUseBtn");
  const closePreviewBtn = document.getElementById("petdexClosePreviewBtn");

  if (sortSelect) sortSelect.value = petdexSortMode;
  if (searchBtn && !searchBtn._bound) {
    searchBtn._bound = true;
    searchBtn.addEventListener("click", () => applyPetdexFilter(searchInput?.value));
    searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") applyPetdexFilter(searchInput.value); });
    searchInput?.addEventListener("input", () => applyPetdexFilter(searchInput.value));
  }
  if (sortSelect && !sortSelect._bound) {
    sortSelect._bound = true;
    sortSelect.addEventListener("change", () => {
      petdexSortMode = sortSelect.value || "source";
      applyPetdexFilter(searchInput?.value || "");
    });
  }
  if (refreshBtn && !refreshBtn._bound) {
    refreshBtn._bound = true;
    refreshBtn.addEventListener("click", () => loadPetdexPets({ refresh: true }));
  }
  if (prevBtn && !prevBtn._bound) {
    prevBtn._bound = true;
    prevBtn.addEventListener("click", () => { if (petdexPage > 0) { petdexPage--; renderPetdexPage(); } });
  }
  if (nextBtn && !nextBtn._bound) {
    nextBtn._bound = true;
    nextBtn.addEventListener("click", () => {
      const total = Math.ceil(petdexFiltered.length / PETDEX_PAGE_SIZE);
      if (petdexPage + 1 < total) { petdexPage++; renderPetdexPage(); }
    });
  }
  if (resetBtn && !resetBtn._bound) {
    resetBtn._bound = true;
    resetBtn.addEventListener("click", () => { applyPetdexSlug(""); closePetdexPreview(); });
  }
  if (useBtn && !useBtn._bound) {
    useBtn._bound = true;
    useBtn.addEventListener("click", () => {
      applyPetdexSlug(petdexPreviewPet || petdexPreviewSlug);
      closePetdexPreview();
    });
  }
  if (closePreviewBtn && !closePreviewBtn._bound) {
    closePreviewBtn._bound = true;
    closePreviewBtn.addEventListener("click", closePetdexPreview);
  }
  document.querySelectorAll("[data-petdex-state]").forEach((button) => {
    if (button._bound) return;
    button._bound = true;
    button.addEventListener("click", () => {
      petdexPreviewState = button.dataset.petdexState || "idle";
      updatePetdexPreviewStateButtons();
      renderPetdexPreviewAnimation();
    });
  });
  // 点击遮罩关闭
  const overlay = document.getElementById("petdexPreviewOverlay");
  if (overlay && !overlay._bound) {
    overlay._bound = true;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closePetdexPreview(); });
  }

  if (!petdexLoaded && !petdexLoading) {
    await loadPetdexPets();
  } else {
    applyPetdexFilter(searchInput?.value || "", { keepPage: true });
  }
}
