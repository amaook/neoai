// public/pet.js — 桌宠逻辑

// ── 状态 ─────────────────────────────────────────────────────────

const root    = document.getElementById("petRoot");
const avatar  = document.getElementById("petAvatar");
const bubble  = document.getElementById("petBubble");
const chat    = document.getElementById("petChat");
const msgs    = document.getElementById("petMessages");
const form    = document.getElementById("petChatForm");
const input   = document.getElementById("petInput");
const sendBtn = document.getElementById("petSendBtn");
const closeBtn = document.getElementById("closeChatBtn");
const attachmentBar = document.getElementById("petAttachmentBar");
const resizeHandles = [...document.querySelectorAll("[data-pet-resize]")];

const STORAGE_KEY = "neo-ai-state-v2";
const LEGACY_STORAGE_KEY = "neo-ai-state-v1";
const PROFILE_CHANNEL_NAME = "neo-agent-profile-v1";
const DEFAULT_PET_WINDOW = { w: 72, h: 72 };
const DEFAULT_CHAT_SIZE = { width: 350, height: 450 };
const CHAT_SIZE_LIMITS = { minW: 280, maxW: 720, minH: 320, maxH: 900 };
const PET_LAYOUT_MARGIN = 8;
const PET_LAYOUT_GAP = 10;
const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
const PETDEX_RENDER_WIDTH = 96;
const PETDEX_WINDOW_PADDING = 16;
const TEXT_EXTS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "jsonl", "xml", "html", "css", "js", "jsx", "ts", "tsx",
  "py", "rb", "go", "rs", "java", "c", "cpp", "h", "hpp", "sh", "zsh", "yaml", "yml", "toml", "ini", "log"
]);

const initialPetSettings = readPetBridgeSettings();
let chatOpen   = false;
let quietMode  = Boolean(initialPetSettings.quietMode);
let streaming  = false;
let currentState = "idle";
let stateStream = null;
let stateReconnectTimer = null;
let profileChannel = null;
let chatSize = normalizeChatSize(initialPetSettings.chatSize);
let currentPlacement = "closed";
let lastPetDisplaySize = { ...DEFAULT_PET_WINDOW };
let pendingAttachments = [];
let petChatHistory = [];
let resizeState = null;
let closeLayoutTimer = null;
let dragDepth = 0;

const STATE_LABELS = {
  idle:      null,
  listening: "听你说话…",
  thinking:  "思考中…",
  working:   "执行任务…",
  done:      "完成！",
  error:     "出错了"
};

const PETDEX_STATE_ANIMATIONS = {
  idle:      { row: 0, frames: 6, durationMs: 1100 },
  listening: { row: 3, frames: 4, durationMs: 700 },
  thinking:  { row: 8, frames: 6, durationMs: 1030 },
  working:   { row: 7, frames: 6, durationMs: 820 },
  done:      { row: 4, frames: 5, durationMs: 840 },
  error:     { row: 5, frames: 8, durationMs: 1220 }
};

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(number, min), max);
}

function readPetBridgeSettings() {
  try {
    return window.petBridge?.getSettings?.() || {};
  } catch {
    return {};
  }
}

function normalizeChatSize(size = {}) {
  return {
    width: Math.round(clampNumber(size.width || DEFAULT_CHAT_SIZE.width, CHAT_SIZE_LIMITS.minW, CHAT_SIZE_LIMITS.maxW)),
    height: Math.round(clampNumber(size.height || DEFAULT_CHAT_SIZE.height, CHAT_SIZE_LIMITS.minH, CHAT_SIZE_LIMITS.maxH))
  };
}

function applyChatSize() {
  chat.style.setProperty("--chat-w", `${chatSize.width}px`);
  chat.style.setProperty("--chat-h", `${chatSize.height}px`);
  root.style.setProperty("--chat-w", `${chatSize.width}px`);
  root.style.setProperty("--chat-h", `${chatSize.height}px`);
}

