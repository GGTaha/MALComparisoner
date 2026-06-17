from typing import Protocol
from schemas.media import PlatformPayload

class PlatformAdapter(Protocol):
    async def fetch_user_list(self, username: str) -> PlatformPayload:
        ...
