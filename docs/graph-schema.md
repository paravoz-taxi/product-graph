# Graph Schema

## Node

```ts
type ProductNode = {
  id: string;
  type: "persona" | "goal" | "job" | "need" | "hypothesis" | "principle" | "feature" | "metric" | "evidence" | "linear" | "system";
  label: string;
  summary: string;
  status: string;
  confidence: string;
  priority: string;
  tags?: string[];
  links?: string[];
  agentContext?: string;
};
```

## Edge

```ts
type ProductEdge = {
  id: string;
  source: string;
  target: string;
  type: "serves" | "has_job" | "has_need" | "motivates" | "tests" | "implemented_by" | "measured_by" | "evidenced_by" | "depends_on" | "syncs_to_linear" | "owned_by_system";
  label?: string;
};
```

## Naming

```text
persona.driver
goal.driver-activation
job.driver.find-car
need.driver.real-catalog
hypothesis.public-catalog
feature.catalog-api
metric.catalog-visit-to-application
system.backend
linear.driver-activation
```

IDs должны быть стабильными. Названия можно менять, IDs нельзя менять без миграции.
