// KeywordBehaviours/OverrunBehaviour.cs
// Overrun: This creature's excess combat damage is dealt to the defending player
// (Trample equivalent)
using TCG.Data;

namespace TCG.Effects.KeywordBehaviours
{
    public static class OverrunBehaviour
    {
        public const string KeywordName = "Overrun";
        public const KeywordFlags Flag = KeywordFlags.Overrun;

        public static bool HasOverrun(CardData card) => card.HasKeyword(Flag);

        /// <summary>
        /// Calculate trample damage assignment
        /// Returns (damageToBlocker, damageToPlayer)
        /// </summary>
        public static (int blockerDamage, int playerDamage) AssignTrampleDamage(
            CardData attacker, 
            CardData blocker, 
            int totalDamage)
        {
            if (!HasOverrun(attacker) || blocker == null)
                return (totalDamage, 0);

            int lethalDamage = blocker.health - blocker.damageMarked; // damage already marked this turn
            if (lethalDamage < 0) lethalDamage = 0;

            int damageToBlocker = Math.Min(totalDamage, lethalDamage);
            int damageToPlayer = totalDamage - damageToBlocker;

            return (damageToBlocker, damageToPlayer);
        }

        public static string GetDisplayText() => "Overrun (Excess combat damage is dealt to the defending player.)";
    }
}