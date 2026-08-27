# Key technical decisions

## 1. Security-first access control

RLS is enforced at the database layer because user-specific filtering is easier to trust when tied directly to the data store. The application only supplies the session identity, and PostgreSQL decides whether a row is accessible.

## 2. Soft delete over hard delete

Deleting a message physically would break auditability and history requirements. Using `rw_deleted_at` ensures original content and metadata remain available for traceability and post-failure recovery.

## 3. Cursor pagination

The system avoids OFFSET to maintain stable results under concurrent updates and to align with large conversation datasets.

## 4. AI provider abstraction

OpenAI is hidden behind an `AIProvider` adapter to isolate the rest of the system from SDK changes and to allow future provider swaps.

## 5. RAG permission boundary

The vector similarity and source retrieval are limited to channels where the user is explicitly a member. The same permission model is enforced in SQL, not just in app logic.
