import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildAgentSlice, graph, nodeById, typeColors, typeLabels, typeOrder, viewNodeIds } from "./graph";
import type { GraphNodeType, ProductNode } from "./types";

const statusLabels: Record<string, string> = {
  active: "active",
  planned: "planned",
  "in-progress": "in progress",
  implemented: "implemented",
  partial: "partial",
  mocked: "mocked",
  testing: "testing",
};

function App() {
  const [selectedId, setSelectedId] = useState("goal.driver-activation");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<GraphNodeType | "all">("all");
  const [activeViewId, setActiveViewId] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  const selectedNode = nodeById(selectedId) ?? graph.nodes[0];
  const activeView = graph.agentViews.find((view) => view.id === activeViewId);
  const scopedIds = activeView ? viewNodeIds(activeView) : undefined;

  const visibleNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return graph.nodes.filter((node) => {
      if (scopedIds && !scopedIds.has(node.id)) return false;
      if (typeFilter !== "all" && node.type !== typeFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = `${node.id} ${node.label} ${node.summary} ${(node.tags ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, scopedIds, typeFilter]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const flowNodes = useMemo<Node[]>(() => buildFlowNodes(visibleNodes, selectedId), [selectedId, visibleNodes]);
  const flowEdges = useMemo<Edge[]>(
    () =>
      graph.edges
        .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          type: "smoothstep",
          animated: edge.type === "syncs_to_linear",
          style: {
            stroke: edgeColor(edge.type),
            strokeWidth: selectedId === edge.source || selectedId === edge.target ? 2.6 : 1.4,
          },
          labelStyle: { fill: "#475569", fontSize: 10, fontWeight: 600 },
        })),
    [selectedId, visibleIds],
  );

  const agentSlice = useMemo(() => buildAgentSlice(selectedNode.id), [selectedNode.id]);
  const agentSliceText = useMemo(() => JSON.stringify(agentSlice, null, 2), [agentSlice]);

  const copyAgentSlice = async () => {
    await navigator.clipboard.writeText(agentSliceText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">ПВ</div>
          <div>
            <div className="brand-title">ПараВоз</div>
            <div className="brand-subtitle">Product Graph</div>
          </div>
        </div>

        <section className="panel mission-panel">
          <div className="eyebrow">Mission</div>
          <p>{graph.project.mission}</p>
        </section>

        <section className="panel">
          <div className="panel-title">AI Views</div>
          <button
            className={activeViewId === "all" ? "filter-button active" : "filter-button"}
            onClick={() => setActiveViewId("all")}
          >
            Весь граф
          </button>
          {graph.agentViews.map((view) => (
            <button
              key={view.id}
              className={activeViewId === view.id ? "filter-button active" : "filter-button"}
              onClick={() => {
                setActiveViewId(view.id);
                setSelectedId(view.entryNodes[0]);
              }}
            >
              {view.label}
            </button>
          ))}
        </section>

        <section className="panel">
          <div className="panel-title">Types</div>
          <button
            className={typeFilter === "all" ? "type-chip active" : "type-chip"}
            onClick={() => setTypeFilter("all")}
          >
            Все типы
          </button>
          {typeOrder.map((type) => (
            <button
              key={type}
              className={typeFilter === type ? "type-chip active" : "type-chip"}
              style={{ "--chip": typeColors[type].chip, "--border": typeColors[type].border } as React.CSSProperties}
              onClick={() => setTypeFilter(type)}
            >
              {typeLabels[type]}
            </button>
          ))}
        </section>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">Graph source of truth</div>
            <h1>Jobs, needs, hypotheses and execution map</h1>
          </div>
          <div className="stats">
            <Stat label="Nodes" value={graph.nodes.length} />
            <Stat label="Edges" value={graph.edges.length} />
            <Stat label="Views" value={graph.agentViews.length} />
          </div>
        </header>

        <section className="workspace">
          <div className="graph-toolbar">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по job, need, feature, metric..."
            />
            <span>{visibleNodes.length} узлов в текущем срезе</span>
          </div>

          <div className="graph-panel">
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              fitView
              minZoom={0.18}
              maxZoom={1.6}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#cbd5e1" />
              <Controls showInteractive={false} />
              <MiniMap
                nodeStrokeWidth={3}
                pannable
                zoomable
                nodeColor={(node) => {
                  const type = String(node.data?.nodeType ?? "feature") as GraphNodeType;
                  return typeColors[type]?.border ?? "#64748b";
                }}
              />
            </ReactFlow>
          </div>
        </section>
      </main>

      <aside className="details">
        <section className="detail-card selected-card">
          <div className="detail-kicker">{typeLabels[selectedNode.type]}</div>
          <h2>{selectedNode.label}</h2>
          <p>{selectedNode.summary}</p>
          <div className="meta-grid">
            <Meta label="status" value={statusLabels[selectedNode.status] ?? selectedNode.status} />
            <Meta label="priority" value={selectedNode.priority} />
            <Meta label="confidence" value={selectedNode.confidence} />
          </div>
          {selectedNode.agentContext ? <div className="note">{selectedNode.agentContext}</div> : null}
          <div className="tag-list">
            {(selectedNode.tags ?? []).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          {(selectedNode.links ?? []).map((link) => (
            <a key={link} className="link" href={link} target="_blank" rel="noreferrer">
              {link}
            </a>
          ))}
        </section>

        <section className="detail-card">
          <div className="detail-row">
            <div>
              <div className="detail-kicker">Agent Slice</div>
              <h3>Compact context</h3>
            </div>
            <button className="copy-button" onClick={copyAgentSlice}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="slice-preview">{agentSliceText}</pre>
        </section>

        <section className="detail-card">
          <div className="detail-kicker">Open Questions</div>
          <div className="questions-list">
            {graph.openQuestions.slice(0, 5).map((question) => (
              <button
                key={question.id}
                onClick={() => setSelectedId(question.targetNodes[0])}
                className="question"
              >
                <span>{question.topic}</span>
                {question.question}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function buildFlowNodes(nodes: ProductNode[], selectedId: string): Node[] {
  const byType = new Map<GraphNodeType, ProductNode[]>();
  for (const type of typeOrder) byType.set(type, []);
  for (const node of nodes) byType.get(node.type)?.push(node);

  const out: Node[] = [];
  typeOrder.forEach((type, laneIndex) => {
    const laneNodes = byType.get(type) ?? [];
    laneNodes.forEach((node, index) => {
      const colors = typeColors[node.type];
      out.push({
        id: node.id,
        data: {
          nodeType: node.type,
          label: (
            <div className={node.id === selectedId ? "flow-node selected" : "flow-node"}>
              <div className="node-type" style={{ background: colors.chip, color: colors.border }}>
                {typeLabels[node.type]}
              </div>
              <div className="node-label">{node.label}</div>
              <div className="node-summary">{node.summary}</div>
            </div>
          ),
        },
        position: {
          x: laneIndex * 290,
          y: index * 178 + (laneIndex % 2) * 38,
        },
        style: {
          width: 246,
          borderColor: node.id === selectedId ? colors.border : "#dbe3ef",
          background: colors.bg,
          borderRadius: 8,
          borderWidth: node.id === selectedId ? 2 : 1,
          boxShadow: node.id === selectedId ? "0 12px 30px rgba(15, 23, 42, 0.18)" : "0 8px 20px rgba(15, 23, 42, 0.08)",
        },
      });
    });
  });
  return out;
}

function edgeColor(type: string) {
  switch (type) {
    case "has_job":
      return "#2563eb";
    case "has_need":
      return "#9333ea";
    case "implemented_by":
      return "#334155";
    case "measured_by":
      return "#be123c";
    case "syncs_to_linear":
      return "#4338ca";
    case "depends_on":
      return "#64748b";
    default:
      return "#0f766e";
  }
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
