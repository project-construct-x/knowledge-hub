from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..crud import useCases as crud
from ..models import models
from ..models.users import User
from ..schemas.useCases import *
from ..schemas.logs import *
from ..crud.auth import require_role, RoleEnum, get_current_user_from_token

router = APIRouter(prefix="/usecases", tags=["Use Cases"])

# ---------LIST--------
@router.get("/", response_model=list[UseCase])
def list_useCases(db: Session = Depends(get_db), current_user = Depends(require_role(RoleEnum.READ))):
    return crud.get_useCases(db)

# ---------GET---------
@router.get("/{id}", response_model=UseCase)
def get_useCase(id: int, db: Session = Depends(get_db)):
    useCase = crud.get_useCase_by_id(db, id)
    if not useCase:
        raise HTTPException(status_code=404, detail="UseCase nicht gefunden")
    return useCase

@router.get("/{id}/version", response_model=VersionInfo)
def get_useCase_version(id: int, db: Session = Depends(get_db)):
    result = crud.get_useCase_version(db, id)
    if not result:
        raise HTTPException(status_code=404, detail="Use Case nicht gefunden")
    return result

# ---------CREATE--------
@router.post("/", response_model=UseCase)
def create_useCase(data: UseCaseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    roles = db.query(models.Role).filter(models.Role.id.in_(data.roles)).all()
    if len(roles) != len(data.roles):
        raise HTTPException(status_code=400, detail="Eine oder mehrere Rollen nicht gefunden")
    return crud.create_useCase(db, data, roles, current_user.username)

# ---------UPDATE--------
@router.put("/{id}", response_model=UseCase)
def update_useCase(id: int, data: UseCaseUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    roles = db.query(models.Role).filter(models.Role.id.in_(data.roles)).all()
    if len(roles) != len(data.roles):
        raise HTTPException(status_code=400, detail="Eine oder mehrere Rollen nicht gefunden")

    useCase = crud.update_useCase(db, id, data, roles, current_user.username)

    if useCase is None:
        raise HTTPException(status_code=404, detail="Use Case nicht gefunden")

    return useCase

# ---------DELETE--------
@router.delete("/{id}", status_code=204)
def delete_useCase(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    useCase = crud.get_useCase_by_id(db, id)
    if not useCase:
        raise HTTPException(status_code=404, detail="Use Case nicht gefunden")

    crud.delete_useCase(db, id, current_user.username)
    return None
