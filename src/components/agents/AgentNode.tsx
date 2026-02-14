import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AgentStatusBadge } from "./AgentStatusBadge";

export interface AgentNodeData {
  name: string;
  role: "lead" | "teammate";
  agentType: string;
  status: "working" | "idle" | "waiting" | "error" | "shutdown";
  currentTask?: string;
  [key: string]: unknown;
}

function AgentNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as AgentNodeData;
  const isLead = nodeData.role === "lead";

  return (
    <div
      className={`rounded-lg border px-4 py-3 shadow-sm ${
        isLead
          ? "border-accent bg-accent/10"
          : "border-border bg-bg-secondary"
      }`}
      style={{ minWidth: 160 }}
    >
      {/* Target handle (top) — teammates receive edges from lead */}
      {!isLead && (
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-accent !h-2 !w-2"
        />
      )}

      {/* Header */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text">{nodeData.name}</span>
        {isLead && (
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
            LEAD
          </span>
        )}
      </div>

      {/* Status */}
      <AgentStatusBadge status={nodeData.status} />

      {/* Agent type */}
      <div className="mt-1 text-xs text-text-muted">{nodeData.agentType}</div>

      {/* Current task */}
      {nodeData.currentTask && (
        <div className="mt-1 truncate text-xs text-text-muted" title={nodeData.currentTask}>
          {nodeData.currentTask}
        </div>
      )}

      {/* Source handle (bottom) — lead sends edges to teammates */}
      {isLead && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-accent !h-2 !w-2"
        />
      )}
    </div>
  );
}

export const AgentNode = memo(AgentNodeComponent);
