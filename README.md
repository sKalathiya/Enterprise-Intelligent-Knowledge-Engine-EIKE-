### Enterprise Intelligent Knowledge Engine (EIKE)

A high-performance, distributed backend system featuring a dual-engine architecture designed to orchestrate complex Generative AI operations. This project simulates an enterprise corporate infrastructure that securely processes, embeds, and queries large volumes of unstructured data using an optimized Retrieval-Augmented Generation (RAG) pipeline. 

### 🏗️ System Architecture

The application is decoupled into two primary service layers that communicate seamlessly via a RESTful network layer and a low-latency caching protocol: 

                      +---------------------------------------+

                      |         Client / Postman UI           |
                      +---------------------------------------+
                                          |
                                          | HTTP Requests
                                          v
+-----------------------------------------------------------------------------------+

|  GATEWAY SERVICE (NestJS / TypeScript)                                            |
|  - JSON Web Token (JWT) Authentication & Guard Layers                              |
|  - Rate Limiting (Throttling) & Route Interceptors                                |
|  - Structured Metadata Storage & Document Upstream Management                     |
+-----------------------------------------------------------------------------------+

       |                                                            |
       | IPC / HTTP Callout                                         | Database Query
       v                                                            v
+------------------------------------------+       +--------------------------------+

|  AI WORKER ENGINE (Python / FastAPI)     |       |  RELATIONAL STORAGE            |
|  - LangChain Orchestration Framework     |       |  - PostgreSQL                  |
|  - Semantic Text Chunking & Extraction   |       |  - Structured User Metadata    |
+------------------------------------------+       +--------------------------------+

       |                         |                                  ^
       | Write Embeddings        | Cache Hits                       | SQL Read
       v                         v                                  |
+--------------------------+  +-------------------------------------+---+

|  VECTOR INFRASTRUCTURE   |  |  IN-MEMORY CACHE ENGINE                 |
|  - Pinecone / pgvector   |  |  - Redis                                |
|  - High-Dim Vector Search|  |  - Token and Prompt Latency Reduction   |
+--------------------------+  +-----------------------------------------+

### ⚡ Key Engineering Features

* **Dual-Engine Microservice Architecture:** Leverages **NestJS (TypeScript)** for enterprise-grade API gateways, security, and access control, while utilizing **FastAPI (Python)** to handle data-heavy AI and mathematical embedding workloads.
* **Production-Ready RAG Pipeline:** Implements optimized chunking and semantic overlap via **LangChain**, converting unstructured enterprise text into mathematical vector arrays.
* **Hybrid Vector Indexing:** Integrates semantic storage (via **Pinecone / pgvector**) decoupled from relational transactional storage (**PostgreSQL**).
* **Token & Cost Optimization Layers:** Implements aggressive string and vector query caching via **Redis**, preventing repetitive LLM compute requests and cutting down API overhead costs.
* **Self-Documenting Backend Infrastructure:** Built-in programmatic API mappings via automated OpenAPI/Swagger specification modules.

### 🛠️ Technology Stack & Tooling

### Core Backend Systems

* **Gateways & Routing:** NestJS, TypeScript, Node.js
* **AI Microservices:** Python, FastAPI, Pydantic v2
* **Orchestration Engines:** LangChain, OpenAI / Claude API ecosystem

### Persistence & Indexing

* **Structured Storage:** PostgreSQL
* **Vector Matrices:** Pinecone (or pgvector extension)
* **Caching & In-Memory Data:** Redis

### DevOps & Engineering Hygiene

* **Containerization Engine:** Docker, Docker-Compose
* **API Verification:** Swagger UI, Postman Specification Collections
* **Source Management:** Git

### 📂 Project Repository Directory Blueprint

text

enterprise-knowledge-engine/
├── .github/                     # Workflow files and code layouts
├── gateway-service/             # NestJS Application Infrastructure
|   ├── src/

|   |   ├── auth/                # JWT Guarding, Strategies, and Authentication
|   |   ├── documents/           # Upstream processing and structured CRUD
|   |   ├── main.ts              # Entry point initializing Core Swagger documentation
|   |   └── app.module.ts        # Primary dependency injection container
|   ├── Dockerfile
|   └── package.json
├── ai-worker/                   # Python FastAPI Machine Learning Framework
|   ├── app/

|   |   ├── core/                # Configuration paradigms and security setup
|   |   ├── services/            # LangChain pipelines & Vector connection tools
|   |   └── main.py              # Microservice server definitions
|   ├── Dockerfile
|   └── requirements.txt
├── docker-compose.yml           # Unified orchestration manifest (Nest, Python, Postgres, Redis)
└── README.md

Use code with caution.

### 🚀 Step-by-Step Deployment Architecture

### Prerequisites

Ensure you have the following environments configured natively on your system: 

* Docker Desktop (Engine version 20.10+ / Compose version v2+)
* An active OpenAI API secret key or compatible LLM provider configuration

### Installation & Standup

1. **Clone the repository infrastructure:** 

bash

git clone https://github.com/yourusername/enterprise-knowledge-engine.git
cd enterprise-knowledge-engine

Use code with caution.
2. **Establish Environment Variable Profiles:**
Create a .env file in the root folder structure and apply your access variables: 

env

# Encryption Paradigms
JWT_SECRET=your_super_secure_jwt_token_secret_key_string

# External Machine Learning APIs
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Core Target Infrastructure Credentials
DATABASE_URL=postgresql://postgres:postgres@postgres_db:5432/eike_db
REDIS_URL=redis://redis_cache:6379

Use code with caution.
3. **Orchestrate and Stand Up the Containers:**
Launch the system via Docker Compose. This single terminal sequence provisions your NestJS tier, Python worker node, isolated relational tables, and Redis routing grids simultaneously: 

bash

docker-compose up --build

Use code with caution.
4. **Verify Endpoint Ecosystem Access:** 

  * **Gateway Microservice API (NestJS):** http://localhost:3000
  * **Interactive Documentation Interface (Swagger UI):** http://localhost:3000/api/docs
  * **Isolated Machine Learning Engine (FastAPI):** http://localhost:8000/docs

### 🧪 Production Architecture Validation

The codebase comes instrumented with testing workflows across both system domains. Run the individual code check suites to ensure system integrity: 

bash

# Execute NestJS Gateway structural unit checks
cd gateway-service && npm run test

# Execute Python FastAPI core RAG integration assertions
cd ../ai-worker && pytest

Use code with caution.
