from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from ..exceptions import VersionConflictError
from .logs import create_audit_log, build_snapshot
from ..schemas.roles import *
from ..models import models


def get_roles(db: Session):
    return db.query(models.Role).all()

def get_role_by_id(db: Session, role_id: int):
    return db.query(models.Role).get(role_id)

def get_role_version(db: Session, role_id: int):
    return db.query(
        models.Role.version,
        models.Role.updated_by,
        models.Role.updated_at,
    ).filter(models.Role.id == role_id).first()

def create_role(db: Session, data: RoleMutate, current_user: str):
    role = models.Role(**data.dict())
    role.updated_by = current_user
    db.add(role)
    db.flush()
    log = create_audit_log("roles", str(role.id), current_user, "", data.model_dump(mode="json"), "created")
    db.add(log)
    db.commit()
    db.refresh(role)
    return role

def update_role(db: Session, role_id: int, data: RoleMutate, current_user: str):
    role = db.query(models.Role).get(role_id)

    if not role:
        return None

    if role.version != data.version:
        raise VersionConflictError(
            current_version=role.version,
            your_version=data.version,
            updated_by=role.updated_by,
            updated_at=role.updated_at
        )

    old_snapshot = jsonable_encoder(build_snapshot(role))

    role.name = data.name
    role.definition = data.definition
    role.version += 1
    role.updated_by = current_user
    log = create_audit_log("roles", str(role_id), current_user, old_snapshot, data.model_dump(mode="json"))
    db.add(log)
    db.commit()
    db.refresh(role)
    return role

def delete_role(db: Session, role_id: int, current_user: str):
    role = db.query(models.Role).get(role_id)
    old_snapshot = jsonable_encoder(build_snapshot(role))
    log = create_audit_log("roles", str(role_id), current_user, old_snapshot, "", "deleted")
    db.add(log)
    db.delete(role)
    db.commit()
