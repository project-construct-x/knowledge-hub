from fastapi import FastAPI, Request, APIRouter
from fastapi.responses import JSONResponse, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from .routers import auth, useCases, subUseCases, roles, transactions, properties, propertyGroups, users, ontology, standards
from .config import IMAGE_DIR, get_settings
from .exceptions import VersionConflictError
import logging

settings = get_settings()

logger = logging.getLogger("uvicorn.error")

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

api = APIRouter(prefix="/api")

@api.get("/health")
def health() -> Response:
    return Response(content="ok\n", media_type="text/plain")

app.mount("/static/images", StaticFiles(directory=IMAGE_DIR), name="images")

api.include_router(auth.auth_router)
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
