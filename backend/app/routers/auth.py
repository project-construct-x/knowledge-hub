from fastapi import Request, APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from ..crud.keycloak import oauth
from ..config import get_settings
import httpx2
from urllib.parse import urlencode


settings = get_settings()

auth_router = APIRouter(tags=["Auth"])

@auth_router.get("/auth/login")
async def login(request: Request):
    redirect_uri = str(request.url_for("auth_callback"))
    return await oauth.keycloak.authorize_redirect(request, redirect_uri)

@auth_router.get("/auth/callback", name="auth_callback")
async def auth_callback(request: Request):
    token = await oauth.keycloak.authorize_access_token(request)
    access_token = token["access_token"]
    refresh_token = token.get("refresh_token", "")
    id_token = token.get("id_token", "")
    return RedirectResponse(
        f"{settings.frontend_url}"
        f"#access_token={access_token}&refresh_token={refresh_token}&id_token={id_token}"
    )

@auth_router.get("/auth/logout")
async def logout(id_token: str | None = None):
    metadata = await oauth.keycloak.load_server_metadata()
    end_session_endpoint = metadata["end_session_endpoint"]

    params = {"post_logout_redirect_uri": settings.frontend_url}
    if id_token:
        params["id_token_hint"] = id_token
    else:
        params["client_id"] = settings.keycloak_client_id

    return RedirectResponse(f"{end_session_endpoint}?{urlencode(params)}")


@auth_router.post("/auth/refresh")
async def refresh(request: Request):
    """Refresh access token using Keycloak refresh token.

    Expects JSON body: {"refresh_token": "..."}
    Returns new tokens (access_token, refresh_token, id_token).
    """
    body = await request.json()
    refresh_token = body.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token missing")
    # Log the refresh attempt (mask the token for security)
    import logging
    logger = logging.getLogger("auth.refresh")
    logger.info("Refresh token request received")
    token_url = f"{settings.keycloak_external_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/token"
    try:
        async with httpx2.AsyncClient(auth=(settings.keycloak_client_id, settings.keycloak_client_secret)) as client:
            resp = await client.post(
                token_url,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            token = resp.json()
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise HTTPException(status_code=502, detail="Failed to refresh token")
    logger.info("Token refreshed successfully")
    return {
        "access_token": token.get("access_token"),
        "refresh_token": token.get("refresh_token", ""),
        "id_token": token.get("id_token", ""),
    }
