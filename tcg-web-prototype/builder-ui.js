/*
 * builder-ui.js — IN-BROWSER DECK BUILDER (A2, in-memory)
 * =======================================================
 * Browse/search/filter the card pool, assemble a 70-card deck against
 * DECKRULES, sample hands, import/export text, then hand a deckDef to
 * game.js for launch. No persistence yet (A3). No engine changes:
 * the finished def flows through the normal deckKey/deckDB path.
 *
 * Flow order is difficulty/format first, deck last (match settings
 * before decks, so every difficulty stays testable).
 */
(function(root) {
  'use strict';

  var entries = new Map(); // id -> count (session lifetime)
  var format = 'Classic';
  var onDone = null;
  var RESULT_CAP = 150;

  function db() { return root.__CARD_DB__ || []; }
  function byId(id) {
    var cards = db();
    for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i];
    return null;
  }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function entryList() {
    var out = [];
    entries.forEach(function(count, id) { out.push({ id: id, count: count }); });
    return out;
  }

  function factionOf(card) { return card.color || ''; }

  // --- pool ---------------------------------------------------------------
  function filteredPool() {
    var q = (el('builder-search').value || '').toLowerCase().trim();
    var f = el('builder-faction').value;
    var t = el('builder-type').value;
    var r = el('builder-rarity').value;
    var out = db().filter(function(c) {
      if (f !== 'All' && factionOf(c) !== f) return false;
      if (t !== 'All' && c.type !== t) return false;
      if (r !== 'All' && c.rarity !== r) return false;
      if (q) {
        var hay = ((c.name || '') + ' ' + (c.text || '') + ' ' + (c.flavor || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    out.sort(function(a, b) {
      var ma = root.DECKRULES.manaValue(a), mb = root.DECKRULES.manaValue(b);
      if (ma !== mb) return ma - mb;
      return (a.name || '').localeCompare(b.name || '');
    });
    return out;
  }

  function renderPool() {
    var box = el('builder-results');
    box.innerHTML = '';
    var pool = filteredPool();
    var shown = pool.slice(0, RESULT_CAP);
    if (pool.length > RESULT_CAP) {
      var note = document.createElement('p');
      note.className = 'builder-note';
      note.textContent = 'Showing ' + RESULT_CAP + ' of ' + pool.length + ' — refine filters.';
      box.appendChild(note);
    }
    shown.forEach(function(card) {
      var owned = entries.get(card.id) || 0;
      var wrap = document.createElement('div');
      wrap.className = 'builder-card';
      wrap.title = owned ? ('In deck: ' + owned + ' (click +1, right-click +4)') : 'Click +1, right-click +4';
      wrap.appendChild(root.CardRenderer.create(card));
      if (owned > 0) {
        var badge = document.createElement('div');
        badge.className = 'builder-owned';
        badge.textContent = '×' + owned;
        wrap.appendChild(badge);
      }
      wrap.addEventListener('click', function() { addCard(card.id, 1); });
      wrap.addEventListener('contextmenu', function(e) { e.preventDefault(); addCard(card.id, 4); });
      box.appendChild(wrap);
    });
  }

  // --- deck ---------------------------------------------------------------
  function addCard(id, n) {
    var cur = entries.get(id) || 0;
    var next = Math.min(root.DECKRULES.MAXCOPIES, cur + n);
    if (next <= 0) entries.delete(id);
    else entries.set(id, next);
    renderAll();
  }

  function renderDeck() {
    var list = el('builder-list');
    list.innerHTML = '';
    var rows = entryList().map(function(e) { return { card: byId(e.id), count: e.count }; })
      .filter(function(r) { return r.card; })
      .sort(function(a, b) {
        var ma = root.DECKRULES.manaValue(a.card), mb = root.DECKRULES.manaValue(b.card);
        if (ma !== mb) return ma - mb;
        return a.card.name.localeCompare(b.card.name);
      });
    if (!rows.length) {
      list.innerHTML = '<p class="builder-note">Empty — click cards to add (right-click adds 4).</p>';
    }
    rows.forEach(function(r) {
      var div = document.createElement('div');
      div.className = 'builder-row' + (r.card.type === 'Land' ? ' is-land' : '');
      div.innerHTML = '<span class="builder-row-name">' + esc(r.card.name) + '</span>' +
        '<span class="builder-row-count">×' + r.count + '</span>';
      var mk = function(label, fn) {
        var b = document.createElement('button');
        b.className = 'control-btn mini-btn';
        b.textContent = label;
        b.addEventListener('click', fn);
        div.appendChild(b);
      };
      mk('+1', function() { addCard(r.card.id, 1); });
      mk('+4', function() { addCard(r.card.id, 4); });
      mk('−1', function() {
        var cur = entries.get(r.card.id) || 0;
        if (cur <= 1) entries.delete(r.card.id);
        else entries.set(r.card.id, cur - 1);
        renderAll();
      });
      mk('✕', function() { entries.delete(r.card.id); renderAll(); });
      list.appendChild(div);
    });
  }

  function renderMeter() {
    var v = root.DECKRULES.validateDeck(entryList(), db(), format);
    el('builder-count').textContent = v.total + '/' + root.DECKRULES.TOTAL;
    var meter = el('builder-meter');
    meter.innerHTML = '';
    var line = function(label, got, want) {
      var d = document.createElement('div');
      d.className = 'meter-line' + (got === want ? ' meter-ok' : ' meter-bad');
      d.textContent = label + ': ' + got + '/' + want;
      meter.appendChild(d);
    };
    line('Total', v.total, root.DECKRULES.TOTAL);
    line('Lands', v.lands, root.DECKRULES.LANDS);
    line('Non-land', v.nonLand, root.DECKRULES.NONLAND);
    v.errors.forEach(function(err) {
      var d = document.createElement('div');
      d.className = 'meter-err';
      d.textContent = err;
      meter.appendChild(d);
    });
    // curve
    var curve = el('builder-curve');
    curve.innerHTML = '';
    var keys = [1, 2, 3, 4, 5, '6+'];
    var max = 1;
    keys.forEach(function(k) { max = Math.max(max, v.curve[k]); });
    keys.forEach(function(k) {
      var n = v.curve[k];
      var bar = document.createElement('div');
      bar.className = 'curve-col';
      bar.innerHTML = '<div class="curve-bar" style="height:' + Math.round((n / max) * 56) + 'px"></div>' +
        '<div class="curve-label">' + (k === '6+' ? '6+' : k) + '</div>' +
        '<div class="curve-n">' + n + '</div>';
      curve.appendChild(bar);
    });
    el('builder-play').disabled = !v.ok;
    return v;
  }

  function renderAll() { renderPool(); renderDeck(); renderMeter(); }

  // --- actions ------------------------------------------------------------
  function autoLands() {
    var cards = db();
    var factionFilter = el('builder-faction').value;
    var faction = root.DECKRULES.majorityFaction(entryList(), cards,
      factionFilter !== 'All' ? factionFilter : 'Crimson');
    var lands = cards.filter(function(c) { return c.type === 'Land' && c.color === faction; });
    if (!lands.length) lands = cards.filter(function(c) { return c.type === 'Land'; });
    var v = root.DECKRULES.validateDeck(entryList(), cards, format);
    var need = root.DECKRULES.LANDS - v.lands;
    for (var i = 0; i < need; i++) {
      var land = lands[i % lands.length];
      var cur = entries.get(land.id) || 0;
      if (cur < root.DECKRULES.MAXCOPIES) entries.set(land.id, cur + 1);
    }
    renderAll();
  }

  function sampleHand() {
    var out = el('builder-sample-out');
    out.innerHTML = '';
    var v = root.DECKRULES.validateDeck(entryList(), db(), format);
    if (!v.ok) {
      out.innerHTML = '<p class="builder-note">Deck must be valid before sampling.</p>';
      return;
    }
    var hand = root.DECKRULES.expandDeck(entryList(), db()).slice(0, 7);
    var lands = hand.filter(function(c) { return c.type === 'Land'; }).length;
    var head = document.createElement('p');
    head.className = 'builder-note';
    head.textContent = 'Sample opener — Lands: ' + lands + ' of 7';
    out.appendChild(head);
    var row = document.createElement('div');
    row.className = 'builder-sample-row';
    hand.forEach(function(card) { row.appendChild(root.CardRenderer.create(card)); });
    out.appendChild(row);
  }

  function exportText() {
    var io = el('builder-io');
    var rows = entryList().map(function(e) { return { card: byId(e.id), count: e.count }; })
      .filter(function(r) { return r.card; })
      .sort(function(a, b) { return a.card.name.localeCompare(b.card.name); });
    io.value = rows.map(function(r) { return r.count + 'x ' + r.card.name; }).join('\n');
    io.classList.remove('hidden');
  }

  function importText() {
    var io = el('builder-io');
    io.classList.remove('hidden');
    var text = (io.value || '').trim();
    if (!text) return;
    var cards = db();
    var nameMap = {};
    cards.forEach(function(c) { nameMap[c.name.toLowerCase()] = c; });
    var unknown = [];
    var fresh = new Map();
    text.split('\n').forEach(function(line) {
      var m = line.trim().match(/^(\d+)\s*x?\s+(.+)$/i);
      if (!m) return;
      var card = nameMap[m[2].toLowerCase()];
      if (!card) { unknown.push(m[2]); return; }
      fresh.set(card.id, Math.min(root.DECKRULES.MAXCOPIES, parseInt(m[1], 10) || 0));
    });
    fresh.forEach(function(n, id) { if (n > 0) entries.set(id, n); else entries.delete(id); });
    renderAll();
    if (unknown.length) {
      io.value = 'Unknown cards (not imported):\n' + unknown.join('\n');
    }
  }

  function toDef() {
    var list = entryList();
    var v = root.DECKRULES.validateDeck(list, db(), format);
    var faction = root.DECKRULES.majorityFaction(list, db(), 'Colorless');
    return {
      name: 'Custom Brew (' + faction + ' ' + format + ')',
      faction: faction,
      format: format,
      strategy: 'Player-built custom deck.',
      lands: v.lands,
      total: v.total,
      cards: list
    };
  }

  // --- public --------------------------------------------------------------
  function open(fmt, done) {
    format = fmt || 'Classic';
    onDone = done || null;
    document.getElementById('builder-screen').classList.remove('hidden');
    renderAll();
  }

  function close() {
    document.getElementById('builder-screen').classList.add('hidden');
  }

  function wire() {
    ['builder-search', 'builder-faction', 'builder-type', 'builder-rarity'].forEach(function(id) {
      var node = document.getElementById(id);
      if (node) node.addEventListener('input', renderPool);
    });
    document.getElementById('builder-save').addEventListener('click', function() {
      var v = root.DECKRULES.validateDeck(entryList(), db(), format);
      if (!v.ok) return;
      var nameInput = document.getElementById('builder-name');
      var name = ((nameInput && nameInput.value) || '').trim() ||
        ('Brew ' + new Date().toISOString().slice(0, 10));
      var def = toDef();
      def.name = name;
      if (root.COLLECTION) root.COLLECTION.saveDeck(def);
      if (nameInput) nameInput.value = '';
      var meter = document.getElementById('builder-meter');
      var d = document.createElement('div');
      d.className = 'meter-line meter-ok';
      d.textContent = 'Saved "' + name + '" — find it under My Decks.';
      meter.appendChild(d);
    });
    document.getElementById('builder-auto-lands').addEventListener('click', autoLands);
    document.getElementById('builder-sample').addEventListener('click', sampleHand);
    document.getElementById('builder-export').addEventListener('click', exportText);
    document.getElementById('builder-import').addEventListener('click', importText);
    document.getElementById('builder-clear').addEventListener('click', function() {
      entries.clear();
      renderAll();
    });
    document.getElementById('builder-back').addEventListener('click', close);
    document.getElementById('builder-play').addEventListener('click', function() {
      var v = root.DECKRULES.validateDeck(entryList(), db(), format);
      if (!v.ok || !onDone) return;
      if (root.COLLECTION && !root.COLLECTION.ownsPlayset(entryList(), db())) {
        var meter = document.getElementById('builder-meter');
        var d = document.createElement('div');
        d.className = 'meter-err';
        d.textContent = 'Collection is missing some of these cards.';
        meter.appendChild(d);
        return;
      }
      var def = toDef();
      close();
      onDone(def);
    });
  }

  root.BuilderUI = { open: open, close: close, wire: wire, toDef: toDef };

})(typeof window !== 'undefined' ? window : this);
