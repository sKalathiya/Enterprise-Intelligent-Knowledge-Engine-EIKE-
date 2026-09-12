# Enterprise Intelligent Knowledge Engine (EIKE)

EIKE is a two-service backend for ingesting enterprise documents. A NestJS gateway handles auth, uploads, and job status. A Python FastAPI worker parses PDFs, chunks text, embeds it, and stores vectors in PostgreSQL (pgvector). Redis (BullMQ) keeps the HTTP request off the heavy AI work.

Ingestion is implemented end to end. Question-answering / retrieval over those vectors is not built yet.

## Architecture

```
Client (Swagger / HTTP)
        |
        | JWT + multipart upload (.pdf / .txt)
        v
+---------------------------+
| Gateway (NestJS, :3000)   |
| Auth, validation, files   |
| TypeORM: users, documents |
+---------------------------+
        |
        | enqueue document-processing job
        v
+---------------------------+
| Redis + BullMQ            |
+---------------------------+
        |
        | worker HTTP POST /process
        | X-Internal-Api-Key
        v
+---------------------------+          +---------------------------+
| AI Worker (FastAPI, :8000)| -------> | Postgres + pgvector       |
| LlamaParse, LangChain     |          | documents (Nest)          |
| Gemini embeddings (768-d) |          | document_chunks (SQLAlchemy)|
+---------------------------+          +---------------------------+
```

Both processes read the same file via `SHARED_UPLOAD` (absolute path in local development).

## What is implemented

**Gateway**

- Register / login with JWT (`passport-jwt`, bcrypt)
- Global `JwtAuthGuard` with `@Public()` on auth routes
- Helmet, CORS, payload size limits, `ValidationPipe` (whitelist), request timeout interceptor
- Document upload (PDF or plain text) and per-user document list
- Document status: `pending` → `processing` → `completed` / `failed`
- BullMQ queue `document-processing-queue` (ioredis)
- Processor calls the AI worker with `HttpService` + `firstValueFrom`
- Swagger UI with bearer auth at `/api/v1/docs`

**AI worker**

- `GET /health`, `POST /process` (API key required)
- LlamaParse → markdown
- Recursive character splitting (LangChain)
- Gemini `models/gemini-embedding-001` with `output_dimensionality=768`
- Batched embed calls (50 chunks)
- Persist rows in `document_chunks` (content + vector)
- Rate limit on `/process` (slowapi)
- `python -m core.init_vector_db` enables `vector`, creates `document_chunks`, and an HNSW cosine index

**Infrastructure**

- Docker Compose: Postgres (`pgvector/pgvector:pg16`) and Redis
- Gateway and AI worker are run locally in development (Compose app services are commented out)

## Tech stack

| Layer | Choices |
| --- | --- |
| Gateway | NestJS 12 (ESM), TypeScript, TypeORM |
| AI worker | FastAPI, Pydantic, SQLAlchemy 2 |
| Queue | BullMQ, Redis 7, ioredis |
| Database | PostgreSQL 16 + pgvector |
| Parsing / chunking | LlamaParse, langchain-text-splitters |
| Embeddings | Google Gemini (`google-generativeai`) |
| Docs | Swagger (Nest), OpenAPI `/docs` (FastAPI) |

## Repository layout

```
Enterprise-Intelligent-Knowledge-Engine-EIKE-/
├── .env                          # local secrets (not committed)
├── docker-compose.yaml           # postgres_db + redis_cache
├── uploads/                      # shared files (SHARED_UPLOAD)
├── gateway-service/
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── config/env.config.ts
│       ├── utils/interceptors/timeout.interceptor.ts
│       └── modules/
│           ├── auth/             # JWT, register, login, guards
│           ├── user/             # User entity
│           └── document/         # upload, queue producer, processor
└── ai-worker/
    ├── main.py                   # FastAPI app
    ├── pdf_parser.py
    ├── text_processor.py
    ├── requirements.txt
    └── core/
        ├── database.py
        ├── document_chunk.py
        ├── embeddings.py
        └── init_vector_db.py
```

