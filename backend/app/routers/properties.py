from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..schemas.logs import VersionInfo
from ..models.users import User
from ..crud.auth import get_current_user_from_token
from ..db import get_db
from ..crud import properties as crud
from ..schemas.properties import *
from typing import List
from uuid import UUID

router = APIRouter(prefix="/properties", tags=["Properties"])

# --------LIST--------
@router.get("/", response_model=List[PropertyResponse])
def list_properties(db: Session = Depends(get_db), skip: int = 0, limit: int = 1000):
    return crud.get_properties(db, skip=skip, limit=limit)

@router.get("/by-group/{group_uuid}", response_model=List[PropertyResponse])
def get_properties_by_group(group_uuid: UUID, db: Session = Depends(get_db)):
    return crud.get_properties_by_group(db, group_uuid=group_uuid)

# --------GET---------
@router.get("/{uuid}", response_model=PropertyResponse)
def get_property(uuid: UUID, db:Session = Depends(get_db)):
    prop = crud.get_property_by_uuid(db, uuid=uuid)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop

@router.get("/{uuid}/version", response_model=VersionInfo)
def get_property_version(uuid: UUID, db: Session = Depends(get_db)):
    result = crud.get_property_version(db, uuid)
    if not result:
        raise HTTPException(status_code=404, detail="Property not found")
    return result

# --------CREATE-------
@router.post("/", response_model=PropertyResponse, status_code=201)
def create_property(prop: PropertyCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    return crud.create_property(db, prop, current_user.username)


# --------UPDATE-------
@router.put("/{uuid}", response_model=PropertyResponse)
def update_property(uuid: UUID, prop: PropertyUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    updated = crud.update_property(db, uuid, prop, current_user.username)
    if not updated:
        raise HTTPException(status_code=404, detail="Property not found")
    return updated


# --------DELETE-------
@router.delete("/{uuid}", status_code=204)
def delete_property(uuid: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    success = crud.delete_property(db, uuid, current_user.username)
    if not success:
        raise HTTPException(status_code=404, detail="Property not found")
    return None