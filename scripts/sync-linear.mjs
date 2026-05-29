import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const graph = JSON.parse(readFileSync(join(root, "data", "product-graph.json"), "utf8"));
const registryPath = join(root, "linear-sync.local.json");
const registry = existsSync(registryPath)
  ? JSON.parse(readFileSync(registryPath, "utf8"))
  : { projects: {}, issues: {}, labels: {}, updatedAt: null };
registry.projects ??= {};
registry.issues ??= {};
registry.labels ??= {};
registry.issueRelations ??= {};
registry.projectRelations ??= {};

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const listTeams = args.has("--teams");
const apiKey = process.env.LINEAR_API_KEY;

if (!apiKey) {
  console.error("LINEAR_API_KEY is required. Create it in Linear settings and export it locally.");
  process.exit(1);
}

const endpoint = "https://api.linear.app/graphql";

async function gql(query, variables = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  if (!response.ok || json.errors?.length) {
    const message = json.errors?.map((error) => error.message).join("; ") || response.statusText;
    throw new Error(message);
  }
  return json.data;
}

async function getWorkspace() {
  return gql(`
    query Workspace {
      viewer { id name email }
      teams(first: 100) {
        nodes { id key name }
      }
      issueLabels(first: 250) {
        nodes { id name }
      }
      projects(first: 250) {
        nodes { id name url }
      }
      issues(first: 250) {
        nodes { id identifier title url }
      }
    }
  `);
}

function pickTeam(teams) {
  const teamId = process.env.LINEAR_TEAM_ID;
  const teamKey = process.env.LINEAR_TEAM_KEY;
  if (teamId) return teams.find((team) => team.id === teamId);
  if (teamKey) return teams.find((team) => team.key.toLowerCase() === teamKey.toLowerCase());
  return teams.length === 1 ? teams[0] : undefined;
}

function node(id) {
  const found = graph.nodes.find((item) => item.id === id);
  if (!found) throw new Error(`Missing graph node: ${id}`);
  return found;
}

function linkedNodes(sourceId, edgeTypes = []) {
  const allowed = new Set(edgeTypes);
  return graph.edges
    .filter((edge) => edge.source === sourceId && (allowed.size === 0 || allowed.has(edge.type)))
    .map((edge) => node(edge.target));
}

function section(title, lines) {
  const body = lines.filter(Boolean).join("\n");
  return body ? `\n## ${title}\n${body}\n` : "";
}

function frontMatter(fields) {
  const out = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) out.push(`${key}: [${value.map((item) => JSON.stringify(item)).join(", ")}]`);
    else out.push(`${key}: ${JSON.stringify(value ?? "")}`);
  }
  out.push("---");
  return out.join("\n");
}

function graphLink(id) {
  return `${graph.project.repoFrontend.replace("/frontend", "/product-graph")}#${encodeURIComponent(id)}`;
}

function jobDescription(item) {
  const needs = linkedNodes(item.id, ["has_need"]);
  const implementations = graph.edges
    .filter((edge) => edge.source === item.id && edge.type === "implemented_by")
    .map((edge) => node(edge.target));
  const metrics = linkedNodes(item.id, ["measured_by"]);
  const blockers = graph.edges
    .filter((edge) => edge.source === item.id && edge.type === "depends_on")
    .map((edge) => node(edge.target));

  return [
    frontMatter({
      graph_id: item.id,
      graph_type: item.type,
      priority: item.priority,
      confidence: item.confidence,
      source: "product-graph",
    }),
    item.summary,
    section(
      "User job",
      [
        `**Job ID:** \`${item.id}\``,
        `**Status:** ${item.status}`,
        `**Tags:** ${(item.tags ?? []).map((tag) => `\`${tag}\``).join(", ")}`,
      ],
    ),
    section(
      "Needs",
      needs.map((need) => `- \`${need.id}\` ${need.label}: ${need.summary}`),
    ),
    section(
      "Implementation links",
      implementations.map((feature) => `- \`${feature.id}\` ${feature.label}: ${feature.summary}`),
    ),
    section(
      "Metrics",
      metrics.map((metric) => `- \`${metric.id}\` ${metric.label}: ${metric.summary}`),
    ),
    section(
      "Next jobs",
      blockers.map((job) => `- \`${job.id}\` ${job.label}`),
    ),
    section("Acceptance", [
      "- The issue links back to the graph ID above.",
      "- The implementation changes the user/business outcome, not only UI copy.",
      "- The result can be verified by API/UI test or explicit product evidence.",
    ]),
  ].join("\n");
}

