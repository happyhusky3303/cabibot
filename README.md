# Cabi Bot

A Python 3.12 Discord bot for feeding your own Cabi. Each Discord account has one Cabi that follows it across servers where the bot is installed.

## Commands

- `/init` opens the Vietnamese setup form on the Cloudflare Worker. Enter what Cabi should call you and optionally give Cabi a name and bio. A new Cabi starts at 3 kg. Existing players can use the form to add profile details and keep their weight and meals.
- `/editinfo` edits the supplied `name`, `cabiname`, and `desc` options on the Worker. Omitted options keep their current values. Use `-` for `cabiname` or `desc` to clear that field.
- `/capsieubeo` feeds your Cabi. On the Worker, complete `/init` first. Small foods gain 0.1–10 kg, medium foods 10–50 kg, and big foods 50–100 kg, in 0.1 kg steps. Each meal has a 70% chance of small food, 25% medium, and 5% big.
- `/cabi` shows your Cabi's weight, meal count, discoveries, most-eaten food, and biggest meal. Use the optional `player` argument to see another player's card.
- `/foods` shows your private collection of 600 foods. Untried foods appear as `???`. Some foods form families across sizes, including three kinds of dumplings.
- `/gym` on Cloudflare gives an initialized Cabi a 0.5% chance of working out and losing 0.1–0.5 kg, down to a minimum of 1 kg. Otherwise, Cabi picks a random excuse from `worker/gym-excuses.json`.

Feeding announces first discoveries and celebrates reaching 5, 10, 20, 50, and 100 kg.

## Project layout

- `bot/__main__.py` starts the bot.
- `bot/client.py` connects to Discord and syncs the slash commands.
- `bot/commands.py` builds command responses, and `bot/food.py` defines foods and weight rolls.
- `bot/catalog.json` contains the food IDs, Vietnamese names, starting weight, and milestones shared by both runtimes.
- `bot/config.py` loads and validates environment variables.
- `bot/database.py` reads profiles and records meals and weight in PostgreSQL.
- `sql/001_cabi.sql` creates the game tables.
- `requirements.txt`, `Dockerfile`, and `render.yaml` define the local dependencies, container, and Render service.

## Configuration

The Docker image builds without credentials. Before running the bot, apply `sql/001_cabi.sql` in your Supabase project's SQL Editor. The script can be run again safely. Install the bot in your Discord server with the `bot` and `applications.commands` scopes.

Copy `.env.example` to `.env` and set `DISCORD_BOT_TOKEN` using the token from the Discord Developer Portal. In `DATABASE_URL`, replace the entire `[YOUR-DATABASE-PASSWORD]` placeholder with your Supabase database password. Percent-encode special characters in the password, for example `@` becomes `%40` and `#` becomes `%23`. Keep `.env` local. The template uses the shared session pooler on port 5432 and requires an encrypted connection.

## Run locally

From the project directory, use Python 3.12. On Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Fill in both variables in `.env`, then run:

```powershell
.\.venv\Scripts\python.exe -m bot
```

## Run with Docker

```sh
docker build -t cabi-bot .
docker run --rm --init --env-file .env cabi-bot
```

The container uses the same startup command and receives credentials at runtime.

## Deploy on Render later

1. Push the project to a Git repository connected to Render.
2. Create a Blueprint in Render and select the repository. The Blueprint defines a Docker background worker on the paid Starter plan. The worker connects outbound to Discord and needs no HTTP port.
3. Enter `DISCORD_BOT_TOKEN` and `DATABASE_URL` in the Blueprint setup.
4. After deployment, check the worker logs for command sync and the Discord connection. Use `/capsieubeo` in Discord to verify the database setup.

[Render Blueprint reference](https://render.com/docs/blueprint-spec) · [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres)

## Deploy on Cloudflare Workers

The Worker is an alternative to running the Python bot. It accepts signed Discord interactions at `/interactions` and uses the same `cabi_game` tables. Apply the SQL migrations in numeric order before deploying. If the profile migration is already applied, run `sql/003_cabi_gym.sql` before deploying the gym update. Keep Hyperdrive query caching disabled so profiles show freshly recorded changes.

Use Node.js 22 or newer. From the project directory, sign in to the Cloudflare account that owns `cabibot`:

```powershell
cd worker
npm ci
npx wrangler login
npm run deploy
npx wrangler secret put DISCORD_PUBLIC_KEY
```

For `DISCORD_PUBLIC_KEY`, use **Public Key** from your Discord application's **General Information** page. Use the Worker URL printed by Wrangler and append `/interactions`. Paste that full URL into **Interactions Endpoint URL** in the same Discord application and save. Discord sends a signed verification ping. Once it accepts the URL, Discord sends interactions to the Worker.

When first setting up the Worker or adding or changing a slash command, register the commands after deploying. From the `worker` directory, set `DISCORD_APPLICATION_ID` to the application's ID and load `DISCORD_BOT_TOKEN` locally. For example, if the token is already in the project's ignored `.env`:

```powershell
$env:DISCORD_APPLICATION_ID = "YOUR_APPLICATION_ID"
node --env-file=../.env register-commands.mjs
```

The registration script updates the Cabi commands by name. The deployed Worker needs the Discord public key and the configured `HYPERDRIVE` binding. Test `/init`, `/editinfo`, `/cabi`, `/capsieubeo`, `/foods`, and `/gym` in Discord after switching over.
