# Cabi Bot

A Python 3.12 Discord bot for feeding your own Cabi. Each Discord account has one Cabi that follows it across servers where the bot is installed.

## Commands

- `/capsieubeo` creates your Cabi on the first meal. Cabi starts at 3 kg. Each meal rolls an equal chance of gaining 0.1 to 1 kg in 0.1 kg steps, then selects a random food in the matching size. Small covers 0.1–0.3 kg, medium 0.4–0.7 kg, and big 0.8–1 kg.
- `/cabi` shows your Cabi's weight, meal count, discoveries, most-eaten food, and biggest meal. Use the optional `player` argument to see another player's card.
- `/foods` shows your private collection of 15 foods. Untried foods appear as `???`. Some foods form families across sizes, including three kinds of dumplings.

Feeding announces first discoveries and celebrates reaching 5, 10, 20, 50, and 100 kg.

## Project layout

- `bot/__main__.py` starts the bot.
- `bot/client.py` connects to Discord and syncs the slash commands.
- `bot/commands.py` builds command responses, and `bot/food.py` defines foods and weight rolls.
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
