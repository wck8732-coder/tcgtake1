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

  class EventBus {
    constructor() { this.listeners = {}; }
    on(event, fn) { (this.listeners[event] = this.listeners[event] || []).push(fn); }
    off(event, fn) { this.listeners[event] = (this.listeners[event] || []).filter(f => f !== fn); }
    emit(event, data) { (this.listeners[event] || []).forEach(fn => fn(data)); }
  }

  const bus = new EventBus();

  return {
    shuffle: shuffle,
    deepClone: deepClone,
    EventBus: EventBus,
    bus: bus
  };

});
