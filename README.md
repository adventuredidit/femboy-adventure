# Femboy Adventure Bot

A small, opinionated Discord bot written in Node.js using discord.js v14. It includes moderation helpers, reaction GIFs, a simple economy (slots/bet), trivia persistence, and a Replit-friendly YouTube search command (`/playquery`). It's tuned for a chill/femboy personality and optionally uses OpenAI for flavored replies.

## Quick start

1. Clone the repo and enter the directory:

   git clone <your-repo-url>
   cd femboy-adventure-bot

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file (copy `.env.example`) and add your keys:

- `DISCORD_TOKEN` (required)
- `OPENAI_KEY` (optional — used for flavored replies)
- `OPENAI_ORG` (optional)
- `GUILD_ID` (optional — if set, slash commands will be registered to that single guild for instant testing)
- `PORT` (optional — used on Replit for the keep-alive server)

4. Start the bot locally:

```bash
# Start only the bot
node index.js

# Or run the keep-alive server + bot (per package.json)
npm start
```

## Replit

This repo includes a tiny HTTP server (`server.js`) and a `.replit` config so you can run the bot on Replit. On Replit, set the environment variables in the Secrets tab and click Run. The bot uses `process.env.PORT` for the HTTP keep-alive route.

Notes:
- Replit's filesystem may be ephemeral for free plans — back up `data/` if you need persistence long term.
- For voice/music features (full playback), Replit free is not suitable — see "Hosting" below.

The repository contains an `.env.example` file showing required variables. Do NOT commit a real `.env` file. If you accidentally commit secrets, rotate them immediately and remove them from git history.

## Commands (high level)

This is a quick summary of implemented commands. Use `/` in Discord to see the full list and parameter hints.

- Moderation
  - `/warn @user [duration] [reason]` — add a persistent warn
  - `/warns @user` — list warns
  - `/clearwarns @user` — clear warns
  - `/setmodlog #channel` — set a mod-log channel for the guild

- Economy
  - `/balance` or `/bal` — check your balance (ephemeral/private)
  - `/slots <amount>` — play slots
  - `/bet <amount> <choice>` — simple bet command
  - `/give @user <amount>` — admin-only grant currency

- Fun
  - `/meme` — random meme GIF
  - `/hug @user` — send a hug GIF
  - `/slap @user` — send a slap GIF
  - `/ship @user @user` — ship two users; produces a percent + themed GIF

- Music
  - `/playquery <query>` — searches YouTube and returns a playable link + metadata (Replit-friendly link-based search; no voice streaming)

- Trivia
  - `/trivia` — play trivia (scores persistent in `data/trivia_scores.json`)

## Data and persistence

The bot stores simple JSON files under `data/`:

- `data/warns.json` — per-guild warns
- `data/economy.json` — balances (per-guild/per-user)
- `data/gifs.json` — configured GIF lists
- `data/trivia_scores.json` — trivia leaderboard
- `data/config.json` — per-guild settings (e.g., modlog channel)

Keep these files backed up if you're on an ephemeral host.

## Environment variables

Create a `.env` file (copy `.env.example`) or set these in your host's secret manager:

- `DISCORD_TOKEN` (required)
- `OPENAI_KEY` (optional, only if you want flavored OpenAI replies)
- `OPENAI_ORG` (optional)
- `GUILD_ID` (optional) — if set, slash commands are registered to that guild only (fast). If unset, commands are registered globally and may take up to ~1 hour to appear.
- `PORT` (optional, used by `server.js`)

See `.env.example` for a template.

## Hosting recommendations

- Small bots + link-based commands: Replit (free) or any small VPS works.
- Voice playback / streaming: use a VPS or droplet with ffmpeg installed (Docker or PM2 recommended). The repo includes `deploy/oracle` helpers if you want an Oracle Always Free VM setup.
- For production reliability, mount a block storage volume for `data/` or push state to a real database.

## Contributing

Feel free to open issues or PRs. If you'd like new features, describe the UX and I'll wire it up.

Quick notes for repository maintainers:
- There are currently 8 cases defined in `data/gifs.json`. If you expect 15 cases, add the missing case definitions to `data/gifs.json` or accept that the bot will only register/list the cases present.
- Use `npm run validate-gifs` to run a format-level check on GIF URLs before committing.

## Troubleshooting

- Bot won't start: ensure `DISCORD_TOKEN` is set and valid.
- Commands not showing: invite the bot with the proper application commands scope and make sure it has the required guild permissions.
- Data not persisting on Replit: download `data/` periodically or switch to a VPS with persistent disks.

## License

This project is provided as-is. Add a LICENSE file that fits how you want to share the code (MIT is common).

---

If you'd like, I can also:

- Add a `.env.example`, `.gitignore`, and an MIT `LICENSE` file now.
- Create a short `README` section per-command with exact usage flags.
- Generate a `Dockerfile` and `docker-compose.yml` for containerized deployment.

Tell me which of the above you'd like next.
