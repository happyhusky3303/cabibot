import { commands } from "./commands.mjs";

const { DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN } = process.env;
if (!/^\d+$/.test(DISCORD_APPLICATION_ID ?? "") || !DISCORD_BOT_TOKEN) {
  console.error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN before registering commands.");
  process.exit(1);
}

const url = `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`;
for (const command of commands) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    console.error(`Registration failed for /${command.name} (Discord HTTP ${response.status}).`);
    process.exit(1);
  }
  console.log(`Registered /${command.name}`);
}
