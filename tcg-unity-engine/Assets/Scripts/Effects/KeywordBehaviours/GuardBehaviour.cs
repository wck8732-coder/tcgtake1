// KeywordBehaviours/GuardBehaviour.cs
// Guard: This creature must be blocked if able, and can block an additional creature
// (Vigilance + must-block equivalent)
using TCG.Data;

namespace TCG.Effects.KeywordBehaviours
{
    public static class GuardBehaviour
    {
        public const string KeywordName = "Guard";
        public const KeywordFlags Flag = KeywordFlags.Guard;

        public static bool HasGuard(CardData card) => card.HasKeyword(Flag);

        /// <summary>
        /// Does this creature require a block if able?
        /// </summary>
        public static bool MustBeBlocked(CardData card) => HasGuard(card);

        /// <summary>
        /// Can this creature block an additional creature? (Standard rules: one blocker per attacker, but Guard allows 2)
        /// </summary>
        public static int MaxBlocks(CardData card) => HasGuard(card) ? 2 : 1;

        /// <summary>
        /// Does this creature tap to attack? (Vigilance = doesn't tap)
        /// </summary>
        public static bool TapsToAttack(CardData card) => !HasGuard(card);

        public static string GetDisplayText() => "Guard (Must be blocked if able. Can block an additional creature. Does not tap to attack.)";
    }
}