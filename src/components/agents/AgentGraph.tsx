import { useMemo } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  BackgroundVariant,
  Controls,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AgentNode, type AgentNodeData } from "./AgentNode";
import { useSessionStore } from "../../stores/sessionStore";
import type { AgentTeam, Session } from "../../lib/types";

interface AgentGraphProps {
  team: AgentTeam | null;
  onNodeClick?: (agentId: string) => void;
}

const nodeTypes = { agent: AgentNode };

/** Map session activity/status to AgentStatusBadge status */
function resolveAgentStatus(session: Session | undefined): AgentNodeData["status"] {
  if (!session) return "idle";
  if (session.status === "error") return "error";
  if (session.status === "completed") return "shutdown";
  switch (session.activityState) {
    case "thinking":
    case "streaming":
    case "tool_running":
      return "working";
    case "awaiting_input":
      return "waiting";
    default:
      return "idle";
  }
}

export function AgentGraph({ team, onNodeClick }: AgentGraphProps) {
  const sessions = useSessionStore((s) => s.sessions);

  const { nodes, edges } = useMemo(() => {
    if (!team || team.members.length === 0) {
      return { nodes: [], edges: [] };
    }

    const lead = team.members.find((m) => m.role === "lead");
    const teammates = team.members.filter((m) => m.role !== "lead");

    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];

    // Helper to find a session matching an agent member
    const findSession = (agentId: string) =>
      sessions.find((s) => s.id === agentId || s.claudeSessionId === agentId);

    // Track if any agent is actively working (for edge animation)
    let anyWorking = false;

    // Lead node at top center
    if (lead) {
      const session = findSession(lead.agentId);
      const status = resolveAgentStatus(session);
      if (status === "working") anyWorking = true;

      const leadNode: Node = {
        id: lead.agentId || "lead",
        type: "agent",
        position: { x: 200, y: 50 },
        data: {
          name: lead.name,
          role: "lead",
          agentType: lead.agentType,
          status,
        } satisfies AgentNodeData as unknown as Record<string, unknown>,
      };
      nodeList.push(leadNode);
    }

    // Teammate nodes spread below
    const spacing = 220;
    const totalWidth = (teammates.length - 1) * spacing;
    const startX = 200 - totalWidth / 2;

    teammates.forEach((member, i) => {
      const nodeId = member.agentId || `teammate-${i}`;
      const session = findSession(member.agentId);
      const status = resolveAgentStatus(session);
      if (status === "working") anyWorking = true;

      const teammateNode: Node = {
        id: nodeId,
        type: "agent",
        position: { x: startX + i * spacing, y: 200 },
        data: {
          name: member.name,
          role: "teammate",
          agentType: member.agentType,
          status,
        } satisfies AgentNodeData as unknown as Record<string, unknown>,
      };
      nodeList.push(teammateNode);

      // Edge from lead to teammate — animate only when agents are active
      if (lead) {
        edgeList.push({
          id: `edge-${lead.agentId || "lead"}-${nodeId}`,
          source: lead.agentId || "lead",
          target: nodeId,
          animated: anyWorking,
          style: { stroke: "var(--color-accent, #7aa2f7)" },
        });
      }
    });

    return { nodes: nodeList, edges: edgeList };
  }, [team, sessions]);

  if (!team) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        <div className="text-center">
          <p>No agent team selected</p>
          <p className="mt-1 text-xs">
            Teams appear here when using Claude Code's agent team feature
          </p>
        </div>
      </div>
    );
  }

  if (team.members.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No members in team "{team.name}"
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_event, node) => onNodeClick?.(node.id)}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
