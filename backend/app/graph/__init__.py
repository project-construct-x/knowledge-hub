"""Graph-Layer: Fuseki-Client und Repository-Klassen für Fachobjekte.

Der Client wird einmal im FastAPI-Lifespan erzeugt und als Dependency injiziert.
"""

from contextvars import ContextVar

from .client import FusekiClient, FusekiError

# Ein Client pro App-Instanz (per ContextVar, damit Tests isoliert laufen können).
_fuseki_client: ContextVar[FusekiClient | None] = ContextVar("fuseki_client", default=None)


def get_fuseki() -> FusekiClient:
    """FastAPI-Dependency: liefert den globalen Fuseki-Client."""
    client = _fuseki_client.get()
    if client is None:
        raise FusekiError(0, "FusekiClient wurde nicht initialisiert (lifespan nicht ausgeführt?)")
    return client


async def init_fuseki(client: FusekiClient) -> None:
    """Wird im FastAPI-Lifespan beim Start aufgerufen."""
    _fuseki_client.set(client)


async def shutdown_fuseki() -> None:
    """Wird im FastAPI-Lifespan beim Stop aufgerufen."""
    client = _fuseki_client.get()
    if client is not None:
        await client.aclose()
        _fuseki_client.set(None)
