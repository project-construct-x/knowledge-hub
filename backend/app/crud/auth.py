from typing import Union
from fastapi import HTTPException, Depends, status
from fastapi.security import OAuth2AuthorizationCodeBearer
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.users import User, RoleEnum
from .keycloak import decode_keycloak_token
from ..config import get_settings

settings = get_settings()

oauth2_scheme = OAuth2AuthorizationCodeBearer(
    authorizationUrl=f"{settings.keycloak_external_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/auth",
    tokenUrl=f"{settings.keycloak_external_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/token",
    scopes={"openid": "openid", "profile": "profile", "email": "email"},
    auto_error=False,
)

async def get_current_user_from_token(
        token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Ungültige Authentifizierung",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = await decode_keycloak_token(token)
    except Exception:
        raise credentials_exception

    username = payload.get("preferred_username")
    if username is None:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        # Just-in-Time Provisioning: User existiert in Keycloak, aber noch nicht lokal
        roles = payload.get("realm_access", {}).get("roles", [])
        role = RoleEnum.WRITE if "write" in roles else RoleEnum.READ
        user = User(
            username=username,
            email=payload.get("email", ""),
            role=role,
            hashed_password="",  # nicht mehr genutzt, Login läuft über Keycloak
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def require_role(required_role: RoleEnum):
    """Decorator-Funktion für Rollenprüfung"""
    async def role_checker(current_user: Union[User, dict] = Depends(get_current_user_from_token)):
        if isinstance(current_user, User):
            user_role = current_user.role
        else:
            user_role = current_user["role"]

        # WRITE-Rolle hat auch READ-Rechte
        if required_role == RoleEnum.READ and user_role in [RoleEnum.READ, RoleEnum.WRITE]:
            return current_user
        elif required_role == RoleEnum.WRITE and user_role == RoleEnum.WRITE:
            return current_user
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unzureichnede Berechtigungen"
            )

    return role_checker