# GD Kingdom

Open packs, collect level cards, train fighters, and play the campaign or Army mode. The server rolls packs, saves progress, and verifies battle rewards and leaderboard entries.

## Run locally

Use Node.js 24. Run `npm ci` and `npm run dev` for a preview. Run `npm test` to build the game and check the server rules. The media and level catalog are supplied in the bundled assets, which the build extracts automatically.

## Run on Railway

Deploy the `main` branch using the supplied Dockerfile. Attach a volume at `/data` and generate a public domain. The service uses Railway's mount path for SQLite and reports readiness at `/health`.

This deployment has its own campaign, inventory, and leaderboard. Guest saves are stored on the server and tied to the browser that created them.
