// Potrero Raqueta · servidor online en Cloudflare
// Cada partida es una sala (Durable Object) identificada por su código.
// La sala solo reenvía: cada jugador manda su "presencia" (posiciones y eventos)
// y la sala se la pasa a los demás. Toda la lógica del juego corre en los navegadores.

const MAX_PEERS = 4;          // 2 jugadores (y margen por reconexiones)
const MAX_PRESENCE = 8192;    // bytes por jugador

export class Room {
  constructor(state, env) {
    this.state = state;
    this.peers = new Map(); // id -> {ws, pres}
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Solo WebSocket', { status: 426 });
    if (this.peers.size >= MAX_PEERS) return new Response('Sala llena', { status: 429 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const me = { ws: server, pres: {} };
    this.peers.set(id, me);
    // al que llega: quién está y qué presencia tiene cada uno
    server.send(JSON.stringify({ t: 'hello', you: id, peers: [...this.peers].filter(([k]) => k !== id).map(([k, v]) => ({ peer: k, d: v.pres })) }));
    this.broadcast(id, { t: 'j', peer: id });
    server.addEventListener('message', (ev) => {
      if (typeof ev.data !== 'string' || ev.data.length > MAX_PRESENCE * 2) return;
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m && m.t === 'p' && m.d && typeof m.d === 'object' && !Array.isArray(m.d)) {
        for (const k of Object.keys(m.d)) { if (m.d[k] === null) delete me.pres[k]; else me.pres[k] = m.d[k]; }
        if (JSON.stringify(me.pres).length > MAX_PRESENCE) me.pres = {};
        this.broadcast(id, { t: 'p', peer: id, d: me.pres });
      } else if (m && m.t === 'ping') {
        try { server.send('{"t":"pong"}'); } catch {}
      }
    });
    const bye = () => { if (this.peers.delete(id)) this.broadcast(id, { t: 'l', peer: id }); };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(from, msg) {
    const s = JSON.stringify(msg);
    for (const [k, v] of this.peers) if (k !== from) { try { v.ws.send(s); } catch {} }
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/room\/([a-z0-9][a-z0-9_.-]{0,47})$/);
    if (m) return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
    if (url.pathname === '/health') return new Response('ok');
    // el resto: el juego (carpeta public/)
    return env.ASSETS ? env.ASSETS.fetch(req) : new Response('Potrero Raqueta', { status: 200 });
  }
};
