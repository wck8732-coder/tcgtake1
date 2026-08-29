// CardPool.cs
// Object pool for CardView - essential for 480+ cards, hand/board/graveyard
// MTGA pattern: pre-warm pool, never Instantiate/Destroy at runtime
using System.Collections.Generic;
using UnityEngine;
using TCG.Data;

namespace TCG.Rendering
{
    /// <summary>
    /// Generic object pool for CardView components
    /// Pre-warms at startup, reuses instances for hand, battlefield, graveyard, exile
    /// </summary>
    public class CardPool : MonoBehaviour
    {
        [Header("Pool Settings")]
        [SerializeField] private CardView _cardViewPrefab;
        [SerializeField] private int _prewarmCount = 100;
        [SerializeField] private int _maxPoolSize = 500;

        [Header("Pool Containers")]
        [SerializeField] private Transform _handPoolContainer;
        [SerializeField] private Transform _battlefieldPoolContainer;
        [SerializeField] private Transform _graveyardPoolContainer;
        [SerializeField] private Transform _exilePoolContainer;
        [SerializeField] private Transform _libraryPoolContainer;

        private readonly Stack<CardView> _available = new();
        private readonly HashSet<CardView> _inUse = new();
        private readonly Dictionary<ZoneType, Transform> _containers = new();

        public static CardPool Instance { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            InitializeContainers();
            PrewarmPool();
        }

        private void InitializeContainers()
        {
            _containers[ZoneType.Hand] = _handPoolContainer ?? CreateContainer("HandPool");
            _containers[ZoneType.Battlefield] = _battlefieldPoolContainer ?? CreateContainer("BattlefieldPool");
            _containers[ZoneType.Graveyard] = _graveyardPoolContainer ?? CreateContainer("GraveyardPool");
            _containers[ZoneType.Exile] = _exilePoolContainer ?? CreateContainer("ExilePool");
            _containers[ZoneType.Library] = _libraryPoolContainer ?? CreateContainer("LibraryPool");
            _containers[ZoneType.Stack] = CreateContainer("StackPool");
            _containers[ZoneType.Command] = CreateContainer("CommandPool");
        }

        private Transform CreateContainer(string name)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform);
            return go.transform;
        }

        private void PrewarmPool()
        {
            for (int i = 0; i < _prewarmCount; i++)
            {
                var card = CreateCardView();
                card.OnDespawned();
                _available.Push(card);
            }
            Debug.Log($"TCG: CardPool prewarmed with {_prewarmCount} cards");
        }

        private CardView CreateCardView()
        {
            var card = Instantiate(_cardViewPrefab, transform);
            card.OnReturnedToPool += ReturnToPool;
            return card;
        }

        /// <summary>
        /// Get a card from the pool for a specific zone
        /// </summary>
        public CardView Get(CardData cardData, ZoneType zone = ZoneType.Hand)
        {
            CardView card;

            if (_available.Count > 0)
            {
                card = _available.Pop();
            }
            else if (_inUse.Count < _maxPoolSize)
            {
                card = CreateCardView();
            }
            else
            {
                // Pool exhausted - recycle oldest (shouldn't happen with proper sizing)
                Debug.LogWarning("TCG: CardPool exhausted! Recycling oldest card.");
                card = GetOldestInUse();
                card.OnDespawned();
            }

            card.transform.SetParent(_containers[zone]);
            card.OnSpawned();
            card.Initialize(cardData);
            _inUse.Add(card);

            return card;
        }

        /// <summary>
        /// Return a card to the pool
        /// </summary>
        public void Return(CardView card)
        {
            if (card == null || !_inUse.Contains(card)) return;

            _inUse.Remove(card);
            card.OnDespawned();
            card.transform.SetParent(transform); // Back to root pool container
            _available.Push(card);
        }

        /// <summary>
        /// Move a card between zones (reparents to zone container)
        /// </summary>
        public void MoveToZone(CardView card, ZoneType zone)
        {
            if (card == null || !_containers.ContainsKey(zone)) return;
            card.transform.SetParent(_containers[zone]);
        }

        private CardView GetOldestInUse()
        {
            // Simple: return first in HashSet (not truly oldest, but works)
            foreach (var card in _inUse)
                return card;
            return null;
        }

        /// <summary>
        /// Get all cards currently in use in a specific zone
        /// </summary>
        public List<CardView> GetCardsInZone(ZoneType zone)
        {
            var container = _containers[zone];
            var results = new List<CardView>();
            foreach (Transform child in container)
            {
                if (child.TryGetComponent<CardView>(out var card) && !card.IsPooled)
                    results.Add(card);
            }
            return results;
        }

        /// <summary>
        /// Clear all cards from a zone back to pool
        /// </summary>
        public void ClearZone(ZoneType zone)
        {
            var cards = GetCardsInZone(zone);
            foreach (var card in cards)
                Return(card);
        }

        /// <summary>
        /// Get pool statistics
        /// </summary>
        public (int available, int inUse, int total) GetStats()
        {
            return (_available.Count, _inUse.Count, _available.Count + _inUse.Count);
        }

        /// <summary>
        /// Warm up pool to specific size (call during loading screen)
        /// </summary>
        public void WarmUp(int targetCount)
        {
            int needed = targetCount - (_available.Count + _inUse.Count);
            for (int i = 0; i < needed; i++)
            {
                var card = CreateCardView();
                card.OnDespawned();
                _available.Push(card);
            }
        }
    }
}