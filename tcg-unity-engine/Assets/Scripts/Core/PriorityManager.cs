// PriorityManager.cs
// Priority/pass system - core MTGA mechanic
// Mirrors the priority system from game.js (pass priority, both pass = resolve top of stack)
using System;
using System.Collections.Generic;
using Cysharp.Threading.Tasks;
using TCG.Data;

namespace TCG.Core
{
    /// <summary>
    /// Manages priority between players - who can act, when both pass resolve stack
    /// MTGA: Active player gets priority first in each phase/step
    /// </summary>
    public class PriorityManager
    {
        private readonly int _playerCount;
        private int _activePlayerId;
        private int _priorityPlayerId;
        private readonly bool[] _hasPassed;
        private readonly Action _onPriorityChanged;
        private readonly Func<UniTask> _onBothPassed;

        public int ActivePlayerId => _activePlayerId;
        public int PriorityPlayerId => _priorityPlayerId;
        public bool BothPassed => _hasPassed[0] && _hasPassed[1];

        public PriorityManager(int playerCount = 2, Action onPriorityChanged = null, Func<UniTask> onBothPassed = null)
        {
            _playerCount = playerCount;
            _hasPassed = new bool[playerCount];
            _onPriorityChanged = onPriorityChanged;
            _onBothPassed = onBothPassed;
        }

        /// <summary>
        /// Start a new priority window (new phase, step, or after stack resolution)
        /// Active player gets priority first
        /// </summary>
        public void StartPriorityWindow(int activePlayerId)
        {
            _activePlayerId = activePlayerId;
            _priorityPlayerId = activePlayerId;
            Array.Clear(_hasPassed, 0, _hasPassed.Length);
            _onPriorityChanged?.Invoke();
        }

        /// <summary>
        /// Current player passes priority
        /// </summary>
        public async UniTask PassPriority()
        {
            _hasPassed[_priorityPlayerId] = true;

            if (BothPassed)
            {
                // Both passed - resolve top of stack or move to next step
                Array.Clear(_hasPassed, 0, _hasPassed.Length);
                if (_onBothPassed != null)
                    await _onBothPassed();
            }
            else
            {
                // Pass to other player
                _priorityPlayerId = 1 - _priorityPlayerId; // assumes 2 players
                _onPriorityChanged?.Invoke();
            }
        }

        /// <summary>
        /// Player takes an action (casts spell, activates ability) - keeps priority
        /// </summary>
        public void TakeAction()
        {
            // Player keeps priority after taking action (MTG rule 117.3c)
            // But we reset pass state for both players
            Array.Clear(_hasPassed, 0, _hasPassed.Length);
            _onPriorityChanged?.Invoke();
        }

        /// <summary>
        /// Force priority to a specific player (e.g., after resolution)
        /// </summary>
        public void SetPriority(int playerId)
        {
            _priorityPlayerId = playerId;
            Array.Clear(_hasPassed, 0, _hasPassed.Length);
            _onPriorityChanged?.Invoke();
        }

        /// <summary>
        /// Check if player currently has priority
        /// </summary>
        public bool HasPriority(int playerId) => _priorityPlayerId == playerId;

        /// <summary>
        /// Check if player has passed this window
        /// </summary>
        public bool HasPassed(int playerId) => _hasPassed[playerId];

        /// <summary>
        /// Get the other player (assumes 2-player)
        /// </summary>
        public int GetOtherPlayer(int playerId) => 1 - playerId;
    }
}