// TurnManager.cs
// Turn phase management matching MTGA's exact phase structure
// Port target: shared/phases.js + game.js turn flow (v0.1042+)
using System;
using Cysharp.Threading.Tasks;
using TCG.Data;

namespace TCG.Core
{
    /// <summary>
    /// Complete MTGA turn structure with all phases and steps
    /// MTG Comprehensive Rules 500-514
    /// </summary>
    public class TurnManager
    {
        public enum Phase
        {
            // Beginning Phase
            Untap = 0,
            Upkeep = 1,
            Draw = 2,

            // Pre-Combat Main Phase
            Main1 = 3,

            // Combat Phase
            BeginCombat = 4,
            DeclareAttackers = 5,
            DeclareBlockers = 6,
            CombatDamage = 7,
            EndCombat = 8,

            // Post-Combat Main Phase
            Main2 = 9,

            // Ending Phase
            EndStep = 10,
            Cleanup = 11
        }

        public enum Step
        {
            None = -1,
            UntapStep = 0,
            UpkeepStep = 1,
            DrawStep = 2,
            Main1Step = 3,
            BeginCombatStep = 4,
            DeclareAttackersStep = 5,
            DeclareBlockersStep = 6,
            CombatDamageStep = 7,
            EndCombatStep = 8,
            Main2Step = 9,
            EndStep = 10,
            CleanupStep = 11
        }

        public Phase CurrentPhase { get; private set; } = Phase.Main1;
        public Step CurrentStep { get; private set; } = Step.Main1Step;
        public int ActivePlayerId { get; private set; } = 0;
        public int TurnNumber { get; private set; } = 0;
        public bool IsFirstTurn { get; private set; } = true;

        // Events
        public event Action<Phase> OnPhaseChanged;
        public event Action<Step> OnStepChanged;
        public event Action<int> OnTurnChanged;
        public event Action OnUntapStep;
        public event Action OnUpkeepStep;
        public event Action OnDrawStep;
        public event Action OnMain1Step;
        public event Action OnBeginCombatStep;
        public event Action OnDeclareAttackersStep;
        public event Action OnDeclareBlockersStep;
        public event Action OnCombatDamageStep;
        public event Action OnEndCombatStep;
        public event Action OnMain2Step;
        public event Action OnEndStep;
        public event Action OnCleanupStep;

        private readonly PriorityManager _priorityManager;
        private readonly GameState _gameState;

        public TurnManager(PriorityManager priorityManager, GameState gameState)
        {
            _priorityManager = priorityManager;
            _gameState = gameState;
        }

        /// <summary>
        /// Initialize for a new game
        /// </summary>
        public void Initialize(int startingPlayer)
        {
            ActivePlayerId = startingPlayer;
            TurnNumber = 1;
            IsFirstTurn = true;
            CurrentPhase = Phase.Untap;
            CurrentStep = Step.UntapStep;
        }

        /// <summary>
        /// Advance to next step/phase
        /// </summary>
        public async UniTask<bool> AdvanceStep()
        {
            // Execute cleanup for current step
            await ExecuteStepCleanup(CurrentStep);

            // Move to next step
            var nextStep = GetNextStep(CurrentStep);
            if (nextStep == Step.None)
            {
                // End of turn - advance to next player's turn
                await EndTurn();
                return true; // Turn ended
            }

            CurrentStep = nextStep;
            CurrentPhase = StepToPhase(CurrentStep);
            OnStepChanged?.Invoke(CurrentStep);
            OnPhaseChanged?.Invoke(CurrentPhase);

            // Execute step start logic
            await ExecuteStepStart(CurrentStep);

            // Start priority window for this step (if applicable)
            if (StepHasPriorityWindow(CurrentStep))
            {
                _priorityManager.StartPriorityWindow(ActivePlayerId);
            }

            return false; // Turn continues
        }

        /// <summary>
        /// Advance to next player's turn
        /// </summary>
        public async UniTask EndTurn()
        {
            // Cleanup current step
            await ExecuteStepCleanup(CurrentStep);

            // Switch active player
            ActivePlayerId = 1 - ActivePlayerId; // assumes 2 players
            TurnNumber++;
            IsFirstTurn = false;

            // Start new turn at Untap
            CurrentPhase = Phase.Untap;
            CurrentStep = Step.UntapStep;
            OnTurnChanged?.Invoke(TurnNumber);
            OnPhaseChanged?.Invoke(CurrentPhase);
            OnStepChanged?.Invoke(CurrentStep);

            // Execute untap step start
            await ExecuteStepStart(CurrentStep);

            // Untap step: no priority window, auto-advance
            await UniTask.NextFrame();
            await AdvanceStep(); // Auto-advance to Upkeep
        }

