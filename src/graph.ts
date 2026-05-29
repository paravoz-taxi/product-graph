import rawGraph from "../data/product-graph.json";
import type { AgentView, GraphEdgeType, GraphNodeType, ProductEdge, ProductGraph, ProductNode } from "./types";

export const graph = rawGraph as ProductGraph;

export const typeLabels: Record<GraphNodeType, string> = {
  persona: "Роли",
  goal: "Цели",
  job: "Работы",
  need: "Потребности",
  hypothesis: "Гипотезы",
  principle: "Принципы",
  feature: "Фичи",
  metric: "Метрики",
  evidence: "Evidence",
  linear: "Linear",
  system: "Системы",
};

export const typeOrder: GraphNodeType[] = [
  "persona",
  "goal",
  "job",
  "need",
  "hypothesis",
  "principle",
  "feature",
  "system",
  "metric",
  "evidence",
  "linear",
];

export const typeColors: Record<GraphNodeType, { border: string; bg: string; chip: string }> = {
  persona: { border: "#166534", bg: "#f0fdf4", chip: "#dcfce7" },
  goal: { border: "#0f766e", bg: "#f0fdfa", chip: "#ccfbf1" },
  job: { border: "#1d4ed8", bg: "#eff6ff", chip: "#dbeafe" },
  need: { border: "#9333ea", bg: "#faf5ff", chip: "#f3e8ff" },
  hypothesis: { border: "#b45309", bg: "#fffbeb", chip: "#fef3c7" },
  principle: { border: "#7c2d12", bg: "#fff7ed", chip: "#ffedd5" },
  feature: { border: "#334155", bg: "#f8fafc", chip: "#e2e8f0" },
  metric: { border: "#be123c", bg: "#fff1f2", chip: "#ffe4e6" },
  evidence: { border: "#047857", bg: "#ecfdf5", chip: "#d1fae5" },
  linear: { border: "#4338ca", bg: "#eef2ff", chip: "#e0e7ff" },
  system: { border: "#0e7490", bg: "#ecfeff", chip: "#cffafe" },
};

export function nodeById(id: string): ProductNode | undefined {
  return graph.nodes.find((node) => node.id === id);
}

export function incidentEdges(nodeId: string): ProductEdge[] {
  return graph.edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
}

export function buildAgentSlice(entryId: string, limit = 14) {
  const ids = new Set<string>([entryId]);
  const queue = [entryId];

  while (queue.length > 0 && ids.size < limit) {
    const id = queue.shift()!;
    for (const edge of incidentEdges(id)) {
      const next = edge.source === id ? edge.target : edge.source;
      if (!ids.has(next)) {
        ids.add(next);
        queue.push(next);
      }
      if (ids.size >= limit) break;
    }
  }

  const selectedIds = Array.from(ids);
  const nodes = selectedIds
    .map(nodeById)
    .filter((node): node is ProductNode => Boolean(node))
    .map(({ id, type, label, summary, status, priority, confidence, tags, agentContext }) => ({
      id,
      type,
      label,
      summary,
      status,
      priority,
      confidence,
      tags,
      agentContext,
    }));
  const edgeSet = graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));

  return {
    source: "paravoz-product-graph",
    graphVersion: graph.schemaVersion,
    entryId,
    contextPolicy: "Use this slice instead of loading the full graph. Expand only if the task needs adjacent jobs, needs, metrics or implementation systems.",
    nodes,
    edges: edgeSet,
  };
}

export function viewNodeIds(view: AgentView): Set<string> {
  const ids = new Set(view.entryNodes);
  const queue = [...view.entryNodes];
  const allowedEdgeTypes = new Set<GraphEdgeType>(view.includeEdgeTypes);

  while (queue.length > 0 && ids.size < view.maxContextNodes) {
    const id = queue.shift()!;
    for (const edge of graph.edges) {
      if (!allowedEdgeTypes.has(edge.type)) continue;
      if (edge.source !== id && edge.target !== id) continue;
      const next = edge.source === id ? edge.target : edge.source;
      if (!ids.has(next)) {
        ids.add(next);
        queue.push(next);
      }
      if (ids.size >= view.maxContextNodes) break;
    }
  }

  return ids;
}
