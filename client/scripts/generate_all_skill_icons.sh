#!/bin/bash

# Batch generate all skill icon images for Neon Siege
# Uses generate_image.sh to create neon cyberpunk-style icons via Gemini API
#
# Usage: ./scripts/generate_all_skill_icons.sh
# Note: This calls the Gemini API ~31 times. Each call costs ~$0.04 (Gemini 3 Pro).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_ROOT/assets/icons/skills"
GENERATOR="$SCRIPT_DIR/generate_image.sh"

mkdir -p "$OUTPUT_DIR"

# Consistent style prefix for all icons
STYLE="Generate a 64x64 pixel game icon with a dark background. Detailed neon cyberpunk style with glowing light effects. No text, no letters, just the icon art. The icon depicts:"

# Counter for progress
TOTAL=31
COUNT=0

generate() {
    local filename="$1"
    local desc="$2"
    COUNT=$((COUNT + 1))

    # Skip if already generated
    if ls "$OUTPUT_DIR/${filename}".* 1>/dev/null 2>&1; then
        echo "[$COUNT/$TOTAL] SKIP $filename (already exists)"
        return
    fi

    echo "[$COUNT/$TOTAL] Generating $filename..."
    "$GENERATOR" "$STYLE $desc" "$filename" "$OUTPUT_DIR"
    echo ""
}

echo "=== Generating all skill icons to $OUTPUT_DIR ==="
echo ""

# ─── ATTRIBUTES (5) ──────────────────────────────────────────────────────────

generate "attr_str" \
    "a glowing neon fist clenched tightly, radiating shockwave energy and crackling power, red and orange neon glow, raw destructive force"

generate "attr_dex" \
    "a neon lightning bolt streaking diagonally with speed lines and electric sparks, cyan and electric blue glow, representing agility and quickness"

generate "attr_vit" \
    "a glowing neon heart radiating a warm protective aura, pulsing with life energy, surrounded by a gentle shield glow, red and pink neon"

generate "attr_int" \
    "a neon glowing brain with circuit board patterns and data streams flowing through it, purple and blue cyberpunk glow, representing intelligence and technology"

generate "attr_luck" \
    "a glowing neon four-leaf clover with sparkles and golden particles swirling around it, green and gold neon glow, fortune and luck"

# ─── GUNNER SKILLS (10) ──────────────────────────────────────────────────────

generate "gunner_sharp_rounds" \
    "a sharp glowing neon bullet with an enhanced cutting edge slicing through metal, trailing energy sparks, yellow and white neon glow, armor-piercing precision"

generate "gunner_rapid_fire" \
    "multiple neon bullets firing in rapid succession with motion blur trails, muzzle flash energy, red and orange neon glow, overwhelming firepower"

generate "gunner_focused_fire" \
    "a neon crosshair with concentrated streams of fire converging to a single bright point, representing focused intense firepower, red neon glow with a bright center"

generate "gunner_piercing" \
    "a neon bullet piercing cleanly through multiple layers of shattered armor plates, energy trail behind it, cyan and silver neon glow, unstoppable penetration"

generate "gunner_triple_shot" \
    "three neon bullets spreading outward in a fan formation from a single barrel, each trailing bright energy, blue and white neon glow, spread shot pattern"

generate "gunner_quick_aim" \
    "a neon targeting reticle snapping rapidly into position with motion speed lines, precise and fast, cyan crosshair with green lock-on glow"

generate "gunner_critical_mastery" \
    "a neon bullet striking a glowing critical weak point with an explosive burst of diamond-shaped energy shards, gold and white neon glow, devastating precision"

generate "gunner_barrage" \
    "a storm of glowing neon homing projectiles spiraling outward from a central point, dozens of bright trails filling the space, cyan and purple neon glow, bullet storm"

generate "gunner_overcharge" \
    "a single neon bullet overloaded with crackling electrical energy, arcing with excess power about to burst, electric blue and yellow neon glow, overcharged"

generate "gunner_aimbot_overdrive" \
    "a neon HUD display with multiple red target lock-on reticles scanning and tracking enemies simultaneously, digital scanning beams, red and cyan neon glow, aimbot system"

# ─── TECHNOMANCER SKILLS (10) ────────────────────────────────────────────────

generate "techno_explosive_rounds" \
    "a neon bullet in mid-detonation with a fiery explosion expanding outward, shrapnel and blast wave rings, orange and red neon glow, explosive impact"

