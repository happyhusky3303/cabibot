import logging

import discord
from discord import app_commands

from bot.config import Settings
from bot.database import get_profile, record_feeding
from bot.food import FOOD_NAMES, FOODS, MILESTONES, kilograms, roll_meal

logger = logging.getLogger(__name__)
SIZE_LABELS = {"Small": "Nhỏ", "Medium": "Vừa", "Big": "Lớn"}


def register_commands(tree: app_commands.CommandTree, settings: Settings) -> None:
    @tree.command(name="capsieubeo", description="Cho Cabi ăn một món ngẫu nhiên.")
    async def capsieubeo(interaction: discord.Interaction) -> None:
        await interaction.response.defer(thinking=True)
        food_id, size, gain = roll_meal()
        result = await record_feeding(settings, interaction.user.id, interaction.id, food_id, gain)
        if result is None:
            await interaction.edit_original_response(content="Bữa ăn này đã được ghi nhận.")
            return

        name = FOOD_NAMES[food_id]
        lines = [
            f"🍽️ Cabi của bạn đã ăn **{name}** (cỡ {SIZE_LABELS[size].lower()}) và tăng **{kilograms(gain)}**.",
            f"Cabi hiện nặng **{kilograms(result.weight)}**.",
        ]
        if result.first_discovery:
            lines.append(f"✨ Lần đầu Cabi thử **{name}**!")
        for milestone in MILESTONES:
            if result.previous_weight < milestone <= result.weight:
                lines.append(f"🎉 Nhờ **{name}**, Cabi đã cán mốc **{kilograms(milestone)}**!")
        await interaction.edit_original_response(content="\n".join(lines))

    @tree.command(name="cabi", description="Xem Cabi của bạn hoặc của người chơi khác.")
    @app_commands.describe(player="Người chơi có Cabi mà bạn muốn xem")
    async def cabi(interaction: discord.Interaction, player: discord.User | None = None) -> None:
        await interaction.response.defer(thinking=True)
        owner = player or interaction.user
        profile = await get_profile(settings, owner.id)
        if profile is None:
            message = (
                "Dùng `/capsieubeo` để gặp Cabi của bạn."
                if owner.id == interaction.user.id
                else f"{owner.mention} chưa cho Cabi ăn lần nào."
            )
            await interaction.edit_original_response(content=message)
            return

        lines = [
            f"**Cân nặng** · {kilograms(profile.weight)}",
            f"**Số bữa đã ăn** · {sum(food.meals for food in profile.foods)}",
            f"**Số món đã thử** · {len(profile.foods)}",
        ]
        if profile.foods:
            most_eaten = max(profile.foods, key=lambda food: food.meals)
            biggest = max(profile.foods, key=lambda food: food.biggest_gain)
            lines.extend([
                f"**Món ăn nhiều nhất** · {FOOD_NAMES.get(most_eaten.food_id, most_eaten.food_id)} "
                f"× {most_eaten.meals}",
                f"**Món làm Cabi tăng cân nhiều nhất** · {FOOD_NAMES.get(biggest.food_id, biggest.food_id)} "
                f"(+{kilograms(biggest.biggest_gain)})",
            ])
        card = discord.Embed(title=f"Cabi của {owner.display_name}", description="\n".join(lines))
        await interaction.edit_original_response(embed=card)

    @tree.command(name="foods", description="Xem những món Cabi của bạn đã thử.")
    async def foods(interaction: discord.Interaction) -> None:
        await interaction.response.defer(thinking=True, ephemeral=True)
        profile = await get_profile(settings, interaction.user.id)
        discovered = {food.food_id for food in profile.foods} if profile else set()
        card = discord.Embed(title="Bộ sưu tập món ăn của Cabi")
        for size, group in FOODS.items():
            count = len(discovered.intersection(group))
            card.add_field(
                name=f"Cỡ {SIZE_LABELS[size].lower()} · {count}/{len(group)}",
                value="\n".join(name if food_id in discovered else "???" for food_id, name in group.items()),
            )
        await interaction.edit_original_response(embed=card)

    @tree.error
    async def on_command_error(
        interaction: discord.Interaction, error: app_commands.AppCommandError
    ) -> None:
        cause = getattr(error, "original", error)
        logger.error("Cabi command failed (%s)", type(cause).__name__)
        message = "Cabi chưa thực hiện được lệnh này. Bạn thử lại sau một chút nhé."
        if interaction.response.is_done():
            await interaction.edit_original_response(content=message)
        else:
            await interaction.response.send_message(message, ephemeral=True)
