import os
import logging
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from ..exceptions import VersionConflictError
from .logs import create_audit_log, build_snapshot
from ..schemas.subUseCases import *
from ..models import models
from ..config import IMAGE_DIR

# ---------------------SUB USE CASES-----------------------
def get_subUseCases(db: Session):
    return db.query(models.SubUseCase).all()

def get_subUseCases_by_role(db: Session, role_id: int):
    return db.query(models.SubUseCase).join(
        models.SubUseCaseRole).filter(models.SubUseCaseRole.role_id == role_id).all()

def get_subUseCase_by_id(db: Session, subUseCase_id: int):
    return db.query(models.SubUseCase).get(subUseCase_id)

def get_subUseCase_version(db: Session, subUseCase_id: int):
    return db.query(
        models.SubUseCase.version,
        models.SubUseCase.updated_by,
        models.SubUseCase.updated_at,
    ).filter(models.SubUseCase.id == subUseCase_id).first()

def create_subUseCase(db: Session, data: SubUseCaseCreate, current_user: str):
    sub = models.SubUseCase(
        name=data.name,
        description = data.description,
        conx_id= data.conx_id,
        useCase_id=data.useCase_id,
        objective=data.objective,
        inputs=data.inputs,
        outputs=data.outputs,
        potential_risks=data.potential_risks,
        distinction_from_other_sucs=data.distinction_from_other_sucs,
        dependency_of_other_sucs=data.dependency_of_other_sucs,
        assumptions=data.assumptions,
        updated_by=current_user
    )
    db.add(sub)
    db.flush()
    _sync_subUseCase_roles(db, sub, data.subUseCase_roles)
    log = create_audit_log("subUseCases", str(sub.id), current_user, "", data.model_dump(mode="json"), "created")
    db.add(log)
    db.commit()
    db.refresh(sub)
    return sub

def update_subUseCase(db: Session, subUseCase_id: int, data: SubUseCaseUpdate, current_user: str):
    sub = db.query(models.SubUseCase).get(subUseCase_id)

    if not sub:
        return None

    if sub.version != data.version:
        raise VersionConflictError(
            current_version=sub.version,
            your_version=data.version,
            updated_by=sub.updated_by,
            updated_at=sub.updated_at
        )

    old_snapshot = jsonable_encoder(build_snapshot(sub))

    sub.name = data.name
    sub.description = data.description
    sub.conx_id = data.conx_id
    sub.useCase_id = data.useCase_id
    sub.objective = data.objective
    sub.inputs = data.inputs
    sub.outputs = data.outputs
    sub.potential_risks = data.potential_risks
    sub.distinction_from_other_sucs = data.distinction_from_other_sucs
    sub.dependency_of_other_sucs = data.dependency_of_other_sucs
    sub.assumptions = data.assumptions
    sub.version += 1
    sub.updated_by = current_user

    log = create_audit_log("subUseCases", str(subUseCase_id), current_user, old_snapshot, data.model_dump(mode="json"))
    db.add(log)
    _sync_subUseCase_roles(db, sub, data.subUseCase_roles)
    db.commit()
    db.refresh(sub)
    return sub

def delete_subUseCase(db: Session, subUseCase_id: int, current_user: str):
    sub = db.query(models.SubUseCase).get(subUseCase_id)
    old_snapshot = jsonable_encoder(build_snapshot(sub))
    log = create_audit_log("subUseCases", str(subUseCase_id), current_user, old_snapshot, "", "deleted")
    db.add(log)
    db.delete(sub)
    db.commit()

def update_subUseCase_bpmn_url(db: Session, subUseCase_id: int, image_url: str):
    sub = db.query(models.SubUseCase).get(subUseCase_id)

    if sub:
        old_image_url = sub.bpmn_png_url
        if old_image_url:
            try:
                filename = os.path.basename(old_image_url)
                old_file_path = os.path.join(IMAGE_DIR, filename)

                if os.path.exists(old_file_path):
                    os.remove(old_file_path)
                    logging.info(f"Deleted old file: {old_file_path}")
            except Exception as e:
                logging.error(f"Error while deleting old file {old_image_url}: {e}")

        sub.bpmn_png_url = image_url
        print(f"CRUD SAVED TO {image_url}")
        db.commit()
        db.refresh(sub)
        return sub
    return None

def update_subUseCase_bpmn_xml(db: Session, subUseCase_id: int, xml_content: str):
    sub = db.query(models.SubUseCase).get(subUseCase_id)
    if sub:
        sub.bpmn_xml = xml_content
        db.commit()
        db.refresh(sub)
        return sub
    return None

def _sync_subUseCase_roles(db: Session, sub: models.SubUseCase, roles_data: list):
    db.query(models.SubUseCaseRole).filter(models.SubUseCaseRole.subUseCase_id == sub.id).delete()
    for r in roles_data:
        entry = models.SubUseCaseRole(
            subUseCase_id=sub.id,
            role_id=r.role_id,
            motivation=r.motivation,
            goal=r.goal,
            monetary_benefit=r.monetary_benefit
        )
        db.add(entry)