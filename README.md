# GD Kingdom

Open packs, collect level cards, train fighters, and play the campaign or Army mode. The server rolls packs, saves progress, and verifies battle rewards and leaderboard entries.

## Run locally

Use Node.js 24. Run `npm ci` and `npm run dev` for a preview. Run `npm test` to build the game and check the server rules. The media and level catalog are supplied in the bundled assets, which the build extracts automatically.

## Run on Railway

Deploy the `main` branch using the supplied Dockerfile. Attach a volume at `/data` and generate a public domain. The service uses Railway's mount path for SQLite and reports readiness at `/health`.

After signing in, a player can transfer a legacy browser save once into their online profile on the same domain. The transfer combines collections and keeps the higher balance for each currency. Transferred progress is playable online and is excluded from new public leaderboard submissions.

## Discord sign-in

Set `DISCORD_CLIENT_ID` to the app's Application ID. Register `<public game origin>/api/auth/discord/callback` under OAuth2 Redirects in the Discord Developer Portal. The server uses the authorization code flow with PKCE and requests the `identify` scope. On first sign-in a Discord account claims the current online guest save when the account has no existing save.

## Rare reveal audio

The tier mixes combine original synth layers with excerpts from [Logo Reveal Intro](https://pixabay.com/sound-effects/film-special-effects-logo-reveal-intro-352299/), [Logo Reveal](https://pixabay.com/sound-effects/film-special-effects-logo-reveal-199582/), and [Clean Logo Reveal](https://pixabay.com/sound-effects/film-special-effects-clean-logo-reveal-139678/) by Universfield, and [Epic Flute Reveal Logo](https://pixabay.com/sound-effects/film-special-effects-epic-flute-reveal-logo-201062/) and [Epic Cinematic Reveal Logo](https://pixabay.com/sound-effects/musical-epic-cinematic-reveal-logo-201065/) by BreakzStudios. The source effects use the [Pixabay Content License](https://pixabay.com/service/license-summary/). When a card has its own music clip, the reveal links to the artist's track.

The audiovisual reveals for Amethyst, andromeda, FOREST OF SPIKES, KILLSTEALER, Based After Based, and METROPOLIS with their respective level music are licensed [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/). Track credits and licenses are linked inside each reveal. Waterflame's source recordings are also listed on the [artist's channel](https://www.youtube.com/user/waterflame89).

The chest mixes combine original sound layers with Pixabay excerpts. Legendary uses [Reveal Logo (Bumper)](https://pixabay.com/sound-effects/musical-reveal-logo-bumper-524252/) by AleXZavesa. Mythic and Secret use [Radiant Shine](https://pixabay.com/sound-effects/film-special-effects-radiant-shine-logo-reveal-sound-effect-530583/) and [Modern Minimal](https://pixabay.com/sound-effects/film-special-effects-modern-minimal-logo-reveal-sound-effect-530581/) by ThunderMotion. Ancient, Exotic, Celestial, and Apex use the flute, [Sci-Fi Intro](https://pixabay.com/sound-effects/film-special-effects-sci-fi-intro-logo-reveal-227279/), [Sci-Fi Intro 4](https://pixabay.com/sound-effects/film-special-effects-sci-fi-intro-logo-reveal-4-227278/), and Epic Cinema Reveal Logo (543747) samples by BreakzStudios. Divine uses [Magical Reveal Start](https://pixabay.com/sound-effects/film-special-effects-magical-reveal-start-388923/) by freesound_gamestudio. Impossible uses Dramatic Reveal Riser 12 (538601) by AberrantRealities. Singularity adds [Cinematic Boom Suspense Reveal Bass](https://pixabay.com/sound-effects/film-special-effects-cinematic-boom-suspense-reveal-bass-341997/) by kalsstockmedia.
