using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace TCG.Data
{
    /// <summary>
    /// Card type enumeration matching schema_definitions.json
    /// </summary>
    public enum CardType
    {
        None = 0,
        Champion = 1,
        Decree = 2,
        Land = 3,
        Enchantment = 4,
        Relic = 5,
        Token = 6
    }

    /// <summary>
    /// Rarity enumeration matching schema_definitions.json
    /// </summary>
    public enum Rarity
    {
        Common = 0,
        Uncommon = 1,
        Rare = 2,
        Mythic = 3,
        Token = 4,
        Special = 5
    }

    /// <summary>
    /// Trigger types for abilities (from shared/card-schema.js)
    /// </summary>
    public enum TriggerType
    {
        None = 0,
        OnCast = 1,
        OnEnterBattlefield = 2,
        OnLeaveBattlefield = 3,
        OnCombatDamage = 4,
        OnGainLife = 5,
        OnLoseLife = 6,
        OnDrawCard = 7,
        OnDiscard = 8,
        OnTurnStart = 9,
        OnTurnEnd = 10,
        OnUntap = 11,
        OnAttack = 12,
        OnBlock = 13,
        OnDeath = 14,
        OnSacrifice = 15,
        OnTarget = 16,
        OnSpellCast = 17,
        OnAbilityActivated = 18,
        OnManaTap = 19,
        OnPhaseChange = 20,
        EndOfTurn = 21,
        BeginningOfTurn = 22,
        MainPhase = 23,
        CombatPhase = 24,
        Instant = 25
    }

    /// <summary>
    /// Zone enumeration for card locations
    /// </summary>
    public enum Zone
    {
        Library = 0,
        Hand = 1,
        Battlefield = 2,
        Graveyard = 3,
        Exile = 4,
        Command = 5,
        Stack = 6,
        Sideboard = 7
    }

    /// <summary>
    /// Ability data structure matching the 84 effects from schema_definitions.json
    /// </summary>
    [Serializable]
    public class AbilityData
    {
        public string effectId;           // e.g., "pump_self_stats", "draw_cards"
        public JToken parameters;         // flexible params per effect
        public TriggerType trigger;       // when this ability triggers
        public string textPatch;          // optional authored display override (from build-cards.js)
        public bool isKeyword;            // true if this is a keyword ability
        public string keywordName;        // if isKeyword: "Swiftstrike", "Ominous", etc.
    }

    /// <summary>
    /// Mana cost structure matching shared/cost-utils.js format
    /// int 0 = land (free), or {color, generic} object for spells
    /// </summary>
    [Serializable]
    public class ManaCost
    {
        public string color;      // "W", "U", "B", "R", "G", "C" (colorless), or null for land
        public int generic;       // generic mana cost
        public bool isLand;       // true if cost == 0 (land)

        public static ManaCost FromJToken(JToken token)
        {
            if (token == null || token.Type == JTokenType.Integer && token.Value<int>() == 0)
                return new ManaCost { isLand = true, color = null, generic = 0 };

            if (token.Type == JTokenType.Object)
            {
                return new ManaCost
                {
                    isLand = false,
                    color = token["color"]?.Value<string>(),
                    generic = token["generic"]?.Value<int>() ?? 0
                };
            }

            // Fallback: integer generic cost
            return new ManaCost
            {
                isLand = false,
                color = null,
                generic = token.Value<int>()
            };
        }

        public int TotalValue => isLand ? 0 : generic + (string.IsNullOrEmpty(color) ? 0 : 1);
        public override string ToString() => isLand ? "Land" : $"{color}{generic}";
    }

    /// <summary>
    /// Keyword flags as bitmask (12 keywords from shared/keywords.js)
    /// </summary>
    [Flags]
    public enum KeywordFlags : uint
    {
        None = 0,
        Swiftstrike = 1 << 0,      // deals damage first
        Quickdraw = 1 << 1,        // attacks/blocks immediately
        KeenEye = 1 << 2,          // can target flying
        Overrun = 1 << 3,          // trample
        Deathshroud = 1 << 4,      // indestructible/regenerate
        Siphon = 1 << 5,           // lifelink
        Flying = 1 << 6,           // flying
        Intimidate = 1 << 7,       // menace/fear
        Guard = 1 << 8,            // defender/vigilance
        Bastion = 1 << 9,          // hexproof/ward
        Recall = 1 << 10,          // recall N (charge-based return)
        Ominous = 1 << 11          // flip on damage at end of turn
    }

    /// <summary>
    /// Complete card data matching card_database.json (480 cards)
    /// Mirrors the structure from shared/card-schema.js and build-cards.js
    /// </summary>
    [Serializable]
    public class CardData
    {
        public int id;                      // unique card ID
        public string cardId;               // stable string ID (e.g., "press_the_advance")
        public string cardName;             // display name
        public CardType type;               // Champion, Decree, Land, etc.
        public ManaCost cost;               // mana cost (land = 0, spell = {color, generic})
        public int attack;                  // base attack (champions/relics)
        public int health;                  // base health (champions)
        public int loyalty;                 // loyalty (for planeswalker-type)
        public Rarity rarity;               // rarity tier
        public string color;                // faction/color identity
        public List<AbilityData> abilities; // all abilities (keywords + effects)
        public KeywordFlags keywordFlags;   // bitmask for fast checks
        public string artKey;               // artwork reference key
        public string flavorText;           // flavor text
        public string textPatch;            // authored full card text override (from build-cards.js)
        public bool isToken;                // true if token card
        public int tokenCopies;             // how many tokens this creates

        // Runtime helpers (not serialized)
        [NonSerialized] public CardData baseCard;  // for tokens: reference to creator
        [NonSerialized] public bool isFlipped;     // for Ominous flip state
        [NonSerialized] public int recallCharges;  // for Recall N keyword

        /// <summary>
        /// Get keyword list for display (ports shared/keywords.js getKeywords)
        /// </summary>
        public List<string> GetStringKeywords()
        {
            var keywords = new List<string>();
            if ((keywordFlags & KeywordFlags.Swiftstrike) != 0) keywords.Add("Swiftstrike");
            if ((keywordFlags & KeywordFlags.Quickdraw) != 0) keywords.Add("Quickdraw");
            if ((keywordFlags & KeywordFlags.KeenEye) != 0) keywords.Add("Keen Eye");
            if ((keywordFlags & KeywordFlags.Overrun) != 0) keywords.Add("Overrun");
            if ((keywordFlags & KeywordFlags.Deathshroud) != 0) keywords.Add("Deathshroud");
            if ((keywordFlags & KeywordFlags.Siphon) != 0) keywords.Add("Siphon");
            if ((keywordFlags & KeywordFlags.Flying) != 0) keywords.Add("Flying");
            if ((keywordFlags & KeywordFlags.Intimidate) != 0) keywords.Add("Intimidate");
            if ((keywordFlags & KeywordFlags.Guard) != 0) keywords.Add("Guard");
            if ((keywordFlags & KeywordFlags.Bastion) != 0) keywords.Add("Bastion");
            if ((keywordFlags & KeywordFlags.Recall) != 0) keywords.Add($"Recall {recallCharges}");
            if ((keywordFlags & KeywordFlags.Ominous) != 0) keywords.Add("Ominous");
            return keywords;
        }

        /// <summary>
        /// Check if card has a specific keyword
        /// </summary>
        public bool HasKeyword(KeywordFlags flag) => (keywordFlags & flag) != 0;

        /// <summary>
        /// Get total mana value for sorting/display
        /// </summary>
        public int ManaValue => cost?.TotalValue ?? 0;
    }

    /// <summary>
    /// Database wrapper matching build-unity-cards.js output format
    /// </summary>
    [Serializable]
    public class CardDatabase
    {
        public DatabaseMetadata metadata;
        public List<CardData> cards;

        public CardDatabase()
        {
            cards = new List<CardData>();
            metadata = new DatabaseMetadata();
        }
    }

    [Serializable]
    public class DatabaseMetadata
    {
        public string source;
        public int card_count;
        public List<string> factions;
        public Dictionary<string, int> rarity_counts;
        public string schema_version;
        public string build_target;
        public string generated_at;
    }

    /// <summary>
    /// Deck definition matching decks.json v0.1045 format
    /// { formats: { Classic: { decks: [...] }, Standard: { decks: [...] } } }
    /// </summary>
    [Serializable]
    public class DeckFormat
    {
        public List<DeckDefinition> decks;
    }

    [Serializable]
    public class DeckDefinition
    {
        public string name;
        public string description;
        public List<int> cards;           // card IDs (max 4 copies each)
        public int minSize = 70;          // Classic: 70 min
        public Dictionary<string, int> rarityCaps; // Standard: per-rarity limits
    }

    [Serializable]
    public class DecksDatabase
    {
        public Dictionary<string, DeckFormat> formats; // "Classic", "Standard"
    }
}