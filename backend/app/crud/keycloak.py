from authlib.integrations.starlette_client import OAuth
from jose import jwt
import httpx
from ..config import get_settings

settings = get_settings()

oauth = OAuth()
oauth.register(
    name="keycloak",
    server_metadata_url=(
        f"{settings.keycloak_internal_url}/realms/{settings.keycloak_realm}" # hier interne URL
        "/.well-known/openid-configuration"
    ),
    client_id=settings.keycloak_client_id,
    client_secret=settings.keycloak_client_secret,
    client_kwargs={"scope": "openid profile email"},
)

_jwks_cache: dict | None = None

async def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        metadata = await oauth.keycloak.load_server_metadata()
        async with httpx.AsyncClient() as client:
            resp = await client.get(metadata["jwks_uri"])
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache

async def decode_keycloak_token(token: str) -> dict:
    jwks = await _get_jwks()
    header = jwt.get_unverified_header(token)
    key = next(k for k in jwks["keys"] if k["kid"] == header["kid"])
    payload = jwt.decode(
        token,
        key,
        algorithms=[header["alg"]],
        audience="account",
        options={"verify_aud": False},
    )
    return payload