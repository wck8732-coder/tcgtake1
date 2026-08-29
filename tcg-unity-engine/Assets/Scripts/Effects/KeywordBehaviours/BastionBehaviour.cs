// KeywordBehaviours/BastionBehaviour.cs
// Bastion: This creature can't be the target of spells or abilities your opponents control
// (Hexproof/Ward equivalent)
using TCG.Data;

namespace TCG.Effects.KeywordBehaviours
{
    public static class BastionBehaviour
    {
        public const string KeywordName = "Bastion";
        public const KeywordFlags Flag = KeywordFlags.Bastion;

        public static bool HasBastion(CardData card) => card.HasKeyword(Flag);

        /// <summary>
        /// Can this creature be targeted by opponent's spells/abilities?
        /// </summary>
        public static bool CanBeTargetedByOpponent(CardData card, int sourcePlayerId)
        {
            if (!HasBastion(card)) return true;
            // Can't be targeted by opponents
            return card.controllerPlayerId == sourcePlayerId;
        }

        /// <summary>
        /// Can this creature be targeted by any spell/ability?
        /// </summary>
        public static bool CanBeTargeted(CardData card, int sourcePlayerId)
        {
            return CanBeTargetedByOpponent(card, sourcePlayerId);
        }

        public static string GetDisplayText() => "Bastion (Can't be the target of spells or abilities your opponents control.)";
    }
}