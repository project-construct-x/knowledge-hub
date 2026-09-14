from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..crud import standards as crud
from ..models.users import User
from ..crud.auth import get_current_user_from_token
from ..schemas.standards import *
from ..schemas.logs import VersionInfo

router = APIRouter(prefix="/standards", tags=["Standards"])

# ---------LIST--------
@router.get("/", response_model=list[Standard])
def list_standards(db: Session = Depends(get_db)):
    return crud.get_standards(db)

# ---------GET---------
@router.get("/{id}", response_model=Standard)
def get_standard(id: int, db: Session = Depends(get_db)):
    standard = crud.get_standard_by_id(db, id)
    if not standard:
        raise HTTPException(status_code=404, detail="Standard nicht gefunden")
    return standard

@router.get("/{id}/version", response_model=VersionInfo)
def get_standard_version(id: int, db: Session = Depends(get_db)):
    result = crud.get_standard_version(db, id)
    if not result:
        raise HTTPException(status_code=404, detail="Standard nicht gefunden")
    return result

# ---------CREATE--------
@router.post("/", response_model=Standard)
def create_standard(data: StandardMutate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    return crud.create_standard(db, data, current_user.username)

# ---------UPDATE--------
@router.put("/{id}", response_model=Standard)
def update_standard(id: int, data: StandardMutate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    standard = crud.get_standard_by_id(db, id)
    if not standard:
        raise HTTPException(status_code=404, detail="Standard nicht gefunden")

    return crud.update_standard(db, id, data, current_user.username)

# ---------DELETE--------
@router.delete("/{id}", status_code=204)
def delete_standard(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    standard = crud.get_standard_by_id(db, id)
    if not standard:
        raise HTTPException(status_code=404, detail="Standard nicht gefunden")
    crud.delete_standard(db, id, current_user.username)
    return None