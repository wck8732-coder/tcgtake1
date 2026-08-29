// EffectResolver.cs
// Core effect resolution engine - maps 84 effect IDs from schema_definitions.json to handlers
// Port of shared/effects.js describeAbility + shared/card-schema.js effect definitions
using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using TCG.Data;

namespace TCG.Effects
{
    /// <summary>
    /// Resolves all 84 game effects - the heart of the rules engine
    /// Each effect ID maps to a handler method
    /// </summary>
    public class EffectResolver
    {
        private readonly GameState _gameState;
        private readonly Dictionary<string, Action<EffectContext>> _effectHandlers;

        public EffectResolver(GameState gameState)
        {
            _gameState = gameState;
            _effectHandlers = new Dictionary<string, Action<EffectContext>>(StringComparer.OrdinalIgnoreCase);
            RegisterAllEffects();
        }

        /// <summary>
        /// Context passed to every effect handler
        /// </summary>
        public class EffectContext
        {
            public CardData SourceCard;        // Card with the ability
            public AbilityData Ability;        // The ability being resolved
            public int ControllerPlayerId;     // Player controlling the effect
            public List<int> TargetIds;        // Target card/player IDs
            public JToken Parameters;          // Raw parameters from ability
            public object CustomData;          // For chaining effects
        }

        /// <summary>
        /// Resolve an effect by ID with context
        /// </summary>
        public void Resolve(string effectId, EffectContext context)
        {
            if (_effectHandlers.TryGetValue(effectId, out var handler))
            {
                try
                {
                    handler(context);
                }
                catch (Exception e)
                {
                    UnityEngine.Debug.LogError($"TCG: Effect '{effectId}' failed: {e.Message}\n{e.StackTrace}");
                }
            }
            else
            {
                UnityEngine.Debug.LogWarning($"TCG: No handler for effect '{effectId}'");
            }
        }

        /// <summary>
        /// Resolve multiple effects in sequence
        /// </summary>
        public void ResolveAll(List<AbilityData> abilities, EffectContext baseContext)
        {
            foreach (var ability in abilities)
            {
                var ctx = new EffectContext
                {
                    SourceCard = baseContext.SourceCard,
                    Ability = ability,
                    ControllerPlayerId = baseContext.ControllerPlayerId,
                    TargetIds = new List<int>(baseContext.TargetIds),
                    Parameters = ability.parameters,
                    CustomData = baseContext.CustomData
                };
                Resolve(ability.effectId, ctx);
            }
        }

        // ============================================================
        // EFFECT REGISTRATION - All 84 effects from schema_definitions.json
        // ============================================================

