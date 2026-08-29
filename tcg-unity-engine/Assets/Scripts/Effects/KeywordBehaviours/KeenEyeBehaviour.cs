// KeywordBehaviours/KeenEyeBehaviour.cs
// Keen Eye: This creature can block creatures with Flying
// (Reach equivalent)
using TCG.Data;

namespace TCG.Effects.KeywordBehaviours
{
    public static class KeenEyeBehaviour
    {
        public const string KeywordName = "Keen Eye";
        public const KeywordFlags Flag = KeywordFlags.KeenEye;

        public static bool HasKeenEye(CardData card) => card.HasKeyword(Flag);

        /// <summary>
        /// Can this creature block flying creatures?
        /// </summary>
        public static bool CanBlockFlying(CardData card) => HasKeenEye(card) || card.HasKeyword(KeywordFlags.Flying);

        public static string GetDisplayText() => "Keen Eye (Can block creatures with Flying.)";
    }
}