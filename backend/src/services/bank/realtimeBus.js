// Realtime bus — per-user pub/sub used by the SSE stream
// (GET /api/bank/events) and by anything that produces bank events
// (sync pipeline, simulator, manual simulate).
//
// In-process EventEmitter is all this demo needs: events are transient and
// per-user, and the server is a single process. If the app ever scales out,
// this module can be swapped for Redis pub/sub without touching callers.

const { EventEmitter } = require("events");

const emitter = new EventEmitter();
emitter.setMaxListeners(0); // many concurrent SSE clients are expected

const keyFor = (userId) => `user:${userId}`;

/**
 * Publish an event to a user's stream.
 * @param {number} userId
 * @param {object} event - e.g. { type: 'transaction.created', payload: {...} }
 */
function publish(userId, event) {
  emitter.emit(keyFor(userId), event);
}

/**
 * Subscribe to a user's events.
 * @param {number} userId
 * @param {(event: object) => void} handler
 * @returns {() => void} unsubscribe function
 */
function subscribe(userId, handler) {
  const key = keyFor(userId);
  emitter.on(key, handler);
  return () => emitter.off(key, handler);
}

module.exports = { publish, subscribe };
