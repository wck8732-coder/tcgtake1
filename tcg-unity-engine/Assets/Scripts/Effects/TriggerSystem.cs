// TriggerSystem.cs
// Event bus for keyword triggers and game events
// Port of shared/keywords.js trigger handling + simulate.js trigger resolution
using System;
using System.Collections.Generic;
using TCG.Data;

namespace TCG.Effects
{
    /// <summary>
    /// Central trigger system - handles all "when/whenever/at" abilities
    /// </summary>
    public class TriggerSystem
    {
        private readonly GameState _gameState;
        private readonly Dictionary<TriggerType, List<TriggerSubscription>> _subscriptions;

        public TriggerSystem(GameState gameState)
        {
            _gameState = gameState;
            _subscriptions = new Dictionary<TriggerType, List<TriggerSubscription>>();
            foreach (TriggerType type in Enum.GetValues(typeof(TriggerType)))
            {
                _subscriptions[type] = new List<TriggerSubscription>();
            }
        }

        /// <summary>
        /// Subscribe to a trigger type
        /// </summary>
        public void Subscribe(TriggerType triggerType, CardData card, int playerId, AbilityData ability)
        {
            if (!_subscriptions.ContainsKey(triggerType))
                _subscriptions[triggerType] = new List<TriggerSubscription>();

            _subscriptions[triggerType].Add(new TriggerSubscription
            {
                Card = card,
                PlayerId = playerId,
                Ability = ability
            });
        }

        /// <summary>
        /// Unsubscribe (when card leaves battlefield)
        /// </summary>
        public void Unsubscribe(TriggerType triggerType, CardData card)
        {
            if (_subscriptions.TryGetValue(triggerType, out var list))
            {
                list.RemoveAll(s => s.Card == card);
            }
        }

        /// <summary>
        /// Unsubscribe all for a card (leaving battlefield)
        /// </summary>
        public void UnsubscribeAll(CardData card)
        {
            foreach (var list in _subscriptions.Values)
            {
                list.RemoveAll(s => s.Card == card);
            }
        }

        /// <summary>
        /// Fire a trigger - check all subscriptions and queue matching abilities
        /// </summary>
        public void Trigger(TriggerType triggerType, int playerId, object context = null)
        {
            if (!_subscriptions.TryGetValue(triggerType, out var subscriptions)) return;

            var toTrigger = new List<TriggerSubscription>(subscriptions);
            foreach (var sub in toTrigger)
            {
                // Check if this subscription matches the player/context
                if (ShouldTrigger(sub, playerId, context))
                {
                    QueueTriggeredAbility(sub, context);
                }
            }
        }

        /// <summary>
        /// Fire trigger for a specific card
        /// </summary>
        public void Trigger(TriggerType triggerType, CardData card, int playerId, object context = null)
        {
            if (!_subscriptions.TryGetValue(triggerType, out var subscriptions)) return;

            foreach (var sub in subscriptions)
            {
                if (sub.Card == card && ShouldTrigger(sub, playerId, context))
                {
                    QueueTriggeredAbility(sub, context);
                }
            }
        }

        private bool ShouldTrigger(TriggerSubscription sub, int triggerPlayerId, object context)
        {
            // Check player match (some triggers are "you", some "opponent", some "any")
            var ability = sub.Ability;
            if (ability.parameters == null) return true;

            string triggerPlayer = ability.parameters.Value<string>("trigger_player");
            if (!string.IsNullOrEmpty(triggerPlayer))
            {
                switch (triggerPlayer.ToLower())
                {
                    case "you":
                        if (sub.PlayerId != triggerPlayerId) return false;
                        break;
                    case "opponent":
                        if (sub.PlayerId == triggerPlayerId) return false;
                        break;
                    case "any":
                        break;
                }
            }

            // Check additional conditions (e.g., "when you gain life", "when creature dies")
            string condition = ability.parameters.Value<string>("condition");
            if (!string.IsNullOrEmpty(condition))
            {
                if (!EvaluateCondition(condition, sub, context)) return false;
            }

            return true;
        }

