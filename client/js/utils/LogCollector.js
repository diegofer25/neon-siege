/**
 * @fileoverview Console log ring buffer — intercepts console.log/warn/error/info
 * and stores entries in a capped array for inclusion in bug reports.
 *
 * Must be imported early (e.g. top of main.js) so it captures logs from startup.
 * Original console methods still fire normally (call-through).
 */

/** @typedef {{ level: string, message: string, timestamp: number }} LogEntry */

const MAX_ENTRIES = 200;

/** @type {LogEntry[]} */
const _buffer = [];

const _original = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
};

/**
 * Serialize arguments into a single string, same as DevTools would display.
 * @param {any[]} args
 * @returns {string}
 */
function _serialize(args) {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

/**
 * Push one entry, evicting the oldest if buffer is full.
 * @param {string} level
 * @param {any[]} args
 */
function _push(level, args) {
  if (_buffer.length >= MAX_ENTRIES) _buffer.shift();
  _buffer.push({ level, message: _serialize(args), timestamp: Date.now() });
}

// ─── Monkey-patch ────────────────────────────────────────────────────────────

console.log = (...args) => {
  _push('log', args);
  _original.log(...args);
};

console.warn = (...args) => {
  _push('warn', args);
  _original.warn(...args);
};

console.error = (...args) => {
  _push('error', args);
  _original.error(...args);
};

console.info = (...args) => {
  _push('info', args);
  _original.info(...args);
};

// Also capture unhandled errors and promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    _push('uncaught', [`${e.message} at ${e.filename}:${e.lineno}:${e.colno}`]);
  });
  window.addEventListener('unhandledrejection', (e) => {
    _push('unhandledrejection', [e.reason instanceof Error ? e.reason.message : String(e.reason)]);
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Return a shallow copy of the log buffer.
 * @returns {LogEntry[]}
 */
export function getConsoleLogs() {
  return _buffer.slice();
}

/**
 * Clear the buffer (e.g. after a successful bug report submission).
 */
export function clearConsoleLogs() {
  _buffer.length = 0;
}
