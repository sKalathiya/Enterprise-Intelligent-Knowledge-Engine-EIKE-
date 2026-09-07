### Enterprise Intelligent Knowledge Engine (EIKE)

A high-performance, distributed backend system featuring a dual-engine architecture designed to orchestrate complex Generative AI operations. This project simulates a corporate production environment that offloads heavy text extraction, embedding compilation, and RAG evaluation pipelines into asynchronous background worker queues, preventing system bottlenecks. 

### 🏗️ System Architecture & Event Pipeline

The architecture decouples heavy computing from the request-response cycle using an event-driven queue topology backed by Redis: 

                      +---------------------------------------+

                      |         Client / Postman UI           |
                      +---------------------------------------+
                                          |
                                          | 1. HTTP Upload (Large PDF)
                                          v
+-----------------------------------------------------------------------------------+

|  GATEWAY SERVICE (NestJS / TypeScript)                                            |
|  - Validates payload metadata & handles secure JWT sessions                       |
|  - Programmatically pushes "document.process" job payload into BullMQ             |
|  - Returns a instant HTTP 202 (Accepted) response to the user                     |
+-----------------------------------------------------------------------------------+
                                          |
                                          | 2. Push Asynchronous Job
                                          v
                      +---------------------------------------+

                      |       REDIS MESSAGE BROKER            |
                      +---------------------------------------+
                                          |
                                          | 3. Consume Job Queue
                                          v
+-----------------------------------------------------------------------------------+

|  ASYNC WORKER SERVICE (NestJS / BullMQ Consumer)                                  |
|  - Pulls chunking & ingestion tasks off the Redis memory queue                    |
|  - Fires optimized binary chunk out to the Python data infrastructure             |
+-----------------------------------------------------------------------------------+
                                          |
                                          | 4. Network Triage
                                          v
+-----------------------------------------------------------------------------------+

|  AI WORKER ENGINE (Python / FastAPI)                                              |
|  - Recovers text fragments using LangChain semantic chunking pipelines            |
|  - Generates multi-dimensional mathematical embeddings vectors                   |
+-----------------------------------------------------------------------------------+

         |                                                           |
         | 5. Populate Vector Index                                  | 6. Database Commit
         v                                                           v
+--------------------------+                               +------------------------+

|  VECTOR INFRASTRUCTURE   |                               |  RELATIONAL STORAGE    |
|  - Pinecone / pgvector   |                               |  - PostgreSQL Database |
|  - Holds Matrix Data     |                               |  - Update File Status  |
+--------------------------+                               +------------------------+

### ⚡ Key Engineering Features

