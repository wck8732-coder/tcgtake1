// KeywordBehaviours/SwiftstrikeBehaviour.cs
// Swiftstrike: This creature deals combat damage before creatures without Swiftstrike
// (First Strike equivalent)
using TCG.Data;

namespace TCG.Effects.KeywordBehaviours
{
    public static class SwiftstrikeBehaviour
    {
        public const string KeywordName = "Swiftstrike";
        public const KeywordFlags Flag = KeywordFlags.Swiftstrike;

        /// <summary>
        /// Check if a creature has Swiftstrike
        /// </summary>
        public static bool HasSwiftstrike(CardData card) => card.HasKeyword(Flag);

        /// <summary>
        /// Determine combat damage step order
        /// Returns true if this creature deals damage in the first strike damage step
        /// </summary>
        public static bool DealsFirstStrikeDamage(CardData card) => HasSwiftstrike(card);

        /// <summary>
        /// Get display text for this keyword
        /// </summary>
        public static string GetDisplayText() => "Swiftstrike (Deals combat damage before creatures without Swiftstrike.)";
    }
}