function featureDescription(item) {
  const sourceEdges = graph.edges.filter((edge) => edge.target === item.id && edge.type === "implemented_by");
  const jobs = sourceEdges.map((edge) => node(edge.source));
  const systems = graph.edges
    .filter((edge) => edge.source === item.id && edge.type === "owned_by_system")
    .map((edge) => node(edge.target));
  const evidence = linkedNodes(item.id, ["evidenced_by"]);

  return [
    frontMatter({
      graph_id: item.id,
      graph_type: item.type,
      priority: item.priority,
      confidence: item.confidence,
      source: "product-graph",
    }),
    item.summary,
    section(
      "Jobs / hypotheses served",
      jobs.map((job) => `- \`${job.id}\` ${job.label}: ${job.summary}`),
    ),
    section(
      "Systems",
      systems.map((system) => `- \`${system.id}\` ${system.label}`),
    ),
    section(
      "Evidence",
      evidence.map((item) => `- \`${item.id}\` ${item.label}: ${item.summary}`),
    ),
    section("Acceptance", [
      "- Backend state is persisted if this touches product state.",
      "- Frontend is linked to real API if this is user-facing.",
      "- CI/build/tests pass.",
      "- Product graph is updated if the job, need or metric changes.",
    ]),
  ].join("\n");
}

function discoveryDescription(question) {
  const targets = question.targetNodes.map(node);
  return [
    frontMatter({
      graph_id: question.id,
      graph_type: "open_question",
      source: "product-graph",
      target_nodes: question.targetNodes,
    }),
    question.question,
    section(
      "Target graph nodes",
      targets.map((target) => `- \`${target.id}\` ${target.label}: ${target.summary}`),
    ),
    section("Done when", [
      "- We have a written decision or a new evidence node.",
      "- The affected jobs/needs/hypotheses are updated in `data/product-graph.json`.",
      "- Delivery issues are created or adjusted if the answer changes scope.",
    ]),
  ].join("\n");
}

function projectDescription(project) {
  const goal = project.goalId ? node(project.goalId) : undefined;
  return [
    frontMatter({
      graph_id: project.id,
      goal_id: project.goalId,
      source: "product-graph",
    }),
    project.description,
    goal ? section("Goal", [`\`${goal.id}\` ${goal.label}: ${goal.summary}`]) : "",
    section("Product graph", [`Repo: ${graph.project.repoFrontend.replace("/frontend", "/product-graph")}`]),
  ].join("\n");
}

