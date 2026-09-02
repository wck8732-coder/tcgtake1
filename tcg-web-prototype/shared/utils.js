(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SHARED = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  // log() is environment-aware: writes to .log-entries in the browser,
  // no-op in Node (no document). Engine code can call log() freely.
  function log(msg, type) {
    if (typeof document === 'undefined') return;
    var el = document.querySelector('.log-entries');
    if (!el) return;
    var entry = document.createElement('div');
    entry.className = 'log-entry ' + (type || 'info');
    entry.textContent = msg;
    el.prepend(entry);
    if (el.children.length > 50) el.lastChild.remove();
    if (typeof window !== 'undefined' && window.__DEBUG) console.log('[' + (type || 'info') + '] ' + msg);
  }

  // debug() prints to console only when window.__DEBUG is set; no-op in Node.
  function debug() {
    if (typeof window !== 'undefined' && window.__DEBUG) {
      console.log.apply(console, ['[DEBUG]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  class EventBus {
    constructor() { this.listeners = {}; }
    on(event, fn) { (this.listeners[event] = this.listeners[event] || []).push(fn); }
    off(event, fn) { this.listeners[event] = (this.listeners[event] || []).filter(f => f !== fn); }
    emit(event, data) { (this.listeners[event] || []).forEach(fn => fn(data)); }
  }
  // Bus-listener pair-up rule (documented for future contributors; see
  // tcg-web-prototype/build/ui-stale-state-audit.md):
  //   Every bus.on(event, fn) MUST have a matching bus.off(event, fn)
  //   when the consumer's lifetime ends (component unmount, player
  //   leaves, view closes). Otherwise listeners accumulate forever
  //   and the bus grows without bound. As of v0.1053, the project has
  //   10 emit callsites and 0 subscribers, so no current leak — but
  //   any future feature that subscribes (audio cues, replay recorder,
  //   tutorial hints, multiplayer spectator overlay) must wire the
  //   off-call in its teardown path.

  const bus = new EventBus();

  return {
    shuffle: shuffle,
    deepClone: deepClone,
    log: log,
    debug: debug,
    EventBus: EventBus,
    bus: bus
  };

});
