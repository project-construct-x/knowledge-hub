import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from starlette.concurrency import run_in_threadpool
from starlette.middleware.sessions import SessionMiddleware

from .config import IMAGE_DIR, get_settings
from .crud.auth import get_current_user_from_token
from .db import SessionLocal
from .exceptions import VersionConflictError
from .graph import FusekiClient, get_fuseki, init_fuseki, shutdown_fuseki
from .routers import (
    auth,
    ontology,
    properties,
    propertyGroups,
    roles,
    standards,
    subUseCases,
    transactions,
    useCases,
    users,
)

settings = get_settings()

logger = logging.getLogger("uvicorn.error")

def _check_sql() -> None:
    with SessionLocal() as session:
        session.execute(text("SELECT 1"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Erzeugt und schließt den Fuseki-Client (ein Client pro App)."""
    if not settings.fuseki_url:
        logger.warning("FUSEKI_URL nicht gesetzt — Graph-Layer deaktiviert.")
        yield
        return
    client = FusekiClient(base_url=settings.fuseki_url, dataset=settings.fuseki_dataset)
    await init_fuseki(client)
    logger.info("Fuseki-Client initialisiert: %s (Dataset: %s)", settings.fuseki_url, settings.fuseki_dataset)
    try:
        yield
    finally:
        await shutdown_fuseki()


app = FastAPI(
    title="Construct-X Knowledge Hub API",
    description="Manage use cases and related information.",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url="/api/redoc",
    swagger_ui_oauth2_redirect_url="/api/docs/oauth2-redirect",
    swagger_ui_init_oauth={
        "clientId": "knowledge-hub-api", # lokal: knowledge-hub-dev-swagger
        "usePkceWithAuthorizationCodeGrant": True,
        "scopes": "openid profile email",
    },
    lifespan=lifespan,
)


@app.exception_handler(VersionConflictError)
async def version_conflict_handler(request: Request, exc: VersionConflictError):
    return JSONResponse(
        status_code=409,
        content={
            "error": "version_conflict",
            "current_version": exc.current_version,
            "your_version": exc.your_version,
            "updated_by": exc.updated_by,
            "updated_at": exc.updated_at.isoformat() if exc.updated_at else None,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()

    for err in errors:
        logger.warning(
            "422 on %s %s | field=%s | type=%s | msg=%s | input=%r",
            request.method,
            request.url.path,
            ".".join(str(p) for p in err["loc"]),
            err["type"],
            err["msg"],
            err.get("input"),
        )

    logger.debug("422 request body: %s", exc.body)

    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(errors)},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=get_settings().session_secret_key,
)

api = APIRouter(prefix="/api", dependencies=[Depends(get_current_user_from_token)])

app.mount("/static/images", StaticFiles(directory=IMAGE_DIR), name="images")

# Public auth endpoints (no token required)
app.include_router(auth.auth_router, prefix="/api")

# Authenticated API routes
api.include_router(users.user_router)
api.include_router(useCases.router)
api.include_router(subUseCases.router)
api.include_router(roles.router)
api.include_router(transactions.router)
api.include_router(properties.router)
api.include_router(propertyGroups.router)
api.include_router(ontology.router)
api.include_router(standards.router)
app.include_router(api)

# Public health endpoint (no auth required)
@app.get("/api/health")
@app.get("/api/health/ready")
async def ready() -> Response:
    problems: list[str] = []
    try:
        await run_in_threadpool(_check_sql)
    except Exception:
        logger.exception("Health: SQL nicht erreichbar")
        problems.append("sql")

    if settings.fuseki_url:
        try:
            if not await get_fuseki().ping():
                problems.append("fuseki")
        except Exception:
            logger.exception("Health: Fuseki nicht erreichbar")
            problems.append("fuseki")

    if problems:
        return Response(f"unavailable: {','.join(problems)}\n",
                        status_code=503, media_type="text/plain")
    return Response("ok\n", media_type="text/plain")
