import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*' }
});

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'riwi-api' });
});

io.on('connection', (socket) => {
  socket.on('join-channel', (channelId: string) => {
    socket.join(channelId);
  });
});

const port = Number(process.env.PORT || 4000);
server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
