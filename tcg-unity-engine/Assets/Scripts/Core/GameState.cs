// GameState.cs
// Central game state orchestrator - port of simulate.js GameState class
// Coordinates: TurnManager, PriorityManager, ManaSystem, ZoneManager, EffectResolver
using System.Collections.Generic;
using Cysharp.Threading.Tasks;
using TCG.Data;

namespace TCG.Core
{
    /// <summary>
    /// Main game state - single source of truth for game
    /// Mirrors simulate.js GameState (v0.1045)
    /// </summary>
    public class GameState
    {
        // Singleton for easy access from MonoBehaviours
        public static GameState Instance { get; private set; }

        // Core systems
        public TurnManager TurnManager { get; private set; }
        public PriorityManager PriorityManager { get; private set; }
        public ManaSystem ManaSystem { get; private set; }
        public ZoneManager ZoneManager { get; private set; }
        public EffectResolver EffectResolver { get; private set; }
        public TriggerSystem TriggerSystem { get; private set; }
        public CombatEngine CombatEngine { get; private set; }
        public StateBasedActions StateBasedActions { get; private set; }

        // Game data
        public CardDatabase CardDatabase { get; private set; }
        public DecksDatabase DecksDatabase { get; private set; }
        public Dictionary<int, CardData> CardMap { get; private set; }

        // Player state
        public int[] LifeTotals { get; private set; } = new int[2];
        public int[] HandSizes { get; private set; } = new int[2];
        public bool[] HasPlayedLand { get; private set; } = new bool[2];
        public bool GameOver { get; private set; } = false;
        public int WinnerPlayerId { get; private set; } = -1;

        // Difficulty / format
        public string Format { get; private set; } = "Classic"; // "Classic" or "Standard"
        public int Difficulty { get; private set; } = 1;

        // Events for UI
        public event Action<int, int> OnLifeChanged; // playerId, newLife
        public event Action<int, int> OnHandSizeChanged; // playerId, newSize
        public event Action<int, CardData> OnCardDrawn; // playerId, card
        public event Action<int, CardData> OnCardPlayed; // playerId, card
        public event Action<int, CardData> OnCardDiscarded; // playerId, card
        public event Action OnGameOver; // winner in WinnerPlayerId
        public event Action<int> OnTurnChanged; // turnNumber
        public event Action OnPhaseChanged;
        public event Action OnStepChanged;

        public GameState()
        {
            Instance = this;
        }

        /// <summary>
        /// Initialize new game with format and difficulty
        /// </summary>
        public void Initialize(string format = "Classic", int difficulty = 1, int player1DeckIndex = 0, int player2DeckIndex = 0)
        {
            Format = format;
            Difficulty = difficulty;

            // Load databases
            CardDatabase = CardDatabaseLoader.LoadDatabase();
            DecksDatabase = CardDatabaseLoader.LoadDecks();

            // Build card map for O(1) lookup
            CardMap = new Dictionary<int, CardData>(CardDatabase.cards.Count);
            foreach (var card in CardDatabase.cards)
                CardMap[card.id] = card;

            // Initialize systems
            ManaSystem = new ManaSystem(2);
            ZoneManager = new ZoneManager(2);
            PriorityManager = new PriorityManager(2, OnPriorityChanged, OnBothPassedAsync);
            TurnManager = new TurnManager(PriorityManager, this);
            EffectResolver = new EffectResolver(this);
            TriggerSystem = new TriggerSystem(this);
            CombatEngine = new CombatEngine(this);
            StateBasedActions = new StateBasedActions(this);

            // Reset player state
            LifeTotals[0] = LifeTotals[1] = 20; // Starting life
            HandSizes[0] = HandSizes[1] = 0;
            HasPlayedLand[0] = HasPlayedLand[1] = false;
            GameOver = false;
            WinnerPlayerId = -1;

            // Build decks and deal opening hands
            BuildAndDealDecks(player1DeckIndex, player2DeckIndex);

            // Randomly determine starting player (or use difficulty)
            int startingPlayer = UnityEngine.Random.Range(0, 2);
            TurnManager.Initialize(startingPlayer);

            // Start first turn
            TurnManager.OnTurnChanged += (turn) => OnTurnChanged?.Invoke(turn);
            TurnManager.OnPhaseChanged += (phase) => OnPhaseChanged?.Invoke();
            TurnManager.OnStepChanged += (step) => OnStepChanged?.Invoke();
        }