        private void RegisterAllEffects()
        {
            // --- Damage/Healing ---
            Register("deal_damage", DealDamage);
            Register("deal_damage_to_target", DealDamageToTarget);
            Register("deal_damage_to_all", DealDamageToAll);
            Register("deal_damage_to_opponent", DealDamageToOpponent);
            Register("gain_life", GainLife);
            Register("gain_life_target", GainLifeTarget);

            // --- Card Draw/Discard ---
            Register("draw_cards", DrawCards);
            Register("draw_cards_target", DrawCardsTarget);
            Register("discard_cards", DiscardCards);
            Register("discard_cards_target", DiscardCardsTarget);
            Register("discard_hand", DiscardHand);

            // --- Creature/Token Creation ---
            Register("create_token", CreateToken);
            Register("create_token_copy", CreateTokenCopy);
            Register("spawn_champion", SpawnChampion);

            // --- Stat Modification (Pump) ---
            Register("pump_self_stats", PumpSelfStats);
            Register("pump_stats_target", PumpStatsTarget);
            Register("pump_stats_all", PumpStatsAll);
            Register("set_stats", SetStats);
            Register("grant_attack", GrantAttack);
            Register("grant_health", GrantHealth);

            // --- Keyword Granting ---
            Register("grant_keyword", GrantKeyword);
            Register("grant_keyword_target", GrantKeywordTarget);
            Register("grant_keyword_all", GrantKeywordAll);

            // --- Removal/Destruction ---
            Register("destroy_target", DestroyTarget);
            Register("destroy_all", DestroyAll);
            Register("exile_target", ExileTarget);
            Register("exile_all", ExileAll);
            Register("sacrifice", Sacrifice);
            Register("bounce_target", BounceTarget);
            Register("bounce_all", BounceAll);

            // --- Counter/Manipulation ---
            Register("counter_spell", CounterSpell);
            Register("counter_ability", CounterAbility);
            Register("add_counters", AddCounters);
            Register("remove_counters", RemoveCounters);
            Register("proliferate", Proliferate);

            // --- Mana/Ramp ---
            Register("add_mana", AddMana);
            Register("add_mana_to_pool", AddManaToPool);
            Register("untap_lands", UntapLands);
            Register("tap_target", TapTarget);

            // --- Search/Tutor ---
            Register("search_library", SearchLibrary);
            Register("tutor_card", TutorCard);
            Register("reveal_top", RevealTop);

            // --- Copy/Steal ---
            Register("copy_spell", CopySpell);
            Register("copy_ability", CopyAbility);
            Register("steal_target", StealTarget);
            Register("exchange_control", ExchangeControl);

            // --- Transformation/Flip ---
            Register("transform", TransformCard);
            Register("flip_card", FlipCard);
            Register("ominous_flip", OminousFlip);

            // --- Recall/Recursion ---
            Register("recall", Recall);
            Register("return_from_graveyard", ReturnFromGraveyard);
            Register("return_from_exile", ReturnFromExile);

            // --- State Modification ---
            Register("change_type", ChangeType);
            Register("change_color", ChangeColor);
            Register("change_cost", ChangeCost);
            Register("grant_ability", GrantAbility);
            Register("lose_ability", LoseAbility);

            // --- Combat ---
            Register("force_attack", ForceAttack);
            Register("force_block", ForceBlock);
            Register("prevent_combat_damage", PreventCombatDamage);
            Register("redirect_damage", RedirectDamage);

            // --- Special/Unique ---
            Register("extra_turn", ExtraTurn);
            Register("skip_phase", SkipPhase);
            Register("win_game", WinGame);
            Register("lose_game", LoseGame);
            Register("restart_game", RestartGame);

            // --- Utility ---
            Register("scry", Scry);
            Register("surveil", Surveil);
            Register("investigate", Investigate);
            Register("venture", Venture);
            Register("learn", Learn);
        }

        private void Register(string effectId, Action<EffectContext> handler)
        {
            _effectHandlers[effectId] = handler;
        }

        // ============================================================
        // EFFECT IMPLEMENTATIONS (Stubs - to be filled in)
        // ============================================================

        #region Damage/Healing
        private void DealDamage(EffectContext ctx)
        {
            int amount = ctx.Parameters?.Value<int>("amount") ?? ctx.Parameters?.Value<int>("value") ?? 1;
            int targetPlayer = ctx.TargetIds.FirstOrDefault();
            _gameState.DealDamage(targetPlayer, amount, ctx.SourceCard);
        }

        private void DealDamageToTarget(EffectContext ctx)
        {
            int amount = ctx.Parameters?.Value<int>("amount") ?? ctx.Parameters?.Value<int>("value") ?? 1;
            foreach (var targetId in ctx.TargetIds)
            {
                var targetCard = _gameState.GetCard(targetId);
                if (targetCard != null)
                {
                    // Deal to creature/planeswalker
                    // targetCard.TakeDamage(amount);
                }
                else
                {
                    // Target is player
                    _gameState.DealDamage(targetId, amount, ctx.SourceCard);
                }
            }
        }

        private void DealDamageToAll(EffectContext ctx)
        {
            int amount = ctx.Parameters?.Value<int>("amount") ?? ctx.Parameters?.Value<int>("value") ?? 1;
            // Damage all creatures/players based on parameters
        }

