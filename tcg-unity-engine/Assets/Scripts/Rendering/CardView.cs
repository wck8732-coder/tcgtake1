// CardView.cs
// Single MonoBehaviour for all card visuals - driven by CardData
// MTGA pattern: one prefab, GPU instanced material, TextMeshPro for text
using System.Collections.Generic;
using Cysharp.Threading.Tasks;
using PrimeTween;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using TCG.Data;

namespace TCG.Rendering
{
    /// <summary>
    /// Card visual representation - single prefab used for all 480 cards
    /// Driven entirely by CardData (ScriptableObject or runtime instance)
    /// </summary>
    public class CardView : MonoBehaviour, IPoolable
    {
        [Header("References")]
        [SerializeField] private MeshRenderer _meshRenderer;
        [SerializeField] private MeshFilter _meshFilter;
        [SerializeField] private TextMeshPro _nameText;
        [SerializeField] private TextMeshPro _costText;
        [SerializeField] private TextMeshPro _typeText;
        [SerializeField] private TextMeshPro _attackText;
        [SerializeField] private TextMeshPro _healthText;
        [SerializeField] private TextMeshPro _abilityText;
        [SerializeField] private Image _artImage;
        [SerializeField] private GameObject _foilOverlay;
        [SerializeField] private GameObject _keywordIconsContainer;
        [SerializeField] private BoxCollider _collider;

        [Header("Materials")]
        [SerializeField] private Material _baseMaterial;      // GPU instanced
        [SerializeField] private Material _foilMaterial;      // Shader Graph holo/foil
        [SerializeField] private Material _stencilMaskMaterial; // Custom HLSL

        // Runtime state
        private CardData _cardData;
        private MaterialPropertyBlock _propertyBlock;
        private bool _isInitialized;
        private Vector3 _originalScale;
        private Tween _currentTween;

        // Pooling
        public bool IsPooled { get; private set; }
        public event Action<CardView> OnReturnedToPool;

        private void Awake()
        {
            _propertyBlock = new MaterialPropertyBlock();
            _originalScale = transform.localScale;
            _isInitialized = true;
        }

        /// <summary>
        /// Initialize card view with data
        /// </summary>
        public void Initialize(CardData cardData)
        {
            _cardData = cardData;
            gameObject.name = $"Card_{cardData.cardName}";

            UpdateVisuals();
            UpdateKeywordIcons();
        }

        /// <summary>
        /// Update all visual elements from CardData
        /// </summary>
        public void UpdateVisuals()
        {
            if (_cardData == null) return;

            // Name
            if (_nameText != null)
                _nameText.text = _cardData.cardName;

            // Mana Cost
            if (_costText != null)
                _costText.text = _cardData.cost?.ToString() ?? "";

            // Type
            if (_typeText != null)
                _typeText.text = _cardData.type.ToString();

            // Attack/Health (for champions/creatures)
            if (_attackText != null && _healthText != null)
            {
                if (_cardData.type == CardType.Champion || _cardData.type == CardType.Token)
                {
                    _attackText.text = _cardData.attack.ToString();
                    _healthText.text = _cardData.health.ToString();
                    _attackText.gameObject.SetActive(true);
                    _healthText.gameObject.SetActive(true);
                }
                else
                {
                    _attackText.gameObject.SetActive(false);
                    _healthText.gameObject.SetActive(false);
                }
            }

            // Ability Text (rich text with keyword highlighting)
            if (_abilityText != null)
            {
                _abilityText.text = FormatAbilityText(_cardData);
            }

            // Artwork
            UpdateArtwork();

            // Foil
            UpdateFoil();

            // Material properties for GPU instancing
            UpdateMaterialProperties();

            // Collider size
            UpdateCollider();
        }

