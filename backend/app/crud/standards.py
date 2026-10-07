from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session, selectinload
from ..exceptions import VersionConflictError
from .logs import create_audit_log, build_snapshot
from ..schemas.standards import *
from ..models import models
from .useCases import get_useCase_by_id

# ------------------STANDARDS---------------
def get_standards(db: Session):
    return (
        db.query(models.Standard)
        .options(selectinload(models.Standard.useCases))
        .all()
    )

def get_standard_by_id(db: Session, standard_id: int):
    return (
        db.query(models.Standard)
        .options(selectinload(models.Standard.useCases))
        .filter(models.Standard.id == standard_id)
        .first()
    )

def get_standard_version(db: Session, standard_id: int):
    return db.query(
        models.Standard.version,
        models.Standard.updated_by,
        models.Standard.updated_at,
    ).filter(models.Standard.id == standard_id).first()

def create_standard(db: Session, data: StandardMutate, current_user: str):
    payload = data.model_dump(exclude={"useCase_ids"})
    standard = models.Standard(**payload)
    standard.updated_by = current_user

    usecase_ids = getattr(data, "useCase_ids", []) or []
    standard.useCases = [get_useCase_by_id(db, id) for id in usecase_ids]

    db.add(standard)
    db.flush()
    log = create_audit_log("useCases", str(standard.id), current_user, "", payload, "created")
    db.add(log)
    db.commit()
    db.refresh(standard)
    return standard

def update_standard(db: Session, standard_id: int, data: StandardMutate, current_user: str):
    s = db.query(models.Standard).get(standard_id)
    if not s:
        return None

    if s.version != data.version:
        raise VersionConflictError(
            current_version=s.version,
            your_version=data.version,
            updated_by=s.updated_by,
            updated_at=s.updated_at,
        )

    old_snapshot = jsonable_encoder(build_snapshot(s))

    s.number = data.number
    s.category = data.category
    s.title = data.title
    s.subTitle = data.subTitle
    s.date = data.date
    s.reference_URL = data.reference_URL
    s.keywords = data.keywords
    s.description = data.description
    s.version += 1
    s.updated_by = current_user

    if data.useCase_ids is not None:
        usecases = [get_useCase_by_id(db, i) for i in data.useCase_ids]
        missing = [i for i, uc in zip(data.useCase_ids, usecases) if uc is None]
        if missing:
            raise ValueError(f"UseCases nicht gefunden: {missing}")
        s.useCases = [uc for uc in usecases if uc is not None]

    log = create_audit_log("standards", str(standard_id), current_user, old_snapshot, data.model_dump())
    db.add(log)
    db.commit()
    db.refresh(s)
    return s

def delete_standard(db: Session, standard_id: int, current_user: str):
    s = db.query(models.Standard).get(standard_id)
    old_snapshot = jsonable_encoder(build_snapshot(s))
    log = create_audit_log("standards", str(standard_id), current_user, old_snapshot, "", "deleted")
    db.add(log)
    db.delete(s)
    db.commit()