const linearPlan = {
  projects: [
    {
      id: "linear.project.driver-activation",
      name: "Driver Activation: найти авто и подать заявку",
      goalId: "goal.driver-activation",
      description: "Довести водителя от первого визита до выбора машины, логина и rental request.",
      issueNodeIds: [
        "job.driver.find-car",
        "job.driver.compare-terms",
        "job.driver.authenticate",
        "job.driver.apply",
        "job.driver.track-status",
        "feature.catalog-api",
        "feature.auth-yandex-email",
      ],
      questionIds: ["q1"],
    },
    {
      id: "linear.project.owner-os",
      name: "Owner OS: машины, водители, заявки",
      goalId: "goal.owner-supply",
      description: "Закрыть supply-side работу владельца: создать авто, опубликовать, добавить водителя, разобрать заявки, видеть парк.",
      issueNodeIds: [
        "job.owner.create-car",
        "job.owner.publish-car",
        "job.owner.invite-driver",
        "job.owner.review-applications",
        "job.owner.track-fleet",
        "feature.fleet-crud",
        "feature.driver-invite",
        "feature.application-status",
        "feature.fleet-radar",
      ],
      questionIds: ["q2", "q3"],
    },
    {
      id: "linear.project.transaction-platform",
      name: "Transaction Platform: бронь, аренда, платежи",
      goalId: "goal.transaction-platform",
      description: "Перевести ПараВоз из каталога в управляемую сделку: booking lifecycle, rental, payments, deposits, documents.",
      issueNodeIds: ["job.driver.start-rental", "goal.transaction-platform"],
      questionIds: ["q4"],
    },
    {
      id: "linear.project.product-ops",
      name: "Product Ops: graph, Linear sync, AI context",
      goalId: undefined,
      description: "Сделать product graph источником истины, связать его с Linear и дать агентам компактные context slices.",
      issueNodeIds: [
        "system.linear",
        "system.graph-rag",
        "principle.graph-source-of-truth",
        "principle.context-slices",
        "principle.execution-evidence-loop",
        "feature.github-ci-pages",
      ],
      questionIds: ["q5"],
    },
  ],
  projectDependencies: [
    {
      id: "dependency.driver-activation.blocks-transaction-platform",
      sourceProjectId: "linear.project.driver-activation",
      targetProjectId: "linear.project.transaction-platform",
      type: "blocks",
      reason: "Driver catalog, auth and application flow must exist before full rental lifecycle is useful.",
    },
    {
      id: "dependency.owner-os.blocks-transaction-platform",
      sourceProjectId: "linear.project.owner-os",
      targetProjectId: "linear.project.transaction-platform",
      type: "blocks",
      reason: "Owner car supply and application review must exist before booking/payment lifecycle can be operated.",
    },
  ],
  issueDependencies: [
    {
      id: "dependency.driver-find.blocks-compare",
      sourceGraphId: "job.driver.find-car",
      targetGraphId: "job.driver.compare-terms",
      type: "blocks",
      reason: "A driver must first see real cars before comparing rental terms.",
    },
    {
      id: "dependency.driver-compare.blocks-auth",
      sourceGraphId: "job.driver.compare-terms",
      targetGraphId: "job.driver.authenticate",
      type: "blocks",
      reason: "The auth gate should happen after the driver chooses an interesting car.",
    },
    {
      id: "dependency.driver-auth.blocks-apply",
      sourceGraphId: "job.driver.authenticate",
      targetGraphId: "job.driver.apply",
      type: "blocks",
      reason: "Rental requests require an authenticated driver session.",
    },
    {
      id: "dependency.driver-apply.blocks-status",
      sourceGraphId: "job.driver.apply",
      targetGraphId: "job.driver.track-status",
      type: "blocks",
      reason: "There is no status to track before a request exists.",
    },
    {
      id: "dependency.driver-status.blocks-rental",
      sourceGraphId: "job.driver.track-status",
      targetGraphId: "job.driver.start-rental",
      type: "blocks",
      reason: "A rental starts only after an application decision path exists.",
    },
    {
      id: "dependency.owner-create.blocks-publish",
      sourceGraphId: "job.owner.create-car",
      targetGraphId: "job.owner.publish-car",
      type: "blocks",
      reason: "A car must exist before it can be published to the catalog.",
    },
    {
      id: "dependency.owner-publish.blocks-review",
      sourceGraphId: "job.owner.publish-car",
      targetGraphId: "job.owner.review-applications",
      type: "blocks",
      reason: "Applications depend on published car supply.",
    },
    {
      id: "dependency.owner-invite.related-review",
      sourceGraphId: "job.owner.invite-driver",
      targetGraphId: "job.owner.review-applications",
      type: "related",
      reason: "Invited drivers and incoming applications are separate but connected owner workflows.",
    },
    {
      id: "dependency.catalog-api.blocks-driver-find",
      sourceGraphId: "feature.catalog-api",
      targetGraphId: "job.driver.find-car",
      type: "blocks",
      reason: "The public catalog job needs real backend catalog data.",
    },
    {
      id: "dependency.auth.blocks-driver-auth",
      sourceGraphId: "feature.auth-yandex-email",
      targetGraphId: "job.driver.authenticate",
      type: "blocks",
      reason: "The driver auth job needs working auth and role state.",
    },
    {
      id: "dependency.fleet-crud.blocks-owner-create",
      sourceGraphId: "feature.fleet-crud",
      targetGraphId: "job.owner.create-car",
      type: "blocks",
      reason: "The owner create-car job needs real fleet CRUD persistence.",
    },
    {
      id: "dependency.driver-invite.blocks-owner-invite",
      sourceGraphId: "feature.driver-invite",
      targetGraphId: "job.owner.invite-driver",
      type: "blocks",
      reason: "The owner invite-driver job needs backend user/driver creation by email.",
    },
    {
      id: "dependency.application-status.blocks-owner-review",
      sourceGraphId: "feature.application-status",
      targetGraphId: "job.owner.review-applications",
      type: "blocks",
      reason: "The owner review job needs persisted application state transitions.",
    },
    {
      id: "dependency.context-slices.blocks-graph-rag",
      sourceGraphId: "principle.context-slices",
      targetGraphId: "system.graph-rag",
      type: "blocks",
      reason: "GraphRAG/context service must retrieve small graph slices rather than the whole graph.",
    },
  ],
};