        /// <summary>
        /// Build decks from decks.json and deal opening 7 cards
        /// </summary>
        private void BuildAndDealDecks(int p1DeckIndex, int p2DeckIndex)
        {
            if (DecksDatabase?.formats == null || !DecksDatabase.formats.ContainsKey(Format))
            {
                Debug.LogError($"Format '{Format}' not found in decks database");
                return;
            }

            var formatData = DecksDatabase.formats[Format];
            var p1DeckDef = formatData.decks[p1DeckIndex];
            var p2DeckDef = formatData.decks[p2DeckIndex];

            // Player 0 deck
            var p1Library = BuildDeckFromDef(p1DeckDef);
            var p1Zone = ZoneManager.GetZone(0, ZoneType.Library);
            p1Zone.cards.AddRange(p1Library);
            p1Zone.Shuffle();

            // Player 1 deck
            var p2Library = BuildDeckFromDef(p2DeckDef);
            var p2Zone = ZoneManager.GetZone(1, ZoneType.Library);
            p2Zone.cards.AddRange(p2Library);
            p2Zone.Shuffle();

            // Draw opening hands (7 cards each)
            for (int i = 0; i < 7; i++)
            {
                ZoneManager.DrawCard(0);
                ZoneManager.DrawCard(1);
            }
            HandSizes[0] = 7;
            HandSizes[1] = 7;
            OnHandSizeChanged?.Invoke(0, 7);
            OnHandSizeChanged?.Invoke(1, 7);
        }

        /// <summary>
        /// Build deck from definition (ports buildDeckFromDef from simulate.js)
        /// Classic: max 4 copies, min 70 cards
        /// Standard: rarity caps per format
        /// </summary>
        public List<CardData> BuildDeckFromDef(DeckDefinition deckDef)
        {
            var deck = new List<CardData>();
            var counts = new Dictionary<int, int>();

            foreach (var cardId in deckDef.cards)
            {
                if (!CardMap.TryGetValue(cardId, out var card))
                {
                    Debug.LogWarning($"Card ID {cardId} not found in database");
                    continue;
                }

                int currentCount = counts.GetValueOrDefault(cardId, 0);
                int maxCopies = 4; // Classic default

                // Standard format: check rarity caps
                if (Format == "Standard" && deckDef.rarityCaps != null)
                {
                    var rarityKey = card.rarity.ToString();
                    if (deckDef.rarityCaps.TryGetValue(rarityKey, out var cap))
                        maxCopies = cap;
                }

                if (currentCount < maxCopies)
                {
                    // Create a copy for the deck (so each card instance is unique)
                    var deckCard = CloneCardForDeck(card);
                    deck.Add(deckCard);
                    counts[cardId] = currentCount + 1;
                }
            }

            // Enforce minimum deck size
            if (deck.Count < deckDef.minSize)
            {
                Debug.LogWarning($"Deck '{deckDef.name}' has {deck.Count} cards, minimum is {deckDef.minSize}");
            }

            return deck;
        }

        /// <summary>
        /// Create a runtime instance of a card for a deck
        /// </summary>
        private CardData CloneCardForDeck(CardData source)
        {
            return new CardData
            {
                id = source.id,
                cardId = source.cardId,
                cardName = source.cardName,
                type = source.type,
                cost = source.cost,
                attack = source.attack,
                health = source.health,
                loyalty = source.loyalty,
                rarity = source.rarity,
                color = source.color,
                abilities = new List<AbilityData>(source.abilities),
                keywordFlags = source.keywordFlags,
                artKey = source.artKey,
                flavorText = source.flavorText,
                textPatch = source.textPatch,
                isToken = source.isToken,
                tokenCopies = source.tokenCopies
            };
        }

        // === Player Actions ===

        /// <summary>
        /// Play a land from hand
        /// </summary>
        public bool PlayLand(int playerId, CardData card)
        {
            if (!TurnManager.CanPlayLand(playerId)) return false;
            if (card.type != CardType.Land) return false;

            var hand = ZoneManager.GetZone(playerId, ZoneType.Hand);
            if (!hand.Remove(card)) return false;

            ZoneManager.MoveCard(card, ZoneType.Hand, ZoneType.Battlefield, playerId);
            HasPlayedLand[playerId] = true;
            HandSizes[playerId]--;
            OnHandSizeChanged?.Invoke(playerId, HandSizes[playerId]);
            OnCardPlayed?.Invoke(playerId, card);

            // Trigger ETB abilities
            TriggerSystem.Trigger(TriggerType.OnEnterBattlefield, card, playerId);

            return true;
        }

        /// <summary>
        /// Cast a spell from hand (puts on stack)
        /// </summary>
        public bool CastSpell(int playerId, CardData card)
        {
            if (!TurnManager.CanCastSorcery(playerId) && card.type != CardType.Decree) return false;

            var hand = ZoneManager.GetZone(playerId, ZoneType.Hand);
            if (!hand.Remove(card)) return false;

            // Check mana cost
            if (!ManaSystem.CanPayMana(playerId, card.cost)) return false;

            // Pay mana
            ManaSystem.PayMana(playerId, card.cost);
            HandSizes[playerId]--;
            OnHandSizeChanged?.Invoke(playerId, HandSizes[playerId]);

            // Put on stack
            var stackObj = new StackObject(card, playerId, StackObjectType.Spell);
            // GameStack is accessed via a reference - we'll need to add it
            // For now, use a placeholder
            // _gameStack.Push(stackObj);

            OnCardPlayed?.Invoke(playerId, card);
            return true;
        }

