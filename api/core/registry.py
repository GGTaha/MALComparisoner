from adapters.mal import MALAdapter
from adapters.letterboxd import LetterboxdAdapter
from adapters.trakt import TraktAdapter
from adapters.base import PlatformAdapter

_registry = {
    "mal": MALAdapter(),
    "letterboxd": LetterboxdAdapter(),
    "trakt": TraktAdapter()
}

def get_adapter(platform: str) -> PlatformAdapter:
    adapter = _registry.get(platform)
    if not adapter:
        raise ValueError(f"Platform '{platform}' is not supported.")
    return adapter
