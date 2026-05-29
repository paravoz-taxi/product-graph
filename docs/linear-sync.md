# Linear Sync Model

## Позиция

Product graph - источник продуктовой причинности.

Linear - источник delivery state.

GitHub - источник кода и технического evidence.

## Маппинг

| Product graph | Linear |
|---|---|
| `goal.*` | Initiative |
| группа `job.*` | Project |
| `feature.*` или concrete task | Issue |
| `need.*` | Customer Request / linked evidence |
| `hypothesis.*` | Project doc / issue front matter |
| `metric.*` | Project success metric |
| `evidence.*` | Customer Request, attachment, comment, doc link |

## Обязательный front matter для Linear issue

```yaml
graph_id: feature.catalog-api
job_id: job.driver.find-car
need_id: need.driver.real-catalog
hypothesis_id: hypothesis.public-catalog
expected_metric: metric.catalog-visit-to-application
confidence: medium
acceptance:
  - catalog reads backend data only
  - filters do not show stale mock cars
  - unauthenticated users can browse catalog
```

## MCP-only execution

Linear не синкается из репозитория и не управляется GitHub Actions.

Правильный поток:

```text
product-graph.json -> агент читает смысл -> Linear MCP создает Projects/Issues/dependencies вручную в Linear
```

Репозиторий хранит только продуктовый смысл и визуализацию. Linear остается живой рабочей доской исполнения.

Через MCP агент должен:

- создать Linear Projects из крупных workstreams;
- создать Issues из `job`, `feature`, `goal`, `principle` и open questions;
- проставить dependency graph в Linear: `blocks`, `related`, parent/child;
- добавить в описание каждой задачи `graph_id`, `job_id`, `need_id`, `hypothesis_id`, acceptance criteria;
- не писать Linear state обратно в репозиторий автоматически.

## Почему так

Если разрешить Linear быть главным источником, продуктовый граф быстро станет обычным backlog. Если graph главный, Linear остается отличной доской исполнения, но задачи не теряют связь с user progress.

## Источники

- Linear Customer Requests: https://linear.app/developers/managing-customers
- Linear Webhooks: https://linear.app/developers/webhooks
- Linear Agent: https://linear.app/docs/linear-agent
- Linear MCP: https://linear.app/docs/mcp