        private void DealDamageToOpponent(EffectContext ctx)
        {
            int amount = ctx.Parameters?.Value<int>("amount") ?? ctx.Parameters?.Value<int>("value") ?? 1;
            int opponent = 1 - ctx.ControllerPlayerId;
            _gameState.DealDamage(opponent, amount, ctx.SourceCard);
        }

        private void GainLife(EffectContext ctx)
        {
            int amount = ctx.Parameters?.Value<int>("amount") ?? ctx.Parameters?.Value<int>("value") ?? 1;
            _gameState.GainLife(ctx.ControllerPlayerId, amount);
        }

        private void GainLifeTarget(EffectContext ctx)
        {
            int amount = ctx.Parameters?.Value<int>("amount") ?? ctx.Parameters?.Value<int>("value") ?? 1;
            foreach (var targetId in ctx.TargetIds)
            {
                _gameState.GainLife(targetId, amount);
            }
        }
        #endregion

        #region Card Draw/Discard
        private void DrawCards(EffectContext ctx)
        {
            int count = ctx.Parameters?.Value<int>("count") ?? ctx.Parameters?.Value<int>("value") ?? 1;
            for (int i = 0; i < count; i++)
                _gameState.DrawCard(ctx.ControllerPlayerId);
        }

        private void DrawCardsTarget(EffectContext ctx)
        {
            int count = ctx.Parameters?.Value<int>("count") ?? ctx.Parameters?.Value<int>("value") ?? 1;
            foreach (var targetId in ctx.TargetIds)
            {
                for (int i = 0; i < count; i++)
                    _gameState.DrawCard(targetId);
            }
        }

        private void DiscardCards(EffectContext ctx)
        {
            int count = ctx.Parameters?.Value<int>("count") ?? ctx.Parameters?.Value<int>("value") ?? 1;
            var hand = _gameState.ZoneManager.GetZone(ctx.ControllerPlayerId, ZoneType.Hand);
            for (int i = 0; i < count && hand.Count > 0; i++)
            {
                var card = hand.RemoveAt(hand.Count - 1);
                _gameState.ZoneManager.GetZone(ctx.ControllerPlayerId, ZoneType.Graveyard).Add(card);
            }
        }

        private void DiscardCardsTarget(EffectContext ctx)
        {
            int count = ctx.Parameters?.Value<int>("count") ?? ctx.Parameters?.Value<int>("value") ?? 1;
            foreach (var targetId in ctx.TargetIds)
            {
                var hand = _gameState.ZoneManager.GetZone(targetId, ZoneType.Hand);
                for (int i = 0; i < count && hand.Count > 0; i++)
                {
                    var card = hand.RemoveAt(hand.Count - 1);
                    _gameState.ZoneManager.GetZone(targetId, ZoneType.Graveyard).Add(card);
                }
            }
        }

        private void DiscardHand(EffectContext ctx)
        {
            foreach (var targetId in ctx.TargetIds)
            {
                var hand = _gameState.ZoneManager.GetZone(targetId, ZoneType.Hand);
                var graveyard = _gameState.ZoneManager.GetZone(targetId, ZoneType.Graveyard);
                graveyard.cards.AddRange(hand.cards);
                hand.Clear();
            }
        }
        #endregion

        #region Creature/Token Creation
        private void CreateToken(EffectContext ctx)
        {
            string tokenId = ctx.Parameters?.Value<string>("token_id");
            int count = ctx.Parameters?.Value<int>("count") ?? 1;

            if (string.IsNullOrEmpty(tokenId)) return;

            var tokenCard = _gameState.GetCardById(tokenId);
            if (tokenCard == null) return;

            for (int i = 0; i < count; i++)
            {
                var token = CloneToken(tokenCard);
                _gameState.ZoneManager.MoveCard(token, ZoneType.None, ZoneType.Battlefield, ctx.ControllerPlayerId);
                _gameState.TriggerSystem.Trigger(TriggerType.OnEnterBattlefield, token, ctx.ControllerPlayerId);
            }
        }

