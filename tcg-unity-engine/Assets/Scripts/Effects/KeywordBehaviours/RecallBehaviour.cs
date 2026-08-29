// KeywordBehaviours/RecallBehaviour.cs
// Recall N: When this card is in your graveyard, you may pay N to return it to your hand
// Charge-based recursion mechanic
using TCG.Data;

namespace TCG.Effects.KeywordBehaviours
{
    public static class RecallBehaviour
    {
        public const string KeywordName = "Recall";
        public const KeywordFlags Flag = KeywordFlags.Recall;

        public static bool HasRecall(CardData card) => card.HasKeyword(Flag);

        /// <summary>
        /// Get the recall cost (N) for this card
        /// Stored in card.recallCharges
        /// </summary>
        public static int GetRecallCost(CardData card) => card.recallCharges;

        /// <summary>
        /// Can this card be recalled from graveyard?
        /// </summary>
        public static bool CanRecall(CardData card, int playerId, ManaSystem manaSystem)
        {
            if (!HasRecall(card)) return false;
            if (card.currentZone != ZoneType.Graveyard) return false;
            if (card.recallCharges <= 0) return false;

            // Check if player can pay the recall cost (typically mana)
            // For now, assume recall cost is generic mana = recallCharges
            var cost = new ManaCost { color = null, generic = card.recallCharges, isLand = false };
            return manaSystem.CanPayMana(playerId, cost);
        }

        /// <summary>
        /// Perform the recall - return from graveyard to hand
        /// </summary>
        public static bool DoRecall(CardData card, int playerId, ManaSystem manaSystem, ZoneManager zoneManager)
        {
            if (!CanRecall(card, playerId, manaSystem)) return false;

            // Pay the recall cost
            var cost = new ManaCost { color = null, generic = card.recallCharges, isLand = false };
            if (!manaSystem.PayMana(playerId, cost)) return false;

            // Move from graveyard to hand
            zoneManager.MoveCard(card, ZoneType.Graveyard, ZoneType.Hand, playerId);
            card.recallCharges--; // Decrement charges

            return true;
        }

        /// <summary>
        /// Reset recall charges (e.g., when card leaves graveyard)
        /// </summary>
        public static void ResetCharges(CardData card)
        {
            // Charges typically reset when card moves zones
            // Base charges would be stored in the original card data
        }

        public static string GetDisplayText(CardData card)
        {
            int cost = GetRecallCost(card);
            return $"Recall {cost} (You may pay {cost} to return this from your graveyard to your hand.)";
        }
    }
}