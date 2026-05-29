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

## One-way sync на старте

Сначала безопаснее делать так:

```text
graph -> Linear
```

Скрипт читает `data/product-graph.json`, создает/обновляет Initiatives/Projects/Issues и ставит labels.

Linear вручную меняет delivery state, но не переписывает смысл графа.

Текущая реализация в `scripts/sync-linear.mjs` делает практичный первый слой:

- создает Linear Projects из крупных business workstreams;
- создает Issues из `job`, `goal`, `feature`, `principle` и open questions;
- создает issue relations `blocks` / `related` для Linear dependency graph;
- создает project relations `blocks` для Linear project timeline dependency graph;
- добавляет markdown front matter с `graph_id`;
- проставляет labels, если Linear API разрешает их создать;
- пишет `linear-sync.local.json`, чтобы локальный повторный запуск не дублировал объекты.

Команды:

```bash
export LINEAR_API_KEY="lin_api_..."
npm run linear:teams
export LINEAR_TEAM_KEY="PAR"
npm run linear:plan
npm run linear:sync
```

GitHub Actions workflow:

```text
.github/workflows/linear-sync.yml
```

Для него нужны GitHub Secrets:

```text
LINEAR_API_KEY
LINEAR_TEAM_ID
```

Или можно задать `LINEAR_TEAM_KEY` как repository variable.

## Two-way sync позже

После стабилизации можно добавить:

```text
Linear webhook -> sync service -> pull request to product-graph
```

Важно: webhook не должен напрямую менять `main`. Он должен открывать PR, чтобы изменение смысла/приоритета проходило review.

## Почему так

Если разрешить Linear быть главным источником, продуктовый граф быстро станет обычным backlog. Если graph главный, Linear остается отличной доской исполнения, но задачи не теряют связь с user progress.

## Источники

- Linear Customer Requests: https://linear.app/developers/managing-customers
- Linear Webhooks: https://linear.app/developers/webhooks
- Linear Agent: https://linear.app/docs/linear-agent
- Linear MCP: https://linear.app/docs/mcp
