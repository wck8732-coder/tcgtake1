// GameStack.cs
// LIFO stack for spells and abilities - core MTGA mechanic
// Mirrors the stack system from simulate.js / game.js
using System.Collections.Generic;
using TCG.Data;

namespace TCG.Core
{
    /// <summary>
    /// Represents an object on the stack (spell, ability, trigger)
    /// </summary>
    public class StackObject
    {
        public int id;                          // unique stack object ID
        public CardData sourceCard;             // card that created this
        public AbilityData ability;             // ability being resolved (for activated/triggered)
        public int controllerPlayerId;          // player who controls this
        public List<int> targets = new();       // target player/card IDs
        public StackObjectType type;            // spell, ability, trigger
        public bool isCopy;                     // true if copied (e.g., via Fork)
        public StackObject parent;              // original if copied

        public StackObject(CardData card, int controller, StackObjectType type = StackObjectType.Spell)
        {
            this.sourceCard = card;
            this.controllerPlayerId = controller;
            this.type = type;
            this.id = System.Guid.NewGuid().GetHashCode();
        }
    }

    public enum StackObjectType
    {
        Spell = 0,          // casting a card from hand
        ActivatedAbility = 1, // activated ability (cost: effect)
        TriggeredAbility = 2, // triggered ability (when/whenever/at)
        StaticAbility = 3,  // continuous effect (handled separately)
        ManaAbility = 4     // mana ability (doesn't use stack)
    }

    /// <summary>
    /// The Stack - LIFO resolution order (MTG comprehensive rules 405)
    /// </summary>
    public class GameStack
    {
        private readonly List<StackObject> _stack = new();
        private int _nextObjectId = 1;

        public IReadOnlyList<StackObject> Objects => _stack.AsReadOnly();
        public int Count => _stack.Count;
        public bool IsEmpty => _stack.Count == 0;

        /// <summary>
        /// Add object to top of stack
        /// </summary>
        public void Push(StackObject obj)
        {
            obj.id = _nextObjectId++;
            _stack.Add(obj);
        }

        /// <summary>
        /// Remove and return top object (for resolution)
        /// </summary>
        public StackObject Pop()
        {
            if (_stack.Count == 0) return null;
            var obj = _stack[_stack.Count - 1];
            _stack.RemoveAt(_stack.Count - 1);
            return obj;
        }

        /// <summary>
        /// Peek at top object without removing
        /// </summary>
        public StackObject Peek()
        {
            return _stack.Count > 0 ? _stack[_stack.Count - 1] : null;
        }

        /// <summary>
        /// Clear entire stack (e.g., game end, Karn Liberated)
        /// </summary>
        public void Clear()
        {
            _stack.Clear();
        }

        /// <summary>
        /// Get all objects controlled by a player
        /// </summary>
        public List<StackObject> GetObjectsByController(int playerId)
        {
            return _stack.FindAll(o => o.controllerPlayerId == playerId);
        }

        /// <summary>
        /// Check if player has any objects on stack
        /// </summary>
        public bool HasObjectsFromPlayer(int playerId)
        {
            return _stack.Exists(o => o.controllerPlayerId == playerId);
        }
    }
}