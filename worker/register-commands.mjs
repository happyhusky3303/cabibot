import { setTimeout as delay } from "node:timers/promises";

import { commands } from "./commands.mjs";

const requested = process.argv.slice(2).map((name) => name.replace(/^\//, ""));
const unknown = requested.find((name) => !commands.some((command) => command.name === name));
if (unknown !== undefined) {
  console.error(`Unknown command: /${unknown}`);
  process.exit(1);
}
const selected = requested.length
  ? commands.filter(({ name }) => requested.includes(name))
  : commands;

const { DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN } = process.env;
if (!/^\d+$/.test(DISCORD_APPLICATION_ID ?? "") || !DISCORD_BOT_TOKEN) {
  console.error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN before registering commands.");
  process.exit(1);
}

const url = `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`;
async function register(command) {
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10000),
  });
}

for (const command of selected) {
  let response = await register(command);
  let retried = false;
  while (response.status === 429) {
    const data = await response.json().catch(() => null);
    const seconds = Number(data?.retry_after ?? response.headers.get("Retry-After") ?? NaN);
    const hasWait = Number.isFinite(seconds) && seconds >= 0;
    if (retried || !hasWait || seconds > 30) {
      const wait = hasWait ? `in at least ${Math.ceil(seconds)} seconds` : "later";
      console.error(`Discord rate limit for /${command.name}. Retry ${wait}.`);
      process.exit(1);
    }
    console.log(`Discord rate limit for /${command.name}. Retrying in ${Math.ceil(seconds)} seconds.`);
    await delay(Math.ceil(seconds * 1000) + 100);
    retried = true;
    response = await register(command);
  }
  if (!response.ok) {
    console.error(`Registration failed for /${command.name} (Discord HTTP ${response.status}).`);
    process.exit(1);
  }
  console.log(`Registered /${command.name}`);
}