function setPetDisplaySize(w = DEFAULT_PET_WINDOW.w, h = DEFAULT_PET_WINDOW.h) {
  lastPetDisplaySize = {
    w: Math.round(clampNumber(w, 48, 180)),
    h: Math.round(clampNumber(h, 48, 220))
  };
  root.style.setProperty("--pet-display-w", `${lastPetDisplaySize.w}px`);
  root.style.setProperty("--pet-display-h", `${lastPetDisplaySize.h}px`);
}

function getPetDisplaySize() {
  return { ...lastPetDisplaySize };
}

function applyLayoutPlacement(placement = currentPlacement) {
  currentPlacement = placement || "closed";
  root.classList.remove("chat-above", "chat-left", "chat-right", "chat-closed");
  if (!chatOpen || currentPlacement === "closed") {
    root.classList.add("chat-closed");
    return;
  }
  root.classList.add(`chat-${currentPlacement}`);
}

function requestPetLayout({ saveChatSize = false, deferClosed = false } = {}) {
  if (!window.petBridge) return;
  const petSize = getPetDisplaySize();
  const layout = {
    open: chatOpen,
    petW: petSize.w,
    petH: petSize.h,
    chatW: chatSize.width,
    chatH: chatSize.height,
    margin: PET_LAYOUT_MARGIN,
    gap: PET_LAYOUT_GAP,
    placement: "auto",
    saveChatSize
  };

  if (window.petBridge.setLayout) {
    window.petBridge.setLayout(layout);
    return;
  }

  const width = chatOpen ? Math.max(chatSize.width, petSize.w) + PET_LAYOUT_MARGIN * 2 : petSize.w + PET_LAYOUT_MARGIN * 2;
  const height = chatOpen
    ? chatSize.height + petSize.h + PET_LAYOUT_GAP + PET_LAYOUT_MARGIN * 2
    : petSize.h + PET_LAYOUT_MARGIN * 2;
  if (!deferClosed || chatOpen) window.petBridge.setSize(width, height);
}

// ── 共享状态与头像 ──────────────────────────────────────────────────

function getProfileChannel() {
  if (profileChannel || typeof BroadcastChannel === "undefined") return profileChannel;
  try {
    profileChannel = new BroadcastChannel(PROFILE_CHANNEL_NAME);
  } catch {
    profileChannel = null;
  }
  return profileChannel;
}

function readNeoState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function hasStoredState() {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY));
  } catch {
    return false;
  }
}

async function hydrateStateFromServer() {
  if (hasStoredState()) return;
  try {
    const response = await fetch("/api/app-state");
    const data = await response.json();
    if (response.ok && data.state && Object.keys(data.state).length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.state));
    }
  } catch {
    // 浏览器模式或旧服务端没有状态接口时，继续使用本地状态。
  }
}

