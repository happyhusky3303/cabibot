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
      gym: (ownerId, interactionId, attempt) => recordWorkout(client, ownerId, interactionId, attempt),
      profile: (ownerId) => readProfile(client, ownerId),
      initialize: (ownerId, info) => initializeProfile(client, ownerId, info),
      editInfo: (ownerId, changes) => editProfile(client, ownerId, changes),
    });
  } finally {
    await client.end();
  }
}

async function recordFeeding(client, ownerId, interactionId, foodId, gain) {
  await client.query("BEGIN");
  try {
    // Serialize meals for the same pet until both its weight and meal history commit.
    const pet = await client.query(
      "SELECT weight_grams FROM cabi_game.pets WHERE owner_id = $1 AND owner_name IS NOT NULL FOR UPDATE",
      [ownerId],
    );
    if (pet.rowCount === 0) {
      await client.query("ROLLBACK");
      return { needsInit: true };
    }
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
    let previousHigh = previousWeight;
    if (catalog.milestones.some((milestone) => previousWeight < milestone && milestone <= weight)) {
      const { rows: [history] } = await client.query(
        `SELECT GREATEST($2::bigint, MAX(weight_grams + loss_grams)) AS previous_high
         FROM cabi_game.gym_attempts WHERE owner_id = $1 AND loss_grams > 0`,
        [ownerId, previousWeight.toString()],
      );
      previousHigh = BigInt(history.previous_high);
    }
    await client.query(
      "UPDATE cabi_game.pets SET weight_grams = $1 WHERE owner_id = $2",
      [weight.toString(), ownerId],
    );
    await client.query("COMMIT");
    return { previousHigh, weight, firstDiscovery: found.rowCount === 0 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function recordWorkout(client, ownerId, interactionId, { excuse, loss }) {
  await client.query("BEGIN");
  try {
    const { rows: [pet] } = await client.query(
      "SELECT weight_grams FROM cabi_game.pets WHERE owner_id = $1 AND owner_name IS NOT NULL FOR UPDATE",
      [ownerId],
    );
    if (!pet) {
      await client.query("ROLLBACK");
      return { needsInit: true };
    }

    const previousWeight = BigInt(pet.weight_grams);
    const availableLoss = previousWeight > 1000n ? previousWeight - 1000n : 0n;
    const appliedLoss = availableLoss < loss ? Number(availableLoss) : loss;
    const weight = previousWeight - BigInt(appliedLoss);
    const { rowCount, rows } = await client.query(
      `INSERT INTO cabi_game.gym_attempts (interaction_id, owner_id, excuse, loss_grams, weight_grams)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (interaction_id) DO NOTHING
       RETURNING excuse, loss_grams, weight_grams`,
      [interactionId, ownerId, excuse, appliedLoss, weight.toString()],
    );
    if (rowCount === 0) {
      const existing = await client.query(
        `SELECT excuse, loss_grams, weight_grams FROM cabi_game.gym_attempts
         WHERE interaction_id = $1 AND owner_id = $2`,
        [interactionId, ownerId],
      );
      await client.query("ROLLBACK");
      return existing.rows[0];
    }

    if (appliedLoss > 0) {
      await client.query(
        "UPDATE cabi_game.pets SET weight_grams = $1 WHERE owner_id = $2",
        [weight.toString(), ownerId],
      );
    }
    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function initializeProfile(client, ownerId, info) {
  const result = await client.query(
    `INSERT INTO cabi_game.pets (owner_id, weight_grams, owner_name, cabi_name, description)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (owner_id) DO UPDATE SET
       owner_name = EXCLUDED.owner_name,
       cabi_name = EXCLUDED.cabi_name,
       description = EXCLUDED.description
     WHERE cabi_game.pets.owner_name IS NULL`,
    [ownerId, catalog.startingWeight, info.name, info.cabiname, info.desc],
  );
  return result.rowCount === 1;
}

async function editProfile(client, ownerId, changes) {
  const { rows } = await client.query(
    `UPDATE cabi_game.pets SET
       owner_name = COALESCE($2, owner_name),
       cabi_name = CASE WHEN $3 THEN $4 ELSE cabi_name END,
       description = CASE WHEN $5 THEN $6 ELSE description END
     WHERE owner_id = $1 AND owner_name IS NOT NULL
     RETURNING owner_name, cabi_name`,
    [ownerId, changes.name ?? null, "cabiname" in changes, changes.cabiname ?? null,
      "desc" in changes, changes.desc ?? null],
  );
  return rows[0];
}

async function readProfile(client, ownerId) {
  const { rows } = await client.query(
    `SELECT pet.weight_grams, pet.owner_name, pet.cabi_name, pet.description,
            meal.food_id, COUNT(*) AS meals, MAX(meal.gain_grams) AS biggest_gain
     FROM cabi_game.pets AS pet
     LEFT JOIN cabi_game.meals AS meal USING (owner_id)
     WHERE pet.owner_id = $1
     GROUP BY pet.owner_id, meal.food_id
     ORDER BY meal.food_id`,
    [ownerId],
  );
  return rows;
}
