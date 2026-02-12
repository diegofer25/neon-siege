import { GameConfig } from './config/GameConfig.js';
import { PowerUp } from './PowerUp.js';

/**
 * Shop class manages the in-game power-up purchasing system.
 * 
 * Handles:
 * - Power-up pricing with stack-based multipliers
 * - Tab-based UI organization (offense/defense/utility)
 * - Purchase validation and affordability checks
 * - Dynamic shop state management and refresh
 * - Integration with player progression and power-up stacking
 * 
 * @class Shop
 */
export class Shop {
    /**
     * Creates a new Shop instance with centralized configuration.
     * Initializes pricing, stack limits, and UI state tracking.
     */
    constructor() {
        /** @type {Object} Power-up base prices from game configuration */
        this.powerUpPrices = GameConfig.POWERUP_PRICES;
        
        /** @type {Object} Maximum stack limits for stackable power-ups */
        this.stackLimits = GameConfig.STACK_LIMITS;
        
        /** @type {string} Currently active shop tab ('offense'|'defense'|'utility') */
        this.currentTab = 'offense';
        
        /** @type {import('./Player.js').Player | null} Reference to current player for state management */
        this.currentPlayer = null;
        
        /** @type {Function|null} Callback function executed on power-up purchase */
        this.currentOnPurchase = null;

        this._tabsInitialized = false;
    }

    /**
     * Calculates the current price for a power-up based on existing stacks.
     * Implements exponential pricing based on initial price to balance game economy.
     * Higher base price power-ups have steeper exponential curves.
     * 
     * @param {string} powerUpName - Name of the power-up to price
     * @param {number} [currentStacks=0] - Number of existing stacks player has
     * @returns {number} Calculated price in coins (minimum 1)
     * 
     * @example
     * // Base price for first purchase
     * shop.getPowerUpPrice("Damage Boost", 0); // Returns 15 (base price)
     * 
     * // Exponential scaling for stacked purchases
     * shop.getPowerUpPrice("Damage Boost", 1); // Returns ~23 coins
     * shop.getPowerUpPrice("Damage Boost", 3); // Returns ~52 coins
     * shop.getPowerUpPrice("Double Damage", 2); // Returns ~180 coins (higher base price = steeper curve)
     */
    getPowerUpPrice(powerUpName, currentStacks = 0) {
        const basePrice = this.powerUpPrices[powerUpName] || 20;
        
        // Ensure stacks is not negative (safety check)
        const validStacks = Math.max(0, currentStacks);
        
        // For first purchase (stack 0), return base price
        if (validStacks === 0) {
            return basePrice;
        }
        
        // Calculate exponential scaling based on base price
        // Higher base price power-ups get steeper exponential curves
        const priceBasedScaling = 1 + (basePrice * GameConfig.ECONOMY.PRICE_BASED_SCALING_FACTOR);
        const exponentialBase = GameConfig.ECONOMY.EXPONENTIAL_PRICE_BASE * priceBasedScaling;
        
        // Apply exponential scaling: basePrice * (exponentialBase ^ stacks)
        const scaledPrice = basePrice * Math.pow(exponentialBase, validStacks);
        
        return Math.max(1, Math.floor(scaledPrice)); // Minimum price of 1 coin
    }

    /**
     * Determines if a player can afford a specific power-up purchase.
     * 
     * @param {string} powerUpName - Name of the power-up to check
     * @param {number} currentStacks - Player's current stack count for this power-up
     * @param {number} playerCoins - Player's available coins
     * @returns {boolean} True if player can afford the purchase
     */
    canAfford(powerUpName, currentStacks, playerCoins) {
        return playerCoins >= this.getPowerUpPrice(powerUpName, currentStacks);
    }