function writeNeoStatePatch(patch = {}) {
  const nextState = { ...readNeoState(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
}

function broadcastAgentProfile(state) {
  const channel = getProfileChannel();
  if (!channel) return;
  channel.postMessage({
    type: "agent-profile",
    source: "pet",
    agentName: state.agentName || "neo",
    agentAvatar: state.agentAvatar || ""
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
  if (!dataUrl) return "";
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

function ensureDefaultIcon() {
  let icon = document.getElementById("petDefaultIcon");
  if (!icon) {
    icon = document.createElement("div");
    icon.id = "petDefaultIcon";
    icon.textContent = "🤖";
    avatar.appendChild(icon);
  }
  return icon;
}

function applyAvatar(url = "") {
  const existing = [...avatar.querySelectorAll("img")];
  if (!url) {
    existing.forEach((img) => img.remove());
    ensureDefaultIcon();
    return;
  }

  const logoEl = document.getElementById("petDefaultIcon");
  const img = existing[0] || document.createElement("img");
  existing.slice(1).forEach((extra) => extra.remove());
  img.style.display = "";
  img.src = url;
  img.alt = "桌宠";
  img.onload = () => { if (logoEl) logoEl.remove(); };
  img.onerror = () => {
    img.remove();
    ensureDefaultIcon();
  };
  if (!img.parentElement) avatar.appendChild(img);
}

function loadAvatar() {
  applyAvatar(readNeoState().agentAvatar || "");
}

function syncRootClass() {
  Object.keys(STATE_LABELS).forEach((state) => root.classList.remove(`state-${state}`));
  root.classList.add(`state-${currentState}`);
  root.classList.toggle("petdex-root", avatar.classList.contains("petdex-mode"));
  applyLayoutPlacement(currentPlacement);
}

function updatePetWindowSize(options = {}) {
  requestPetLayout(options);
}

async function persistAvatar(dataUrl) {
  const avatarDataUrl = await createAvatarDataUrl(dataUrl);
  applyAvatar(avatarDataUrl);
  const nextState = writeNeoStatePatch({
    agentName: readNeoState().agentName || "neo",
    agentAvatar: avatarDataUrl
  });
  broadcastAgentProfile(nextState);
  showBubble("头像已更新");
}

// ── 状态更新 ──────────────────────────────────────────────────────

function setState(state) {
  if (currentState === state) return;
  currentState = state;
  syncRootClass();
  restartPetdexAnimation();
  if (!quietMode) showBubble(STATE_LABELS[state]);
  // 自动回到 idle
  if (state === "done" || state === "error") {
    setTimeout(() => { if (currentState === state) setState("idle"); }, 2500);
  }
}

function showBubble(text) {
  if (!text || quietMode) { bubble.classList.remove("visible"); return; }
  bubble.textContent = text;
  bubble.classList.add("visible");
  clearTimeout(bubble._timer);
  bubble._timer = setTimeout(() => bubble.classList.remove("visible"), 3000);
}

// 订阅服务端状态 SSE
function subscribeState() {
  if (stateStream) stateStream.close();
  clearTimeout(stateReconnectTimer);

  const es = new EventSource("/api/pet/stream");
  stateStream = es;
  es.onmessage = (e) => {
    try { const { state } = JSON.parse(e.data); setState(state); } catch {}
  };
  es.onerror = () => {
    es.close();
    if (stateStream === es) stateStream = null;
    stateReconnectTimer = setTimeout(subscribeState, 3000);
  };
}

// ── 聊天框 ────────────────────────────────────────────────────────

function openChat() {
  if (chatOpen) return;
  chatOpen = true;
  clearTimeout(closeLayoutTimer);
  syncRootClass();
  requestPetLayout();
  chat.classList.add("open");
  requestAnimationFrame(() => input.focus());
  if (!msgs.children.length) appendMsg("assistant", "你好！有什么我可以帮你的？");
}

function closeChat() {
  if (!chatOpen) return;
  chatOpen = false;
  chat.classList.remove("open");
  syncRootClass();
  clearTimeout(closeLayoutTimer);
  closeLayoutTimer = setTimeout(() => {
    if (!chatOpen) requestPetLayout();
  }, 230);
}

function toggleChat() {
  if (chatOpen) closeChat();
  else openChat();
}

function setMsgText(element, text) {
  const textEl = element.querySelector(".pet-msg-text") || element;
  textEl.textContent = text;
}

function appendMsg(role, text, attachments = []) {
  const div = document.createElement("div");
  div.className = `pet-msg ${role}`;
  const textEl = document.createElement("div");
  textEl.className = "pet-msg-text";
  textEl.textContent = text;
  div.appendChild(textEl);
  appendMessageAttachments(div, attachments);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[ch]));
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function formatBytes(value = 0) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
}

function attachmentKindFromFile(file) {
  const name = String(file?.name || "");
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  const mediaType = String(file?.type || "");
  if (mediaType.startsWith("image/")) return "image";
  if (ext === "pdf" || mediaType === "application/pdf") return "pdf";
  if (["xlsx", "xls", "xlsm"].includes(ext)) return "sheet";
  if (["docx", "doc"].includes(ext)) return "doc";
  if (TEXT_EXTS.has(ext) || mediaType.startsWith("text/")) return "text";
  return "file";
}

function attachmentKindLabel(kind = "file") {
  const labels = { image: "图片", pdf: "PDF", sheet: "表格", doc: "文档", text: "文本", file: "文件" };
  return labels[kind] || "文件";
}

function fileIcon(kind = "file") {
  const labels = { image: "IMG", pdf: "PDF", sheet: "XLS", doc: "DOC", text: "TXT", file: "FILE" };
  return labels[kind] || "FILE";
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("文本读取失败"));
    reader.readAsText(file);
  });
}

