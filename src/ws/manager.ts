import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { logger } from '../utils/logger';

const clients = new Set<WebSocket>();

export const wsManager = {
  attach(wss: WebSocketServer) {
    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      clients.add(ws);
      logger.debug({ ip: req.socket.remoteAddress }, 'WS client connected');
      ws.on('close', () => clients.delete(ws));
    });
  },

  broadcast(payload: unknown) {
    const msg = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
  },
};
