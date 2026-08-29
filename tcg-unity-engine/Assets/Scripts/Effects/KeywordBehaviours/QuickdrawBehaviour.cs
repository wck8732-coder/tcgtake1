// KeywordBehaviours/QuickdrawBehaviour.cs
// Quickdraw: This creature can attack and block the turn it enters the battlefield
// (Haste equivalent)
using TCG.Data;

namespace TCG.Effects.KeywordBehaviours
{
    public static class QuickdrawBehaviour
    {
        public const string KeywordName = "Quickdraw";
        public const KeywordFlags Flag = KeywordFlags.Quickdraw;

        public static bool HasQuickdraw(CardData card) => card.HasKeyword(Flag);

        /// <summary>
        /// Can this creature attack immediately (ignoring summoning sickness)?
        /// </summary>
        public static bool CanAttackImmediately(CardData card) => HasQuickdraw(card);

        /// <summary>
        /// Can this creature block immediately?
        /// </summary>
        public static bool CanBlockImmediately(CardData card) => HasQuickdraw(card);

        public static string GetDisplayText() => "Quickdraw (Can attack and block the turn it enters the battlefield.)";
    }
}