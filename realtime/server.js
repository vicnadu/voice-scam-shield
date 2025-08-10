import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8081;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

/**
 * Track UI clients to broadcast call events/levels
 */
const uiClients = new Set();

/**
 * μ-law decode to PCM16 (Int16Array)
 * Based on standard G.711 μ-law expansion
 */
function mulawByteToPcm16(mu) {
  mu = ~mu & 0xff;
  const sign = mu & 0x80;
  let exponent = (mu >> 4) & 0x07;
  let mantissa = mu & 0x0f;
  let sample = ((mantissa << 4) + 0x08) << (exponent + 3);
  sample -= 0x84; // bias
  return sign ? -sample : sample;
}

function decodeMulaw(buffer) {
  const out = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    out[i] = mulawByteToPcm16(buffer[i]);
  }
  return out;
}

function computeRms(int16) {
  if (int16.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < int16.length; i++) {
    const v = int16[i] / 32768; // normalize to -1..1
    sumSquares += v * v;
  }
  const rms = Math.sqrt(sumSquares / int16.length);
  return Math.min(1, rms);
}

function broadcastUi(messageObj) {
  const payload = JSON.stringify(messageObj);
  for (const ws of uiClients) {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  }
}

server.on('upgrade', (req, socket, head) => {
  const { url } = req;
  if (url !== '/ui' && url !== '/call-stream') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws._path = url; // annotate
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws, req) => {
  const path = ws._path;
  if (path === '/ui') {
    uiClients.add(ws);
    ws.send(JSON.stringify({ type: 'hello', serverTime: Date.now() }));
    ws.on('close', () => uiClients.delete(ws));
    return;
  }

  if (path === '/call-stream') {
    // Twilio Media Streams connection
    let callId = undefined;

    ws.on('message', (data) => {
      try {
        const evt = JSON.parse(data.toString());
        switch (evt.event) {
          case 'start': {
            callId = evt.start?.callSid || evt.streamSid || `call-${Math.random().toString(36).slice(2)}`;
            broadcastUi({ type: 'call-start', callId, from: evt.start?.from, to: evt.start?.to });
            break;
          }
          case 'media': {
            if (!evt.media?.payload) return;
            const mulawBuf = Buffer.from(evt.media.payload, 'base64');
            const pcm16 = decodeMulaw(mulawBuf);
            const rms = computeRms(pcm16);
            broadcastUi({ type: 'level', callId, rms });
            break;
          }
          case 'stop': {
            broadcastUi({ type: 'call-stop', callId });
            break;
          }
          default:
            break;
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid-json' }));
      }
    });

    ws.on('close', () => {
      if (callId) broadcastUi({ type: 'call-stop', callId });
    });
    return;
  }
});

server.listen(PORT, () => {
  console.log(`Realtime server listening on :${PORT}`);
  console.log(`- UI WS: ws://localhost:${PORT}/ui`);
  console.log(`- Twilio Media Stream WS: ws://localhost:${PORT}/call-stream`);
}); 