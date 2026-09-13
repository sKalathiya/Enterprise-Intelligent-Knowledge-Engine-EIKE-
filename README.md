# Enterprise Intelligent Knowledge Engine (EIKE)

EIKE is a two-service backend for ingesting documents and answering questions from them. A NestJS gateway handles auth, uploads, job status, and SSE search. A Python FastAPI worker parses PDFs, chunks text, embeds it, stores vectors in PostgreSQL (pgvector), and generates grounded answers. Redis (BullMQ) keeps upload HTTP off the heavy AI work.

Ingestion and retrieval (RAG + streaming) are both implemented.

## Architecture

```
Browser (JWT)
        |
        | only public port :3000
        v
+---------------------------+     public_network
| Gateway (NestJS)          |
| Auth, upload, SSE query   |
+---------------------------+
        |
        | eike_network (no host ports)
        +-- Redis / BullMQ
        +-- Postgres + pgvector
        |     users, documents (TypeORM)
        |     document_chunks (SQLAlchemy)
        +-- AI worker (FastAPI)
              LlamaParse, Gemini embed + generate
              outbound HTTPS to LlamaCloud / Google
```

The host talks only to the gateway. Postgres, Redis, and the worker have no published ports. They reach each other by Compose service name (`postgres_db`, `redis_cache`, `ai-worker:8000`). The private network is a normal bridge (not `internal: true`) so the worker can still call Gemini and LlamaParse.

Both app containers mount the same folder:

```text
./uploads  (on the host)  <->  /shared/uploads  (in gateway and worker)
```

`SHARED_UPLOAD=/shared/uploads`. The gateway writes the PDF there and passes that path to the worker. The file is not copied over HTTP.

## What is implemented

**Gateway**

- Register / login with JWT (`passport-jwt`, bcrypt)
- Global `JwtAuthGuard` with `@Public()` on auth routes
- Helmet, CORS, payload size limits, `ValidationPipe` (whitelist)
- Document upload (PDF or plain text) and per-user document list
- Document status: `pending` → `processing` → `completed` / `failed`
- BullMQ queue `document-processing-queue` (ioredis)
- Processor `POST`s to the worker `/process` with `X-Internal-Api-Key`
- `POST /document/query` streams SSE (`@Sse()`). Body `{ "query": "..." }`; `user_id` comes from the JWT
- Swagger at `/api/v1/docs`

**AI worker**

- Prefix `/api/v1/ai` via `APIRouter`
- `GET /health`, `POST /process`, `POST /query` (API key required)
- LlamaParse → markdown → LangChain split (500 / 50)
- Gemini `models/gemini-embedding-001` (`output_dimensionality=768`)
- Query embeddings use `task_type=retrieval_query`; documents use `retrieval_document`
- Chunks stored with `user_id` + `document_id`; search is tenant-scoped
- Gemini generate, streamed as SSE frames (`sources`, `token`, `end`)
- `python -m core.init_vector_db` on container start (vector extension, table, HNSW)

**Infrastructure**

- Docker Compose: Postgres (`pgvector/pgvector:pg16`), Redis 7, gateway, worker
- Gateway on `public_network` + `eike_network`; everything else on `eike_network` only

## Tech stack

| Layer | Choices |
| --- | --- |
| Gateway | NestJS 12 (ESM), TypeScript, TypeORM |
| AI worker | FastAPI, Pydantic, SQLAlchemy 2 |
| Queue | BullMQ, Redis 7, ioredis |
| Database | PostgreSQL 16 + pgvector |
| Parsing / chunking | LlamaParse, langchain-text-splitters |
| Embed / generate | Google Gemini (`google-generativeai`) |
| Docs | Swagger (Nest). Worker OpenAPI is not published to the host |

## Repository layout

```
Enterprise-Intelligent-Knowledge-Engine-EIKE-/
├── .env.example                  # committed template
├── .env                          # secrets (gitignored)
├── docker-compose.yaml
├── uploads/                      # bind-mounted into both app containers
├── gateway-service/
│   ├── Dockerfile
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── config/env.config.ts
│       └── modules/
│           ├── auth/
│           ├── user/
│           └── document/         # upload, queue, SSE query
└── ai-worker/
    ├── Dockerfile
    ├── main.py
    ├── pdf_parser.py
    ├── text_processor.py
    └── core/
        ├── database.py
        ├── document_chunk.py
        ├── embeddings.py
        ├── generativeService.py
        └── init_vector_db.py
```

## Prerequisites

