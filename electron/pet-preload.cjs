// electron/pet-preload.cjs — 桌宠窗口预加载脚本
// 向渲染进程暴露受限的 Electron 原生 API

"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petBridge", {
  showContextMenu: () => ipcRenderer.send("pet:context-menu"),
  openMain:        () => ipcRenderer.send("pet:open-main"),
  hidePet:         () => ipcRenderer.send("pet:hide"),
  startDrag:       () => ipcRenderer.send("pet:start-drag"),
  moveBy:          (dx, dy) => ipcRenderer.send("pet:move-by", { dx, dy }),
  setSize:         (w, h) => ipcRenderer.send("pet:set-size", { w, h }),
  setLayout:       (layout) => ipcRenderer.send("pet:set-layout", layout || {}),
  saveChatSize:    (size) => ipcRenderer.send("pet:save-chat-size", size || {}),
  onAvatarChange:  (fn) => ipcRenderer.on("pet:avatar", (_, url) => fn(url)),
  onQuietMode:     (fn) => ipcRenderer.on("pet:quiet-mode", (_, v) => fn(v)),
  onLayout:        (fn) => ipcRenderer.on("pet:layout", (_, layout) => fn(layout || {})),
  getSettings:     () => ipcRenderer.sendSync("pet:get-settings"),
  getServerUrl:    () => ipcRenderer.sendSync("pet:get-server-url")
});
