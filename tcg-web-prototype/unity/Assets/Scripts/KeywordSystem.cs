// KeywordSystem.cs  (PREPARATION STUB)
// Port target: shared/keywords.js (getKeywords interpreter).
// Keywords are STRING abilities resolved at runtime. Port list (v0.1042):
//   Swiftstrike, Quickdraw, Keen Eye, Overrun, Deathshroud, Siphon, Flying,
//   Intimidate, Guard, Bastion, Recall N, Ominous.
using System.Collections.Generic;
using UnityEngine;

namespace TCG.Engine
{
    public static class KeywordSystem
    {
        public static List<string> GetKeywords(CardData card)
        {
            // TODO: port getKeywords — resolve "Recall N" charge values, Ominous flag,
            //       and string-ability triggers. Currently delegates to CardData.GetStringKeywords().
            return card.GetStringKeywords();
        }
    }

    public enum Keyword { Swiftstrike, Quickdraw, KeenEye, Overrun, Deathshroud, Siphon, Flying, Intimidate, Guard, Bastion, Ominous }
}
