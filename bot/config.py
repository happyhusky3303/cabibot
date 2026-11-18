import os
from dataclasses import dataclass, field

from dotenv import load_dotenv


class ConfigurationError(ValueError):
    """Application configuration is missing or incomplete."""


@dataclass(frozen=True)
class Settings:
    discord_bot_token: str = field(repr=False)
    database_url: str = field(default="", repr=False)

    def require_database_url(self) -> str:
        if not self.database_url or "[YOUR-DATABASE-PASSWORD]" in self.database_url:
            raise ConfigurationError("Set DATABASE_URL with your database password before starting the bot.")
        return self.database_url

    @classmethod
    def from_environment(cls) -> "Settings":
        load_dotenv()
        token = os.getenv("DISCORD_BOT_TOKEN", "").strip()
        if not token:
            raise ConfigurationError("Set DISCORD_BOT_TOKEN before starting the bot.")

        return cls(discord_bot_token=token, database_url=os.getenv("DATABASE_URL", "").strip())
