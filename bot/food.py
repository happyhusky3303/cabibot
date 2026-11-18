import json
import random
from pathlib import Path

_catalog = json.loads(Path(__file__).with_name("catalog.json").read_text(encoding="utf-8"))
STARTING_WEIGHT = _catalog["startingWeight"]
MILESTONES = tuple(_catalog["milestones"])
FOODS = _catalog["foods"]
FOOD_NAMES = {food_id: name for group in FOODS.values() for food_id, name in group.items()}


def roll_meal() -> tuple[str, str, int]:
    gain = random.randint(1, 10) * 100
    if gain <= 300:
        size = "Small"
    elif gain <= 700:
        size = "Medium"
    else:
        size = "Big"
    return random.choice(tuple(FOODS[size])), size, gain


def kilograms(grams: int) -> str:
    whole, fraction = divmod(grams, 1000)
    whole_text = f"{whole:,}".replace(",", ".")
    fraction_text = f",{fraction:03}".rstrip("0").rstrip(",")
    return f"{whole_text}{fraction_text} kg"