        private string FormatAbilityText(CardData card)
        {
            if (!string.IsNullOrEmpty(card.textPatch))
            {
                // Authored override from build-cards.js
                return card.textPatch;
            }

            // Generate from abilities
            var parts = new List<string>();
            foreach (var ability in card.abilities)
            {
                if (!string.IsNullOrEmpty(ability.textPatch))
                {
                    parts.Add(ability.textPatch);
                }
                else
                {
                    // Generate from effectId + parameters
                    parts.Add(GenerateEffectText(ability));
                }
            }

            // Add keywords
            var keywords = card.GetStringKeywords();
            if (keywords.Count > 0)
            {
                parts.Insert(0, string.Join(", ", keywords));
            }

            return string.Join("\n", parts);
        }

        private string GenerateEffectText(AbilityData ability)
        {
            // Port from shared/effects.js describeAbility
            return ability.effectId switch
            {
                "deal_damage" => $"Deal {ability.parameters?["amount"] ?? ability.parameters?["value"] ?? 1} damage.",
                "draw_cards" => $"Draw {ability.parameters?["count"] ?? ability.parameters?["value"] ?? 1} card(s).",
                "gain_life" => $"Gain {ability.parameters?["amount"] ?? ability.parameters?["value"] ?? 1} life.",
                "pump_self_stats" => $"This gets +{ability.parameters?["attack"] ?? 0}/+{ability.parameters?["health"] ?? 0} until end of turn.",
                "pump_stats_target" => $"Target gets +{ability.parameters?["attack"] ?? 0}/+{ability.parameters?["health"] ?? 0} until end of turn.",
                "create_token" => $"Create a {ability.parameters?["token_id"] ?? "token"} token.",
                "destroy_target" => "Destroy target.",
                "exile_target" => "Exile target.",
                "bounce_target" => "Return target to its owner's hand.",
                "counter_spell" => "Counter target spell.",
                _ => ability.effectId.Replace("_", " ")
            };
        }

        private void UpdateKeywordIcons()
        {
            if (_keywordIconsContainer == null) return;

            // Clear existing
            foreach (Transform child in _keywordIconsContainer.transform)
                Destroy(child.gameObject);

            // Add keyword icons (would use prefab icons)
            var keywords = _cardData?.GetStringKeywords();
            if (keywords != null)
            {
                foreach (var kw in keywords)
                {
                    // Instantiate keyword icon prefab
                    // var icon = Instantiate(_keywordIconPrefab, _keywordIconsContainer.transform);
                    // icon.SetKeyword(kw);
                }
            }
        }

        private void UpdateArtwork()
        {
            if (_artImage == null || string.IsNullOrEmpty(_cardData.artKey)) return;

            // Load artwork via Addressables or Resources
            // For now, placeholder
            // Addressables.LoadAssetAsync<Sprite>(_cardData.artKey).Completed += handle => _artImage.sprite = handle.Result;
        }

        private void UpdateFoil()
        {
            if (_foilOverlay == null) return;

            bool isFoil = _cardData.rarity >= Rarity.Rare || _cardData.isToken;
            _foilOverlay.SetActive(isFoil);

            if (isFoil && _foilMaterial != null)
            {
                // Animate foil shimmer
                // _foilMaterial.SetFloat("_Time", Time.time);
            }
        }

        private void UpdateMaterialProperties()
        {
            if (_meshRenderer == null || _baseMaterial == null) return;

            // Per-instance properties via MaterialPropertyBlock (keeps GPU instancing!)
            _propertyBlock.Clear();

            // Color by rarity
            Color rarityColor = GetRarityColor(_cardData.rarity);
            _propertyBlock.SetColor("_CardColor", rarityColor);

            // Art texture
            // _propertyBlock.SetTexture("_ArtTex", _artImage?.sprite?.texture);

            // Foil intensity
            _propertyBlock.SetFloat("_FoilIntensity", _cardData.rarity >= Rarity.Rare ? 1f : 0f);

            _meshRenderer.SetPropertyBlock(_propertyBlock);
        }

