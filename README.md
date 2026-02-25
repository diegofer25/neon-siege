# 🎮 Neon Siege

A browser-based 2D shooter with infinite wave survival, auto-targeting mechanics, and vibrant neon aesthetics. Built with vanilla JavaScript and HTML5 Canvas for smooth 60fps gameplay.

## ✨ Features

### 🎯 Core Gameplay
- **Intelligent Auto-targeting System**: Advanced player rotation and targeting AI with customizable turn speed
- **Balanced Difficulty Curve**: Slower initial firing with strategic enemy scaling that increases challenge over time
- **Infinite Wave Survival**: Progressively challenging enemy waves with ~9% health scaling per wave (plus speed/damage scaling)
- **Skill-Based Progression**: Level up during runs and allocate attribute + skill points
- **Archetypes + Ascension**: Choose a class path at wave 10 and pick ascension modifiers every 10 waves
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

## 🎵 Generate Music (ElevenLabs Music)

Music tracks are generated offline and saved under `assets/audio/music`.

```bash
export ELEVENLABS_API_KEY="<your-api-key>"

# Preview planned soundtrack files only (no API calls)
npm run music:plan

# Generate full soundtrack manifest
npm run music:generate
```

Optional flags:

```bash
npm run music:generate -- --only=music_menu_main,music_run_wave_early
npm run music:generate -- --concurrency=1 --retries=4
npm run music:generate -- --force
```

Notes:
- Requires ElevenLabs Music API access on your ElevenLabs account.
- Music prompts are manifest-driven in `scripts/music-manifest.mjs`.
- Existing files are skipped by default to keep generation incremental and cost-aware.

## 🎮 How to Play

### Basic Controls
- **Automatic Aiming**: Player automatically targets nearest enemy
- **P Key**: Pause/unpause game
- **Q/W/E/R**: Cast equipped active skills
- **Mouse**: Navigate menus and progression panels
- **⚙️ Settings Button**: Open settings to change audio, difficulty, performance, and save/load controls

### Gameplay Loop
1. **Survive Waves**: Your character auto-fires at approaching enemies
2. **Gain XP**: Defeat enemies and complete waves to level up
3. **Build Your Kit**: Spend skill/attribute points, then choose archetype and ascension milestones
4. **Progress**: Each wave increases enemy count, health, speed, and damage
5. **Survive**: See how many waves you can endure!

### Progression System

#### 🧠 Attributes
- **STR**: Improves direct and explosive damage
- **DEX**: Improves fire rate and turn speed
- **VIT**: Improves health, shields, and regeneration
- **INT**: Improves cooldown recovery and area effects
- **LUCK**: Improves crit and reward outcomes

#### 🧬 Skills and Archetypes
- 5 archetypes are available, with **Gunner** and **Technomancer** fully implemented.
- Skill slots include passives, active skills, and one ultimate slot.
- Tier gates require minimum points invested before higher-tier skills unlock.

#### ✨ Ascension
- Every 10 waves, pick 1 of 3 random ascension modifiers.
- Ascension effects stack for the run and can alter cooldowns, damage, survivability, and utility.

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
managers/SkillManager.js (XP, leveling, attributes, skill loadout)
systems/AscensionSystem.js (Ascension selection and run modifiers)
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

### Skill Progression
```javascript
LEVEL_CONFIG: {
    BASE_XP_TO_LEVEL: 50,
    XP_EXPONENT: 1.25
},
TIER_UNLOCK_COSTS: {
    tier3: 15,
    tier4: 30
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
│   ├── config/
│   │   ├── GameConfig.js  # Game balance settings
│   │   └── SkillConfig.js # Skill/archetype definitions
│   ├── utils/
│   │   ├── ObjectPool.js  # Memory optimization
│   │   └── MathUtils.js   # Utility functions
│   ├── systems/
│   │   ├── CollisionSystem.js    # Collision handling
│   │   ├── WaveManager.js        # Wave progression
│   │   ├── EffectsManager.js     # Visual effects
│   │   ├── EntityManager.js      # Entity management
│   │   └── AscensionSystem.js    # Ascension picks/modifiers
│   └── managers/
│       ├── PerformanceManager.js # Performance monitoring
│       ├── SkillManager.js       # Run-level progression
│       ├── ProgressionManager.js # Persistent meta progression
│       └── TelemetryManager.js   # Analytics instrumentation
├── docs/
└── README.md
```

### Adding New Skills

1. **Define the skill** in `js/config/SkillConfig.js`:
```javascript
my_skill_id: {
    name: 'My Skill',
    type: 'passive',
    tier: 2,
    maxRank: 3,
    effects: [{ stat: 'damageMult', perRank: 0.1 }]
}
```

2. **Wire runtime effect mapping** in `js/Game.js` (`_syncPlayerFromSkills`):
```javascript
if (passive.mySkillBonus) {
    this.player.applyMultiplicativeBoost('damageMod', passive.mySkillBonus);
}
```

3. **Expose it in the correct archetype** and tier gate inside `SkillConfig.js`:
```javascript
ARCHETYPES.MY_ARCHETYPE.skills.my_skill_id = {
    /* skill definition */
}
```

### Performance Debugging

Add `?stats=true` to the URL to enable performance monitoring:
```
http://localhost:8080/?stats=true
```

This displays real-time FPS, frame time, and optimization status.

### Telemetry Debugging

- Add `?telemetry=true` to log analytics events in the browser console.

### Balancing Guidelines

- **Wave Scaling**: Enemy stats should scale exponentially but be capped to prevent infinite growth
- **Skill Balance**: Keep attribute growth and skill scaling aligned to avoid one-stat dominance
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