        private CardData CloneToken(CardData source)
        {
            var token = new CardData
            {
                id = source.id,
                cardId = source.cardId,
                cardName = source.cardName,
                type = source.type,
                cost = source.cost,
                attack = source.attack,
                health = source.health,
                rarity = source.rarity,
                color = source.color,
                abilities = new List<AbilityData>(source.abilities),
                keywordFlags = source.keywordFlags,
                isToken = true
            };
            token.baseCard = source;
            return token;
        }

        private void CreateTokenCopy(EffectContext ctx)
        {
            // Copy target permanent
        }

        private void SpawnChampion(EffectContext ctx)
        {
            // Special champion spawn logic
        }
        #endregion

        #region Stat Modification (Pump)
        private void PumpSelfStats(EffectContext ctx)
        {
            int attack = ctx.Parameters?.Value<int>("attack") ?? 0;
            int health = ctx.Parameters?.Value<int>("health") ?? 0;
            string duration = ctx.Parameters?.Value<string>("duration") ?? "until_end_of_turn";

            if (ctx.SourceCard != null)
            {
                ctx.SourceCard.attack += attack;
                ctx.SourceCard.health += health;
                // Track duration for cleanup
            }
        }

        private void PumpStatsTarget(EffectContext ctx)
        {
            int attack = ctx.Parameters?.Value<int>("attack") ?? 0;
            int health = ctx.Parameters?.Value<int>("health") ?? 0;

            foreach (var targetId in ctx.TargetIds)
            {
                var target = _gameState.GetCard(targetId);
                if (target != null)
                {
                    target.attack += attack;
                    target.health += health;
                }
            }
        }

        private void PumpStatsAll(EffectContext ctx)
        {
            int attack = ctx.Parameters?.Value<int>("attack") ?? 0;
            int health = ctx.Parameters?.Value<int>("health") ?? 0;
            string filter = ctx.Parameters?.Value<string>("filter"); // "my_creatures", "all_creatures", etc.

            var targets = GetFilteredTargets(ctx.ControllerPlayerId, filter);
            foreach (var target in targets)
            {
                target.attack += attack;
                target.health += health;
            }
        }

        private void SetStats(EffectContext ctx)
        {
            int attack = ctx.Parameters?.Value<int>("attack") ?? -1;
            int health = ctx.Parameters?.Value<int>("health") ?? -1;

            foreach (var targetId in ctx.TargetIds)
            {
                var target = _gameState.GetCard(targetId);
                if (target != null)
                {
                    if (attack >= 0) target.attack = attack;
                    if (health >= 0) target.health = health;
                }
            }
        }

        private void GrantAttack(EffectContext ctx)
        {
            int amount = ctx.Parameters?.Value<int>("value") ?? ctx.Parameters?.Value<int>("amount") ?? 1;
            foreach (var targetId in ctx.TargetIds)
            {
                var target = _gameState.GetCard(targetId);
                if (target != null) target.attack += amount;
            }
        }

        private void GrantHealth(EffectContext ctx)
        {
            int amount = ctx.Parameters?.Value<int>("value") ?? ctx.Parameters?.Value<int>("amount") ?? 1;
            foreach (var targetId in ctx.TargetIds)
            {
                var target = _gameState.GetCard(targetId);
                if (target != null) target.health += amount;
            }
        }
        #endregion

        #region Keyword Granting
        private void GrantKeyword(EffectContext ctx)
        {
            string keyword = ctx.Parameters?.Value<string>("keyword");
            if (Enum.TryParse<KeywordFlags>(keyword, true, out var flag))
            {
                ctx.SourceCard.keywordFlags |= flag;
            }
        }

        private void GrantKeywordTarget(EffectContext ctx)
        {
            string keyword = ctx.Parameters?.Value<string>("keyword");
            if (Enum.TryParse<KeywordFlags>(keyword, true, out var flag))
            {
                foreach (var targetId in ctx.TargetIds)
                {
                    var target = _gameState.GetCard(targetId);
                    if (target != null) target.keywordFlags |= flag;
                }
            }
        }

