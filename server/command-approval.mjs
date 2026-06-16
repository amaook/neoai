// server/command-approval.mjs — run_command 单次审批代理
// 服务端挂起待确认命令，前端通过 POST /api/command-confirm 放行或驳回，超时自动拒绝。

import { randomUUID } from "node:crypto";

const pendingApprovals = new Map();

export const COMMAND_APPROVAL_TIMEOUT_MS = 60_000;

export function requestCommandApproval(command, { timeoutMs = COMMAND_APPROVAL_TIMEOUT_MS } = {}) {
  const id = randomUUID();
  const decision = new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(id);
      resolve({ approved: false, reason: "timeout" });
    }, timeoutMs);
    pendingApprovals.set(id, { resolve, timer, command: String(command || "") });
  });
  return { id, decision };
}

export function resolveCommandApproval(id, approved) {
  const entry = pendingApprovals.get(String(id || ""));
  if (!entry) return false;
  clearTimeout(entry.timer);
  pendingApprovals.delete(String(id || ""));
  entry.resolve({ approved: Boolean(approved), reason: approved ? "approved" : "denied" });
  return true;
}
