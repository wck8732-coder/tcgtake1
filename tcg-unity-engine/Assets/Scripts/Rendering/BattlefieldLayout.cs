// BattlefieldLayout.cs
// 2.5D battlefield grid/slot layout for creatures, lands, enchantments
// MTGA-style: lands left, creatures right, stack center
using System.Collections.Generic;
using Cysharp.Threading.Tasks;
using PrimeTween;
using UnityEngine;
using TCG.Data;

namespace TCG.Rendering
{
    /// <summary>
    /// Manages card layout on the battlefield - grid slots for permanents
    /// Separate areas for each player: lands, creatures, enchantments, artifacts
    /// </summary>
    public class BattlefieldLayout : MonoBehaviour
    {
        [Header("Layout Settings")]
        [SerializeField] private float _slotSize = 2.5f;
        [SerializeField] private float _rowSpacing = 3f;
        [SerializeField] private float _zoneSpacing = 4f;
        [SerializeField] private int _maxSlotsPerRow = 8;
        [SerializeField] private float _animationDuration = 0.3f;
        [SerializeField] private Ease _animationEase = Ease.OutBack;

        [Header("Player 0 (Bottom) Zones")]
        [SerializeField] private Transform _p0LandsZone;
        [SerializeField] private Transform _p0CreaturesZone;
        [SerializeField] private Transform _p0EnchantmentsZone;
        [SerializeField] private Transform _p0ArtifactsZone;

        [Header("Player 1 (Top) Zones")]
        [SerializeField] private Transform _p1LandsZone;
        [SerializeField] private Transform _p1CreaturesZone;
        [SerializeField] private Transform _p1EnchantmentsZone;
        [SerializeField] private Transform _p1ArtifactsZone;

        [Header("Shared Zones")]
        [SerializeField] private Transform _stackZone;
        [SerializeField] private Transform _exileZone;

        [Header("References")]
        [SerializeField] private CardPool _cardPool;

        // Slot tracking
        private readonly Dictionary<int, List<BattlefieldSlot>> _playerSlots = new();
        private readonly Dictionary<CardView, BattlefieldSlot> _cardToSlot = new();

        private void Awake()
        {
            if (_cardPool == null) _cardPool = CardPool.Instance;
            InitializeSlots();
        }

        private void InitializeSlots()
        {
            for (int player = 0; player < 2; player++)
            {
                _playerSlots[player] = new List<BattlefieldSlot>();

                var zones = GetPlayerZones(player);
                foreach (var zone in zones)
                {
                    for (int i = 0; i < _maxSlotsPerRow; i++)
                    {
                        var slot = new BattlefieldSlot
                        {
                            playerId = player,
                            zoneType = zone.zoneType,
                            index = i,
                            zoneTransform = zone.transform,
                            isOccupied = false
                        };
                        _playerSlots[player].Add(slot);
                    }
                }
            }
        }

        private (ZoneType zoneType, Transform transform)[] GetPlayerZones(int player)
        {
            if (player == 0)
            {
                return new[]
                {
                    (ZoneType.Battlefield, _p0LandsZone),
                    (ZoneType.Battlefield, _p0CreaturesZone),
                    (ZoneType.Battlefield, _p0EnchantmentsZone),
                    (ZoneType.Battlefield, _p0ArtifactsZone)
                };
            }
            else
            {
                return new[]
                {
                    (ZoneType.Battlefield, _p1LandsZone),
                    (ZoneType.Battlefield, _p1CreaturesZone),
                    (ZoneType.Battlefield, _p1EnchantmentsZone),
                    (ZoneType.Battlefield, _p1ArtifactsZone)
                };
            }
        }

        /// <summary>
        /// Add a permanent to battlefield
        /// </summary>
        public async UniTask AddPermanent(CardData cardData, int playerId, ZoneType zoneType = ZoneType.Battlefield)
        {
            var slot = FindEmptySlot(playerId, zoneType);
            if (slot == null)
            {
                Debug.LogWarning($"TCG: No empty slot for player {playerId} in zone {zoneType}");
                return;
            }

            var cardView = _cardPool.Get(cardData, zoneType);
            cardView.transform.SetParent(slot.zoneTransform);

            slot.cardView = cardView;
            slot.isOccupied = true;
            _cardToSlot[cardView] = slot;

            await AnimateToSlot(cardView, slot);
        }

        /// <summary>
        /// Move a permanent to a different zone/slot
        /// </summary>
        public async UniTask MovePermanent(CardView cardView, int playerId, ZoneType newZoneType)
        {
            if (!_cardToSlot.TryGetValue(cardView, out var oldSlot)) return;

            oldSlot.cardView = null;
            oldSlot.isOccupied = false;

            var newSlot = FindEmptySlot(playerId, newZoneType);
            if (newSlot == null) return;

            newSlot.cardView = cardView;
            newSlot.isOccupied = true;
            _cardToSlot[cardView] = newSlot;

            cardView.transform.SetParent(newSlot.zoneTransform);
            await AnimateToSlot(cardView, newSlot);
        }