        /// <summary>
        /// Activate an ability (puts on stack)
        /// </summary>
        public bool ActivateAbility(int playerId, CardData source, AbilityData ability)
        {
            // Check if ability can be activated (cost, timing, etc.)
            if (!CanActivateAbility(playerId, source, ability)) return false;

            // Pay costs
            if (ability.parameters != null && ability.parameters["cost"] != null)
            {
                var cost = ManaCost.FromJToken(ability.parameters["cost"]);
                if (!ManaSystem.PayMana(playerId, cost)) return false;
            }

            // Put on stack
            var stackObj = new StackObject(source, playerId, StackObjectType.ActivatedAbility)
            {
                ability = ability
            };
            // _gameStack.Push(stackObj);

            return true;
        }

        private bool CanActivateAbility(int playerId, CardData source, AbilityData ability)
        {
            // Check timing restrictions, tap requirements, etc.
            return true; // Simplified
        }

        /// <summary>
        /// Pass priority
        /// </summary>
        public async UniTask PassPriority(int playerId)
        {
            if (!PriorityManager.HasPriority(playerId)) return;
            await PriorityManager.PassPriority();
        }

        // === Trigger System ===

        /// <summary>
        /// Trigger abilities of a specific type
        /// </summary>
        public void TriggerAbilities(TriggerType triggerType, int playerId, object context = null)
        {
            TriggerSystem.Trigger(triggerType, playerId, context);
        }

        /// <summary>
        /// Trigger for a specific card
        /// </summary>
        public void Trigger(TriggerType triggerType, CardData card, int playerId, object context = null)
        {
            TriggerSystem.Trigger(triggerType, card, playerId, context);
        }

        // === Zone Helpers ===

        public void UntapAll(int playerId)
        {
            // Remove "until end of turn" effects
            ManaSystem.UntapAllLands(playerId);
            HasPlayedLand[playerId] = false;
        }

        public CardData DrawCard(int playerId)
        {
            var card = ZoneManager.DrawCard(playerId);
            if (card != null)
            {
                HandSizes[playerId]++;
                OnHandSizeChanged?.Invoke(playerId, HandSizes[playerId]);
                OnCardDrawn?.Invoke(playerId, card);
            }
            return card;
        }

        public void Discard(int playerId, CardData card)
        {
            ZoneManager.Discard(playerId, card);
            HandSizes[playerId]--;
            OnHandSizeChanged?.Invoke(playerId, HandSizes[playerId]);
            OnCardDiscarded?.Invoke(playerId, card);
        }

        public void Cleanup(int playerId)
        {
            // Discard to hand size (7)
            var hand = ZoneManager.GetZone(playerId, ZoneType.Hand);
            while (hand.Count > 7)
            {
                var card = hand.RemoveAt(hand.Count - 1);
                ZoneManager.GetZone(playerId, ZoneType.Graveyard).Add(card);
                HandSizes[playerId]--;
            }
            OnHandSizeChanged?.Invoke(playerId, HandSizes[playerId]);

            // Remove damage from creatures
            // End "until end of turn" effects
            ManaSystem.EmptyPool(playerId);
        }

        public bool HasPlayedLandThisTurn(int playerId) => HasPlayedLand[playerId];

        // === Stack Resolution ===

        private async UniTask OnBothPassedAsync()
        {
            // Both players passed - resolve top of stack or advance
            // This is called from PriorityManager when both pass
            await ResolveTopOfStackOrAdvance();
        }

        private async UniTask ResolveTopOfStackOrAdvance()
        {
            // Get top of stack and resolve
            // If stack empty, advance turn step
            await UniTask.Yield();
        }

        private void OnPriorityChanged()
        {
            // UI update
        }

        // === Damage / Life ===

        public void DealDamage(int targetPlayerId, int amount, CardData source = null)
        {
            LifeTotals[targetPlayerId] -= amount;
            OnLifeChanged?.Invoke(targetPlayerId, LifeTotals[targetPlayerId]);

            if (LifeTotals[targetPlayerId] <= 0)
            {
                GameOver = true;
                WinnerPlayerId = 1 - targetPlayerId;
                OnGameOver?.Invoke();
            }

            // Trigger lifegain/damage triggers
            if (amount > 0)
            {
                TriggerSystem.Trigger(TriggerType.OnLoseLife, targetPlayerId, amount);
                if (source != null && source.HasKeyword(KeywordFlags.Siphon))
                {
                    // Lifelink
                    GainLife(source.controllerPlayerId, amount);
                }
            }
        }

        public void GainLife(int playerId, int amount)
        {
            LifeTotals[playerId] += amount;
            OnLifeChanged?.Invoke(playerId, LifeTotals[playerId]);
            TriggerSystem.Trigger(TriggerType.OnGainLife, playerId, amount);
        }

        // === Getters ===

        public CardData GetCard(int id) => CardMap.GetValueOrDefault(id);
        public CardData GetCardById(string cardId) => CardDatabaseLoader.GetCardById(cardId);
    }
}