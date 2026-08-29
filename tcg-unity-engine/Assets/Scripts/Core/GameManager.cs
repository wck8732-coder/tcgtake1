// GameManager.cs
// Entry point - initializes all systems and starts the game
// Singleton pattern for easy access from anywhere
using Cysharp.Threading.Tasks;
using UnityEngine;
using TCG.Core;
using TCG.Data;
using TCG.Rendering;

namespace TCG
{
    /// <summary>
    /// Main game manager - initializes all systems and coordinates gameplay
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Game Settings")]
        [SerializeField] private string _format = "Classic";
        [SerializeField] private int _difficulty = 1;
        [SerializeField] private int _player1DeckIndex = 0;
        [SerializeField] private int _player2DeckIndex = 0;

        [Header("System References")]
        [SerializeField] private HandLayout _player0Hand;
        [SerializeField] private HandLayout _player1Hand;
        [SerializeField] private BattlefieldLayout _battlefieldLayout;

        // Core systems
        public GameState GameState { get; private set; }
        public TurnManager TurnManager => GameState?.TurnManager;
        public PriorityManager PriorityManager => GameState?.PriorityManager;
        public ManaSystem ManaSystem => GameState?.ManaSystem;
        public ZoneManager ZoneManager => GameState?.ZoneManager;
        public EffectResolver EffectResolver => GameState?.EffectResolver;
        public TriggerSystem TriggerSystem => GameState?.TriggerSystem;
        public CombatEngine CombatEngine => GameState?.CombatEngine;

        private bool _isInitialized = false;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private async void Start()
        {
            await InitializeGame();
        }

        /// <summary>
        /// Initialize all game systems
        /// </summary>
        public async UniTask InitializeGame()
        {
            if (_isInitialized) return;

            Debug.Log("TCG: Initializing game systems...");

            // 1. Load card database (must happen first)
            CardDatabaseLoader.LoadDatabase();
            Debug.Log($"TCG: Loaded {CardDatabaseLoader.Count} cards");

            // 2. Create GameState (initializes all subsystems)
            GameState = new GameState();
            GameState.Initialize(_format, _difficulty, _player1DeckIndex, _player2DeckIndex);

            // 3. Subscribe to GameState events for UI updates
            GameState.OnLifeChanged += OnLifeChanged;
            GameState.OnHandSizeChanged += OnHandSizeChanged;
            GameState.OnCardDrawn += OnCardDrawn;
            GameState.OnCardPlayed += OnCardPlayed;
            GameState.OnCardDiscarded += OnCardDiscarded;
            GameState.OnGameOver += OnGameOver;
            GameState.OnTurnChanged += OnTurnChanged;
            GameState.OnPhaseChanged += OnPhaseChanged;
            GameState.OnStepChanged += OnStepChanged;

            // 4. Initialize rendering systems
            if (_player0Hand != null) _player0Hand.Initialize(0, GameState);
            if (_player1Hand != null) _player1Hand.Initialize(1, GameState);
            if (_battlefieldLayout != null) _battlefieldLayout.Initialize(GameState);

            // 5. Sync initial hand visuals
            await SyncHandVisuals(0);
            await SyncHandVisuals(1);

            _isInitialized = true;
            Debug.Log("TCG: Game initialized successfully!");

            // 6. Start first turn (TurnManager already started in Initialize)
            // Game loop runs via TurnManager events
        }

        private async UniTask SyncHandVisuals(int playerId)
        {
            var handLayout = playerId == 0 ? _player0Hand : _player1Hand;
            if (handLayout == null) return;

            var handZone = ZoneManager.GetZone(playerId, ZoneType.Hand);
            foreach (var card in handZone.cards)
            {
                await handLayout.AddCard(card);
            }
        }

        // === Event Handlers ===

        private void OnLifeChanged(int playerId, int newLife)
        {
            Debug.Log($"TCG: Player {playerId} life: {newLife}");
            // Update UI
        }

        private void OnHandSizeChanged(int playerId, int newSize)
        {
            Debug.Log($"TCG: Player {playerId} hand size: {newSize}");
        }