* **Dual-Engine Microservice Architecture:** Leverages **NestJS (TypeScript)** for enterprise-grade API gateways, security, and access control, while utilizing **FastAPI (Python)** to handle data-heavy AI and mathematical embedding workloads.
* **Asynchronous Background Ingestion (BullMQ):** Uses **BullMQ** to buffer long-running file operations. Incoming large documents are processed out-of-band via an event queue, maintaining lower API latencies.

 [](https://www.linkedin.com/pulse/mastering-background-tasks-bullmq-nodejs-dilshod-shoolimkhon-ste7f)
LinkedIn +1

sn._setImageSrc('img-4V2eap6BL9ukhvcP9puIuA8_3','data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADCUlEQVR4nO2bO2zaUBSGf1dFCh1CqDOkyUBaS+mQSDgrQ+Is2RDZyJg1nRjYgaEbA1Mzhm4ZG7FFlWKpEksqxZWaoZVcCUWlSxAxi5EY3KEFEWyIr2M4+PFNGN9rn\/P5Pi2ZMwwDQeYZdQDUhAKoA6Dm+bgTXL5WBJADEJtZNNNBA1ABUDHK6fvRkyYBXL62BEAGkJx6aLMhBqAA4ACAOHrSqgvk4J\/kh0n+b9UPGCfAr5hysxLg9T4\/CVNu4SzgtKIk8JCEZQCArN5BVluuBTVLmAVIAo\/q4TYS8ejgvwI20GjrODq79pwIpi4gCTwuj1MPku+TiEdxeZyCJPCuBTcLmARUD7ddKTNP2BYgCbzlkx8lEY96qhUwCFi2fVGWstQEfhq0LUBW72xflKUsNQwCWmi09UfLNdq6p6ZCpi5wdHbtSpl5gkmArLawd1K3bAmNto69k7qnnj7gYCUoqy2sv\/8c3KVwH1lteTbpYRwLmDb9xZQkLENparjXewAApdkZ\/HYDZgFGOT3xPJev2S5fuviJ4sWPwbEk8MjtvEFmc2XiPRptHdWrW1S+\/HqyjLloAesvX6CaFbFrcwmdiEdR2N9Abuc1cuc3qF7dOr43uQBxdRHyuxRiCxHmurGFCE6z\/95zOpVAuhQW15wnP8xpVnS8ASMVkNlceXLyfYr7bx3V881maFfgIa4uMtfzjQAAONh6xVyHfBAcRev2oPzuDI6XohEkbT5ZJ+PA3AjQur2xU5ok8Khkth4VIa55tAto3R6kD\/WxU5mstmztMp0MqHMhIHd+A6XZmVhGaXbw8avzBc84yAX0l7V2GB4b3IJcwKfvf2yXVZqa6\/cnF0C9pSYX4ObW1gnkAliYRmshFxD4LkBNKIA6AGpCAdQBUBMKoA6AmlAAdQDUhAKoA6CGG\/1miMvXfP0RkVFOc8PHgW8BoQDqAKixEuD+i7f5wZSblYDKDAKhwpSbaRYAAC5fU+C\/74a+GeW0rY+mAEACUII\/uoMGoGSVPDCmBQSJcBagDoCawAv4CyJz5Ou100U7AAAAAElFTkSuQmCC')
* **Production-Ready RAG Pipeline:** Implements optimized chunking and semantic overlap via **LangChain**, converting unstructured enterprise text into mathematical vector arrays.
* **Hybrid Vector Indexing:** Integrates semantic storage (via **Pinecone / pgvector**) decoupled from relational transactional storage (**PostgreSQL**).
* **Token & Cost Optimization Layers:** Implements aggressive string and vector query caching via **Redis**, preventing repetitive LLM compute requests and cutting down API overhead costs.
* **Self-Documenting Backend Infrastructure:** Built-in programmatic API mappings via automated OpenAPI/Swagger specification modules.

### 🛠️ Technology Stack & Tooling

### Core Backend & Task Orchestration

* **Gateways & Routing:** NestJS, TypeScript, Node.js
* **Async Task Queuing:** BullMQ (Redis-backed)
* **AI Microservices:** Python, FastAPI, Pydantic v2
* **Orchestration Engines:** LangChain, OpenAI / Claude API ecosystem

 [](https://medium.com/@kaushalsinh73/scalable-background-jobs-with-nestjs-redis-3a4a53832ad0)
Medium

### Persistence & Indexing

* **Structured Storage:** PostgreSQL
* **Vector Matrices:** Pinecone (or pgvector extension)
* **Caching & In-Memory Data Store:** Redis

### DevOps & Engineering Hygiene

* **Containerization Engine:** Docker, Docker-Compose
* **API Verification:** Swagger UI, Postman Specification Collections
* **Source Management:** Git

### 📂 Project Repository Directory Blueprint

sn._setImageSrc('img-4V2eap6BL9ukhvcP9puIuA8_4','data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAAM1BMVEVHcEz\/\/\/\/8\/Pzp6ekAAAAAAAAAAAAUFBQAAAAAAAC7u7vPz89vb2+JiYk1NTVSUlKkpKTQb8x6AAAACnRSTlMA\/\/\/\/jQ\/\/\/UfM4B95CQAABWdJREFUeJztm9uaqyAMRsfQSquCvP\/TbqJVDgmnbqfMRfPNzbRFfpchCSA\/P6HdH4\/bU46\/Ys\/n7fG4\/+TMdv47fXsqbmkNH+j+JYHt\/n77JfLU5I2B8PjI3R\/2JBAeH7v93eSjb\/\/WHp37DxR06d97CveP+p+z5zEWbn36H8dbzweAtj+EezcAFsG9K4BXPOoIYPOCXkNgNzsQHj37x2jUXUBXF0An6OoC1gn6C+jb\/zh+BXwFfAX8WQGrWhhbq2oHybRUa6uASYAgNqcuE9hC2oGYlkYBUmsFA7HUZQKbhrilWnWKXc4HVkEEzBXPgDQTOW5ZJ6QMoAKBiduY3K+zAvRMEEzF\/te4URZAXoCkT3MoPgMV3f8w6wsFwKAK\/ds2UYspq7mZgCggWIewzeUCoIDAAgC4SgAzoksjUcIAs7hKAD5PEUsQ2ZGo8AfC0\/2\/BIY5cqoBshe0Nz\/rywQggWlpCWw2dNm4cy0B6ggZN5wRwHUC5CaABOR0ZEFaZpQXE6A5KeWGKBjWCwXsBEYTIgD8jDWUapNFnQC9KDNNpoJAjMBePPEMMA2sVQK0mmGPVzUExngkDnyCxeQpxrIAuSdMwJgJNQQwvocGLILlNUIKAlazdW0jplGLqiIwEjdkESAAXRSwzPvdC7N9XkVgu7fAuISgD2FZAWa\/GTgieh2BILhu7ZmRaI48kRNwlCtnUq0jYC8eCaAIbB589ZURcAQ1OEu7OgJMpUsQmPO20gLOPOnySSUBGSMgbijnM0YnBRy3AV5tW0mASQhRTtzzYFaAuwtwjSsJMBV6mBO32mXNC1iO7rdw1UggRgDRSNzzYF7AkdeD0rqWAI7EyAI3NF54TAjw4qn3+KoJkBlXkBMxup\/\/JwRM5yfgwasmMK6xG3qetMWXkwgvQMP5iecCDQRsqE+ORByDbsbCC1DnEAjY1ROgOdF1iV85x+IFTE6AP8NtIEAQuEnSHNTKrADnxBAEsQYC8bzXVadbHnSOxQpYfAHaWQsBMhKPnGjC3MAK8OOImObTWgjIaCTC67ZRmB+WWAFRMoHDWgiMiUmSstfxAzMnwJ9ow2SctRAYNVud6qMUywnwc0kwt2siQHMidoxcgszECVjfEhATYHLisufBoEpmBXhPD94nYCdJEQNxTIcaBARprI2AC+jubl7ToXoB4UJXIwFSnQ64HhP9pijg3Ui4IYidAPuKCtSCEzYkI4YAzYl0JbIwDCGY2bUSoJMkpkAuxIEAWTOBeCQCXTNiQ\/HkN\/Eu2kyArgXT6Xc5FzgEzQTIJInOkYrZ0C+p2wmEq9HcYjgrINTtklc7gSgnMmvHfEkW+s7pOO0EsAL1iwu6UlCoCXc7wL1BAPO\/uxCzVsILWOIQKt8lEC5XMEsliYkJqWZ0UUCCgCvx+T2khABS0wql3yOAOfHogVu4TgiQMMRRfFZNVXEgLHSlGgE0k6KEtwi4hMAunKcEMBuhlSul9Is5AyC9RMNtBr8nYEcAiSXbpIB4S69KgGC\/2Wkmto9kctNKk2oiL4BU\/M5MZiF+DTe6\/OUs6gbFzevEPiFeKbWTHZfOKmpXLSDHGadaiU3U\/PZ9vLede4Hh9QzBrMxjWPhtZKmV8Kaem1lU\/vsLuFwNRQH+KxwgJhrw9MwBsM1s74L++a9w4I+GQ0TdSyzcKygr92gWo3gzS\/izc3u312s8elXGTNZ6vkckpZbyz77I9BXwFfA5AR3frUf7A+8Vd3+1u\/vL7d0FdD\/g0P2Ix4eP2YW2nfPpfsyn+0Gn\/ke9+h92637cr4+C4NDnvfeRz\/6HXvsf++1\/8BkhfEaCTBz93nyx7+H3HYMV8Usq2OP\/\/wARtVQ2bT8nHAAAAABJRU5ErkJggg\x3d\x3d')

text

enterprise-knowledge-engine/
├── .github/                     # Workflow configurations
├── gateway-service/             # NestJS Application Infrastructure (Gateway + Workers)
|   ├── src/

|   |   ├── auth/                # JWT Guarding, Strategies, and Authentication
|   |   ├── documents/           # Upstream file collection layer
|   |   ├── queues/              # BullMQ module, Producers, and Event Consumers
|   |   ├── main.ts              # Entry point initializing Core Swagger documentation
|   |   └── app.module.ts        # Primary dependency injection configuration (Registers BullModule)
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
Launch the system via Docker Compose. This single terminal sequence provisions your NestJS API gateway, background queue workers, isolated relational tables, and Redis routing grids simultaneously: 

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

# Execute NestJS Gateway structural unit & queue handling checks
cd gateway-service && npm run test

# Execute Python FastAPI core RAG integration assertions
cd ../ai-worker && pytest

Use code with caution.
