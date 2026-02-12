# 🎮 Neon Tower Defense Shooter

A browser-based 2D tower defense game with infinite wave survival, auto-targeting mechanics, and vibrant neon aesthetics. Built with vanilla JavaScript and HTML5 Canvas for smooth 60fps gameplay.

## ✨ Features

### 🎯 Core Gameplay
- **Intelligent Auto-targeting System**: Advanced player rotation and targeting AI with customizable turn speed
- **Balanced Difficulty Curve**: Slower initial firing with strategic enemy scaling that increases challenge over time
- **Infinite Wave Survival**: Progressively challenging enemy waves with ~9% health scaling per wave (plus speed/damage scaling)
- **Power-up Shop**: 15+ upgrades across offense, defense, and utility categories
- **Stackable Upgrades**: Build your perfect loadout with combinable power-ups
- **Smart Enemy AI**: Enemies with varied movement patterns and behaviors
- **Run Save/Load**: Save your run to localStorage and load it from start, settings, or game over
- **Recovery Flow**: After game over, choose to start again, load save, or watch a rewarded ad to restore save

### 🎨 Visual Effects
- **Neon Aesthetic**: Synthwave-inspired visual design
- **Dynamic Particles**: Explosions, muzzle flashes, and hit effects
- **Screen Shake**: Responsive feedback for impacts and explosions
- **Glowing Elements**: All game objects feature neon glow effects
- **Animated UI**: Smooth transitions and floating damage text
- **Settings Overlay**: In-game settings panel that pauses gameplay while open and resumes when closed

### ⚡ Performance
- **Object Pooling**: Optimized memory management for particles and projectiles
- **Performance Monitoring**: Real-time FPS tracking and automatic optimization
- **Responsive Design**: Adapts to different screen sizes while maintaining 4:3 aspect ratio
- **High DPI Support**: Crisp rendering on retina displays

### 🛠️ Technical Features
- **Modular Architecture**: Clean separation of concerns with dedicated systems
- **Collision System**: Efficient circular collision detection
- **Wave Management**: Dynamic enemy spawning and difficulty scaling
- **Effect System**: Centralized visual effects management
- **Configuration System**: Centralized game balance and settings
- **Vite Tooling**: Lightning-fast dev server with optimized production builds

## 🚀 Quick Start

