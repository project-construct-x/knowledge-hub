from fastapi import Request, APIRouter
from fastapi.responses import RedirectResponse
from ..crud.keycloak import oauth
from ..config import get_settings
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