// KeywordBehaviours/IntimidateBehaviour.cs
// Intimidate: This creature can only be blocked by creatures that share a color with it or are colorless
// (Menace/Fear hybrid equivalent)
using TCG.Data;

namespace TCG.Effects.KeywordBehaviours
{
    public static class IntimidateBehaviour
    {
        public const string KeywordName = "Intimidate";
        public const KeywordFlags Flag = KeywordFlags.Intimidate;

        public static bool HasIntimidate(CardData card) => card.HasKeyword(Flag);

        /// <summary>
        /// Can the given blocker block this intimidating creature?
        /// </summary>
        public static bool CanBeBlockedBy(CardData attacker, CardData blocker)
        {
            if (!HasIntimidate(attacker)) return true;

            // Blocker must share a color OR be colorless (artifact)
            if (string.IsNullOrEmpty(blocker.color)) return true; // Colorless/artifact
            return blocker.color == attacker.color;
        }

        public static string GetDisplayText() => "Intimidate (Can only be blocked by creatures that share a color with it or are colorless.)";
    }
}