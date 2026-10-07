from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from ..exceptions import VersionConflictError
from .logs import create_audit_log, build_snapshot
from ..schemas.properties import *
from ..models import models
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from .base import set_creation_timestamps


# -----------------------PROPERTIES-----------------------------
def get_properties(db: Session, skip: int = 0, limit: int = 1000) -> List[models.Property]:
    return db.query(models.Property).offset(skip).limit(limit).all()

def get_property_by_uuid(db: Session, uuid: UUID) -> Optional[models.Property]:
    return db.query(models.Property).get(uuid)

def get_property_version(db: Session, uuid: UUID):
    return db.query(models.Property.version,
                 models.Property.updated_by,
                 models.Property.date_of_change.label("updated_at")
                 ).filter(models.Property.UUID == uuid).first()

def create_property(db: Session, prop: PropertyCreate, current_user: str) -> models.Property:
    db_prop = models.Property(**prop.dict())
    set_creation_timestamps(db_prop)
    db_prop.updated_by = current_user

    # Nur dieses Feld manuell setzen (das ist nicht im Schema)
    db_prop.groups = db_prop.groups or []  # Statt [uuid4()]
    db.add(db_prop)
    db.flush()
    log = create_audit_log("properties", str(db_prop.UUID), current_user, "", prop.model_dump(mode="json"), "created")
    db.add(log)
    db.commit()
    db.refresh(db_prop)
    return db_prop

def update_property(db: Session, uuid: UUID, prop: PropertyUpdate, current_user: str) -> Optional[models.Property]:
    db_prop = get_property_by_uuid(db, uuid=uuid)
    if not db_prop:
        return None

    if db_prop.version != prop.version:
        raise VersionConflictError(
            current_version=db_prop.version,
            your_version=prop.version,
            updated_by=db_prop.updated_by,
            updated_at=db_prop.date_of_change,
        )

    old_snapshot = jsonable_encoder(build_snapshot(db_prop))

    update_data = prop.dict(exclude_unset=True)
    update_data["date_of_change"] = datetime.now()
    update_data["version"] += 1
    update_data["updated_by"] = current_user

    for field, value in update_data.items():
        setattr(db_prop, field, value)

    log = create_audit_log("properties", str(uuid), current_user, old_snapshot, prop.model_dump(mode="json"))
    db.add(log)
    db.commit()
    db.refresh(db_prop)
    return db_prop

def delete_property(db: Session, uuid: UUID, current_user: str) -> bool:
    db_prop = get_property_by_uuid(db, uuid=uuid)
    if not db_prop:
        return False

    old_snapshot = jsonable_encoder(build_snapshot(db_prop))
    log = create_audit_log("properties", str(uuid), current_user, old_snapshot, "", "deleted")
    db.add(log)
    db.delete(db_prop)
    db.commit()
    return True

def get_properties_by_group(db: Session, group_uuid: UUID) -> List[models.Property]:
    return db.query(models.Property).filter(models.Property.groups.contains([group_uuid])).all()

def search_properties(db: Session, search_term: str, limit: int = 50) -> List[models.Property]:
    return db.query(models.Property).filter(
        (models.Property.name.ilike(f"%{search_term}%")) |
        (models.Property.definition.ilike(f"%{search_term}%"))
    ).limit(limit).all()
