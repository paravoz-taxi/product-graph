# AI Context And Graph Reading

## Короткий вывод

Нейронка не "читает граф" магически. Она хорошо работает, когда граф заранее превращается в небольшой релевантный контекст:

1. Найти entry node: `job_id`, `need_id`, `linear_issue_id`, `persona`.
2. Достать соседние узлы по нужным типам ребер.
3. Ограничить бюджет узлов и токенов.
4. Дать модели компактный JSON slice.
5. Попросить модель ссылаться на `graph_id`, а не пересказывать весь проект.

## Почему граф полезен

Обычный backlog теряет причинность: задача есть, но непонятно, какую работу пользователя она закрывает. Граф хранит связи:

```text
job -> need -> hypothesis -> feature -> metric -> evidence
```

Для агента это лучше плоского PRD, потому что можно получить ровно тот подграф, который нужен для текущей задачи.

## Как не забить контекст модели

Правила:

- Каждый узел должен иметь стабильный `id`.
- Каждый узел должен иметь короткий `summary`.
- Длинные исследования и интервью должны жить отдельными файлами, а в графе хранится ссылка/evidence.
- Agent slice не должен превышать 10-20 узлов для обычной coding task.
- Для strategy task можно брать community summary: например, только `Driver activation slice`.
- Linear issue должен содержать `graph_id`, `job_id`, `need_id`, `hypothesis_id`, `expected_metric`.

## Будущий backend для графа

На старте хватает JSON в git. Когда граф станет большим, нужен маленький context service:

```text
GET /context/graph-slice?entry=job.driver.apply&view=driver-activation
```

Он должен возвращать:

- selected node;
- nearest relevant neighbors;
- edges;
- open questions;
- linked Linear issues;
- linked docs/evidence;
- compact summary.

Позже можно добавить:

- Postgres JSONB для версионирования;
- vector index для поиска по текстам исследований;
- graph traversal для связей;
- Linear webhooks для статусов;
- GitHub PR links для delivery evidence.

## Источники

- Microsoft GraphRAG: https://www.microsoft.com/en-us/research/project/graphrag/
- Microsoft GraphRAG repo: https://github.com/microsoft/graphrag
- GraphRAG survey: https://huggingface.co/papers/2408.08921
- Linear Agent docs: https://linear.app/docs/linear-agent
- Linear MCP docs: https://linear.app/docs/mcp