async function processPetFile(file) {
  if (!file) return null;
  const kind = attachmentKindFromFile(file);
  const fallbackName = kind === "image" ? `pasted-image-${Date.now()}.png` : `attachment-${Date.now()}`;
  const name = String(file.name || fallbackName).trim() || fallbackName;
  const size = Number(file.size || 0);
  if (size > ATTACHMENT_MAX_BYTES) {
    showBubble(`「${name}」超过 8MB，已跳过`);
    return null;
  }

  const dataUrl = await readAsDataUrl(file);
  let content = "";
  if (kind === "text") {
    try {
      content = await readAsText(file);
      if (content.length > 60000) content = `${content.slice(0, 60000)}\n...[内容过长已截断]`;
    } catch {
      content = "";
    }
  }

  return {
    name,
    kind,
    size,
    dataUrl,
    mediaType: file.type || "",
    content
  };
}

async function handlePetFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const before = pendingAttachments.length;
  for (const file of files) {
    try {
      const attachment = await processPetFile(file);
      if (attachment) pendingAttachments.push(attachment);
    } catch (error) {
      showBubble(error.message || "附件读取失败");
    }
  }
  renderPetAttachmentBar();
  const added = pendingAttachments.length - before;
  if (added > 0) showBubble(`已添加 ${added} 个附件`);
}

function renderPetAttachmentBar() {
  if (!attachmentBar) return;
  attachmentBar.innerHTML = "";
  pendingAttachments.forEach((attachment, index) => {
    const chip = document.createElement("div");
    chip.className = "pet-attachment-chip";

    if (attachment.kind === "image" && attachment.dataUrl) {
      const thumb = document.createElement("img");
      thumb.className = "pet-attachment-thumb";
      thumb.src = attachment.dataUrl;
      thumb.alt = "";
      chip.appendChild(thumb);
    } else {
      const icon = document.createElement("span");
      icon.className = "pet-attachment-icon";
      icon.textContent = fileIcon(attachment.kind);
      chip.appendChild(icon);
    }

    const name = document.createElement("span");
    name.className = "pet-attachment-name";
    name.title = attachment.name;
    name.textContent = `${attachment.name} · ${formatBytes(attachment.size)}`;
    chip.appendChild(name);

    const remove = document.createElement("button");
    remove.className = "pet-attachment-remove";
    remove.type = "button";
    remove.title = "移除";
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      pendingAttachments.splice(index, 1);
      renderPetAttachmentBar();
    });
    chip.appendChild(remove);
    attachmentBar.appendChild(chip);
  });
}

function appendMessageAttachments(container, attachments = []) {
  if (!Array.isArray(attachments) || !attachments.length) return;
  const list = document.createElement("div");
  list.className = "pet-msg-attachments";
  attachments.forEach((attachment) => {
    const chip = document.createElement("div");
    chip.className = "pet-msg-attachment";
    if (attachment.kind === "image" && attachment.dataUrl) {
      const img = document.createElement("img");
      img.className = "pet-msg-attachment-thumb";
      img.src = attachment.dataUrl;
      img.alt = "";
      chip.appendChild(img);
    } else {
      const icon = document.createElement("span");
      icon.className = "pet-msg-attachment-icon";
      icon.textContent = fileIcon(attachment.kind);
      chip.appendChild(icon);
    }

    const meta = document.createElement("span");
    meta.className = "pet-msg-attachment-name";
    meta.textContent = `${attachment.name || "附件"} · ${attachmentKindLabel(attachment.kind)}`;
    chip.appendChild(meta);
    list.appendChild(chip);
  });
  container.appendChild(list);
}

