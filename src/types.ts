export type GraphNodeType =
  | "persona"
  | "goal"
  | "job"
  | "need"
  | "hypothesis"
  | "principle"
  | "feature"
  | "metric"
  | "evidence"
  | "linear"
  | "system";

export type GraphEdgeType =
  | "serves"
  | "has_job"
  | "has_need"
  | "motivates"
  | "tests"
  | "implemented_by"
  | "measured_by"
  | "evidenced_by"
  | "depends_on"
  | "syncs_to_linear"
  | "owned_by_system";

export type ProductNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  summary: string;
  status: string;
  confidence: string;
  priority: string;
  tags?: string[];
  links?: string[];
  agentContext?: string;
};

export type ProductEdge = {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  label?: string;
};

export type AgentView = {
  id: string;
  label: string;
  entryNodes: string[];
  maxContextNodes: number;
  includeEdgeTypes: GraphEdgeType[];
  prompt: string;
};

export type ProductGraph = {
  schemaVersion: string;
  updatedAt: string;
  project: {
    name: string;
    repoFrontend: string;
    repoBackend: string;
    productionFrontend: string;
    productionBackend: string;
    mission: string;
    positioning: string;
  };
  principles: Array<{ id: string; label: string; summary: string }>;
  nodeTypes: GraphNodeType[];
  edgeTypes: GraphEdgeType[];
  nodes: ProductNode[];
  edges: ProductEdge[];
  linearMapping: Record<string, unknown>;
  agentViews: AgentView[];
  openQuestions: Array<{
    id: string;
    topic: string;
    question: string;
    targetNodes: string[];
  }>;
};