function buildIssues(project) {
  const nodeIssues = project.issueNodeIds.map((id) => {
    const item = node(id);
    const isJob = item.type === "job" || item.type === "goal";
    const prefix = isJob ? "JTBD" : item.type === "feature" ? "Build" : "Define";
    return {
      graphId: item.id,
      title: `${prefix}: ${item.label}`,
      description: item.type === "feature" ? featureDescription(item) : jobDescription(item),
      labels: labelsFor(item),
    };
  });
  const discoveryIssues = project.questionIds.map((id) => {
    const question = graph.openQuestions.find((item) => item.id === id);
    if (!question) throw new Error(`Missing open question: ${id}`);
    return {
      graphId: question.id,
      title: `Discovery: ${question.topic}`,
      description: discoveryDescription(question),
      labels: ["source:product-graph", "type:discovery"],
    };
  });
  return [...nodeIssues, ...discoveryIssues];
}

function labelsFor(item) {
  const labels = new Set(["source:product-graph", `type:${item.type}`]);
  for (const tag of item.tags ?? []) {
    if (tag.startsWith("role:") || tag.startsWith("job:")) labels.add(tag);
    if (["catalog", "auth", "fleet", "drivers", "applications", "payments", "documents", "linear", "ai"].includes(tag)) {
      labels.add(`area:${tag}`);
    }
  }
  return Array.from(labels);
}

async function ensureLabel(name, workspace) {
  if (registry.labels[name]) return registry.labels[name];
  const existing = workspace.issueLabels.nodes.find((label) => label.name === name);
  if (existing) {
    registry.labels[name] = existing.id;
    return existing.id;
  }
  if (!apply) return undefined;
  try {
    const data = await gql(
      `
        mutation IssueLabelCreate($input: IssueLabelCreateInput!) {
          issueLabelCreate(input: $input) {
            success
            issueLabel { id name }
          }
        }
      `,
      { input: { name, color: labelColor(name) } },
    );
    const label = data.issueLabelCreate.issueLabel;
    registry.labels[name] = label.id;
    return label.id;
  } catch (error) {
    console.warn(`Could not create label ${name}: ${error.message}`);
    return undefined;
  }
}

