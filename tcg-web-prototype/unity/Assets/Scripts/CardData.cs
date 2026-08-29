// CardData.cs
// Unity POCO matching the LIVE card_database.json schema (v0.1042, 480 cards).
// Generated from: node build-unity-cards.js  (reads root card_database.json).
// Requires UPM package: com.unity.nuget.newtonsoft-json
using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace TCG
{
    // Mana cost may be a flat int (lands: 0) or an object {color,generic} (v0.1042 normalized).
    // Kept as JToken so both forms deserialize without loss; parsed lazily via CostSystem.
    [Serializable]
    public class CardData
    {
        public int id;
        public string name;
        public string type;          // Champion | Spell | Instant | Decree | Relic | Domain | Omen | Land
        public JToken cost;          // int(0) for lands, or {color,generic} for spells
        public int? power;           // null for non-champions
        public int? toughness;       // null for non-champions
        public int? providesMana;    // null for non-lands (v0.1042 normalized providesMana:null)
        public string color;         // Crimson | Sunforged | Lantern | Gilded | Colorless | Zealot
        public string rarity;        // Common | Uncommon | Rare | Mythic | Legendary
        public List<JToken> abilities; // mixed: string keywords ("Ominous") + JObjects ({name,trigger,effect,...})
        public string flipTrigger;
        public JToken flipCost;
        public JToken faceDownCost;
        public string keywords;

        public static string GetColorHex(string color)
        {
            switch (color)
            {
                case "Crimson":   return "#c0392b";
                case "Sunforged": return "#27ae60";
                case "Lantern":   return "#000000";
                case "Gilded":    return "#2980b9";
                case "Colorless": return "#95a5a6";
                case "Zealot":    return "#f1c40f";
                default:          return "#555555";
            }
        }

        public bool IsChampion => type == "Champion";
        public bool IsLand      => type == "Land";
        public bool IsOmen      => type == "Omen";
        public bool IsLegendary => rarity == "Legendary";

        // Lazy keyword extraction; mirrors shared/keywords.js getKeywords
        public List<string> GetStringKeywords()
        {
            var kw = new List<string>();
            if (abilities == null) return kw;
            foreach (var a in abilities)
                if (a.Type == JTokenType.String) kw.Add(a.Value<string>());
            if (!string.IsNullOrEmpty(keywords)) kw.AddRange(keywords.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries));
            return kw;
        }
    }

    [Serializable]
    public class CardMetadata
    {
        public string source;
        public int card_count;
        public List<string> factions;
        public string schema_version;
        public string build_target;
    }

    // Wrapper matching the unity/data/tcgtake1_cards.json layout.
    [Serializable]
    public class CardDatabase
    {
        public CardMetadata metadata;
        public List<CardData> cards;
    }
}
