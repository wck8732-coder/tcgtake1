// KeywordBehaviours/SiphonBehaviour.cs
// Siphon: Damage dealt by this creature also causes you to gain that much life
// (Lifelink equivalent)
using TCG.Data;

namespace TCG.Effects.KeywordBehaviours
{
    public static class SiphonBehaviour
    {
        public const string KeywordName = "Siphon";
        public const KeywordFlags Flag = KeywordFlags.Siphon;

        public static bool HasSiphon(CardData card) => card.HasKeyword(Flag);

        /// <summary>
        /// Trigger life gain when this creature deals damage
        /// </summary>
        public static void OnDamageDealt(CardData source, int damage, int controllerPlayerId, GameState gameState)
        {
            if (HasSiphon(source) && damage > 0)
            {
                gameState.GainLife(controllerPlayerId, damage);
            }
        }

        public static string GetDisplayText() => "Siphon (Damage dealt by this creature also causes you to gain that much life.)";
    }
}