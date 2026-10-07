from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from ..exceptions import VersionConflictError
from .logs import create_audit_log, build_snapshot
from ..schemas.propertyGroups import *
from .properties import get_properties_by_group
from ..models import models
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from .base import set_creation_timestamps

# -----------------------PROPERTY GROUP------------------------
def get_propertyGroups(db: Session, skip: int = 0, limit: int = 100) -> List[models.PropertyGroup]:
    """Alle PropertyGroups mit Pagination abrufen"""
    return db.query(models.PropertyGroup).offset(skip).limit(limit).all()


def get_propertyGroup_by_uuid(db: Session, uuid: UUID) -> Optional[models.PropertyGroup]:
    return db.query(models.PropertyGroup).filter(models.PropertyGroup.UUID == uuid).first()

def get_propertyGroup_version(db: Session, uuid: UUID):
    return db.query(models.PropertyGroup.version,
                 models.PropertyGroup.updated_by,
                 models.PropertyGroup.date_of_change.label("updated_at")
                 ).filter(models.PropertyGroup.UUID == uuid).first()

def create_propertyGroup(db: Session, property_group: PropertyGroupCreate, current_user: str) -> models.PropertyGroup:
    db_property_group = models.PropertyGroup(**property_group.dict())
    set_creation_timestamps(db_property_group)
    db_property_group.updated_by = current_user

    db.add(db_property_group)
    db.flush()
    log = create_audit_log("propertyGroups", str(db_property_group.UUID), current_user, "", property_group.model_dump(mode="json"), "created")
    db.add(log)
    db.commit()
    db.refresh(db_property_group)
    return db_property_group


def update_propertyGroup(db: Session, uuid: UUID, property_group: PropertyGroupUpdate, current_user: str) -> Optional[models.PropertyGroup]:
    db_property_group = get_propertyGroup_by_uuid(db, uuid=uuid)
    if not db_property_group:
        return None

    if db_property_group.version != property_group.version:
        raise VersionConflictError(
            current_version=db_property_group.version,
            your_version=property_group.version,
            updated_by=db_property_group.updated_by,
            updated_at=db_property_group.date_of_change,
        )

    old_snapshot = jsonable_encoder(build_snapshot(db_property_group))

    update_data = property_group.dict(exclude_unset=True)
    update_data["date_of_change"] = datetime.now()
    update_data["version"] += 1
    update_data["updated_by"] = current_user

    for field, value in update_data.items():
        setattr(db_property_group, field, value)

    log = create_audit_log("propertyGroups", str(uuid), current_user, old_snapshot, property_group.model_dump(mode="json"))
    db.add(log)
    db.commit()
    db.refresh(db_property_group)
    return db_property_group


def delete_propertyGroup(db: Session, uuid: UUID, current_user: str) -> bool:
    db_property_group = get_propertyGroup_by_uuid(db, uuid=uuid)
    if not db_property_group:
        return False

    old_snapshot = jsonable_encoder(build_snapshot(db_property_group))
    log = create_audit_log("propertyGroups", str(uuid), current_user, old_snapshot, "", "deleted")
    db.add(log)
    db.delete(db_property_group)
    db.commit()
    return True

def get_propertyGroups_by_category(db: Session, category: str, skip: int = 0, limit: int = 100) -> List[models.PropertyGroup]:
    """PropertyGroups nach Kategorie filtern"""
    return db.query(models.PropertyGroup).filter(
        models.PropertyGroup.category == category
    ).offset(skip).limit(limit).all()


def get_child_propertyGroups(db: Session, parent_uuid: UUID) -> List[models.PropertyGroup]:
    """Alle Untergruppen einer PropertyGroup abrufen"""
    return db.query(models.PropertyGroup).filter(
        models.PropertyGroup.groups.contains([parent_uuid])
    ).all()


def search_propertyGroups(db: Session, search_term: str, limit: int = 50) -> List[models.PropertyGroup]:
    """PropertyGroups nach Name oder Definition suchen"""
    return db.query(models.PropertyGroup).filter(
        (models.PropertyGroup.name.ilike(f"%{search_term}%")) |
        (models.PropertyGroup.definition.ilike(f"%{search_term}%"))
    ).limit(limit).all()

def get_class_property_tree(db: Session) -> list:
    classes = get_propertyGroups_by_category(db, category="CLASS", limit=1000)

    result = []
    for cls in classes:
        props = get_properties_by_group(db, group_uuid=cls.UUID)

        result.append({
            "uuid": str(cls.UUID),
            "name": cls.name,
            "properties": [
                {
                    "UUID": str(p.UUID),
                    "name": p.name,
                    "definition": p.definition or "",
                }
                for p in props
            ]
        })
    return result