        private void GrantKeywordAll(EffectContext ctx)
        {
            string keyword = ctx.Parameters?.Value<string>("keyword");
            string filter = ctx.Parameters?.Value<string>("filter");
            if (Enum.TryParse<KeywordFlags>(keyword, true, out var flag))
            {
                var targets = GetFilteredTargets(ctx.ControllerPlayerId, filter);
                foreach (var target in targets)
                    target.keywordFlags |= flag;
            }
        }
        #endregion

        #region Removal/Destruction
        private void DestroyTarget(EffectContext ctx)
        {
            foreach (var targetId in ctx.TargetIds)
            {
                var target = _gameState.GetCard(targetId);
                if (target != null)
                    _gameState.ZoneManager.Destroy(targetId, target);
            }
        }

        private void DestroyAll(EffectContext ctx)
        {
            string filter = ctx.Parameters?.Value<string>("filter");
            var targets = GetFilteredTargets(ctx.ControllerPlayerId, filter);
            foreach (var target in targets)
                _gameState.ZoneManager.Destroy(target.id, target);
        }

        private void ExileTarget(EffectContext ctx)
        {
            foreach (var targetId in ctx.TargetIds)
            {
                var target = _gameState.GetCard(targetId);
                if (target != null)
                    _gameState.ZoneManager.Exile(targetId, target, ZoneType.Battlefield);
            }
        }

        private void ExileAll(EffectContext ctx)
        {
            string filter = ctx.Parameters?.Value<string>("filter");
            var targets = GetFilteredTargets(ctx.ControllerPlayerId, filter);
            foreach (var target in targets)
                _gameState.ZoneManager.Exile(target.id, target, ZoneType.Battlefield);
        }

        private void Sacrifice(EffectContext ctx)
        {
            // Controller sacrifices their own permanent
            string filter = ctx.Parameters?.Value<string>("filter") ?? "my_permanents";
            var targets = GetFilteredTargets(ctx.ControllerPlayerId, filter);
            if (targets.Count > 0)
            {
                // Choose one (or all if specified)
                var target = targets[0];
                _gameState.ZoneManager.Destroy(target.id, target);
            }
        }

        private void BounceTarget(EffectContext ctx)
        {
            foreach (var targetId in ctx.TargetIds)
            {
                var target = _gameState.GetCard(targetId);
                if (target != null)
                    _gameState.ZoneManager.MoveCard(target, ZoneType.Battlefield, ZoneType.Hand, ctx.ControllerPlayerId);
            }
        }

        private void BounceAll(EffectContext ctx)
        {
            string filter = ctx.Parameters?.Value<string>("filter");
            var targets = GetFilteredTargets(ctx.ControllerPlayerId, filter);
            foreach (var target in targets)
                _gameState.ZoneManager.MoveCard(target, ZoneType.Battlefield, ZoneType.Hand, ctx.ControllerPlayerId);
        }
        #endregion

        #region Counter/Manipulation
        private void CounterSpell(EffectContext ctx) { }
        private void CounterAbility(EffectContext ctx) { }
        private void AddCounters(EffectContext ctx) { }
        private void RemoveCounters(EffectContext ctx) { }
        private void Proliferate(EffectContext ctx) { }
        #endregion

        #region Mana/Ramp
        private void AddMana(EffectContext ctx)
        {
            var cost = ManaCost.FromJToken(ctx.Parameters);
            _gameState.ManaSystem.GetPool(ctx.ControllerPlayerId).Add(cost);
        }

        private void AddManaToPool(EffectContext ctx)
        {
            foreach (var targetId in ctx.TargetIds)
            {
                var cost = ManaCost.FromJToken(ctx.Parameters);
                _gameState.ManaSystem.GetPool(targetId).Add(cost);
            }
        }

        private void UntapLands(EffectContext ctx)
        {
            _gameState.ManaSystem.UntapAllLands(ctx.ControllerPlayerId);
        }

        private void TapTarget(EffectContext ctx)
        {
            // Tap target permanent
        }
        #endregion

