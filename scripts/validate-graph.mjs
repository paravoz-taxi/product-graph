import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const graphPath = join(root, "data", "product-graph.json");
const graph = JSON.parse(readFileSync(graphPath, "utf8"));

const requiredRootFields = ["schemaVersion", "project", "nodes", "edges", "agentViews"];
for (const field of requiredRootFields) {
  if (!(field in graph)) throw new Error(`Missing root field: ${field}`);
}

if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
  throw new Error("Graph must contain nodes");
}
if (!Array.isArray(graph.edges)) {
  throw new Error("Graph edges must be an array");
}

const nodeIds = new Set();
for (const node of graph.nodes) {
  for (const field of ["id", "type", "label", "summary", "status", "confidence", "priority"]) {
    if (!node[field]) throw new Error(`Node ${node.id ?? "<unknown>"} is missing ${field}`);
  }
  if (nodeIds.has(node.id)) throw new Error(`Duplicate node id: ${node.id}`);
  nodeIds.add(node.id);
  if (graph.nodeTypes && !graph.nodeTypes.includes(node.type)) {
    throw new Error(`Node ${node.id} has unknown type: ${node.type}`);
  }
}

const edgeIds = new Set();
for (const edge of graph.edges) {
  for (const field of ["id", "source", "target", "type"]) {
    if (!edge[field]) throw new Error(`Edge ${edge.id ?? "<unknown>"} is missing ${field}`);
  }
  if (edgeIds.has(edge.id)) throw new Error(`Duplicate edge id: ${edge.id}`);
  edgeIds.add(edge.id);
  if (!nodeIds.has(edge.source)) throw new Error(`Edge ${edge.id} has missing source: ${edge.source}`);
  if (!nodeIds.has(edge.target)) throw new Error(`Edge ${edge.id} has missing target: ${edge.target}`);
  if (graph.edgeTypes && !graph.edgeTypes.includes(edge.type)) {
    throw new Error(`Edge ${edge.id} has unknown type: ${edge.type}`);
  }
}

for (const view of graph.agentViews) {
  if (!view.id || !view.label || !Array.isArray(view.entryNodes)) {
    throw new Error(`Agent view is malformed: ${JSON.stringify(view)}`);
  }
  for (const id of view.entryNodes) {
    if (!nodeIds.has(id)) throw new Error(`Agent view ${view.id} references missing entry node: ${id}`);
  }
}

console.log(
  `Graph valid: ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${graph.agentViews.length} agent views`,
);