        private bool EvaluateCondition(string condition, TriggerSubscription sub, object context)
        {
            // Simple condition evaluation - expand as needed
            return condition switch
            {
                "combat_damage" => context is CombatDamageContext,
                "life_gain" => context is LifeGainContext,
                "card_draw" => context is CardDrawContext,
                "spell_cast" => context is SpellCastContext,
                _ => true
            };
        }

        private void QueueTriggeredAbility(TriggerSubscription sub, object context)
        {
            // Put triggered ability on stack
            var stackObj = new StackObject(sub.Card, sub.PlayerId, StackObjectType.TriggeredAbility)
            {
                ability = sub.Ability
            };
            // _gameState.GameStack.Push(stackObj);
        }

        // === Keyword-Specific Trigger Handlers ===

        /// <summary>
        /// Handle Ominous trigger (flip at end of turn if dealt combat damage)
        /// </summary>
        public void HandleOminousTrigger(CardData card, int playerId)
        {
            if (!card.HasKeyword(KeywordFlags.Ominous)) return;
            if (!card.isFlipped && card.dealtCombatDamageThisTurn)
            {
                // Queue flip at end of turn
                _gameState.EffectResolver.Resolve("ominous_flip", new EffectResolver.EffectContext
                {
                    SourceCard = card,
                    ControllerPlayerId = playerId
                });
                card.dealtCombatDamageThisTurn = false; // Reset
            }
        }

        /// <summary>
        /// Handle Recall trigger (return from graveyard with charges)
        /// </summary>
        public void HandleRecallTrigger(CardData card, int playerId)
        {
            if (!card.HasKeyword(KeywordFlags.Recall)) return;
            if (card.recallCharges > 0 && card.currentZone == ZoneType.Graveyard)
            {
                card.recallCharges--;
                _gameState.ZoneManager.ReturnFromExile(playerId, card, ZoneType.Hand);
            }
        }

        /// <summary>
        /// Handle Swiftstrike (first strike damage)
        /// </summary>
        public bool HasSwiftstrike(CardData card) => card.HasKeyword(KeywordFlags.Swiftstrike);

        /// <summary>
        /// Handle Siphon (lifelink)
        /// </summary>
        public void HandleSiphon(CardData source, int damageDealt)
        {
            if (source.HasKeyword(KeywordFlags.Siphon) && damageDealt > 0)
            {
                _gameState.GainLife(source.controllerPlayerId, damageDealt);
            }
        }

        /// <summary>
        /// Handle Deathshroud (indestructible/regenerate)
        /// </summary>
        public bool HasDeathshroud(CardData card) => card.HasKeyword(KeywordFlags.Deathshroud);

        /// <summary>
        /// Handle Flying/Keen Eye/Intimidate/Guard/Bastion - combat legality
        /// </summary>
        public bool CanBlock(CardData attacker, CardData blocker)
        {
            // Flying: only flyers/Keen Eye can block
            if (attacker.HasKeyword(KeywordFlags.Flying))
            {
                if (!blocker.HasKeyword(KeywordFlags.Flying) && !blocker.HasKeyword(KeywordFlags.KeenEye))
                    return false;
            }

            // Intimidate: only same color or artifact can block
            if (attacker.HasKeyword(KeywordFlags.Intimidate))
            {
                if (blocker.color != attacker.color && !blocker.HasKeyword(KeywordFlags.Bastion)) // Artifact = colorless
                    return false;
            }

            // Guard: must be blocked if able (defender/vigilance handled elsewhere)
            // Bastion: hexproof/ward - handled in targeting

            return true;
        }

        /// <summary>
        /// Handle Quickdraw (attack/block immediately)
        /// </summary>
        public bool HasQuickdraw(CardData card) => card.HasKeyword(KeywordFlags.Quickdraw);

        /// <summary>
        /// Handle Overrun (trample)
        /// </summary>
        public bool HasOverrun(CardData card) => card.HasKeyword(KeywordFlags.Overrun);

        // Context classes for conditions
        public class CombatDamageContext { public int Damage; public CardData Source; public CardData Target; }
        public class LifeGainContext { public int Amount; public int PlayerId; }
        public class CardDrawContext { public int Count; public int PlayerId; }
        public class SpellCastContext { public CardData Spell; public int PlayerId; }

        private class TriggerSubscription
        {
            public CardData Card;
            public int PlayerId;
            public AbilityData Ability;
        }
    }
}