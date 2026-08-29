// CombatEngine.cs
// Combat resolution engine - mirrors game.js combatDeclareAttackers / resolveCombatPhase
// Handles attacker/blocker declaration, combat damage, Ominous flips
using System.Collections.Generic;
using System.Linq;
using TCG.Data;

namespace TCG.Combat
{
    /// <summary>
    /// Manages the combat phase - attacker declaration, blocker assignment, damage resolution
    /// </summary>
    public class CombatEngine
    {
        private readonly GameState _gameState;

        // Current combat state
        public List<Attacker> DeclaredAttackers { get; private set; } = new();
        public Dictionary<int, List<Blocker>> BlockAssignments { get; private set; } = new(); // attackerId -> blockers
        public bool CombatPhaseActive { get; private set; } = false;

        public CombatEngine(GameState gameState)
        {
            _gameState = gameState;
        }

        // === Attacker Declaration ===

        /// <summary>
        /// Declare a creature as an attacker
        /// </summary>
        public bool DeclareAttacker(int playerId, CardData attacker, int? targetPlayerId = null)
        {
            if (!CanAttack(attacker)) return false;
            if (CombatPhaseActive) return false; // Must declare all at once

            var attackerObj = new Attacker
            {
                Card = attacker,
                AttackerPlayerId = playerId,
                TargetPlayerId = targetPlayerId ?? (1 - playerId),
                IsAttacking = true
            };

            DeclaredAttackers.Add(attackerObj);
            attacker.isTapped = true; // Tap to attack (unless Vigilance/Guard)
            _gameState.TriggerSystem.Trigger(TriggerType.OnAttack, attacker, playerId);

            return true;
        }

        /// <summary>
        /// Declare multiple attackers at once (start of combat)
        /// </summary>
        public void DeclareAttackers(List<(CardData card, int? target)> attackers)
        {
            CombatPhaseActive = true;
            DeclaredAttackers.Clear();

            foreach (var (card, target) in attackers)
            {
                DeclareAttacker(_gameState.TurnManager.ActivePlayerId, card, target);
            }
        }

        /// <summary>
        /// Check if a creature can attack
        /// </summary>
        public bool CanAttack(CardData attacker)
        {
            if (attacker.type != CardType.Champion) return false;
            if (attacker.isTapped) return false;
            if (attacker.hasSummoningSickness && !QuickdrawBehaviour.HasQuickdraw(attacker)) return false;
            // Check for "must attack" effects
            return true;
        }

        /// <summary>
        /// End attacker declaration, move to blocker declaration
        /// </summary>
        public void EndDeclareAttackers()
        {
            // Trigger "when attackers declared" abilities
            foreach (var attacker in DeclaredAttackers)
            {
                _gameState.TriggerSystem.Trigger(TriggerType.OnAttack, attacker.Card, attacker.AttackerPlayerId);
            }
        }

        // === Blocker Declaration ===

        /// <summary>
        /// Declare a blocker for an attacker
        /// </summary>
        public bool DeclareBlocker(int defenderPlayerId, CardData blocker, int attackerIndex)
        {
            if (!CanBlock(blocker)) return false;
            if (attackerIndex < 0 || attackerIndex >= DeclaredAttackers.Count) return false;

            var attacker = DeclaredAttackers[attackerIndex];
            if (!attacker.IsAttacking) return false;

            // Check block legality (Flying, Intimidate, etc.)
            if (!CombatRules.CanBlock(attacker.Card, blocker, _gameState))
                return false;

            // Check max blocks (Guard allows 2)
            if (!BlockAssignments.ContainsKey(attackerIndex))
                BlockAssignments[attackerIndex] = new List<Blocker>();

            var currentBlocks = BlockAssignments[attackerIndex].Count;
            int maxBlocks = GuardBehaviour.MaxBlocks(blocker);
            if (currentBlocks >= maxBlocks) return false;

            var blockerObj = new Blocker
            {
                Card = blocker,
                BlockerPlayerId = defenderPlayerId,
                BlockedAttackerIndex = attackerIndex
            };

            BlockAssignments[attackerIndex].Add(blockerObj);
            blocker.isTapped = true; // Tap to block (unless vigilance)
            _gameState.TriggerSystem.Trigger(TriggerType.OnBlock, blocker, defenderPlayerId);

            return true;
        }

        /// <summary>
        /// Check if a creature can block
        /// </summary>
        public bool CanBlock(CardData blocker)
        {
            if (blocker.type != CardType.Champion) return false;
            if (blocker.isTapped) return false;
            return true;
        }

        /// <summary>
        /// End blocker declaration, move to damage
        /// </summary>
        public void EndDeclareBlockers()
        {
            // Order blockers for each attacker (damage assignment order)
            foreach (var kvp in BlockAssignments)
            {
                // Player chooses order - for now, order by power descending
                kvp.Value.Sort((a, b) => b.Card.attack.CompareTo(a.Card.attack));
            }

            // Trigger "when blockers declared" abilities
            foreach (var kvp in BlockAssignments)
            {
                foreach (var blocker in kvp.Value)
                {
                    _gameState.TriggerSystem.Trigger(TriggerType.OnBlock, blocker.Card, blocker.BlockerPlayerId);
                }
            }
        }

        // === Combat Damage ===