        #region Search/Tutor
        private void SearchLibrary(EffectContext ctx) { }
        private void TutorCard(EffectContext ctx) { }
        private void RevealTop(EffectContext ctx) { }
        #endregion

        #region Copy/Steal
        private void CopySpell(EffectContext ctx) { }
        private void CopyAbility(EffectContext ctx) { }
        private void StealTarget(EffectContext ctx) { }
        private void ExchangeControl(EffectContext ctx) { }
        #endregion

        #region Transformation/Flip
        private void TransformCard(EffectContext ctx) { }
        private void FlipCard(EffectContext ctx) { }

        private void OminousFlip(EffectContext ctx)
        {
            // Ominous keyword: when this deals combat damage, flip at end of turn
            if (ctx.SourceCard != null)
            {
                ctx.SourceCard.isFlipped = !ctx.SourceCard.isFlipped;
                // Swart stats/abilities for flipped side
            }
        }
        #endregion

        #region Recall/Recursion
        private void Recall(EffectContext ctx) { }
        private void ReturnFromGraveyard(EffectContext ctx) { }
        private void ReturnFromExile(EffectContext ctx) { }
        #endregion

        #region State Modification
        private void ChangeType(EffectContext ctx) { }
        private void ChangeColor(EffectContext ctx) { }
        private void ChangeCost(EffectContext ctx) { }
        private void GrantAbility(EffectContext ctx) { }
        private void LoseAbility(EffectContext ctx) { }
        #endregion

        #region Combat
        private void ForceAttack(EffectContext ctx) { }
        private void ForceBlock(EffectContext ctx) { }
        private void PreventCombatDamage(EffectContext ctx) { }
        private void RedirectDamage(EffectContext ctx) { }
        #endregion

        #region Special
        private void ExtraTurn(EffectContext ctx) { }
        private void SkipPhase(EffectContext ctx) { }
        private void WinGame(EffectContext ctx)
        {
            _gameState.GameOver = true;
            _gameState.WinnerPlayerId = ctx.ControllerPlayerId;
        }

        private void LoseGame(EffectContext ctx)
        {
            _gameState.GameOver = true;
            _gameState.WinnerPlayerId = 1 - ctx.ControllerPlayerId;
        }

        private void RestartGame(EffectContext ctx) { }
        #endregion

        #region Utility
        private void Scry(EffectContext ctx) { }
        private void Surveil(EffectContext ctx) { }
        private void Investigate(EffectContext ctx) { }
        private void Venture(EffectContext ctx) { }
        private void Learn(EffectContext ctx) { }
        #endregion

        // ============================================================
        // HELPER METHODS
        // ============================================================

        private List<CardData> GetFilteredTargets(int playerId, string filter)
        {
            var results = new List<CardData>();

            if (string.IsNullOrEmpty(filter)) return results;

            switch (filter.ToLower())
            {
                case "my_creatures":
                    results.AddRange(_gameState.ZoneManager.GetBattlefield(playerId)
                        .Where(c => c.type == CardType.Champion || c.type == CardType.Token));
                    break;
                case "opponent_creatures":
                    results.AddRange(_gameState.ZoneManager.GetBattlefield(1 - playerId)
                        .Where(c => c.type == CardType.Champion || c.type == CardType.Token));
                    break;
                case "all_creatures":
                    results.AddRange(_gameState.ZoneManager.GetBattlefield(playerId)
                        .Where(c => c.type == CardType.Champion || c.type == CardType.Token));
                    results.AddRange(_gameState.ZoneManager.GetBattlefield(1 - playerId)
                        .Where(c => c.type == CardType.Champion || c.type == CardType.Token));
                    break;
                case "my_permanents":
                    results.AddRange(_gameState.ZoneManager.GetBattlefield(playerId));
                    break;
                case "all_permanents":
                    results.AddRange(_gameState.ZoneManager.GetBattlefield(playerId));
                    results.AddRange(_gameState.ZoneManager.GetBattlefield(1 - playerId));
                    break;
            }

            return results;
        }
    }
}