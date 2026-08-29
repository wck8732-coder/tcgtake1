(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.COST = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {

  function normalizeCost(cost) {
    if (cost == null) return { color: null, generic: 0 };
    if (typeof cost === 'number') return { color: null, generic: cost };
    if (typeof cost === 'object') return { color: cost.color || null, generic: cost.generic || 0 };
    return { color: null, generic: Number(cost) || 0 };
  }

  function totalCostValue(cost) {
    var c = normalizeCost(cost);
    return c.generic + (c.color ? 1 : 0);
  }

  function canPayCost(player, cost) {
    var c = normalizeCost(cost);
    var total = availableMana(player);
    var colored = c.color ? player.battlefield.lands.filter(function(l) { return !l.tapped && l.color === c.color; }).length : total;
    return colored >= (c.color ? 1 : 0) && total >= (c.generic + (c.color ? 1 : 0));
  }

  function availableMana(player) {
    if (!player || !player.battlefield || !player.battlefield.lands) return 0;
    return player.battlefield.lands.filter(function(l) { return !l.tapped; }).length;
  }

  function effectiveCost(player, cost) {
    var c = normalizeCost(cost);
    var generic = c.generic - (player.costDiscount || 0);
    if (generic < 0) generic = 0;
    generic += player.costTax || 0;
    return { color: c.color, generic: generic };
  }

  function consumeCostDiscount(player) {
    if (player.costDiscountUses > 0) {
      player.costDiscountUses--;
      if (player.costDiscountUses <= 0) player.costDiscount = 0;
    }
  }

  return {
    normalize: normalizeCost,
    totalValue: totalCostValue,
    canPay: canPayCost,
    available: availableMana,
    effective: effectiveCost,
    consumeDiscount: consumeCostDiscount
  };

});