        private async UniTask ExecuteStepStart(Step step)
        {
            switch (step)
            {
                case Step.UntapStep:
                    OnUntapStep?.Invoke();
                    // Untap all permanents, remove "until end of turn" effects
                    _gameState.UntapAll(ActivePlayerId);
                    break;
                case Step.UpkeepStep:
                    OnUpkeepStep?.Invoke();
                    // Trigger "at beginning of upkeep" abilities
                    _gameState.TriggerAbilities(TriggerType.OnTurnStart, ActivePlayerId);
                    break;
                case Step.DrawStep:
                    OnDrawStep?.Invoke();
                    if (!IsFirstTurn || ActivePlayerId != 0) // First player skips draw on turn 1
                        _gameState.DrawCard(ActivePlayerId);
                    break;
                case Step.Main1Step:
                    OnMain1Step?.Invoke();
                    break;
                case Step.BeginCombatStep:
                    OnBeginCombatStep?.Invoke();
                    break;
                case Step.DeclareAttackersStep:
                    OnDeclareAttackersStep?.Invoke();
                    break;
                case Step.DeclareBlockersStep:
                    OnDeclareBlockersStep?.Invoke();
                    break;
                case Step.CombatDamageStep:
                    OnCombatDamageStep?.Invoke();
                    break;
                case Step.EndCombatStep:
                    OnEndCombatStep?.Invoke();
                    break;
                case Step.Main2Step:
                    OnMain2Step?.Invoke();
                    break;
                case Step.EndStep:
                    OnEndStep?.Invoke();
                    // Trigger "at beginning of end step" / "at end of turn" abilities
                    _gameState.TriggerAbilities(TriggerType.EndOfTurn, ActivePlayerId);
                    break;
                case Step.CleanupStep:
                    OnCleanupStep?.Invoke();
                    // Discard to hand size, remove damage, end "until end of turn" effects
                    _gameState.Cleanup(ActivePlayerId);
                    break;
            }
            await UniTask.Yield();
        }

        private async UniTask ExecuteStepCleanup(Step step)
        {
            // Most steps don't need cleanup logic here
            // Cleanup step handles end-of-turn effects
            await UniTask.Yield();
        }

        private Step GetNextStep(Step current)
        {
            int next = (int)current + 1;
            if (next >= (int)Step.CleanupStep + 1)
                return Step.None; // End of turn
            return (Step)next;
        }

        private Phase StepToPhase(Step step)
        {
            return step switch
            {
                Step.UntapStep => Phase.Untap,
                Step.UpkeepStep => Phase.Upkeep,
                Step.DrawStep => Phase.Draw,
                Step.Main1Step => Phase.Main1,
                Step.BeginCombatStep => Phase.BeginCombat,
                Step.DeclareAttackersStep => Phase.DeclareAttackers,
                Step.DeclareBlockersStep => Phase.DeclareBlockers,
                Step.CombatDamageStep => Phase.CombatDamage,
                Step.EndCombatStep => Phase.EndCombat,
                Step.Main2Step => Phase.Main2,
                Step.EndStep => Phase.EndStep,
                Step.CleanupStep => Phase.Cleanup,
                _ => Phase.Main1
            };
        }

        private bool StepHasPriorityWindow(Step step)
        {
            // Steps where players get priority (can cast spells, activate abilities)
            return step switch
            {
                Step.UpkeepStep => true,
                Step.DrawStep => true,
                Step.Main1Step => true,
                Step.BeginCombatStep => true,
                Step.DeclareAttackersStep => true,
                Step.DeclareBlockersStep => true,
                Step.CombatDamageStep => true,
                Step.EndCombatStep => true,
                Step.Main2Step => true,
                Step.EndStep => true,
                _ => false // Untap, Cleanup: no priority
            };
        }

        /// <summary>
        /// Check if it's a main phase (can play lands, cast sorceries)
        /// </summary>
        public bool IsMainPhase => CurrentPhase == Phase.Main1 || CurrentPhase == Phase.Main2;

        /// <summary>
        /// Check if it's combat phase
        /// </summary>
        public bool IsCombatPhase => CurrentPhase >= Phase.BeginCombat && CurrentPhase <= Phase.EndCombat;

        /// <summary>
        /// Check if player can cast sorcery-speed spells
        /// </summary>
        public bool CanCastSorcery(int playerId) =>
            IsMainPhase && ActivePlayerId == playerId && _priorityManager.HasPriority(playerId);

        /// <summary>
        /// Check if player can play a land
        /// </summary>
        public bool CanPlayLand(int playerId) =>
            IsMainPhase && ActivePlayerId == playerId && !_gameState.HasPlayedLandThisTurn(playerId);
    }
}