### Play Online
Visit the [live demo](https://your-username.github.io/neon-td-vanilla) to play immediately in your browser.

### Local Development
```bash
# Clone the repository
git clone https://github.com/your-username/neon-td-vanilla.git
cd neon-td-vanilla

# Install dependencies
npm install

# Start the Vite dev server (auto-opens http://localhost:8080)
npm run dev

# Build production assets
npm run build

# Preview the optimized build locally
npm run preview
```

### Manual Setup
For best experience, serve from a local HTTP server (opening `index.html` directly may fail due to ES module/CORS restrictions):

```bash
# Using Python 3
python -m http.server 8080

# Using Node.js
npx live-server --port=8080
```

## 🔊 Generate Sound Effects (ElevenLabs)

Sound effects are generated offline and saved under `assets/audio/sfx`.

```bash
export ELEVENLABS_API_KEY="<your-api-key>"

# Preview generated filenames only (no API calls)
npm run sfx:plan

# Generate full catalog (2 variants per event by default)
npm run sfx:generate
```

Optional flags:

```bash
npm run sfx:generate -- --only=player_shoot_basic,enemy_death
npm run sfx:generate -- --force
npm run sfx:generate -- --variants=2 --concurrency=2
```

Notes:
- The script does not run at game runtime; it is a one-time/offline pipeline step.
- Existing files are skipped by default to keep generation incremental and cost-aware.
- Sound prompts are manifest-driven in `scripts/sfx-manifest.mjs`.

## 🎮 How to Play

### Basic Controls
- **Automatic Aiming**: Player automatically targets nearest enemy
- **P Key**: Pause/unpause game
- **Mouse**: Navigate menus and shop interface
- **⚙️ Settings Button**: Open settings to change audio, difficulty, performance, and save/load controls

### Gameplay Loop
1. **Survive Waves**: Your character auto-fires at approaching enemies
2. **Collect Coins**: Earn currency for each enemy defeated
3. **Shop Phase**: Between waves, purchase power-ups to strengthen your character
4. **Progress**: Each wave increases enemy count, health, speed, and damage
5. **Survive**: See how many waves you can endure!

### Power-Up Categories

#### ⚔️ Offense
- **Damage Boost**: +25% bullet damage (stackable, exponential pricing)
- **Fire Rate**: +12.5% attack speed (stackable, exponential pricing)
- **Turn Speed**: +10% rotation speed for faster target acquisition (stackable, exponential pricing)
- **Triple Shot**: Fire 3 bullets in a spread
- **Piercing Shots**: Bullets pierce through enemies
- **Explosive Shots**: Bullets explode on impact
- **Speed Boost**: +15% projectile speed (stackable, exponential pricing)
- **Double Damage**: +50% bullet damage (stackable, exponential pricing)
- **Rapid Fire**: +25% attack speed (stackable, exponential pricing)
- **Bigger Explosions**: +25% explosion radius and damage (stackable, exponential pricing)

#### 🛡️ Defense
- **Max Health**: +20% health and full heal (stackable)
- **Shield**: Absorbs damage before health (stackable)
- **Regeneration**: +5 health per second (stackable)
- **Shield Regen**: +10 shield per second (stackable)
- **Full Heal**: Instantly restore all health

#### ⚡ Utility
- **Life Steal**: Heal 10% of enemy max health on kill
- **Slow Field**: Enemies move slower near you (stackable)
- **Coin Magnet**: +50% coin rewards from enemy kills (stackable)
- **Lucky Shots**: 10% chance for bullets to deal double damage (stackable chance up to 50%)
- **Immolation Aura**: All nearby enemies take 1% of their max health as burn damage per second (stackable)

### 👾 Enemy Types

Enemy spawn mix by wave range:
- Waves 1–10: Basic only
- Waves 11–20: Basic ~80%, Fast ~20%
- Waves 21–30: Basic ~70%, Fast ~15%, Tank ~15%
- Waves 31+: Basic ~60%, Fast ~10%, Tank ~10%, Splitter ~20%

#### Basic Enemy (Cyan)
- **Appearance**: Waves 1-10
- **Characteristics**: Balanced stats, hexagonal shape
- **Strategy**: Standard threat, good for learning the game

#### Fast Enemy (Magenta) 
- **Appearance**: Waves 11+
- **Characteristics**: 50% health, 200% speed, 150% damage
- **Strategy**: Glass cannons that rush quickly but die easily

#### Tank Enemy (Yellow)
- **Appearance**: Waves 21+
- **Characteristics**: 300% health, 50% speed, 250% damage
- **Strategy**: Slow but heavily armored, requires sustained fire

#### 🆕 Splitter Enemy (Orange)
- **Appearance**: Waves 31+ (20% spawn rate)
- **Characteristics**: 200% health, 80% speed, 180% damage
- **Special Ability**: Splits into 2-3 smaller enemies when destroyed
- **Generations**: Can split up to 3 times (Original → Split → Mini-Split)
- **Visual Cues**: Pulsating orange glow, generation dots above health bar
- **Strategy**: Prioritize early to prevent exponential enemy multiplication!

#### Boss Enemies
- **Classic Boss (Magenta)**: Waves 10, 30, 50... - Projectile bursts and charging attacks
- **🆕 Shield Boss (Cyan)**: Waves 20, 40, 60... - Regenerating shields and laser attacks
- Boss waves are boss-only (no regular enemy spawns)

## 🏗️ Architecture

### Core Systems

```
Game.js (Main Controller)
├── CollisionSystem.js (Collision detection & responses)
├── WaveManager.js (Enemy spawning & wave progression)
├── EffectsManager.js (Visual effects & screen shake)
├── EntityManager.js (Entity lifecycle management)
└── PerformanceManager.js (FPS monitoring & optimization)
```

### Game Entities

```
Player.js (Player character & abilities)
Enemy.js (Enemy AI & behaviors)
Projectile.js (Bullets & projectile physics)
Particle.js (Visual effect particles)
PowerUp.js (Upgrade system & definitions)
Shop.js (Power-up purchasing interface)
```

### Utilities & Configuration

```
utils/
├── ObjectPool.js (Memory optimization)
├── MathUtils.js (Mathematical operations)
└── config/
    └── GameConfig.js (Centralized game balance)
```

### Key Design Patterns

- **Object Pooling**: Reduces garbage collection for frequently created/destroyed objects
- **System Architecture**: Separation of concerns with dedicated managers
- **Configuration-Driven**: Centralized balance and settings management
- **Event-Driven**: Loose coupling between systems through callbacks

## 🎛️ Configuration

Game balance and settings are centralized in `GameConfig.js`. Key configurable areas:

### Wave Scaling
```javascript
WAVE: {
    BASE_ENEMY_COUNT: 4,          // Enemies in wave 1
    ENEMY_COUNT_SCALING: 2,       // Additional enemies per wave
    SCALING_FACTORS: {
        HEALTH: 1.09,             // 9% health increase per wave
        SPEED: 1.03,              // 3% speed increase per wave
        DAMAGE: 1.06              // 6% damage increase per wave
    }
}
```

### Power-Up Pricing
```javascript
POWERUP_PRICES: {
    "Damage Boost": 15,
    "Triple Shot": 40,
    "Explosive Shots": 60,
    // ... see GameConfig.js for full list
}
```

### Performance Tuning
```javascript
VFX: {
    PARTICLE_LIMITS: {
        MAX_PARTICLES: 200,       // Maximum active particles
        MAX_PROJECTILES: 100      // Maximum active projectiles
    }
}
```

## 🔧 Development

### Project Structure
```
neon-td-vanilla/
├── index.html              # Main HTML file
├── package.json            # Dependencies and scripts
├── style/
│   └── index.css          # Game styling and UI
├── js/
│   ├── main.js            # Application entry point
│   ├── Game.js            # Main game controller
│   ├── Player.js          # Player character
│   ├── Enemy.js           # Enemy entities
│   ├── Projectile.js      # Bullet mechanics
│   ├── Particle.js        # Visual effects
│   ├── PowerUp.js         # Upgrade system
│   ├── Shop.js            # Power-up shop
│   ├── config/
│   │   └── GameConfig.js  # Game balance settings
│   ├── utils/
│   │   ├── ObjectPool.js  # Memory optimization
│   │   └── MathUtils.js   # Utility functions
│   ├── systems/
│   │   ├── CollisionSystem.js    # Collision handling
│   │   ├── WaveManager.js        # Wave progression
│   │   ├── EffectsManager.js     # Visual effects
│   │   └── EntityManager.js     # Entity management
│   └── managers/
│       ├── PerformanceManager.js # Performance monitoring
│       ├── ProgressionManager.js # Persistent meta progression
│       ├── TelemetryManager.js   # Analytics instrumentation
│       └── MonetizationManager.js # Rewarded ad abstraction layer
├── docs/
│   └── monetization-telemetry.md # Event schema + integration guide
└── README.md
```

### Adding New Power-Ups

1. **Define the power-up** in `PowerUp.js`:
```javascript
new PowerUp(
    "My Power-Up",
    "Description of effect",
    "🎯",
    (player) => { /* Apply effect */ },
    true // Stackable
)
```

2. **Add pricing** in `GameConfig.js`:
```javascript
POWERUP_PRICES: {
    "My Power-Up": 25
}
```

3. **Add to shop category** in `Shop.js` or `PowerUp.js`:
```javascript
CATEGORIES: {
    OFFENSE: [..., "My Power-Up"]
}
```

### Performance Debugging

Add `?stats=true` to the URL to enable performance monitoring:
```
http://localhost:8080/?stats=true
```

This displays real-time FPS, frame time, and optimization status.

### Monetization Telemetry Debugging

- Add `?telemetry=true` to log analytics events in the browser console.
- Add `?rewardedMock=true` to simulate rewarded-ad success flow without an SDK.
- Consent is required before start; reopen preferences from the ⚖️ button in the HUD.

See `docs/monetization-telemetry.md` for event definitions and integration notes.

### Balancing Guidelines

- **Wave Scaling**: Enemy stats should scale exponentially but be capped to prevent infinite growth
- **Power-Up Pricing**: Use stacking multipliers to encourage build diversity
- **Performance**: Keep particle counts under 200 for smooth gameplay on lower-end devices
- **Difficulty**: Each wave should feel challenging but achievable with proper upgrades

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Use JSDoc comments for all functions
- Follow the existing modular architecture
- Add configuration options to `GameConfig.js` instead of hardcoding values
- Write performance-conscious code (prefer object pooling for frequently created objects)

## 🐛 Known Issues

- Audio may not autoplay in some browsers due to autoplay policies
- Performance may degrade on very old mobile devices (pre-2018)
- High DPI scaling may cause slight blurriness on some displays
- Save restore intentionally uses a safe checkpoint wave start, not full frame-perfect mid-combat state

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Fonts**: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) and [Audiowide](https://fonts.google.com/specimen/Audiowide) from Google Fonts
- **Inspiration**: Classic arcade shooters and modern tower defense games
- **Graphics**: Pure CSS and HTML5 Canvas, no external image assets

## 📈 Roadmap

- [x] **Audio System**: Sound effects and background music with in-game settings controls
- [x] **Enemy Varieties**: Multiple enemy types with unique behaviors  
- [x] **Boss Battles**: Special boss enemies every 10 waves with enhanced visibility and combat feedback
- [ ] **Achievements**: Unlock system for milestone rewards
- [ ] **Leaderboards**: High score tracking and sharing
- [ ] **Mobile Controls**: Touch-friendly interface improvements
- [ ] **Visual Polish**: Enhanced particle effects and animations
- [x] **Save System**: localStorage run save/load with game-over recovery options

---

**Built with ❤️ by [Diego Lamarão](https://github.com/your-username) & GitHub Copilot**

*Star ⭐ this repository if you enjoyed the game!*
*Star ⭐ this repository if you enjoyed the game!*