        /// <summary>
        /// Resolve all combat damage
        /// Two steps: First strike (Swiftstrike), then regular
        /// </summary>
        public void DealCombatDamage()
        {
            // Step 1: First Strike Damage (Swiftstrike)
            DealDamageStep(true);

            // Step 2: Regular Combat Damage
            DealDamageStep(false);

            // Check for Ominous triggers
            CheckOminousTriggers();

            // State-based actions will handle 0 toughness creatures
            _gameState.StateBasedActions.RunToCompletion();
        }

        private void DealDamageStep(bool firstStrikeOnly)
        {
            foreach (var attacker in DeclaredAttackers)
            {
                if (!attacker.IsAttacking) continue;

                var blockers = BlockAssignments.GetValueOrDefault(DeclaredAttackers.IndexOf(attacker), new List<Blocker>());

                if (blockers.Count == 0)
                {
                    // Unblocked - deal to player
                    if (firstStrikeOnly && SwiftstrikeBehaviour.HasSwiftstrike(attacker.Card))
                    {
                        DealDamageToPlayer(attacker, attacker.Card.attack);
                    }
                    else if (!firstStrikeOnly && !SwiftstrikeBehaviour.HasSwiftstrike(attacker.Card))
                    {
                        DealDamageToPlayer(attacker, attacker.Card.attack);
                    }
                }
                else
                {
                    // Blocked - assign damage to blockers in order
                    int remainingDamage = attacker.Card.attack;
                    bool attackerHasSwiftstrike = SwiftstrikeBehaviour.HasSwiftstrike(attacker.Card);
                    bool isFirstStrikeStep = firstStrikeOnly && attackerHasSwiftstrike;
                    bool isRegularStep = !firstStrikeOnly && !attackerHasSwiftstrike;

                    if (!isFirstStrikeStep && !isRegularStep) continue;

                    foreach (var blocker in blockers)
                    {
                        if (remainingDamage <= 0) break;

                        int blockerDamage, playerDamage;
                        if (OverrunBehaviour.HasOverrun(attacker.Card))
                        {
                            (blockerDamage, playerDamage) = OverrunBehaviour.AssignTrampleDamage(
                                attacker.Card, blocker.Card, remainingDamage);
                        }
                        else
                        {
                            int lethalDamage = blocker.Card.health - (blocker.Card.damageMarked ?? 0);
                            blockerDamage = Math.Min(remainingDamage, Math.Max(0, lethalDamage));
                            playerDamage = 0;
                        }

                        // Deal damage to blocker
                        if (blockerDamage > 0)
                        {
                            DealDamageToCreature(attacker.Card, blocker.Card, blockerDamage);
                            remainingDamage -= blockerDamage;
                        }

                        // Trample damage to player
                        if (playerDamage > 0)
                        {
                            DealDamageToPlayer(attacker, playerDamage);
                            remainingDamage -= playerDamage;
                        }
                    }

                    // Any remaining damage to player (if no blockers left or trample)
                    if (remainingDamage > 0 && blockers.Count == 0)
                    {
                        DealDamageToPlayer(attacker, remainingDamage);
                    }
                }

                // Blockers deal damage back to attacker
                foreach (var blocker in blockers)
                {
                    bool blockerHasSwiftstrike = SwiftstrikeBehaviour.HasSwiftstrike(blocker.Card);
                    bool blockerIsFirstStrike = firstStrikeOnly && blockerHasSwiftstrike;
                    bool blockerIsRegular = !firstStrikeOnly && !blockerHasSwiftstrike;

                    if (!blockerIsFirstStrike && !blockerIsRegular) continue;

                    int damage = blocker.Card.attack;
                    DealDamageToCreature(blocker.Card, attacker.Card, damage);
                }
            }
        }

        private void DealDamageToPlayer(Attacker attacker, int damage)
        {
            if (damage <= 0) return;
            _gameState.DealDamage(attacker.TargetPlayerId, damage, attacker.Card);
        }

        private void DealDamageToCreature(CardData source, CardData target, int damage)
        {
            if (damage <= 0) return;

            target.damageMarked = (target.damageMarked ?? 0) + damage;
            target.health -= damage; // For display purposes

            // Trigger Siphon (lifelink)
            SiphonBehaviour.OnDamageDealt(source, damage, source.controllerPlayerId, _gameState);

            // Trigger Ominous
            OminousBehaviour.OnCombatDamageDealt(source);

            // Trigger "deal combat damage" abilities
            _gameState.TriggerSystem.Trigger(TriggerType.OnCombatDamage, source, source.controllerPlayerId);
        }

        private void CheckOminousTriggers()
        {
            foreach (var attacker in DeclaredAttackers)
            {
                if (OminousBehaviour.ShouldFlipAtEndOfTurn(attacker.Card))
                {
                    // Will flip at end of turn via StateBasedActions / TurnManager
                    attacker.Card.needsOminousFlip = true;
                }
            }

            foreach (var kvp in BlockAssignments)
            {
                foreach (var blocker in kvp.Value)
                {
                    if (OminousBehaviour.ShouldFlipAtEndOfTurn(blocker.Card))
                    {
                        blocker.Card.needsOminousFlip = true;
                    }
                }
            }
        }

        // === Cleanup ===

        public void EndCombat()
        {
            CombatPhaseActive = false;
            DeclaredAttackers.Clear();
            BlockAssignments.Clear();
        }

        // === Data Structures ===

        public class Attacker
        {
            public CardData Card;
            public int AttackerPlayerId;
            public int TargetPlayerId;
            public bool IsAttacking;
        }

        public class Blocker
        {
            public CardData Card;
            public int BlockerPlayerId;
            public int BlockedAttackerIndex;
        }
    }
}