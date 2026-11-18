from dataclasses import dataclass

from psycopg import AsyncConnection

from bot.config import Settings
from bot.food import STARTING_WEIGHT


@dataclass(frozen=True)
class Feeding:
    previous_weight: int
    weight: int
    first_discovery: bool


@dataclass(frozen=True)
class FoodRecord:
    food_id: str
    meals: int
    biggest_gain: int


@dataclass(frozen=True)
class Profile:
    weight: int
    foods: list[FoodRecord]


async def connect_database(settings: Settings) -> AsyncConnection:
    """Open a PostgreSQL connection. The caller owns its lifecycle."""
    return await AsyncConnection.connect(settings.require_database_url(), connect_timeout=5)


async def record_feeding(
    settings: Settings, owner_id: int, interaction_id: int, food_id: str, gain: int
) -> Feeding | None:
    async with await connect_database(settings) as connection:
        await connection.execute(
            """
            INSERT INTO cabi_game.pets (owner_id, weight_grams)
            VALUES (%s, %s) ON CONFLICT (owner_id) DO NOTHING
            """,
            (owner_id, STARTING_WEIGHT),
        )
        # Hold the pet row lock until both the meal and the new weight commit.
        cursor = await connection.execute(
            "SELECT weight_grams FROM cabi_game.pets WHERE owner_id = %s FOR UPDATE",
            (owner_id,),
        )
        (previous_weight,) = await cursor.fetchone()
        cursor = await connection.execute(
            "SELECT 1 FROM cabi_game.meals WHERE owner_id = %s AND food_id = %s LIMIT 1",
            (owner_id, food_id),
        )
        first_discovery = await cursor.fetchone() is None
        cursor = await connection.execute(
            """
            INSERT INTO cabi_game.meals (interaction_id, owner_id, food_id, gain_grams)
            VALUES (%s, %s, %s, %s) ON CONFLICT (interaction_id) DO NOTHING
            """,
            (interaction_id, owner_id, food_id, gain),
        )
        if cursor.rowcount == 0:
            return None

        weight = previous_weight + gain
        await connection.execute(
            "UPDATE cabi_game.pets SET weight_grams = %s WHERE owner_id = %s",
            (weight, owner_id),
        )
        return Feeding(previous_weight, weight, first_discovery)


async def get_profile(settings: Settings, owner_id: int) -> Profile | None:
    async with await connect_database(settings) as connection:
        cursor = await connection.execute(
            """
            SELECT pet.weight_grams, meal.food_id, COUNT(*), MAX(meal.gain_grams)
            FROM cabi_game.pets AS pet
            LEFT JOIN cabi_game.meals AS meal USING (owner_id)
            WHERE pet.owner_id = %s
            GROUP BY pet.weight_grams, meal.food_id
            ORDER BY meal.food_id
            """,
            (owner_id,),
        )
        rows = await cursor.fetchall()

    if not rows:
        return None
    foods = [
        FoodRecord(food_id, count, biggest)
        for _, food_id, count, biggest in rows
        if food_id is not None
    ]
    return Profile(rows[0][0], foods)