async function importPetAttachment(attachment) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch("/api/attachments/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        name: attachment.name,
        kind: attachment.kind,
        size: attachment.size,
        mediaType: attachment.mediaType,
        dataUrl: attachment.dataUrl,
        content: attachment.content || ""
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `保存附件「${attachment.name}」失败`);
    return {
      ...data.attachment,
      dataUrl: attachment.kind === "image" ? attachment.dataUrl : "",
      mediaType: data.attachment?.mediaType || attachment.mediaType || ""
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function importPetAttachments(attachments = []) {
  const imported = [];
  for (const attachment of attachments) {
    imported.push(await importPetAttachment(attachment));
  }
  return imported;
}

function attachmentContextText(attachments = []) {
  if (!attachments.length) return "";
  return attachments.map((attachment, index) => {
    const lines = [
      `<attachment index="${index + 1}" name="${escapeAttr(attachment.name)}" path="${escapeAttr(attachment.path || "")}" kind="${escapeAttr(attachment.kind || "file")}">`,
      `文件名：${attachment.name}`,
      `工作区路径：${attachment.path || "未保存"}`,
      `类型：${attachmentKindLabel(attachment.kind)}`,
      `大小：${formatBytes(attachment.size)}`,
      `摘要：${attachment.summary || "已附加"}`
    ];
    if (attachment.content) {
      lines.push("内容预览：", attachment.content);
    } else if (attachment.kind === "image") {
      lines.push("图片已保存到工作区；如果当前模型支持视觉，也会同时收到图片数据。");
    }
    lines.push("</attachment>");
    return lines.join("\n");
  }).join("\n\n");
}

function modelContentForPetMessage(message) {
  const text = String(message.content || "").trim();
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const contextText = attachmentContextText(attachments);
  const fullText = [text, contextText].filter(Boolean).join("\n\n");
  const imageAttachments = attachments.filter((attachment) => attachment.kind === "image" && attachment.dataUrl);
  if (!imageAttachments.length) return fullText;
  return [
    { type: "text", text: fullText || "请查看附件。" },
    ...imageAttachments.map((attachment) => ({ type: "image_url", image_url: { url: attachment.dataUrl } }))
  ];
}

function readChatConfig() {
  const state = readNeoState();
  const providers = Array.isArray(state.providers) ? state.providers : [];
  const provider = providers.find((p) => p.id === state.activeProviderId)
    || providers.find((p) => p.id === state.selectedProviderId)
    || providers[0]
    || { id: "neo-local", name: "neo mock", protocol: "mock", models: ["neo-mock"] };
  const model = state.activeModel || provider.model || provider.models?.[0] || "neo-mock";
  return { state, provider, model };
}

function buildPetRequestMessages(provider, model) {
  const state = readNeoState();
  const systemPrompt = String(state.systemPrompt || "你是 neo 的桌宠助手。请用自然、简洁的中文帮助用户，必要时读取用户附加的文件信息。").trim();
  const messages = systemPrompt ? [{ role: "system", content: systemPrompt }] : [];
  for (const message of petChatHistory.slice(-12)) {
    if (message.role === "assistant") {
      messages.push({ role: "assistant", content: String(message.content || "") });
    } else if (message.role === "user") {
      messages.push({ role: "user", content: modelContentForPetMessage(message, provider, model) });
    }
  }
  return messages.filter((message) => {
    if (Array.isArray(message.content)) return message.content.length > 0;
    return String(message.content || "").trim();
  });
}

async function sendChat(text, attachments = []) {
  if ((!text.trim() && !attachments.length) || streaming) return;
  streaming = true;
  sendBtn.disabled = true;
  appendMsg("user", text || "请查看附件", attachments);

  const assistantDiv = appendMsg("assistant", "");
  assistantDiv.classList.add("streaming");
  msgs.scrollTop = msgs.scrollHeight;

  // 获取当前活跃的供应商/模型配置
  const { state, provider, model } = readChatConfig();

  try {
    setState("thinking");
    const importedAttachments = await importPetAttachments(attachments);
    const userMessage = {
      role: "user",
      content: text || "请查看附件",
      attachments: importedAttachments
    };
    petChatHistory.push(userMessage);
    const messages = buildPetRequestMessages(provider, model);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        model,
        messages,
        temperature: Number.isFinite(Number(state.temperature)) ? Number(state.temperature) : 0.7,
        maxTokens: Number.isFinite(Number(state.maxTokens)) ? Number(state.maxTokens) : 2048,
        thinking: state.thinking || "balanced",
        enableTools: Boolean(state.agentTools),
        enabledSkills: Array.isArray(state.enabledSkills) ? state.enabledSkills : [],
        stream: true
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "请求失败");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let fullContent = "";
    let finalContent = "";

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
          fullContent += event.text;
          setMsgText(assistantDiv, fullContent);
          msgs.scrollTop = msgs.scrollHeight;
        } else if (event.type === "tool_start" || event.type === "skill_start" || event.type === "skill_step") {
          setState("working");
        } else if (event.type === "done") {
          finalContent = String(event.content || fullContent || "");
        } else if (event.type === "error") {
          throw new Error(event.error || "流式请求失败");
        }
      }
    }

    assistantDiv.classList.remove("streaming");
    const reply = finalContent || fullContent || "(没有收到回复，请检查 API Key)";
    setMsgText(assistantDiv, reply);
    petChatHistory.push({ role: "assistant", content: reply });
    setState("done");
  } catch (err) {
    assistantDiv.classList.remove("streaming");
    setMsgText(assistantDiv, `请求失败：${err.message}`);
    setState("error");
  } finally {
    streaming = false;
    sendBtn.disabled = false;
  }
}