generate "techno_bigger_booms" \
    "a massive neon explosion expanding outward with concentric shockwave rings, each ring bigger than the last, orange and yellow neon glow, amplified destruction"

generate "techno_emp_pulse" \
    "a neon electromagnetic pulse wave radiating outward from a central tech device, disrupting digital particles, electric blue and white neon glow, EMP disruption"

generate "techno_chain_hit" \
    "neon explosions chaining between multiple targets connected by bright energy arcs, domino-effect detonations, purple and orange neon glow, chain reaction"

generate "techno_volatile_kills" \
    "a neon enemy silhouette disintegrating in a volatile self-destructive explosion, fragments flying outward, dark red and orange neon glow, death explosion"

generate "techno_burn" \
    "a neon flame aura burning intensely around a central figure, heat waves radiating outward damaging nearby area, orange and red fire with purple neon edges"

generate "techno_elemental_synergy" \
    "neon fire and electricity merging and intertwining together in a spiral of combined elemental energy, orange flames meeting blue lightning, synergy of elements"

generate "techno_neon_nova" \
    "a massive brilliant neon nova blast expanding in all directions from a central point, blinding white core with cyan and purple shockwave, devastating area blast"

generate "techno_meltdown" \
    "a neon reactor core in critical meltdown state, dripping with molten glowing energy, cracks leaking intense light, red and orange neon with green toxic glow"

generate "techno_lightning_cascade" \
    "bright neon chain lightning bolts branching out and cascading across multiple points, electric blue and purple arcs of devastating energy, ultimate power"

# ─── ASCENSION MODIFIERS (15) ────────────────────────────────────────────────

generate "asc_ricochet" \
    "a neon projectile bouncing off angular walls at sharp angles, leaving glowing trail marks at each bounce point, cyan and green neon glow, ricochet trajectory"

generate "asc_death_explosions" \
    "a neon skull cracking and exploding into glowing fragments and shrapnel, volatile death energy, dark purple and red neon glow, enemy death explosion"

generate "asc_double_cd" \
    "a neon clock face spinning at double speed with accelerated hands, time compression energy swirling around it, cyan and yellow neon glow, overclock protocol"

generate "asc_glass_cannon" \
    "a cannon made of cracking translucent glass glowing with neon energy, powerful but visibly fragile, radiant barrel, cyan and white neon glow, glass cannon"

generate "asc_vampiric" \
    "neon red energy tendrils being drained from a fading enemy silhouette and flowing into a dark figure, blood-red and crimson neon glow, vampiric lifesteal"

generate "asc_bullet_time" \
    "a neon hourglass with time-slowed particles frozen around it, sand grains suspended in mid-air, blue and purple neon glow, bullet time slow motion"

generate "asc_xp_surge" \
    "a neon open book radiating beams of knowledge energy upward, glowing pages with data streams, blue and gold neon glow, experience and learning surge"

generate "asc_thick_skin" \
    "a glowing neon shield with multiple layered armor plates stacked together, impenetrable defense, blue and silver neon glow, thick skin protection"

generate "asc_chain_reaction" \
    "a neon critical hit spark bouncing chain-style between multiple enemy silhouettes, connected by bright energy lines, gold and cyan neon glow, chain crit"

generate "asc_treasure_hunter" \
    "a glowing neon treasure chest overflowing with coins, gems and loot items, golden light pouring out, gold and green neon glow, treasure and riches"

generate "asc_rapid_evolution" \
    "a neon DNA double helix mutating and evolving rapidly with energy sparks transforming its structure, green and purple neon glow, rapid genetic evolution"

generate "asc_berserker" \
    "a neon figure silhouette enraged with growing flames intensifying as cracks of damage appear on its body, red and orange neon glow, berserker fury"

generate "asc_shield_nova" \
    "a neon energy shield shattering outward in all directions, fragments becoming damaging projectiles, bright blue and white neon glow, shield nova explosion"

generate "asc_echo" \
    "a neon projectile with a translucent ghost duplicate trailing closely behind it, echo afterimage effect, cyan and pale blue neon glow, echo strike"

generate "asc_resilience" \
    "a solid neon rock fortress standing firm against incoming damage impacts, unmoved and unbroken, grey and blue neon glow with impact sparks, resilience"

echo ""
echo "=== Done! Generated $COUNT/$TOTAL icons ==="
echo "Output directory: $OUTPUT_DIR"
