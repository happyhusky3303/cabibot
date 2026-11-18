import { commands, initModal, initModalId, respondToCommand, submitInit } from "./commands.mjs";
import { withDatabase } from "./database.mjs";

const discordApi = "https://discord.com/api/v10";
const commandNames = new Set(commands.map(({ name }) => name));
const encoder = new TextEncoder();

function hexBytes(hex, length) {
  if (typeof hex !== "string" || hex.length !== length * 2 || !/^[a-f0-9]+$/i.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function verifyDiscord(request, body, publicKey) {
  const signature = hexBytes(request.headers.get("X-Signature-Ed25519"), 64);
  const timestamp = request.headers.get("X-Signature-Timestamp");
  const key = hexBytes(publicKey, 32);
  if (!signature || !timestamp || !key || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() - Number(timestamp) * 1000) > 5 * 60 * 1000) return false;

  const prefix = encoder.encode(timestamp);
  const signed = new Uint8Array(prefix.length + body.byteLength);
  signed.set(prefix);
  signed.set(new Uint8Array(body), prefix.length);
  try {
    const verifyKey = await crypto.subtle.importKey("raw", key, "Ed25519", false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", verifyKey, signature, signed);
  } catch {
    return false;
  }
}

async function finishCommand(interaction, env) {
  let message;
  try {
    message = await withDatabase(env.HYPERDRIVE.connectionString, (db) =>
      interaction.type === 5 ? submitInit(interaction, db) : respondToCommand(interaction, db),
    );
  } catch (error) {
    console.error("Cabi command failed", interaction.data.name, error.code ?? error.name);
    message = { content: "Cabi chưa thực hiện được lệnh này. Bạn thử lại sau một chút nhé." };
  }

  const token = encodeURIComponent(interaction.token);
  const url = `${discordApi}/webhooks/${interaction.application_id}/${token}/messages/@original`;
  try {
    const result = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...message, allowed_mentions: { parse: [] } }),
    });
    if (!result.ok) console.error("Discord response update failed", result.status);
  } catch {
    console.error("Could not reach Discord to update the response");
  }
}

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname !== "/interactions") {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
    }

    const body = await request.arrayBuffer();
    if (!await verifyDiscord(request, body, env.DISCORD_PUBLIC_KEY)) {
      return new Response("Invalid signature", { status: 401 });
    }

    let interaction;
    try {
      interaction = JSON.parse(new TextDecoder().decode(body));
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    if (interaction?.type === 1) return Response.json({ type: 1 });
    const name = interaction?.data?.name;
    const isCommand = interaction?.type === 2 && commandNames.has(name);
    const isInitSubmission = interaction?.type === 5 && interaction.data?.custom_id === initModalId;
    if (isCommand && name === "init") return Response.json({ type: 9, data: initModal });
    if (!isCommand && !isInitSubmission) {
      return Response.json({ type: 4, data: { content: "Lệnh này không khả dụng.", flags: 64 } });
    }

    ctx.waitUntil(finishCommand(interaction, env));
    // Acknowledge immediately so database latency cannot exceed Discord's initial deadline.
    return Response.json({
      type: 5,
      ...(isInitSubmission || name === "foods" || name === "editinfo" ? { data: { flags: 64 } } : {}),
    });
  },
};
