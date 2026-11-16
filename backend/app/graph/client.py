"""Dünnster HTTP-Client für den Apache Jena Fuseki-Server.

Kapselt die SPARQL-Query-, Update- und Graph-Store-Endpoints.
Kann im FastAPI-Lifespan erzeugt und geschlossen werden (ein Client pro App).
"""

from __future__ import annotations

import httpx2


class FusekiError(RuntimeError):
    """Wird bei nicht erfolgreichen Antworten des Fuseki-Servers geworfen."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Fuseki {status_code}: {detail}")


class FusekiClient:
    """Asynchroner HTTP-Client für Fuseki (SPARQL + Graph Store Protocol)."""

    def __init__(
        self,
        base_url: str,
        dataset: str,
        auth: tuple[str, str] | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._dataset = dataset
        self._query_url = f"{base_url}/{dataset}/sparql"
        self._update_url = f"{base_url}/{dataset}/update"
        self._data_url = f"{base_url}/{dataset}/data"
        self._http = httpx2.AsyncClient(timeout=timeout, auth=auth)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def ping(self) -> bool:
        """Liefert True, wenn Fuseki erreichbar ist (GET /$/$ping bzw. /$ping)."""
        try:
            r = await self._http.get(f"{self._base_url}/$/$ping")
            return r.status_code == 200
        except httpx2.HTTPError:
            return False

    async def select(self, query: str) -> list[dict]:
        """Führt eine SPARQL SELECT-Abfrage aus und gibt die Bindings zurück.

        WICHTIG: Keine Nutzereingaben per f-String in `query` einbauen.
        Terme stattdessen über rdflib erzeugen (URIRef(...).n3(), Literal(...).n3()),
        um SPARQL-Injection zu vermeiden.
        """
        r = await self._http.post(
            self._query_url,
            data={"query": query},
            headers={"Accept": "application/sparql-results+json"},
        )
        r.raise_for_status()
        return r.json()["results"]["bindings"]

    async def update(self, update: str) -> None:
        """Führt ein SPARQL-Update (INSERT/DELETE) aus."""
        r = await self._http.post(self._update_url, data={"update": update})
        r.raise_for_status()

    async def load_turtle(self, graph_iri: str, ttl: bytes) -> None:
        """Lädt Turtle-Daten über den Graph Store Protocol-Endpoint in einen benannten Graph."""
        r = await self._http.post(
            self._data_url,
            params={"graph": graph_iri},
            content=ttl,
            headers={"Content-Type": "text/turtle"},
        )
        r.raise_for_status()

    async def clear_graph(self, graph_iri: str) -> None:
        """Leert einen benannten Graph (idempotenter Import: leer -> neu laden)."""
        r = await self._http.delete(self._data_url, params={"graph": graph_iri})
        r.raise_for_status()
