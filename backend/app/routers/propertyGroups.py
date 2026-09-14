from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.users import User
from ..crud.auth import get_current_user_from_token
from ..crud import propertyGroups as crud
from ..schemas.propertyGroups import *
from ..schemas.logs import VersionInfo
from typing import List
from uuid import UUID

router = APIRouter(prefix="/propertygroups", tags=["Property Groups"])

# --------LIST--------
@router.get("/", response_model=List[PropertyGroupResponse])
def list_propertyGroups(db: Session = Depends(get_db), skip: int = 0, limit: int = 100):
    return crud.get_propertyGroups(db, skip=skip, limit=limit)

# --------LIST BY CATEGORY-------
@router.get("/category/{category}", response_model=List[PropertyGroupResponse])
def list_propertyGroups_by_category(category: str, db: Session = Depends(get_db), skip: int = 0, limit: int = 100):
    return crud.get_propertyGroups_by_category(db, category=category, skip=skip, limit=limit)

# ---------GET LIST OF CLASSES WITH PROPERTIES-------------
@router.get("/class-property-tree", response_model=List[ClassWithProperties])
def get_class_property_tree(db: Session = Depends(get_db)):
    return crud.get_class_property_tree(db)

# --------GET---------
@router.get("/{uuid}", response_model=PropertyGroupResponse)
def get_propertyGroup(uuid: UUID, db:Session = Depends(get_db)):
    prop = crud.get_propertyGroup_by_uuid(db, uuid=uuid)
    if not prop:
        raise HTTPException(status_code=404, detail="Property Group not found")
    return prop

@router.get("/{uuid}/version", response_model=VersionInfo)
def get_propertyGroup_version(uuid: UUID, db: Session = Depends(get_db)):
    result = crud.get_propertyGroup_version(db, uuid)
    if not result:
        raise HTTPException(status_code=404, detail="Property Group not found")
    return result

# --------CREATE-------
@router.post("/", response_model=PropertyGroupResponse, status_code=201)
def create_propertyGroup(property_group: PropertyGroupCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    return crud.create_propertyGroup(db, property_group, current_user.username)

# --------UPDATE-------
@router.put("/{uuid}", response_model=PropertyGroupResponse)
def update_propertyGroup(uuid: UUID, property_group: PropertyGroupUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    updated = crud.update_propertyGroup(db, uuid, property_group, current_user.username)
    if not updated:
        raise HTTPException(status_code=404, detail="Property Group not found")
    return updated

# --------DELETE-------
@router.delete("/{uuid}", status_code=204)
def delete_propertyGroup(uuid: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    success = crud.delete_propertyGroup(db, uuid, current_user.username)
    if not success:
        raise HTTPException(status_code=404, detail="Property Group not found")
    return None