        private void OnCardDrawn(int playerId, CardData card)
        {
            Debug.Log($"TCG: Player {playerId} drew {card.cardName}");
            var handLayout = playerId == 0 ? _player0Hand : _player1Hand;
            if (handLayout != null)
                await handLayout.AddCard(card);
        }

        private void OnCardPlayed(int playerId, CardData card)
        {
            Debug.Log($"TCG: Player {playerId} played {card.cardName}");
            // Move from hand to battlefield/stack visually
        }

        private void OnCardDiscarded(int playerId, CardData card)
        {
            Debug.Log($"TCG: Player {playerId} discarded {card.cardName}");
            var handLayout = playerId == 0 ? _player0Hand : _player1Hand;
            if (handLayout != null)
            {
                // Find and remove the card view
                var cardView = handLayout.Cards.Find(c => c._cardData == card);
                if (cardView != null)
                    await handLayout.RemoveCard(cardView);
            }
        }

        private void OnGameOver()
        {
            Debug.Log($"TCG: Game Over! Winner: Player {GameState.WinnerPlayerId}");
            // Show game over UI
        }

        private void OnTurnChanged(int turnNumber)
        {
            Debug.Log($"TCG: Turn {turnNumber} - Player {TurnManager.ActivePlayerId}'s turn");
            // Untap lands, reset mana, etc.
            ManaSystem.UntapAllLands(TurnManager.ActivePlayerId);
            ManaSystem.EmptyPool(TurnManager.ActivePlayerId);
        }

        private void OnPhaseChanged()
        {
            Debug.Log($"TCG: Phase: {TurnManager.CurrentPhase}");
        }

        private void OnStepChanged()
        {
            Debug.Log($"TCG: Step: {TurnManager.CurrentStep}");
        }

        // === Public API for UI/Input ===

        /// <summary>
        /// Attempt to play a land from hand
        /// </summary>
        public bool TryPlayLand(int playerId, CardData card)
        {
            return GameState.PlayLand(playerId, card);
        }

        /// <summary>
        /// Attempt to cast a spell from hand
        /// </summary>
        public bool TryCastSpell(int playerId, CardData card)
        {
            return GameState.CastSpell(playerId, card);
        }

        /// <summary>
        /// Pass priority
        /// </summary>
        public async UniTask TryPassPriority(int playerId)
        {
            await GameState.PassPriority(playerId);
        }

        /// <summary>
        /// Declare attackers
        /// </summary>
        public void DeclareAttackers(List<(CardData card, int? target)> attackers)
        {
            CombatEngine.DeclareAttackers(attackers);
        }

        /// <summary>
        /// Declare blockers
        /// </summary>
        public bool DeclareBlocker(int defenderPlayerId, CardData blocker, int attackerIndex)
        {
            return CombatEngine.DeclareBlocker(defenderPlayerId, blocker, attackerIndex);
        }

        /// <summary>
        /// Resolve combat damage
        /// </summary>
        public void ResolveCombat()
        {
            CombatEngine.DealCombatDamage();
            CombatEngine.EndCombat();
        }

        /// <summary>
        /// Restart game
        /// </summary>
        public async UniTask RestartGame()
        {
            // Cleanup
            _player0Hand?.Clear();
            _player1Hand?.Clear();
            // Reinitialize
            _isInitialized = false;
            await InitializeGame();
        }

        private void OnDestroy()
        {
            if (GameState != null)
            {
                GameState.OnLifeChanged -= OnLifeChanged;
                GameState.OnHandSizeChanged -= OnHandSizeChanged;
                GameState.OnCardDrawn -= OnCardDrawn;
                GameState.OnCardPlayed -= OnCardPlayed;
                GameState.OnCardDiscarded -= OnCardDiscarded;
                GameState.OnGameOver -= OnGameOver;
                GameState.OnTurnChanged -= OnTurnChanged;
                GameState.OnPhaseChanged -= OnPhaseChanged;
                GameState.OnStepChanged -= OnStepChanged;
            }
        }
    }
}