    /**
     * Retrieves the current stack count for a stackable power-up.
     * Uses modern stack tracking when available, falls back to legacy calculation.
     * 
     * @param {string} powerUpName - Name of the power-up to check
     * @param {import('./Player.js').Player} player - Player object to check stacks for
     * @returns {number} Current number of stacks (0 if none)
     * 
     * @todo Migrate all power-ups to use the new stack tracking system
     */
    getCurrentStacks(powerUpName, player) {
        // Prefer modern stack tracking system when available
        if (player.powerUpStacks && player.powerUpStacks[powerUpName] !== undefined) {
            return player.powerUpStacks[powerUpName];
        }
        
        // Legacy calculation methods for backward compatibility
        // These approximations should be replaced with proper stack tracking
        switch(powerUpName) {
            case "Max Health":
                // Approximate stacks based on current max HP (20 HP per stack)
                return Math.round((player.maxHp - 100) / 20);
            case "Shield":
                // Calculate shield stacks based on max shield HP
                return player.hasShield ? Math.floor((player.maxShieldHp - 50) / 25) + 1 : 0;
            case "Regeneration":
                // 5 HP regen per stack
                return player.hpRegen / 5;
            case "Shield Regen":
                // 10 shield regen per stack
                return player.shieldRegen / 10;
            case "Bigger Explosions":
                // Logarithmic calculation for explosion radius stacks
                return Math.round(Math.log(player.explosionRadius / 50) / Math.log(1.5));
            case "Piercing Shots":
                // Use piercingLevel as the stack count
                return player.piercingLevel || 0;
            case "Triple Shot":
                return player.powerUpStacks && player.powerUpStacks["Triple Shot"] ? player.powerUpStacks["Triple Shot"] : 0;
            case "Full Heal":
                // Always available at base price (consumable)
                return 0;
            case "Slow Field":
                return player.slowFieldStrength;
            case "Coin Magnet":
                // Calculate stacks based on multiplier (base 1.0, +0.5 per stack)
                return Math.round((player.coinMagnetMultiplier - 1) / 0.5);
            case "Lucky Shots":
                // Calculate stacks based on chance (10% per stack)
                return player.luckyShots ? Math.round(player.luckyShots.chance / 0.1) : 0;
            case "Immolation Aura":
                // Calculate stacks based on damage percent (1% per stack)
                return player.immolationAura ? Math.round(player.immolationAura.damagePercent / 0.01) : 0;
            case "Shield Breaker":
                // Use the dedicated stack counter
                return player.shieldBreakerStacks || 0;
            case "Overcharge Burst":
                // Calculate stacks based on burst interval (starts at 10, decreases by 2 per stack)
                return player.overchargeBurst ? Math.round((10 - player.overchargeBurst.burstInterval) / 2) : 0;
            case "Emergency Heal":
                // Calculate stacks based on cooldown reduction (starts at 45s, -10s per stack)
                return player.emergencyHeal ? Math.round((45000 - player.emergencyHeal.maxCooldown) / 10000) : 0;
            default:
                return 0;
        }
    }

    /**
     * Displays the shop modal interface with current player state.
     * Initializes tabs, updates coin display, and sets up event handlers.
     * 
     * @param {import('./Player.js').Player} player - Current player object
     * @param {number} coins - Player's available coins
     * @param {Function} onPurchase - Callback executed when power-up is purchased
     * @param {Function} onContinue - Callback executed when shop is closed
     * @param {Function|null} onRewardedBoost - Callback executed when rewarded boost button is clicked
     */
    showShop(player, coins, onPurchase, onContinue, onRewardedBoost = null) {
        const modal = document.getElementById('powerUpModal');
        
        // Store current state for refresh operations
        this.currentPlayer = player;
        this.currentOnPurchase = onPurchase;
        
        // Update modal title to show current coin count
        modal.querySelector('h2').textContent = `Power-Up Shop (Coins: ${coins.toFixed(1)})`;
        
        // Initialize tab system and event handlers
        this.setupTabs();
        this.setupCloseButton(onContinue);
        this.setupRewardedButton(onRewardedBoost);
        
        // Display the current tab content
        this.showTab(this.currentTab, player, coins, onPurchase);
        
        // Ensure correct tab button is visually active
        this.updateActiveTabButton();
        
        // Show the modal
        modal.classList.add('show');
    }
    
    /**
     * Refreshes the shop display with current player state.
     * Used after purchases to update prices, availability, and coin count.
     * 
     * @private
     */
    refreshShop() {
        if (this.currentPlayer && this.currentOnPurchase) {
            const modal = document.getElementById('powerUpModal');
            // Update coin display
            modal.querySelector('h2').textContent = `Power-Up Shop (Coins: ${this.currentPlayer.coins.toFixed(1)})`;
            // Refresh current tab content
            this.showTab(this.currentTab, this.currentPlayer, this.currentPlayer.coins, this.currentOnPurchase);
        }
    }

    /**
     * Initializes tab button event handlers for shop navigation.
     * Handles tab switching and visual state updates.
     * 
     * @private
     * @param {import('./Player.js').Player} player - Current player object
     * @param {number} coins - Player's available coins
     * @param {Function} onPurchase - Purchase callback function
     */
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');

        if (this._tabsInitialized) {
            return;
        }

        this._tabsInitialized = true;
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update visual state
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Switch to selected tab
                const tabName = button.getAttribute('data-tab');
                this.currentTab = tabName;

