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
import type { AgentTeam } from "../../lib/types";

interface AgentGraphProps {
  team: AgentTeam | null;
  onNodeClick?: (agentId: string) => void;
}

const nodeTypes = { agent: AgentNode };

export function AgentGraph({ team, onNodeClick }: AgentGraphProps) {
  const { nodes, edges } = useMemo(() => {
    if (!team || team.members.length === 0) {
      return { nodes: [], edges: [] };
    }

    const lead = team.members.find((m) => m.role === "lead");
    const teammates = team.members.filter((m) => m.role !== "lead");

    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];

    // Lead node at top center
    if (lead) {
      const leadNode: Node = {
        id: lead.agentId || "lead",
        type: "agent",
        position: { x: 200, y: 50 },
        data: {
          name: lead.name,
          role: "lead",
          agentType: lead.agentType,
          status: "idle",
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
      const teammateNode: Node = {
        id: nodeId,
        type: "agent",
        position: { x: startX + i * spacing, y: 200 },
        data: {
          name: member.name,
          role: "teammate",
          agentType: member.agentType,
          status: "idle",
        } satisfies AgentNodeData as unknown as Record<string, unknown>,
      };
      nodeList.push(teammateNode);

      // Edge from lead to teammate
      if (lead) {
        edgeList.push({
          id: `edge-${lead.agentId || "lead"}-${nodeId}`,
          source: lead.agentId || "lead",
          target: nodeId,
          animated: true,
          style: { stroke: "var(--color-accent, #7aa2f7)" },
        });
      }
    });

    return { nodes: nodeList, edges: edgeList };
  }, [team]);

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