function labelColor(name) {
  if (name.includes("driver")) return "#2563eb";
  if (name.includes("owner")) return "#16a34a";
  if (name.includes("discovery")) return "#b45309";
  if (name.includes("feature")) return "#334155";
  if (name.includes("auth")) return "#7c3aed";
  if (name.includes("catalog")) return "#0891b2";
  return "#64748b";
}

async function ensureProject(project, team, workspace) {
  if (registry.projects[project.id]) return registry.projects[project.id];
  const existing = workspace.projects.nodes.find((item) => item.name === project.name);
  if (existing) {
    registry.projects[project.id] = { id: existing.id, url: existing.url, name: existing.name };
    return registry.projects[project.id];
  }
  if (!apply) return { id: `<dry-run:${project.id}>`, url: "", name: project.name };

  const data = await gql(
    `
      mutation ProjectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          success
          project { id name url }
        }
      }
    `,
    {
      input: {
        name: project.name,
        description: projectDescription(project),
        teamIds: [team.id],
      },
    },
  );
  registry.projects[project.id] = data.projectCreate.project;
  return data.projectCreate.project;
}

async function ensureIssue(issue, project, team, labelIds) {
  if (registry.issues[issue.graphId]) return registry.issues[issue.graphId];
  const existing = workspaceIssueByTitle(issue.title);
  if (existing) {
    registry.issues[issue.graphId] = existing;
    return existing;
  }
  if (!apply) {
    return { id: `<dry-run:${issue.graphId}>`, identifier: "", url: "", title: issue.title };
  }
  const data = await gql(
    `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier title url }
        }
      }
    `,
    {
      input: {
        title: issue.title,
        description: `${issue.description}\n\n---\nGraph node: \`${issue.graphId}\`\nGraph site: ${graphLink(issue.graphId)}\n`,
        teamId: team.id,
        projectId: project.id,
        labelIds,
      },
    },
  );
  registry.issues[issue.graphId] = data.issueCreate.issue;
  return data.issueCreate.issue;
}

let workspaceIssues = [];

function workspaceIssueByTitle(title) {
  return workspaceIssues.find((issue) => issue.title === title);
}

async function ensureIssueRelation(relation) {
  const source = registry.issues[relation.sourceGraphId];
  const target = registry.issues[relation.targetGraphId];
  if (!source || !target) {
    console.warn(
      `Skipping issue dependency ${relation.id}: missing issue for ${relation.sourceGraphId} or ${relation.targetGraphId}`,
    );
    return;
  }
  if (registry.issueRelations[relation.id]) return registry.issueRelations[relation.id];
  if (!apply) return undefined;
  try {
    const data = await gql(
      `
        mutation IssueRelationCreate($input: IssueRelationCreateInput!) {
          issueRelationCreate(input: $input) {
            success
            issueRelation {
              id
              type
              issue { id identifier title url }
              relatedIssue { id identifier title url }
            }
          }
        }
      `,
      {
        input: {
          issueId: source.id,
          relatedIssueId: target.id,
          type: relation.type,
        },
      },
    );
    registry.issueRelations[relation.id] = data.issueRelationCreate.issueRelation;
    return data.issueRelationCreate.issueRelation;
  } catch (error) {
    console.warn(`Could not create issue dependency ${relation.id}: ${error.message}`);
    return undefined;
  }
}

