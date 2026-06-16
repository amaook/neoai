const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("neoDesktop", {
  windowControl: (action) => ipcRenderer.send("neo:window-control", String(action || "")),
  petGetEnabled: () => ipcRenderer.invoke("neo:pet-get-enabled"),
  petSetEnabled: (enabled) => ipcRenderer.send("neo:pet-set-enabled", Boolean(enabled)),
  onGlobalCursor: (fn) => {
    if (typeof fn !== "function") return () => {};
    const handler = (_, payload) => fn(payload || {});
    ipcRenderer.on("neo:global-cursor", handler);
    return () => ipcRenderer.removeListener("neo:global-cursor", handler);
  }
});
