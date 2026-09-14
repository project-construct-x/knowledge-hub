from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..models.users import User
from ..crud.auth import get_current_user_from_token
from ..crud import roles as crud
from ..db import get_db
from ..schemas.roles import *
from ..schemas.logs import VersionInfo

router = APIRouter(prefix="/roles", tags=["Roles"])

# ---------LIST--------
@router.get("/", response_model=list[Role])
def list_roles(db: Session = Depends(get_db)):
    return crud.get_roles(db)

# ---------GET---------
@router.get("/{id}", response_model=Role)
def get_role(id: int, db: Session = Depends(get_db)):
    role = crud.get_role_by_id(db, id)
    if not role:
        raise HTTPException(status_code=404, detail="Role nicht gefunden")
    return role

@router.get("/{id}/version", response_model=VersionInfo)
def get_role_version(id: int, db: Session = Depends(get_db)):
    result = crud.get_role_version(db, id)
    if not result:
        raise HTTPException(status_code=404, detail="Rolle nicht gefunden")
    return result

# ---------CREATE--------
@router.post("/", response_model=Role)
def create_role(data: RoleMutate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    return crud.create_role(db, data, current_user.username)

# ---------UPDATE--------
@router.put("/{id}", response_model=Role)
def update_role(id: int, data: RoleMutate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    role = crud.get_role_by_id(db, id)
    if not role:
        raise HTTPException(status_code=404, detail="Rolle nicht gefunden")
    return crud.update_role(db, id, data, current_user.username)

# ---------DELETE--------
@router.delete("/{id}", status_code=204)
def delete_role(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    role = crud.get_role_by_id(db, id)
    if not role:
        raise HTTPException(status_code=404, detail="Rolle nicht gefunden")
    crud.delete_role(db, id, current_user.username)
    return None