- Docker Desktop
- [LlamaCloud](https://cloud.llamaindex.ai/) API key
- [Google AI Studio](https://aistudio.google.com/) Gemini API key
- Node.js 20+ and Python 3.10+ only if you run the apps on the host

## Environment

```bash
cp .env.example .env
```

Fill in `POSTGRES_PASSWORD`, `JWT_SECRET` (≥ 32 characters), `API_KEY`, `LLAMA_PARSE_API_KEY`, and `GEMINI_API_KEY`. Do not commit `.env`.

`.env` holds secrets and the gateway publish port. Hostnames in `.env` may be `localhost` for host-side tools. Compose **overrides** in-network values:

| Variable | In `.env` (host tools) | Inside Compose |
| --- | --- | --- |
| `POSTGRES_HOST` | `localhost` | `postgres_db` |
| `REDIS_HOST` | `localhost` | `redis_cache` |
| `DATABASE_URL` | `...@localhost:5432/...` | `...@postgres_db:5432/...` |
| `DOCUMENT_SERVICE_URL` | `http://localhost:8000/api/v1/ai` | `http://ai-worker:8000/api/v1/ai` |
| `SHARED_UPLOAD` | absolute path if apps run on the host | `/shared/uploads` |

`DOCUMENT_SERVICE_URL` is the worker **prefix**. The gateway appends `/process` and `/query`.

Joi requires `SHARED_UPLOAD`, `DOCUMENT_SERVICE_URL`, `API_KEY`, Postgres/Redis fields, and `JWT_SECRET`.

## Run

```bash
mkdir uploads
docker compose up --build
```

Gateway (only public URL): [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs)

`localhost:8000`, `5432`, and `6379` are not published. That is intentional.

**Smoke checks**

```powershell
curl http://localhost:3000/api/v1
# should fail — worker is not on the host
curl http://localhost:8000/docs

# private hop from inside the gateway
docker compose exec gateway-service wget -qO- http://ai-worker:8000/api/v1/ai/health
```

The health call needs header `X-Internal-Api-Key` matching `API_KEY`.

**Host apps + Compose data plane only**

Postgres and Redis have no host ports in the default compose file. To run Nest/Python on the laptop, add temporary `ports` on those two services, set `.env` hosts to `localhost`, and set `SHARED_UPLOAD` to one absolute folder both processes can read.

## Typical flow

1. `POST /api/v1/auth/register` then `POST /api/v1/auth/login`
2. Authorize in Swagger (JWT, no `Bearer ` prefix)
3. `POST /api/v1/document/upload` (multipart field `file`)
4. Gateway writes under `/shared/uploads`, saves `documents` (`pending`), enqueues the job (`user_id` included)
5. Processor sets `processing` and `POST`s `{ document_id, path, user_id }` to `/process`
6. Worker parses, chunks, embeds, inserts `document_chunks`
7. Processor sets `completed` or `failed`
8. `GET /api/v1/document/list`
9. `POST /api/v1/document/query` with `{ "query": "..." }` — use `fetch`, not `EventSource` (POST + JWT + body). SSE events: `sources`, `token`, `end`

Job options: `jobId` = document id, 3 attempts, exponential backoff.

Query example:

```ts
const res = await fetch('http://localhost:3000/api/v1/document/query', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  },
  body: JSON.stringify({ query: 'What is the work experience?' }),
});
```

## API summary

| Service | Method | Path | Auth | Notes |
| --- | --- | --- | --- | --- |
| Gateway | POST | `/api/v1/auth/register` | Public | |
| Gateway | POST | `/api/v1/auth/login` | Public | |
| Gateway | POST | `/api/v1/document/upload` | JWT | |
| Gateway | GET | `/api/v1/document/list` | JWT | |
| Gateway | POST | `/api/v1/document/query` | JWT | SSE; body `{ query }` |
| Worker | GET | `/api/v1/ai/health` | API key | Internal only |
| Worker | POST | `/api/v1/ai/process` | API key | Internal only |
| Worker | POST | `/api/v1/ai/query` | API key | Internal only |

The browser never sends `X-Internal-Api-Key` or talks to the worker.

## Tests

```bash
cd gateway-service && npm test
```

The worker does not have a pytest suite yet.

## Notes

- Nest `synchronize: true` creates `users` and `documents`. The worker owns `document_chunks`.
- Embedding size must stay **768**.
- Search is scoped by `user_id` on chunks. Nest still authenticates; do not trust a client-supplied user id.
- `uploads/` is gitignored.
- Do not set `internal: true` on `eike_network` or the worker cannot reach Gemini / LlamaParse.