// ── 事件绑定 ──────────────────────────────────────────────────────

// 拖动头像移动窗口（移动超过 4px 视为拖动，不触发 click）
let dragStartX = 0, dragStartY = 0, dragging = false, hasDragged = false;
avatar.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  dragging = true;
  hasDragged = false;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  e.preventDefault();
});
document.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const dx = e.screenX - dragStartX;
  const dy = e.screenY - dragStartY;
  if (!hasDragged && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
  hasDragged = true;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  if (window.petBridge) window.petBridge.moveBy(dx, dy);
});
document.addEventListener("mouseup", () => { dragging = false; });

// 点击头像：展开/收起聊天框（拖动后不触发）
avatar.addEventListener("click", (e) => {
  if (hasDragged) { hasDragged = false; return; }
  e.preventDefault();
  e.stopPropagation();
  toggleChat();
}, false);

// 阻止头像上的右键冒泡，交给 contextmenu 处理
avatar.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (window.petBridge) window.petBridge.showContextMenu();
});

closeBtn.addEventListener("click", () => {
  if (chatOpen) toggleChat();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  const attachments = [...pendingAttachments];
  if (!text && !attachments.length) return;
  input.value = "";
  pendingAttachments = [];
  renderPetAttachmentBar();
  sendChat(text, attachments);
});

function isFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

function clearPetDragHint() {
  dragDepth = 0;
  chat.classList.remove("drag-over");
}

chat.addEventListener("dragenter", (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dragDepth += 1;
  chat.classList.add("drag-over");
});

chat.addEventListener("dragover", (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});

