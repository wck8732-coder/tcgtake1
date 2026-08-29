// CombatEngine.cs  (PREPARATION STUB)
// Port target: game.js combat block (combatDeclareAttackers / resolveCombatPhase).
// Mirrors: attacker/blocker champion lookups, combat damage, flip-on-damage omens.
// Gated on decks.json rebuild (70-card pools) for live testing.
using UnityEngine;

namespace TCG.Engine
{
    public class CombatEngine
    {
        // Port: combat declaration phase
        public void DeclareAttackers() { /* TODO */ }

        // Port: blocker assignment
        public void DeclareBlockers() { /* TODO */ }

        // Port: combat damage (triggers flipCost / Ominous flips at END_OF_TURN)
        public void DealCombatDamage() { /* TODO */ }

        public bool CanAttack(CardData attacker) => attacker.IsChampion && !attacker.IsLand;
    }
}
