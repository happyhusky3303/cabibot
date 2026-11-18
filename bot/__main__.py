import asyncio
import logging
import sys

from bot.config import ConfigurationError, Settings


async def run_bot(settings: Settings) -> None:
    from bot.client import CabiBot

    async with CabiBot(settings) as client:
        await client.start(settings.discord_bot_token)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    try:
        settings = Settings.from_environment()
        settings.require_database_url()
    except ConfigurationError as error:
        raise SystemExit(str(error)) from None

    # Psycopg's async connections require a selector event loop on Windows.
    loop_factory = asyncio.SelectorEventLoop if sys.platform == "win32" else None
    try:
        asyncio.run(run_bot(settings), loop_factory=loop_factory)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
