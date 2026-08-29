// KeywordBehaviours/DeathshroudBehaviour.cs
// Deathshroud: This creature cannot be destroyed by damage or effects that say "destroy"
// (Indestructible equivalent)
using TCG.Data;

namespace TCG.Effects.KeywordBehaviours
{
    public static class DeathshroudBehaviour
    {
        public const string KeywordName = "Deathshroud";
        public const KeywordFlags Flag = KeywordFlags.Deathshroud;

        public static bool HasDeathshroud(CardData card) => card.HasKeyword(Flag);

        /// <summary>
        /// Can this creature be destroyed by damage or "destroy" effects?
        /// </summary>
        public static bool CanBeDestroyed(CardData card) => !HasDeathshroud(card);

        /// <summary>
        /// Check if creature dies from lethal damage (state-based action)
        /// </summary>
        public static bool DiesFromDamage(CardData card)
        {
            if (HasDeathshroud(card)) return false;
            return card.health <= 0;
        }

        public static string GetDisplayText() => "Deathshroud (Cannot be destroyed by damage or effects that say \"destroy\".)";
    }
}