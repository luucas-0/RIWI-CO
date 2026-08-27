# Riwi Co. Internal Messaging Platform – English Documentation

## Project Description

This repository provides a full-stack, secure, real-time internal messaging platform for Riwi Co. S.A.S. The system modernizes company communication with features such as:
- User authentication and authorization
- Channel-based messaging
- Message read state management
- Full-text search
- Conversation history with keyset/cursor pagination
- Secure, per-channel permissions (data-level)
- Integrated AI Copilot with Retrieval Augmented Generation (RAG)

All data access and permissions are strictly enforced, ensuring company confidentiality and compliance requirements, with PostgreSQL Row Level Security for maximum isolation.

---

## Technology Stack

- **Frontend:** Next.js (App Router) + React + Tailwind CSS + TypeScript
- **Backend/API:** Node.js (Express/TypeScript) – Clean Architecture principles
- **Database:** PostgreSQL 15+ with pgvector for vector search and RLS (Row Level Security)
- **Realtime:** WebSockets (Socket.io)
- **AI Copilot:** OpenAI SDK (gpt-4o-mini, text-embedding-3-small), interchangeable provider
- **Containerization:** Docker Compose for reproducible development

---

## Features

- 3-zone responsive layout (channels, main conversation, Copilot panel)
- User authentication via secure JWT tokens (access/refresh)
- All data/permissions checked in DB, never trusted from client
- Messaging with live updates, status (pending, sent, failed)
- Channel listing/restriction per user membership
- Message search and keyset/cursor-based pagination
- Strict soft-delete and audit support (no physical message deletion)
- Copilot AI answers only from channels the user is a member of, always with message citation
- Internationalization: Spanish/English interface

---

## Requirements

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+ (managed via Docker)
- OpenAI API key (for Copilot context-based answers)

---

## Quick Start

1. **Clone this repository**

   ```sh
   git clone <repo_url>
   cd <project_root>
   ```

2. **Copy and configure environment**

   Copy .env.example to .env and set your `OPENAI_API_KEY` (optional, only for Copilot)

   ```sh
   cp .env.example .env
   # Then edit .env to include your OPENAI_API_KEY (optional, Copilot)
   ```

3. **Start all services (DB, backend, frontend)**

   ```sh
   docker compose up --build
   ```

   - The database (PostgreSQL) is automatically seeded with test users, channels, and example messages.
   - API runs at http://localhost:4000
   - Frontend UI at http://localhost:3000

4. **Login with demo credentials**

   - Email: `lucas@riwi.co`
   - Password: `RiwiDemo2026!`

5. **Using the platform**
   - Browse authorized channels
   - Send and search messages, see their real-time state
   - Ask questions to the Copilot (AI) – only if `OPENAI_API_KEY` is set

6. **Resetting demo data**

   ```sh
   docker compose down -v
   docker compose up --build
   ```

---

## Architecture Notes

- **Clean Architecture:** Layers are split into Domain, Use Cases, Infrastructure, and Interfaces.
- **DB schema:** English names, always prefixed `rw_`, strict normalized, RLS enforces row-level permissions.
- **Security:** JWT user is trusted only if validated by the backend. RLS ensures channel membership for all data access. No global queries or unsafe SQL.
- **AI Copilot:** Uses semantic search (vector similarity) per channel; only cites/answers from what the authenticated user is allowed to see.

---

## Advanced (Developers)

- Run tests and migration scripts (see `README.md` for details)
- Review the DB schema in `database/schema.sql`
- All config variables in `.env.example`

---

## License & Credits

Developed by Lucas Mortigo Cano for Riwi Co. S.A.S. For test and demo only. All rights reserved.
