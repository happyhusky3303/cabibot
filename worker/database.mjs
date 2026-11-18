import { Client } from "pg";
import catalog from "../bot/catalog.json" with { type: "json" };

export async function withDatabase(connectionString, operation) {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  try {
    await client.connect();
    return await operation({
      feed: (ownerId, interactionId, foodId, gain) => recordFeeding(client, ownerId, interactionId, foodId, gain),
      profile: (ownerId) => readProfile(client, ownerId),
    });
  } finally {
    await client.end();
  }
}

async function recordFeeding(client, ownerId, interactionId, foodId, gain) {
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO cabi_game.pets (owner_id, weight_grams)
       VALUES ($1, $2) ON CONFLICT (owner_id) DO NOTHING`,
      [ownerId, catalog.startingWeight],
    );
    // Serialize meals for the same pet until both its weight and meal history commit.
    const pet = await client.query(
      "SELECT weight_grams FROM cabi_game.pets WHERE owner_id = $1 FOR UPDATE",
      [ownerId],
    );
    const found = await client.query(
      "SELECT 1 FROM cabi_game.meals WHERE owner_id = $1 AND food_id = $2 LIMIT 1",
      [ownerId, foodId],
    );
    const meal = await client.query(
      `INSERT INTO cabi_game.meals (interaction_id, owner_id, food_id, gain_grams)
       VALUES ($1, $2, $3, $4) ON CONFLICT (interaction_id) DO NOTHING`,
      [interactionId, ownerId, foodId, gain],
    );
    if (meal.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const previousWeight = BigInt(pet.rows[0].weight_grams);
    const weight = previousWeight + BigInt(gain);
    await client.query(
      "UPDATE cabi_game.pets SET weight_grams = $1 WHERE owner_id = $2",
      [weight.toString(), ownerId],
    );
    await client.query("COMMIT");
    return { previousWeight, weight, firstDiscovery: found.rowCount === 0 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function readProfile(client, ownerId) {
  const { rows } = await client.query(
    `SELECT pet.weight_grams, meal.food_id, COUNT(*) AS meals, MAX(meal.gain_grams) AS biggest_gain
     FROM cabi_game.pets AS pet
     LEFT JOIN cabi_game.meals AS meal USING (owner_id)
     WHERE pet.owner_id = $1
     GROUP BY pet.weight_grams, meal.food_id
     ORDER BY meal.food_id`,
    [ownerId],
  );
  return rows;
}