        private Color GetRarityColor(Rarity rarity)
        {
            return rarity switch
            {
                Rarity.Common => Color.white,
                Rarity.Uncommon => new Color(0.2f, 1f, 0.2f),     // Green
                Rarity.Rare => new Color(0.2f, 0.6f, 1f),          // Blue
                Rarity.Mythic => new Color(1f, 0.5f, 0f),          // Orange/Red
                Rarity.Token => new Color(0.8f, 0.8f, 0.8f),       // Gray
                Rarity.Special => new Color(1f, 0.2f, 1f),         // Purple
                _ => Color.white
            };
        }

        private void UpdateCollider()
        {
            if (_collider != null && _meshFilter != null && _meshFilter.sharedMesh != null)
            {
                _collider.size = _meshFilter.sharedMesh.bounds.size;
                _collider.center = _meshFilter.sharedMesh.bounds.center;
            }
        }

        // === Animation Methods (PrimeTween - allocation free) ===

        /// <summary>
        /// Move card to position with spring animation
        /// </summary>
        public Tween MoveTo(Vector3 targetPosition, float duration = 0.3f, Ease ease = Ease.OutBack)
        {
            KillCurrentTween();
            _currentTween = Tween.Position(transform, targetPosition, duration, ease);
            return _currentTween;
        }

        /// <summary>
        /// Rotate card (for flip animations)
        /// </summary>
        public Tween RotateTo(Quaternion targetRotation, float duration = 0.2f, Ease ease = Ease.OutQuad)
        {
            KillCurrentTween();
            _currentTween = Tween.Rotation(transform, targetRotation, duration, ease);
            return _currentTween;
        }

        /// <summary>
        /// Scale card (for hover/selection)
        /// </summary>
        public Tween ScaleTo(Vector3 targetScale, float duration = 0.15f, Ease ease = Ease.OutQuad)
        {
            KillCurrentTween();
            _currentTween = Tween.Scale(transform, targetScale, duration, ease);
            return _currentTween;
        }

        /// <summary>
        /// Flip card (Ominous transform)
        /// </summary>
        public async UniTask FlipCard(bool toBack)
        {
            // 90° Y rotation -> swap visuals -> 90° Y rotation
            var startRot = transform.rotation;
            var midRot = startRot * Quaternion.Euler(0, 90, 0);
            var endRot = startRot * Quaternion.Euler(0, 180, 0);

            await Tween.Rotation(transform, midRot, 0.15f, Ease.InQuad).ToUniTask();

            // Swap visuals here (front/back art, stats)
            _cardData.isFlipped = toBack;
            UpdateVisuals();

            await Tween.Rotation(transform, endRot, 0.15f, Ease.OutQuad).ToUniTask();
        }

        /// <summary>
        /// Shake animation (for damage, invalid action)
        /// </summary>
        public Tween Shake(float strength = 0.1f, float duration = 0.3f)
        {
            KillCurrentTween();
            return Tween.ShakePosition(transform, strength, duration);
        }

        private void KillCurrentTween()
        {
            if (_currentTween.IsAlive)
                _currentTween.Stop();
        }

        // === Pooling Interface ===

        public void OnSpawned()
        {
            IsPooled = false;
            gameObject.SetActive(true);
            transform.localScale = _originalScale;
        }

        public void OnDespawned()
        {
            IsPooled = true;
            KillCurrentTween();
            _cardData = null;
            gameObject.SetActive(false);
            OnReturnedToPool?.Invoke(this);
        }

        public void ResetForPool()
        {
            OnDespawned();
        }

        // === Input Handling ===

        private void OnMouseEnter()
        {
            if (IsPooled) return;
            ScaleTo(_originalScale * 1.1f);
        }

        private void OnMouseExit()
        {
            if (IsPooled) return;
            ScaleTo(_originalScale);
        }

        private void OnMouseDown()
        {
            if (IsPooled) return;
            // Drag start
        }

        private void OnMouseUp()
        {
            if (IsPooled) return;
            // Drag end - attempt play
        }

        private void OnDestroy()
        {
            KillCurrentTween();
        }
    }

    /// <summary>
    /// Interface for object pooling
    /// </summary>
    public interface IPoolable
    {
        void OnSpawned();
        void OnDespawned();
        void ResetForPool();
    }
}