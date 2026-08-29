// HandLayout.cs
// 2.5D hand fan layout with smooth animations
// MTGA-style: cards fan out, hover lifts, drag preview
using System.Collections.Generic;
using Cysharp.Threading.Tasks;
using PrimeTween;
using UnityEngine;
using TCG.Data;

namespace TCG.Rendering
{
    /// <summary>
    /// Manages card layout in player's hand - fan arrangement with animations
    /// </summary>
    public class HandLayout : MonoBehaviour
    {
        [Header("Layout Settings")]
        [SerializeField] private float _fanRadius = 8f;
        [SerializeField] private float _maxFanAngle = 30f;        // degrees
        [SerializeField] private float _cardSpacing = 2.5f;
        [SerializeField] private float _hoverHeight = 1.5f;
        [SerializeField] private float _animationDuration = 0.25f;
        [SerializeField] private Ease _animationEase = Ease.OutBack;

        [Header("References")]
        [SerializeField] private CardPool _cardPool;
        [SerializeField] private Transform _handTransform;

        private readonly List<CardView> _cardsInHand = new();
        private int _hoveredIndex = -1;
        private bool _isDragging = false;
        private int _draggedIndex = -1;

        private void Awake()
        {
            if (_cardPool == null) _cardPool = CardPool.Instance;
            if (_handTransform == null) _handTransform = transform;
        }

        /// <summary>
        /// Add a card to hand with animation
        /// </summary>
        public async UniTask AddCard(CardData cardData, int insertIndex = -1)
        {
            var cardView = _cardPool.Get(cardData, ZoneType.Hand);
            if (insertIndex >= 0 && insertIndex <= _cardsInHand.Count)
            {
                _cardsInHand.Insert(insertIndex, cardView);
            }
            else
            {
                _cardsInHand.Add(cardView);
            }

            await RebuildLayout(animate: true);
        }

        /// <summary>
        /// Remove a card from hand (played, discarded)
        /// </summary>
        public async UniTask RemoveCard(CardView cardView, bool returnToPool = true)
        {
            int index = _cardsInHand.IndexOf(cardView);
            if (index < 0) return;

            _cardsInHand.RemoveAt(index);

            if (returnToPool)
                _cardPool.Return(cardView);

            await RebuildLayout(animate: true);
        }

        /// <summary>
        /// Move card within hand (reorder)
        /// </summary>
        public async UniTask ReorderCard(CardView cardView, int newIndex)
        {
            int oldIndex = _cardsInHand.IndexOf(cardView);
            if (oldIndex < 0 || newIndex < 0 || newIndex >= _cardsInHand.Count) return;

            _cardsInHand.RemoveAt(oldIndex);
            _cardsInHand.Insert(newIndex, cardView);
            await RebuildLayout(animate: true);
        }

        /// <summary>
        /// Rebuild entire hand layout
        /// </summary>
        public async UniTask RebuildLayout(bool animate = true)
        {
            int count = _cardsInHand.Count;
            if (count == 0) return;

            // Calculate positions
            var positions = CalculateFanPositions(count);
            var rotations = CalculateFanRotations(count);

            // Animate each card to position
            var tasks = new List<UniTask>();
            for (int i = 0; i < count; i++)
            {
                var card = _cardsInHand[i];
                if (card == null) continue;

                var targetPos = positions[i];
                var targetRot = rotations[i];

                // Adjust for hover
                if (i == _hoveredIndex && !_isDragging)
                {
                    targetPos.y += _hoverHeight;
                }

                if (animate)
                {
                    tasks.Add(AnimateCardTo(card, targetPos, targetRot));
                }
                else
                {
                    card.transform.position = targetPos;
                    card.transform.rotation = targetRot;
                }
            }

            if (animate && tasks.Count > 0)
            {
                await UniTask.WhenAll(tasks);
            }
        }

