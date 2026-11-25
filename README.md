# GD Kingdom

Open packs, collect level cards, train fighters, and play the campaign or Army mode. The server rolls packs, saves progress, and verifies battle rewards and leaderboard entries.

## Run locally

Use Node.js 24. Run `npm ci` and `npm run dev` for a preview. Run `npm test` to build the game and check the server rules. The media and level catalog are supplied in the bundled assets, which the build extracts automatically.

## Run on Railway

Deploy the `main` branch using the supplied Dockerfile. Attach a volume at `/data` and generate a public domain. The service uses Railway's mount path for SQLite and reports readiness at `/health`.

Guest saves are stored on the server and tied to the browser that created them. A legacy browser save can transfer once into its current online profile on the same domain. The transfer combines collections and keeps the higher balance for each currency. Transferred progress is playable online and is excluded from new public leaderboard submissions.

## Discord sign-in

Set `DISCORD_CLIENT_ID` to the app's Application ID. Register `<public game origin>/api/auth/discord/callback` under OAuth2 Redirects in the Discord Developer Portal. The server uses the authorization code flow with PKCE and requests the `identify` scope. On first sign-in a Discord account claims the current online guest save when the account has no existing save.
