// PhaseManager.cs  (PREPARATION STUB)
// Port target: shared/phases.js (phase windows) + game.js turn flow.
// Mirrors the v0.1042 enforced engine phases.
using UnityEngine;

namespace TCG.Engine
{
    public class PhaseManager : MonoBehaviour
    {
        public enum Phase { StartOfTurn, Main1, Combat, Main2, EndOfTurn }
        public Phase Current { get; private set; } = Phase.Main1;

        // Port: shared/phases.js step windows (ON_COMBAT_DAMAGE, END_OF_TURN, etc.)
        public void Advance()
        {
            // TODO: port phase-window + colored-mana step enforcement once GameState is live.
            Current = (Phase)(((int)Current + 1) % System.Enum.GetValues(typeof(Phase)).Length);
        }

        public bool IsMainPhase => Current == Phase.Main1 || Current == Phase.Main2;
        public bool IsCombatPhase => Current == Phase.Combat;
        public bool IsEndOfTurn => Current == Phase.EndOfTurn;
    }
}
