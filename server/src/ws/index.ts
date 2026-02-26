import { Elysia } from 'elysia';

/**
 * WebSocket stub for future co-op and arena modes.
 *
 * Planned message protocol:
 * - { type: 'ping' } -> { type: 'pong' }
 * - { type: 'join_room', roomId } -> join a co-op/arena room
 * - { type: 'game_state', data } -> sync game state in co-op
 * - { type: 'player_action', action } -> broadcast player actions
 */
export const wsRoutes = new Elysia()
  .ws('/ws', {
    open(ws) {
      console.log(`WebSocket connected: ${ws.id}`);
    },
    message(ws, message) {
      // Echo for now - replace with game protocol handler
      ws.send(JSON.stringify({ type: 'echo', data: message }));
    },
    close(ws) {
      console.log(`WebSocket disconnected: ${ws.id}`);
    },
  });
