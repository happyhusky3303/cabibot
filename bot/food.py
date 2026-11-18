import random

STARTING_WEIGHT = 3000
MILESTONES = (5000, 10000, 20000, 50000, 100000)

# Keep food IDs stable after players discover them.
FOODS = {
    "Small": {
        "mini-dumpling": "Há cảo mini",
        "blueberry": "Việt quất",
        "rice-cracker": "Bánh gạo giòn",
        "strawberry": "Dâu tây",
        "butter-cookie": "Bánh quy bơ",
    },
    "Medium": {
        "dumpling-basket": "Xửng há cảo hấp",
        "mango-sticky-rice": "Xôi xoài",
        "egg-sandwich": "Bánh mì kẹp trứng",
        "berry-parfait": "Ly sữa chua trái cây mọng",
        "pancakes": "Chồng bánh pancake",
    },
    "Big": {
        "soup-dumpling": "Tiểu long bao khổng lồ",
        "noodle-feast": "Tiệc mì",
        "pizza": "Cả chiếc pizza",
        "berry-cake": "Bánh kem trái cây mọng ba tầng",
        "rice-platter": "Đĩa cơm chiên đầy ụ",
    },
}
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
