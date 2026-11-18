import logging

import discord
from discord import app_commands

from bot.commands import register_commands
from bot.config import Settings

logger = logging.getLogger(__name__)


class CabiBot(discord.Client):
    def __init__(self, settings: Settings) -> None:
        super().__init__(
            intents=discord.Intents.none(),
            allowed_mentions=discord.AllowedMentions.none(),
        )
        self.tree = app_commands.CommandTree(self)
        register_commands(self.tree, settings)

    async def setup_hook(self) -> None:
        commands = await self.tree.sync()
        logger.info("Synced %s slash commands", len(commands))

    async def on_ready(self) -> None:
        logger.info("Connected to Discord as %s", self.user)
