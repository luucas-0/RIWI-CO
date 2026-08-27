import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { pool, withUserContext } from './infrastructure/db/postgres.js';
import { PostgresChannelRepository, PostgresMessageRepository } from './infrastructure/db/PostgresRepositories.js';
import { OpenAiProvider } from './infrastructure/ai/OpenAiProvider.js';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, JwtPayload } from './infrastructure/security/jwt.js';
import { config } from './infrastructure/config/env.js';

type AuthRequest = Request & { auth?: JwtPayload };
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: config.corsOrigin } });

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = config.corsOrigin;

  if (origin && (origin === allowedOrigin || /^http:\/\/localhost:\d+$/.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json({ limit: '20kb' }));

function auth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('missing token');
    req.auth = verifyAccessToken(token);
    next();
  } catch { res.status(401).json({ error: 'unauthorized' }); }
}
function actor(req: AuthRequest) { return req.auth!.sub; }

app.get('/health', async (_req, res, next) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, service: 'riwi-api' }); } catch (error) { next(error); }
});
app.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });
    const { rows } = await pool.query<{ rw_id: string; rw_email: string; rw_role: string; rw_name: string; rw_password_hash: string }>('SELECT rw_id, rw_email, rw_role, rw_name, rw_password_hash FROM rw_users WHERE rw_email = $1 AND rw_deleted_at IS NULL', [email.toLowerCase()]);
    const account = rows[0];
    if (!account || !(await bcrypt.compare(password, account.rw_password_hash))) return res.status(401).json({ error: 'invalid_credentials' });
    const payload = { sub: account.rw_id, email: account.rw_email, role: account.rw_role };
    const refreshToken = signRefreshToken(payload);
    await pool.query("INSERT INTO rw_refresh_tokens (rw_id, rw_user_id, rw_token_hash, rw_expires_at) VALUES ($1, $2, $3, now() + interval '7 days')", [crypto.randomUUID(), account.rw_id, await bcrypt.hash(refreshToken, 10)]);
    res.json({ accessToken: signAccessToken(payload), refreshToken, user: { id: account.rw_id, name: account.rw_name, role: account.rw_role } });
  } catch (error) { next(error); }
});
app.post('/auth/refresh', async (req, res, next) => {
  try {
    const token = req.body?.refreshToken as string | undefined;
    if (!token) return res.status(400).json({ error: 'refresh_token_required' });
    const payload = verifyRefreshToken(token);
    const { rows } = await pool.query<{ rw_id: string; rw_token_hash: string }>('SELECT rw_id, rw_token_hash FROM rw_refresh_tokens WHERE rw_user_id = $1 AND rw_revoked_at IS NULL AND rw_expires_at > now()', [payload.sub]);
    const stored = (await Promise.all(rows.map(async row => ({ row, valid: await bcrypt.compare(token, row.rw_token_hash) })))).find(item => item.valid)?.row;
    if (!stored) return res.status(401).json({ error: 'invalid_refresh_token' });
    await pool.query('UPDATE rw_refresh_tokens SET rw_revoked_at = now() WHERE rw_id = $1', [stored.rw_id]);
    const nextRefresh = signRefreshToken(payload);
    await pool.query("INSERT INTO rw_refresh_tokens (rw_id, rw_user_id, rw_token_hash, rw_expires_at) VALUES ($1, $2, $3, now() + interval '7 days')", [crypto.randomUUID(), payload.sub, await bcrypt.hash(nextRefresh, 10)]);
    res.json({ accessToken: signAccessToken(payload), refreshToken: nextRefresh });
  } catch (error) { next(error); }
});
app.get('/channels', auth, async (req: AuthRequest, res, next) => {
  try { res.json(await withUserContext(actor(req), client => new PostgresChannelRepository(client).listForUser(actor(req)))); } catch (error) { next(error); }
});
app.get('/channels/:channelId/messages', auth, async (req: AuthRequest, res, next) => {
  try {
    const cursor = req.query.cursorCreatedAt && req.query.cursorId ? { rw_created_at: new Date(String(req.query.cursorCreatedAt)), rw_id: String(req.query.cursorId) } : undefined;
    const items = await withUserContext(actor(req), client => new PostgresMessageRepository(client).listByChannel(String(req.params.channelId), cursor, Math.min(Math.max(Number(req.query.limit) || 25, 1), 100)));
    const last = items.at(-1);
    res.json({ items, nextCursor: last ? { createdAt: last.rw_created_at, id: last.rw_id } : null });
  } catch (error) { next(error); }
});
app.get('/channels/:channelId/messages/search', auth, async (req: AuthRequest, res, next) => {
  try {
    const term = String(req.query.q || '').trim();
    if (!term) return res.status(400).json({ error: 'query_required' });
    const items = await withUserContext(actor(req), async client => (await client.query('SELECT rw_id, rw_channel_id, rw_sender_user_id, rw_content, rw_status, rw_created_at, rw_updated_at, ts_headline(\'simple\', rw_content, plainto_tsquery(\'simple\', $2), \'StartSel=<mark>, StopSel=</mark>\') AS rw_highlight FROM rw_messages WHERE rw_channel_id = $1 AND rw_deleted_at IS NULL AND to_tsvector(\'simple\', rw_content) @@ plainto_tsquery(\'simple\', $2) ORDER BY rw_created_at DESC, rw_id DESC LIMIT 50', [String(req.params.channelId), term])).rows);
    res.json({ items });
  } catch (error) { next(error); }
});
app.post('/channels/:channelId/messages', auth, async (req: AuthRequest, res, next) => {
  try {
    const content = String(req.body?.content || '').trim();
    if (!content || content.length > 4000) return res.status(400).json({ error: 'invalid_content' });
    const channelId = String(req.params.channelId);
    const message = await withUserContext(actor(req), client => new PostgresMessageRepository(client).save({ rw_id: crypto.randomUUID(), rw_channel_id: channelId, rw_sender_user_id: actor(req), rw_content: content, rw_status: 'sent' }));
    if (config.openAiApiKey) {
      const embedding = await new OpenAiProvider().embedText(content);
      await withUserContext(actor(req), client => client.query('UPDATE rw_messages SET rw_embedding = $1::vector WHERE rw_id = $2', [`[${embedding.join(',')}]`, message.rw_id]));
    }
    io.to(channelId).emit('message-created', message);
    res.status(201).json(message);
  } catch (error) { next(error); }
});
app.post('/copilot/ask', auth, async (req: AuthRequest, res, next) => {
  try {
    const question = String(req.body?.question || '').trim();
    if (!question || question.length > 2000) return res.status(400).json({ error: 'invalid_question' });

    const normalized = question.toLowerCase();
    const isSimpleChat = /^(hola|hello|hi|hey|buenas|buenos días|buenas tardes|buenas noches|qué puedes hacer|que puedes hacer|ayuda|help|puedes ayudarme|puedes ayudar)$/.test(normalized.trim());

    if (isSimpleChat) {
      return res.json({
        answer: '¡Hola! Puedo ayudarte con coordinación interna, despliegue, campañas y seguimiento del equipo. Si me dices el tema exacto, te respondo de forma útil y concreta.',
        citations: [],
      });
    }

    const userId = actor(req);
    const allowedChannels = await withUserContext(userId, async (client) => {
      const repository = new PostgresChannelRepository(client);
      return repository.listForUser(userId);
    });

    if (!allowedChannels.length) {
      return res.status(403).json({ error: 'forbidden_no_channel_access' });
    }

    const channelIds = allowedChannels.map((channel) => channel.rw_id);
    const provider = new OpenAiProvider();
    const answer = await withUserContext(userId, async (client) => {
      let context: Array<{ rw_id: string; rw_content: string; rw_channel_id: string; rw_created_at: Date }> = [];

      if (config.openAiApiKey) {
        const embedding = await provider.embedText(question);
        context = (await client.query<{ rw_id: string; rw_content: string; rw_channel_id: string; rw_created_at: Date }>(`
          SELECT rw_id, rw_content, rw_channel_id, rw_created_at
          FROM rw_messages
          WHERE rw_deleted_at IS NULL
            AND rw_channel_id = ANY($1::uuid[])
            AND rw_embedding IS NOT NULL
          ORDER BY rw_embedding <=> $2::vector
          LIMIT 8
        `, [channelIds, `[${embedding.join(',')}]`])).rows;
      }

      if (!context.length) {
        context = (await client.query<{ rw_id: string; rw_content: string; rw_channel_id: string; rw_created_at: Date }>(`
          SELECT rw_id, rw_content, rw_channel_id, rw_created_at
          FROM rw_messages
          WHERE rw_deleted_at IS NULL
            AND rw_channel_id = ANY($1::uuid[])
          ORDER BY rw_created_at DESC, rw_id DESC
          LIMIT 8
        `, [channelIds])).rows;
      }

      return provider.answerWithRag({
        userId,
        channelIds,
        question,
        context: context.map((message) => ({
          rw_id: message.rw_id,
          rw_content: message.rw_content,
          rw_channel_id: message.rw_channel_id,
          rw_created_at: message.rw_created_at,
        })),
      });
    });

    res.json(answer);
  } catch (error) { next(error); }
});
io.use((socket, next) => { try { socket.data.auth = verifyAccessToken(socket.handshake.auth?.token); next(); } catch { next(new Error('unauthorized')); } });
io.on('connection', socket => socket.on('join-channel', async (channelId: string) => {
  try { await withUserContext(socket.data.auth.sub, async client => { if (await new PostgresChannelRepository(client).isMember(socket.data.auth.sub, channelId)) socket.join(channelId); }); } catch { socket.emit('error', 'forbidden'); }
}));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const code = (error as { code?: string }).code;
  if (code === '42501') return res.status(403).json({ error: 'forbidden' });
  console.error(error); res.status(500).json({ error: 'internal_error' });
});
server.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));