async function ensureProjectRelation(relation) {
  const source = registry.projects[relation.sourceProjectId];
  const target = registry.projects[relation.targetProjectId];
  if (!source || !target) {
    console.warn(
      `Skipping project dependency ${relation.id}: missing project for ${relation.sourceProjectId} or ${relation.targetProjectId}`,
    );
    return;
  }
  if (registry.projectRelations[relation.id]) return registry.projectRelations[relation.id];
  if (!apply) return undefined;
  try {
    const data = await gql(
      `
        mutation ProjectRelationCreate($input: ProjectRelationCreateInput!) {
          projectRelationCreate(input: $input) {
            success
            projectRelation {
              id
              type
              anchorType
              relatedAnchorType
              project { id name url }
              relatedProject { id name url }
            }
          }
        }
      `,
      {
        input: {
          projectId: source.id,
          relatedProjectId: target.id,
          type: relation.type,
          anchorType: "end",
          relatedAnchorType: "start",
        },
      },
    );
    registry.projectRelations[relation.id] = data.projectRelationCreate.projectRelation;
    return data.projectRelationCreate.projectRelation;
  } catch (error) {
    console.warn(`Could not create project dependency ${relation.id}: ${error.message}`);
    return undefined;
  }
}

function printPlan(team) {
  console.log(`Linear sync plan for team: ${team.name} (${team.key})`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log("");
  for (const project of linearPlan.projects) {
    console.log(`Project: ${project.name}`);
    for (const issue of buildIssues(project)) {
      console.log(`  - ${issue.title} [${issue.graphId}]`);
    }
    console.log("");
  }
  console.log("Issue dependencies:");
  for (const relation of linearPlan.issueDependencies) {
    console.log(`  - ${relation.sourceGraphId} ${relation.type} ${relation.targetGraphId}`);
  }
  console.log("");
  console.log("Project dependencies:");
  for (const relation of linearPlan.projectDependencies) {
    console.log(`  - ${relation.sourceProjectId} ${relation.type} ${relation.targetProjectId}`);
  }
  console.log("");
}

async function main() {
  const workspace = await getWorkspace();
  if (listTeams) {
    console.log(`Viewer: ${workspace.viewer.name} <${workspace.viewer.email}>`);
    console.log("Teams:");
    for (const team of workspace.teams.nodes) {
      console.log(`- ${team.name}: LINEAR_TEAM_ID=${team.id} LINEAR_TEAM_KEY=${team.key}`);
    }
    return;
  }

  const team = pickTeam(workspace.teams.nodes);
  workspaceIssues = workspace.issues.nodes;
  if (!team) {
    console.error("Set LINEAR_TEAM_ID or LINEAR_TEAM_KEY. Available teams:");
    for (const item of workspace.teams.nodes) console.error(`- ${item.name}: ${item.id} (${item.key})`);
    process.exit(1);
  }

  printPlan(team);
  if (!apply) {
    console.log("Dry run only. Run `npm run linear:sync` to create/update Linear objects.");
    return;
  }

  for (const projectPlan of linearPlan.projects) {
    const project = await ensureProject(projectPlan, team, workspace);
    console.log(`Project ready: ${project.name} ${project.url ?? ""}`);
    for (const issuePlan of buildIssues(projectPlan)) {
      const labelIds = (
        await Promise.all(issuePlan.labels.map((label) => ensureLabel(label, workspace)))
      ).filter(Boolean);
      const issue = await ensureIssue(issuePlan, project, team, labelIds);
      console.log(`  Issue ready: ${issue.identifier || issue.id} ${issue.title} ${issue.url ?? ""}`);
    }
  }

  console.log("Creating issue dependency graph...");
  for (const relation of linearPlan.issueDependencies) {
    const created = await ensureIssueRelation(relation);
    if (created) {
      console.log(
        `  Issue relation ready: ${created.issue?.identifier ?? relation.sourceGraphId} ${created.type} ${created.relatedIssue?.identifier ?? relation.targetGraphId}`,
      );
    }
  }

  console.log("Creating project dependency graph...");
  for (const relation of linearPlan.projectDependencies) {
    const created = await ensureProjectRelation(relation);
    if (created) {
      console.log(
        `  Project relation ready: ${created.project?.name ?? relation.sourceProjectId} ${created.type} ${created.relatedProject?.name ?? relation.targetProjectId}`,
      );
    }
  }

  registry.updatedAt = new Date().toISOString();
  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
  console.log(`Linear registry written: ${registryPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
