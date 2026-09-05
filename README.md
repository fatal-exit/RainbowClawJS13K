# 🌈 Rainbow Claw

An arcade unicorn claw machine roguelite with color splashing, Balatro-style scoring combos, and FM synthesis, built for [JS13kGames 2026](https://js13kgames.com/) (theme: *Unicorns and Rainbows*) and the [Wavedash](https://wavedash.com/) jam category.

The entire game — custom 2D physics, procedural 1-bit pixel art with dynamic color splash, full FM donk bass & cutting PWM synth audio engine, shop upgrades, and Wavedash leaderboard integration — compiles and packs into a single zip under **13,312 bytes**.

## Gameplay & Features

- **Crane Claw Physics**: Position your claw, time the drop, grab unicorns, and drop them into the prize chute.
- **Rainbow Color Splash**: Rescued unicorns burst monochrome pixels into vivid spectrum colors.
- **Balatro-Style Combos**: Score multipliers for Unicorn Pairs, Rainbow Flush, Full Stable, Prism Royal, and more.
- **Daily Quotas & Shop**: Beat escalating daily rent quotas and purchase claw buffs, magnetism, rainbow lasers, and speed boosts between shifts.
- **Synthesizer & Audio Engine**: Custom multi-oscillator synth featuring FM donk bass, duty-modulated PWM leads, arpeggios, and responsive SFX.
- **Wavedash SDK Integration**: Real-time leaderboard submission and high score persistence.

## Controls

- **Left / Right / A / D**: Move claw left and right
- **Down / S / Space / Tap**: Drop claw / Activate shop purchase
- **M**: Mute / unmute audio
- **Escape**: Pause / Title menu

## Development

```bash
npm install
npm run dev
```

Build the distribution bundle and pack with Roadroller:

```bash
npm run build
```

Run and push to Wavedash:

```bash
npm run wavedash:dev    # Local Wavedash SDK preview
npm run wavedash:push   # Build & push release to Wavedash
```

## Size Budget

Built with `esbuild`, `terser`, and `roadroller`. Total zip payload strictly adheres to the JS13k limit of 13,312 bytes.

## License

MIT License / JS13kGames 2026.
