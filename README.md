# ПараВоз Product Graph

Отдельный репозиторий для графа работ, потребностей, гипотез, фич, метрик и будущей синхронизации с Linear.

## Зачем это нужно

Linear хорошо подходит для execution: initiatives, projects, issues, cycles, customer requests, comments, agents. Но продуктовая причинность должна жить выше задач:

```text
persona -> job -> need -> hypothesis -> feature -> metric -> evidence -> Linear execution
```

Этот репозиторий хранит эту структуру как машинно-читаемый граф. UI на React Flow только визуализирует его.

## Главные файлы

- `data/product-graph.json` - источник истины для графа.
- `src/*` - GitHub Pages UI на React Flow.
- `docs/linear-sync.md` - как синхронизировать граф с Linear.
- `docs/ai-context.md` - как давать агентам граф без переполнения контекста.
- `docs/job-questions.md` - вопросы, которые надо закрыть перед декомпозицией в Linear.
- `scripts/validate-graph.mjs` - проверка целостности графа.

## Локальный запуск

```bash
npm ci
npm run dev
```

## Проверка

```bash
npm run validate
npm run typecheck
npm run build
```

## Linear sync

Сначала получи Linear API key и выбери команду:

```bash
cp .env.example .env.local
export LINEAR_API_KEY="lin_api_..."
npm run linear:teams
```

После этого выбери один вариант:

```bash
export LINEAR_TEAM_KEY="PAR"
# или
export LINEAR_TEAM_ID="..."
```

Проверить план без создания объектов:

```bash
npm run linear:plan
```

Создать Linear projects/issues:

```bash
npm run linear:sync
```

Скрипт создает локальный `linear-sync.local.json`, чтобы повторный запуск не дублировал уже созданные задачи. Этот файл намеренно не коммитится.

В GitHub Actions есть ручной workflow `Sync Linear`. Для него нужны secrets:

- `LINEAR_API_KEY`
- `LINEAR_TEAM_ID`

Можно вместо `LINEAR_TEAM_ID` задать repository variable `LINEAR_TEAM_KEY`.

## GitHub Pages

Pages собирается через `.github/workflows/pages.yml` на каждый push в `main`.

Ожидаемый URL:

```text
https://paravoz-taxi.github.io/product-graph/
```

Если GitHub Pages для приватных репозиториев недоступен на текущем плане организации, надо либо сделать репозиторий public, либо вынести публикацию на Cloudflare Pages/Dokploy.

## Правило для агентов

Агенту не надо читать весь граф. Он должен брать `agentViews` или slice вокруг конкретного `graph_id`:

```text
entry node + 1-2 hop neighbors + relevant edges + open questions + linked Linear/GitHub context
```

Так граф помогает думать, но не съедает весь context window.