chat.addEventListener("dragleave", (event) => {
  if (!isFileDrag(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) chat.classList.remove("drag-over");
});

chat.addEventListener("drop", async (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  clearPetDragHint();
  await handlePetFiles(event.dataTransfer.files);
});

chat.addEventListener("paste", async (event) => {
  const imageFiles = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (!imageFiles.length) return;
  event.preventDefault();
  await handlePetFiles(imageFiles);
});

function startChatResize(event) {
  if (!chatOpen || event.button !== 0) return;
  resizeState = {
    dir: event.currentTarget.dataset.petResize || "se",
    startX: event.screenX,
    startY: event.screenY,
    width: chatSize.width,
    height: chatSize.height,
    placement: currentPlacement
  };
  event.preventDefault();
  event.stopPropagation();
}

resizeHandles.forEach((handle) => handle.addEventListener("mousedown", startChatResize));

document.addEventListener("mousemove", (event) => {
  if (!resizeState) return;
  const dx = event.screenX - resizeState.startX;
  const dy = event.screenY - resizeState.startY;
  const invertX = resizeState.placement === "above" || resizeState.placement === "left";
  const next = {
    width: chatSize.width,
    height: chatSize.height
  };
  if (resizeState.dir.includes("e")) {
    next.width = resizeState.width + (invertX ? -dx : dx);
  }
  if (resizeState.dir.includes("s")) {
    next.height = resizeState.height + dy;
  }
  chatSize = normalizeChatSize(next);
  applyChatSize();
  requestPetLayout({ saveChatSize: false });
});

document.addEventListener("mouseup", () => {
  if (!resizeState) return;
  resizeState = null;
  window.petBridge?.saveChatSize?.(chatSize);
  requestPetLayout({ saveChatSize: true });
});

// Electron bridge 回调
if (window.petBridge) {
  window.petBridge.onAvatarChange(async (url) => {
    try {
      await persistAvatar(url);
    } catch (error) {
      showBubble(error.message || "头像更新失败");
    }
  });

  window.petBridge.onQuietMode((v) => {
    quietMode = v;
    if (v) bubble.classList.remove("visible");
  });

  window.petBridge.onLayout((layout = {}) => {
    if (!resizeState && layout.chatSize) {
      chatSize = normalizeChatSize(layout.chatSize);
      applyChatSize();
    }
    applyLayoutPlacement(layout.placement || (chatOpen ? "above" : "closed"));
  });
}

// ── Petdex 精灵图 ─────────────────────────────────────────────────

const PETDEX_LEGACY_SPRITE_BASE = "https://petdex.crafter.run/pets";
let petdexSpriteTimer = null;
let petdexCurrentKey = "";
let petdexCurrentPet = null;
let petdexCurrentImage = null;

function clearPetdexSprite() {
  if (petdexSpriteTimer) { clearInterval(petdexSpriteTimer); petdexSpriteTimer = null; }
  const existing = avatar.querySelector("canvas.petdex-canvas");
  if (existing) existing.remove();
}

function normalizePetdexSelection(value, fallbackSlug = "") {
  const slug = String(value?.slug || fallbackSlug || "").trim();
  if (!slug) return null;
  return {
    slug,
    displayName: String(value?.displayName || value?.name || slug).trim(),
    spritesheetUrl: String(value?.spritesheetUrl || "").trim()
  };
}

function readPetdexSelection() {
  const state = readNeoState();
  return normalizePetdexSelection(state.petdexPet, state.petdexSlug || "");
}

function getPetdexSpriteUrl(pet) {
  return pet?.spritesheetUrl || (pet?.slug ? `${PETDEX_LEGACY_SPRITE_BASE}/${pet.slug}/spritesheet.webp` : "");
}

function getPetdexAnimationForState(state = currentState) {
  const animation = PETDEX_STATE_ANIMATIONS[state] || PETDEX_STATE_ANIMATIONS.idle;
  return {
    row: Number.isFinite(animation.row) ? animation.row : PETDEX_STATE_ANIMATIONS.idle.row,
    frames: Number.isFinite(animation.frames) ? animation.frames : PETDEX_STATE_ANIMATIONS.idle.frames,
    durationMs: Number.isFinite(animation.durationMs) ? animation.durationMs : PETDEX_STATE_ANIMATIONS.idle.durationMs
  };
}

function loadPetdexSpriteImage(pet) {
  const spriteUrl = getPetdexSpriteUrl(pet);
  if (!spriteUrl) return Promise.reject(new Error("缺少精灵图地址"));
  return new Promise((resolve, reject) => {
    const img = new Image();
    const fallbackUrl = spriteUrl.includes(PETDEX_LEGACY_SPRITE_BASE) && spriteUrl.endsWith(".webp")
      ? spriteUrl.replace(/\.webp$/, ".png")
      : "";
    img.onload = () => resolve(img);
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

function resetPetdexMode() {
  petdexCurrentPet = null;
  petdexCurrentImage = null;
  petdexCurrentKey = "";
  avatar.classList.remove("petdex-mode");
  avatar.style.removeProperty("--petdex-w");
  avatar.style.removeProperty("--petdex-h");
  setPetDisplaySize(DEFAULT_PET_WINDOW.w, DEFAULT_PET_WINDOW.h);
  delete avatar.dataset.windowW;
  delete avatar.dataset.windowH;
  clearPetdexSprite();
  syncRootClass();
  updatePetWindowSize();
}

function restartPetdexAnimation() {
  if (!petdexCurrentPet || !petdexCurrentImage) return;
  clearPetdexSprite();

  const img = petdexCurrentImage;
  const cols = 8, rows = 9;
  const frameW = img.naturalWidth / cols;
  const frameH = img.naturalHeight / rows;
  const animation = getPetdexAnimationForState(currentState);
  const row = Math.max(0, Math.min(rows - 1, Number(animation.row || 0)));
  const frameCount = Math.max(1, Math.min(cols, Number(animation.frames || PETDEX_STATE_ANIMATIONS.idle.frames)));
  const frameMs = Number(animation.durationMs || PETDEX_STATE_ANIMATIONS.idle.durationMs) / frameCount;
  const renderW = PETDEX_RENDER_WIDTH;
  const renderH = Math.round(renderW * frameH / frameW);

  avatar.style.setProperty("--petdex-w", `${renderW}px`);
  avatar.style.setProperty("--petdex-h", `${renderH}px`);
  setPetDisplaySize(renderW, renderH);
  avatar.dataset.windowW = String(renderW + PETDEX_WINDOW_PADDING);
  avatar.dataset.windowH = String(renderH + PETDEX_WINDOW_PADDING);
  avatar.classList.add("petdex-mode");
  syncRootClass();
  updatePetWindowSize();

  const canvas = document.createElement("canvas");
  canvas.className = "petdex-canvas";
  canvas.width = renderW;
  canvas.height = renderH;

  avatar.querySelector("canvas.petdex-canvas")?.remove();
  avatar.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let frame = 0;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, frame * frameW, row * frameH, frameW, frameH, 0, 0, canvas.width, canvas.height);
    frame = (frame + 1) % frameCount;
  };
  draw();
  petdexSpriteTimer = setInterval(draw, Math.max(80, frameMs));
}

function applyPetdexSelection(selection) {
  const pet = normalizePetdexSelection(selection);
  const nextKey = pet ? `${pet.slug}|${pet.spritesheetUrl || ""}` : "";
  if (nextKey === petdexCurrentKey) return;
  petdexCurrentKey = nextKey;
  clearPetdexSprite();

  if (!pet) {
    // 恢复自定义头像或默认表情
    resetPetdexMode();
    loadAvatar();
    return;
  }

  // 隐藏默认表情和自定义头像图片
  const icon = document.getElementById("petDefaultIcon");
  if (icon) icon.style.display = "none";
  avatar.querySelectorAll("img").forEach((img) => img.style.display = "none");

  loadPetdexSpriteImage(pet).then((img) => {
    // 清掉可能之后又触发的旧图
    if (petdexCurrentKey !== nextKey) return;

    petdexCurrentPet = pet;
    petdexCurrentImage = img;
    restartPetdexAnimation();
  }).catch(() => {
    resetPetdexMode();
    loadAvatar();
  });
}

// ── 初始化 ────────────────────────────────────────────────────────

function setupProfileSync() {
  const channel = getProfileChannel();
  if (channel) {
    channel.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === "agent-profile" && data.source !== "pet") {
        if (!petdexCurrentPet) applyAvatar(data.agentAvatar || "");
      }
      // 桌宠设置页发来的 petdex 切换消息
      if (data.type === "petdex-selection") {
        applyPetdexSelection(data.pet || { slug: data.slug || "" });
      }
      if (data.type === "petdex-slug") {
        applyPetdexSelection(data.pet || { slug: data.slug || "" });
      }
    };
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === LEGACY_STORAGE_KEY) {
      const selection = readPetdexSelection();
      const nextKey = selection ? `${selection.slug}|${selection.spritesheetUrl || ""}` : "";
      if (nextKey !== petdexCurrentKey) {
        applyPetdexSelection(selection);
      } else if (!selection) {
        loadAvatar();
      }
    }
  });
}

function loadPetdexFromState() {
  const selection = readPetdexSelection();
  if (selection) {
    applyPetdexSelection(selection);
  } else {
    loadAvatar();
  }
}

applyChatSize();
setPetDisplaySize(DEFAULT_PET_WINDOW.w, DEFAULT_PET_WINDOW.h);
syncRootClass();
requestPetLayout();
setupProfileSync();
hydrateStateFromServer().finally(() => {
  loadPetdexFromState();
  subscribeState();
});