## Prerequisites

- Node.js 20+
- Python 3.10+
- Docker Desktop (for Postgres and Redis)
- [LlamaCloud](https://cloud.llamaindex.ai/) API key
- [Google AI Studio](https://aistudio.google.com/) Gemini API key

## Environment

Copy the variables below into a root `.env`. Do not commit real keys.

```env
POSTGRES_USER=admin_user
POSTGRES_PASSWORD=change_me
POSTGRES_DB=eike_production_db
POSTGRES_PORT=5432
POSTGRES_HOST=localhost
DATABASE_URL=postgresql://admin_user:change_me@localhost:5432/eike_production_db

REDIS_HOST=localhost
REDIS_PORT=6379

SHARED_UPLOAD=C:\absolute\path\to\Enterprise-Intelligent-Knowledge-Engine-EIKE-\uploads

AI_WORKER_PORT=8000
API_KEY=your_internal_worker_key
AI_WORKER_ALLOWED_ORIGINS=*
LLAMA_PARSE_API_KEY=llx-...
GEMINI_API_KEY=AIza...

DOCUMENT_SERVICE_URL=http://localhost:8000/process
GATEWAY_SERVICE_PORT=3000
JWT_SECRET=a_long_random_string
GATEWAY_SERVICE_CORS_ORIGIN=*
GATEWAY_SERVICE_NODE_ENV=development
```

`SHARED_UPLOAD` must be the same absolute folder both processes can read. Create that directory before uploading.

Gateway loads `../.env` via `ConfigModule`. The worker loads `../.env` from `ai-worker/`.

## Local setup

**1. Data plane**

```bash
docker compose up -d
```

**2. Vector table (once, after Postgres is healthy)**

```bash
cd ai-worker
python -m venv venv
# Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m core.init_vector_db
```

**3. AI worker**

```bash
cd ai-worker
# venv active
python main.py
```

Docs: [http://localhost:8000/docs](http://localhost:8000/docs)  
Send header `X-Internal-Api-Key` with the same value as `API_KEY`.

**4. Gateway**

```bash
cd gateway-service
npm install
npm run start:dev
```

Docs: [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs)  
Use **Authorize** and paste the JWT from login (no `Bearer ` prefix).

## Typical flow

1. `POST /api/v1/auth/register` then `POST /api/v1/auth/login`
2. `POST /api/v1/document/upload` (multipart field `file`)
3. Gateway writes the file under `SHARED_UPLOAD`, saves a `documents` row (`pending`), and enqueues the job
4. The processor sets `processing` and `POST`s `{ documentId, path }` to the worker
5. Worker parses, chunks, embeds, inserts `document_chunks`
6. Processor sets `completed` or `failed` (`errorMessage` on failure)
7. `GET /api/v1/document/list` returns the user’s documents and statuses

Job options: `jobId` = document id, 3 attempts, exponential backoff.

## API summary

| Service | Method | Path | Auth |
| --- | --- | --- | --- |
| Gateway | POST | `/api/v1/auth/register` | Public |
| Gateway | POST | `/api/v1/auth/login` | Public |
| Gateway | POST | `/api/v1/document/upload` | JWT |
| Gateway | GET | `/api/v1/document/list` | JWT |
| Worker | GET | `/health` | API key |
| Worker | POST | `/process` | API key |

## Tests

```bash
cd gateway-service && npm test
```

The worker does not have a pytest suite yet.

## Notes

- Compose currently starts **only** Postgres and Redis. App containers are defined but commented out.
- Nest `synchronize: true` creates `users` and `documents`. The worker owns `document_chunks` via `init_vector_db`.
- Embedding size must stay **768** to match `Vector(768)` and `output_dimensionality=768`.
- FastAPI `prefix="/api/v1/ai"` on `FastAPI()` is ignored (that option belongs on `APIRouter`). Worker routes stay at `/health` and `/process`.
