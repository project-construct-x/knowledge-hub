from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from ..schemas.useCases import *
from ..models import models
from ..exceptions import VersionConflictError
from .logs import build_snapshot, create_audit_log

# ----------------------USE CASES-------------------------
def get_useCases(db: Session):
    return db.query(models.UseCase).all()

def get_useCase_by_id(db: Session, useCase_id: int):
    return db.query(models.UseCase).get(useCase_id)

def get_useCase_version(db: Session, useCase_id: int):
    return db.query(
        models.UseCase.version,
        models.UseCase.updated_by,
        models.UseCase.updated_at,
    ).filter(models.UseCase.id == useCase_id).first()

def create_useCase(db: Session, data: UseCaseCreate, roles: list, current_user: str):
    uc = models.UseCase(name=data.name, keywords=data.keywords, roles=roles, updated_by=current_user)
    db.add(uc)
    db.flush()
    log = create_audit_log("useCases", str(uc.id), current_user, "", data.model_dump(exclude={"version", "roles"}), "created")
    db.add(log)
    db.commit()
    db.refresh(uc)
    return uc

def update_useCase(db: Session, useCase_id: int, data: UseCaseUpdate, roles: list, current_user: str):
    uc = db.query(models.UseCase).filter(
        models.UseCase.id == useCase_id
    ).with_for_update().first()

    if not uc:
        return None

    if uc.version != data.version:
        raise VersionConflictError(
            current_version=uc.version,
            your_version=data.version,
            updated_by=uc.updated_by,
            updated_at=uc.updated_at,
        )

    old_snapshot = jsonable_encoder(build_snapshot(uc))

    uc.name = data.name
    uc.keywords = data.keywords
    uc.roles = roles
    uc.description = data.description
    uc.relation_to_other_useCases = data.relation_to_other_useCases
    uc.uc_owner_institution = data.uc_owner_institution
    uc.uc_owner = data.uc_owner
    uc.conx_id = data.conx_id
    uc.version += 1
    uc.updated_by = current_user

    log = create_audit_log("useCases", str(useCase_id), current_user, old_snapshot, data.model_dump(exclude={"version", "roles"}))
    db.add(log)
    db.commit()
    db.refresh(uc)
    return uc

def delete_useCase(db: Session, useCase_id: int, current_user: str):
    uc = db.query(models.UseCase).get(useCase_id)
    old_snapshot = jsonable_encoder(build_snapshot(uc))
    log = create_audit_log("useCases", str(useCase_id), current_user, old_snapshot, "", "deleted")
    db.add(log)
    db.delete(uc)
    db.commit()