        private List<Vector3> CalculateFanPositions(int count)
        {
            var positions = new List<Vector3>();

            if (count == 1)
            {
                positions.Add(Vector3.zero);
                return positions;
            }

            // Calculate total arc angle
            float totalAngle = Mathf.Min(_maxFanAngle, (count - 1) * _cardSpacing);
            float startAngle = -totalAngle * 0.5f;
            float angleStep = count > 1 ? totalAngle / (count - 1) : 0;

            for (int i = 0; i < count; i++)
            {
                float angle = startAngle + i * angleStep;
                float rad = angle * Mathf.Deg2Rad;

                // Fan around a circle
                float x = Mathf.Sin(rad) * _fanRadius;
                float z = -Mathf.Cos(rad) * _fanRadius + _fanRadius; // Offset so center is at origin

                positions.Add(new Vector3(x, 0, z));
            }

            return positions;
        }

        private List<Quaternion> CalculateFanRotations(int count)
        {
            var rotations = new List<Quaternion>();

            if (count == 1)
            {
                rotations.Add(Quaternion.identity);
                return rotations;
            }

            float totalAngle = Mathf.Min(_maxFanAngle, (count - 1) * _cardSpacing);
            float startAngle = -totalAngle * 0.5f;
            float angleStep = count > 1 ? totalAngle / (count - 1) : 0;

            for (int i = 0; i < count; i++)
            {
                float angle = startAngle + i * angleStep;
                rotations.Add(Quaternion.Euler(0, angle, 0));
            }

            return rotations;
        }

        private async UniTask AnimateCardTo(CardView card, Vector3 targetPos, Quaternion targetRot)
        {
            if (card == null) return;

            // Move and rotate simultaneously
            var moveTween = Tween.Position(card.transform, targetPos, _animationDuration, _animationEase);
            var rotTween = Tween.Rotation(card.transform, targetRot, _animationDuration, _animationEase);

            await UniTask.WhenAll(moveTween.ToUniTask(), rotTween.ToUniTask());
        }

        // === Hover/Drag Handling ===

        public void OnCardHoverEnter(CardView cardView)
        {
            int index = _cardsInHand.IndexOf(cardView);
            if (index >= 0 && !_isDragging)
            {
                _hoveredIndex = index;
                _ = RebuildLayout(animate: true);
            }
        }

        public void OnCardHoverExit(CardView cardView)
        {
            if (!_isDragging)
            {
                _hoveredIndex = -1;
                _ = RebuildLayout(animate: true);
            }
        }

        public void OnDragStart(CardView cardView)
        {
            _isDragging = true;
            _draggedIndex = _cardsInHand.IndexOf(cardView);
            _hoveredIndex = -1;

            // Bring to front
            cardView.transform.SetAsLastSibling();
        }

        public void OnDragUpdate(CardView cardView, Vector3 worldPosition)
        {
            if (!_isDragging || _draggedIndex < 0) return;

            // Follow mouse with slight lag for "physical" feel
            var pos = worldPosition;
            pos.y = _hoverHeight * 2; // Higher when dragging
            Tween.Position(cardView.transform, pos, 0.05f, Ease.OutQuad);
        }

        public async UniTask OnDragEnd(CardView cardView, bool wasPlayed)
        {
            _isDragging = false;

            if (wasPlayed)
            {
                // Card was played - remove from hand
                await RemoveCard(cardView, returnToPool: false); // Don't return to pool, it's on battlefield now
            }
            else
            {
                // Return to hand position
                _draggedIndex = -1;
                await RebuildLayout(animate: true);
            }
        }

        // === Utility ===

        public int Count => _cardsInHand.Count;
        public IReadOnlyList<CardView> Cards => _cardsInHand.AsReadOnly();

        public CardView GetCardAtIndex(int index)
        {
            return index >= 0 && index < _cardsInHand.Count ? _cardsInHand[index] : null;
        }

        public int GetCardIndex(CardView cardView)
        {
            return _cardsInHand.IndexOf(cardView);
        }

        public void Clear()
        {
            foreach (var card in _cardsInHand)
            {
                _cardPool.Return(card);
            }
            _cardsInHand.Clear();
        }
    }
}