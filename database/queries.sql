-- Consulta 1: Historial de mensajes de un canal con paginación por Keyset.
SELECT m.*
FROM rw_messages m
WHERE m.rw_channel_id = $1
  AND m.rw_deleted_at IS NULL
  AND (
    m.rw_created_at, m.rw_id
  ) < ($2, $3)
ORDER BY m.rw_created_at DESC, m.rw_id DESC
LIMIT $4;

-- Consulta 2: Búsqueda de mensajes con resaltado del término encontrado.
SELECT
  m.rw_id,
  m.rw_channel_id,
  m.rw_sender_user_id,
  m.rw_content,
  ts_headline('spanish', m.rw_content, plainto_tsquery($1)) AS rw_highlight,
  m.rw_created_at
FROM rw_messages m
WHERE m.rw_channel_id = $2
  AND m.rw_deleted_at IS NULL
  AND to_tsvector('spanish', m.rw_content) @@ plainto_tsquery($1)
ORDER BY m.rw_created_at DESC, m.rw_id DESC
LIMIT $3;

-- Consulta 3: Recuperación vectorial. El actor se toma solo del contexto transaccional;
-- RLS también impide filas ajenas incluso si esta condición se modifica por error.
SELECT
  m.rw_id,
  m.rw_channel_id,
  m.rw_content,
  m.rw_created_at,
  1 - (m.rw_embedding <=> $1::vector) AS rw_similarity
FROM rw_messages m
WHERE m.rw_deleted_at IS NULL
  AND m.rw_channel_id IN (
    SELECT rw_channel_id
    FROM rw_channel_members
    WHERE rw_user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
      AND rw_deleted_at IS NULL
  )
ORDER BY m.rw_embedding <=> $1::vector
LIMIT $3;

-- Consulta 4: Consumo acumulado de tokens/costo del Copiloto por usuario.
SELECT
  rw_user_id,
  SUM(rw_total_tokens) AS rw_total_tokens,
  SUM(rw_cost_usd) AS rw_total_cost_usd
FROM rw_ai_usage
WHERE rw_user_id = $1::uuid
GROUP BY rw_user_id;
