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

  return {
    shuffle: shuffle,
    deepClone: deepClone
  };

});
