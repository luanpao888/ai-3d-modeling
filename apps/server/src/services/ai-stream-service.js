export class AiStreamService {
  constructor() {
    this.channels = new Map();
    this.sequenceBySession = new Map();
  }

  subscribe(sessionId, reply) {
    const raw = reply.raw;

    raw.setHeader('Content-Type', 'text/event-stream');
    raw.setHeader('Cache-Control', 'no-cache, no-transform');
    raw.setHeader('Connection', 'keep-alive');
    raw.setHeader('X-Accel-Buffering', 'no');
    raw.write('retry: 3000\n\n');

    if (typeof raw.flushHeaders === 'function') {
      raw.flushHeaders();
    }

    let channel = this.channels.get(sessionId);
    if (!channel) {
      channel = new Set();
      this.channels.set(sessionId, channel);
    }

    channel.add(raw);

    return () => {
      channel.delete(raw);
      if (channel.size === 0) {
        this.channels.delete(sessionId);
      }
    };
  }

  emit(sessionId, event, payload) {
    const channel = this.channels.get(sessionId);
    if (!channel || channel.size === 0) {
      return null;
    }

    const nextSeq = (this.sequenceBySession.get(sessionId) ?? 0) + 1;
    this.sequenceBySession.set(sessionId, nextSeq);

    const eventId = String(nextSeq);
    const data = JSON.stringify(payload ?? {});
    const packet = `id: ${eventId}\nevent: ${event}\ndata: ${data}\n\n`;

    for (const stream of channel) {
      stream.write(packet);
    }

    return eventId;
  }

  heartbeat(sessionId) {
    this.emit(sessionId, 'heartbeat', {
      at: new Date().toISOString()
    });
  }
}
