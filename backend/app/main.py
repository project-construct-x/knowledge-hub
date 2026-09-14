from fastapi import FastAPI, Request, APIRouter
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from .routers import auth, useCases, subUseCases, roles, transactions, properties, propertyGroups, users, ontology, standards
from .config import IMAGE_DIR, get_settings
from .exceptions import VersionConflictError

settings = get_settings()

app = FastAPI(
    title="Construct-X UseCase Management API",
    description="Manage use cases and related information.",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    swagger_ui_init_oauth={
        "clientId": "usecase-management-dev-swagger",
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

@app.get("/health")
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
