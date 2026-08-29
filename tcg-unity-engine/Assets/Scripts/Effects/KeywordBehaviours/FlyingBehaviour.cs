// KeywordBehaviours/FlyingBehaviour.cs
// Flying: This creature can only be blocked by creatures with Flying or Keen Eye
using TCG.Data;

namespace TCG.Effects.KeywordBehaviours
{
    public static class FlyingBehaviour
    {
        public const string KeywordName = "Flying";
        public const KeywordFlags Flag = KeywordFlags.Flying;

        public static bool HasFlying(CardData card) => card.HasKeyword(Flag);

        /// <summary>
        /// Can the given blocker block this flying creature?
        /// </summary>
        public static bool CanBeBlockedBy(CardData attacker, CardData blocker)
        {
            if (!HasFlying(attacker)) return true; // Non-flying can be blocked by anything
            return blocker.HasKeyword(KeywordFlags.Flying) || blocker.HasKeyword(KeywordFlags.KeenEye);
        }

        public static string GetDisplayText() => "Flying (Can only be blocked by creatures with Flying or Keen Eye.)";
    }
}