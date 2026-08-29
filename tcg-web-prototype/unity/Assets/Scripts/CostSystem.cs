// CostSystem.cs  (PREPARATION STUB)
// Port target: shared/cost-utils.js (COST.normalize / totalValue / canPayCost / payMana).
// Handles v0.1042 cost format: int(0) for lands, or {color,generic} object for spells.
using UnityEngine;

namespace TCG.Engine
{
    public class CostSystem
    {
        // Port: normalizeCost — normalize {color,generic} / int(0) into one object.
        public static ManaCost Normalize(object cost) { /* TODO */ return null; }

        // Port: totalCostValue — sum of generic + colored pips.
        public static int TotalValue(object cost) { /* TODO */ return 0; }

        // Port: canPayCost — check a player's available mana vs the cost.
        public static bool CanPay(CardData card, object availableMana) { /* TODO */ return false; }
    }

    // Plain data carrier; parsed by CostSystem from JToken at runtime.
    public class ManaCost
    {
        public string color;
        public int generic;
    }
}