                // Load tab content using current state
                if (this.currentPlayer && this.currentOnPurchase) {
                    this.showTab(tabName, this.currentPlayer, this.currentPlayer.coins, this.currentOnPurchase);
                }
            });
        });
    }

    /**
     * Initializes the shop close button with proper event handling.
     * Prevents event listener duplication by cloning the button.
     * 
     * @private
     * @param {Function} onContinue - Callback executed when shop is closed
     */
    setupCloseButton(onContinue) {
        const closeButton = document.querySelector('.shop-close-btn');
        
        // Remove any existing event listeners by cloning the element
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);
        
        newCloseButton.addEventListener('click', () => {
            onContinue ? onContinue() : this.closeShop();
        });
    }

    setupRewardedButton(onRewardedBoost) {
        const rewardButton = document.querySelector('.shop-reward-btn');
        if (!rewardButton) {
            return;
        }

        const newRewardButton = rewardButton.cloneNode(true);
        rewardButton.parentNode.replaceChild(newRewardButton, rewardButton);

        if (typeof onRewardedBoost !== 'function') {
            newRewardButton.style.display = 'none';
            return;
        }

        newRewardButton.style.display = 'inline-block';
        newRewardButton.disabled = false;
        newRewardButton.textContent = 'Watch Ad: +50% Wave Coins';

        newRewardButton.addEventListener('click', async () => {
            newRewardButton.disabled = true;
            newRewardButton.textContent = 'Loading...';

            try {
                const result = await onRewardedBoost();

                if (result?.rewardGranted) {
                    newRewardButton.textContent = 'Reward Claimed';
                } else {
                    newRewardButton.textContent = 'Ad Unavailable';
                    setTimeout(() => {
                        newRewardButton.textContent = 'Watch Ad: +50% Wave Coins';
                        newRewardButton.disabled = false;
                    }, 1500);
                }
            } catch {
                newRewardButton.textContent = 'Try Again';
                newRewardButton.disabled = false;
            }

            this.refreshShop();
        });
    }

    /**
     * Displays power-up cards for the specified tab category.
     * Handles filtering, pricing, and purchase interaction setup.
     * 
     * @private
     * @param {string} tabName - Tab identifier ('offense'|'defense'|'utility')
     * @param {import('./Player.js').Player} player - Current player object
     * @param {number} coins - Player's available coins
     * @param {Function} onPurchase - Purchase callback function
     */
    showTab(tabName, player, coins, onPurchase) {
        const cardsContainer = document.getElementById('powerUpCards');
        
        // Clear existing content
        cardsContainer.innerHTML = '';
        
        // Map UI tab names to internal categories
        const categoryMap = {
            'offense': 'OFFENSE',
            'defense': 'DEFENSE', 
            'utility': 'UTILITY'
        };
        
        const category = categoryMap[tabName];
        if (!category) return;
        
        // Get available power-ups for this category
        const categoryPowerUps = this.getPowerUpsByCategory(category, player);
        
        // Use current player coins instead of initial coins parameter
        const currentCoins = player.coins;
        
        // Create cards for each available power-up
        categoryPowerUps.forEach(powerUp => {
            const currentStacks = this.getCurrentStacks(powerUp.name, player);
            const price = this.getPowerUpPrice(powerUp.name, currentStacks);
            const canAfford = this.canAfford(powerUp.name, currentStacks, currentCoins);
            const isMaxed = this.isPowerUpMaxed(powerUp.name, player);

            const card = this.createPowerUpCard(powerUp, currentStacks, price, canAfford, isMaxed, onPurchase);
            cardsContainer.appendChild(card);
        });
        
        // Show empty state if no power-ups are available
        if (categoryPowerUps.length === 0) {
            this.showEmptyTabMessage(cardsContainer);
        }
    }

    /**
     * Filters power-ups by category and availability.
     * Excludes maxed out power-ups from the shop display.
     * 
     * @private
     * @param {string} category - Category to filter by ('OFFENSE'|'DEFENSE'|'UTILITY')
     * @param {import('./Player.js').Player} player - Player object to check power-up states
     * @returns {PowerUp[]} Array of available power-ups for the category
     */
    getPowerUpsByCategory(category, player) {
        // Use categories from PowerUp.js to ensure all power-ups are included
        const powerUpNames = PowerUp.CATEGORIES[category] || [];
        
        return PowerUp.ALL_POWERUPS.filter(powerUp => {
            if (!powerUpNames.includes(powerUp.name)) return false;
            
            // Check if power-up requirements are met
            if (!this.areRequirementsMet(powerUp.name, player)) return false;
            
            // Hide maxed power-ups from shop
            return !this.isPowerUpMaxed(powerUp.name, player);
        });
    }

    /**
     * Check if all requirements for a power-up are met.
     * 
     * @private
     * @param {string} powerUpName - Name of power-up to check requirements for
     * @param {import('./Player.js').Player} player - Player object to check current state
     * @returns {boolean} True if all requirements are met
     */
    areRequirementsMet(powerUpName, player) {
        switch(powerUpName) {
            case "Bigger Explosions":
                // Requires Explosive Shots to be useful
                return player.explosiveShots;
            // Shield Boss Counter power-ups have no special requirements
            case "Shield Breaker":
            case "Adaptive Targeting":
            case "Barrier Phase":
            case "Overcharge Burst":
            case "Emergency Heal":
                return true;
            default:
                return true; // No requirements for other power-ups
        }
    }

    /**
     * Get requirement description for a power-up.
     * 
     * @private
     * @param {string} powerUpName - Name of power-up to get requirements for
     * @returns {string} Human-readable requirement description, or empty string if no requirements
     */
    getRequirementDescription(powerUpName) {
        switch(powerUpName) {
            case "Bigger Explosions":
                return "Requires: Explosive Shots";
            default:
                return "";
        }
    }

    /**
     * Creates a power-up card element with proper styling and interactions.
     * 
     * @private
     * @param {PowerUp} powerUp - Power-up object to create card for
     * @param {number} currentStacks - Player's current stacks for this power-up
     * @param {number} price - Calculated price for this purchase
     * @param {boolean} canAfford - Whether player can afford this purchase
     * @param {boolean} isMaxed - Whether this power-up is at maximum level
     * @param {Function} onPurchase - Purchase callback function
     * @returns {HTMLElement} Configured card element
     */
    createPowerUpCard(powerUp, currentStacks, price, canAfford, isMaxed, onPurchase) {
        const card = document.createElement('div');
        card.className = `card shop-card ${!canAfford ? 'unaffordable' : ''} ${isMaxed ? 'maxed' : ''}`;
        
        // Add stack level indicator for stackable power-ups
        let stackInfo = '';
        if (powerUp.stackable && currentStacks > 0) {
            stackInfo = ` (Lv.${currentStacks})`;
        }

        // Add status indicators for purchase state
        let statusText = '';
        if (isMaxed) {
            statusText = '<div class="status-text maxed">MAXED</div>';
        } else if (!canAfford) {
            statusText = '<div class="status-text unaffordable">Can\'t Afford</div>';
        }

        // Add requirement information if applicable
        const requirementDesc = this.getRequirementDescription(powerUp.name);
        let requirementText = '';
        if (requirementDesc) {
            requirementText = `<div class="requirement-text">${requirementDesc}</div>`;
        }

        card.innerHTML = `
            <div class="card-icon">${powerUp.icon}</div>
            <div class="card-title">${powerUp.name}${stackInfo}</div>
            <div class="card-description">${powerUp.description}</div>
            ${requirementText}
            <div class="card-price">${price} coins</div>
            ${statusText}
        `;
        
        // Add click handler for purchasable items
        if (canAfford && !isMaxed) {
            card.addEventListener('click', () => {
                onPurchase(powerUp, price);
                // Refresh shop after purchase to update state
                setTimeout(() => {
                    this.refreshShop();
                }, 50); // Small delay ensures purchase processing completes
            });
        }
        
        return card;
    }

    /**
     * Displays an empty state message when no power-ups are available in a tab.
     * 
     * @private
     * @param {HTMLElement} container - Container to add empty message to
     */
    showEmptyTabMessage(container) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-tab-message';
        emptyMessage.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #888; font-size: 14px;">
                <p>No power-ups available in this category</p>
                <p>All upgrades are maxed out!</p>
            </div>
        `;
        container.appendChild(emptyMessage);
    }

    /**
     * Updates the visual state of tab buttons to show the active tab.
     * 
     * @private
     */
    updateActiveTabButton() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(btn => btn.classList.remove('active'));
        const activeButton = document.querySelector(`[data-tab="${this.currentTab}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    /**
     * Closes the shop modal and cleans up the interface.
     * 
     * @public
     */
    closeShop() {
        document.getElementById('powerUpModal').classList.remove('show');
    }

    /**
     * Determines if a power-up has reached its maximum stack limit.
     * Checks both stackable power-ups against their limits and non-stackable power-ups.
     * 
     * @param {string} powerUpName - Name of the power-up to check
     * @param {import('./Player.js').Player} player - Player object to check current state
     * @returns {boolean} True if power-up is at maximum level or already owned (non-stackable)
     */
    isPowerUpMaxed(powerUpName, player) {
        // Check if it's a non-stackable power-up that's already owned
        const nonStackable = player.getNonStackablePowerUps();
        if (nonStackable.includes(powerUpName)) {
            return true;
        }
        
        // Check stack limits for stackable power-ups
        if (this.stackLimits[powerUpName] !== undefined) {
            const currentStacks = this.getCurrentStacks(powerUpName, player);
            return currentStacks >= this.stackLimits[powerUpName];
        }
        
        // Special case for Slow Field (has its own max tracking)
        if (powerUpName === "Slow Field") {
            return player.isSlowFieldMaxed();
        }
        
        // For power-ups without limits (like Full Heal), never maxed
        return false;
    }
}
