import json
import random
from pathlib import Path

_catalog = json.loads(Path(__file__).with_name("catalog.json").read_text(encoding="utf-8"))
STARTING_WEIGHT = _catalog["startingWeight"]
MILESTONES = tuple(_catalog["milestones"])
MEAL_SIZES = _catalog["mealSizes"]
FOODS = _catalog["foods"]
FOOD_NAMES = {food_id: name for group in FOODS.values() for food_id, name in group.items()}


def roll_meal() -> tuple[str, str, int]:
    size = random.choices(
        tuple(MEAL_SIZES),
        weights=tuple(settings["chance"] for settings in MEAL_SIZES.values()),
        k=1,
    )[0]
    limits = MEAL_SIZES[size]
    gain = random.randint(limits["minGainGrams"] // 100, limits["maxGainGrams"] // 100) * 100
    return random.choice(tuple(FOODS[size])), size, gain


def kilograms(grams: int) -> str:
    whole, fraction = divmod(grams, 1000)
    whole_text = f"{whole:,}".replace(",", ".")
    fraction_text = f",{fraction:03}".rstrip("0").rstrip(",")
    return f"{whole_text}{fraction_text} kg"