        /// <summary>
        /// Remove a permanent from battlefield (destroyed, bounced, exiled)
        /// </summary>
        public async UniTask RemovePermanent(CardView cardView, bool returnToPool = true)
        {
            if (!_cardToSlot.TryGetValue(cardView, out var slot)) return;

            slot.cardView = null;
            slot.isOccupied = false;
            _cardToSlot.Remove(cardView);

            // Animate off screen then return to pool
            var offScreenPos = slot.zoneTransform.position + Vector3.up * 10f;
            await Tween.Position(cardView.transform, offScreenPos, 0.2f, Ease.InQuad).ToUniTask();

            if (returnToPool)
                _cardPool.Return(cardView);
        }

        /// <summary>
        /// Move card to stack zone (casting spell)
        /// </summary>
        public async UniTask MoveToStack(CardView cardView, int playerId)
        {
            if (_stackZone == null) return;

            var stackPos = _stackZone.position + Vector3.up * _cardToSlot.Count * 0.1f;
            cardView.transform.SetParent(_stackZone);
            await Tween.Position(cardView.transform, stackPos, 0.2f, Ease.OutQuad).ToUniTask();
        }

        /// <summary>
        /// Move card from stack to battlefield (resolved)
        /// </summary>
        public async UniTask ResolveFromStack(CardView cardView, int playerId, ZoneType zoneType)
        {
            await AddPermanent(cardView._cardData, playerId, zoneType);
        }

        /// <summary>
        /// Move to exile zone
        /// </summary>
        public async UniTask MoveToExile(CardView cardView, int playerId)
        {
            if (_exileZone == null) return;

            var exilePos = _exileZone.position + Vector3.right * _cardToSlot.Count * 0.5f;
            cardView.transform.SetParent(_exileZone);
            await Tween.Position(cardView.transform, exilePos, 0.2f, Ease.OutQuad).ToUniTask();
        }

        private BattlefieldSlot FindEmptySlot(int playerId, ZoneType zoneType)
        {
            if (!_playerSlots.TryGetValue(playerId, out var slots)) return null;

            return slots.Find(s => !s.isOccupied && s.zoneType == zoneType);
        }

        private async UniTask AnimateToSlot(CardView cardView, BattlefieldSlot slot)
        {
            var targetPos = CalculateSlotPosition(slot);
            var targetRot = CalculateSlotRotation(slot);

            await UniTask.WhenAll(
                Tween.Position(cardView.transform, targetPos, _animationDuration, _animationEase).ToUniTask(),
                Tween.Rotation(cardView.transform, targetRot, _animationDuration, _animationEase).ToUniTask()
            );
        }

        private Vector3 CalculateSlotPosition(BattlefieldSlot slot)
        {
            int row = slot.index / _maxSlotsPerRow;
            int col = slot.index % _maxSlotsPerRow;

            var basePos = slot.zoneTransform.position;
            return basePos + new Vector3(col * _slotSize, 0, row * _rowSpacing);
        }

        private Quaternion CalculateSlotRotation(BattlefieldSlot slot)
        {
            // Player 0 cards face up, Player 1 cards face down (rotated 180°)
            return slot.playerId == 0 ? Quaternion.identity : Quaternion.Euler(0, 180, 0);
        }

        /// <summary>
        /// Compact slots (remove gaps when cards leave)
        /// </summary>
        public async UniTask CompactLayout(int playerId)
        {
            if (!_playerSlots.TryGetValue(playerId, out var slots)) return;

            var tasks = new List<UniTask>();
            int writeIndex = 0;

            for (int readIndex = 0; readIndex < slots.Count; readIndex++)
            {
                var slot = slots[readIndex];
                if (slot.isOccupied && slot.cardView != null)
                {
                    if (writeIndex != readIndex)
                    {
                        // Move card to compacted slot
                        var targetSlot = slots[writeIndex];
                        targetSlot.cardView = slot.cardView;
                        targetSlot.isOccupied = true;
                        _cardToSlot[slot.cardView] = targetSlot;

                        slot.cardView = null;
                        slot.isOccupied = false;

                        await AnimateToSlot(targetSlot.cardView, targetSlot);
                    }
                    writeIndex++;
                }
            }
        }

        // === Slot Data Structure ===

        private class BattlefieldSlot
        {
            public int playerId;
            public ZoneType zoneType;
            public int index;
            public Transform zoneTransform;
            public bool isOccupied;
            public CardView cardView;
        }
    }
}