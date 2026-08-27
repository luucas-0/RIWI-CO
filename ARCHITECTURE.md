# Architecture

## Overview

The solution is organized around Clean Architecture boundaries so that the domain remains independent from Express, PostgreSQL drivers, and the OpenAI SDK.

## Layers

### Domain

Entities and rules live here, including `User`, `Channel`, `ChannelMember`, `Message`, and `AiUsageRecord`.

### Application use cases

Use cases orchestrate domain logic:

- `GetChannelMessagesUseCase`
- `SearchMessagesUseCase`
- `GetRagContextUseCase`
- `CreateMessageUseCase`
- `DeleteMessageUseCase`
- `GetTokenUsageUseCase`

### Infrastructure

- PostgreSQL adapters and repositories
- JWT and auth helpers
- Socket.IO event layer
- AI adapter abstraction with OpenAI implementation

### Interface / adapters

- Express HTTP controllers and routes
- Next.js UI layer and Socket.IO client

## Security model

The identity of the caller is always extracted from the verified JWT and never from request parameters.

PostgreSQL Row Level Security is enabled on `rw_messages` and `rw_channels` and enforces membership-based access. The backend sets the current user context at the transaction level with `SET LOCAL app.current_user_id = '<uuid>'` before executing restricted SQL.

## RAG boundary

The vector similarity query is constrained to channels for which the actor is a member. The AI layer uses an `AIProvider` abstraction and exposes citations with explicit negative answers when access or context is insufficient.

## Observability and integrity

- Soft delete with `rw_deleted_at` preserves original message history.
- Cursor-based pagination uses `rw_created_at` and `rw_id`.
- Message statuses include `pending`, `sent`, and `failed`.
- Token usage is tracked per user by Copilot interaction.
