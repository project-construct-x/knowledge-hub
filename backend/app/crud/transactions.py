from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..exceptions import VersionConflictError
from .logs import create_audit_log, build_snapshot
from ..schemas.transactions import *
from ..models import models

def get_transactions(db: Session):
    return db.query(models.Transaction).all()

def get_transactions_by_subusecase(db: Session, sub_id: int):
    return db.query(models.Transaction).filter(models.Transaction.subUseCase_id == sub_id).all()

def get_transaction_by_id(db: Session, transaction_id: int):
    return db.query(models.Transaction).get(transaction_id)

def get_transaction_version(db: Session, transaction_id: int):
    return db.query(
        models.Transaction.version,
        models.Transaction.updated_by,
        models.Transaction.updated_at,
    ).filter(models.Transaction.id == transaction_id).first()

def create_transaction(db: Session, data: TransactionMutate, current_user: str):
    transaction = models.Transaction(**data.dict(exclude={"property_uuids"}))
    transaction.updated_by = current_user

    if data.property_uuids:
        props = db.execute(select(models.Property).where(models.Property.UUID.in_(data.property_uuids))).scalars().all()
        transaction.properties = props

    db.add(transaction)
    db.flush()
    log = create_audit_log("transactions", str(transaction.id), current_user, "", data.model_dump(mode="json"), "created")
    db.add(log)
    db.commit()
    db.refresh(transaction)
    return transaction

def update_transaction(db: Session, transaction_id: int, data: TransactionMutate, current_user: str):
    transaction = db.query(models.Transaction).get(transaction_id)

    if not transaction:
        return None

    if transaction.version != data.version:
        raise VersionConflictError(
            current_version=transaction.version,
            your_version=data.version,
            updated_by=transaction.updated_by,
            updated_at=transaction.updated_at,
        )

    old_snapshot = jsonable_encoder(build_snapshot(transaction))

    transaction.name = data.name
    transaction.subUseCase_id = data.subUseCase_id
    transaction.usesDataspace = data.usesDataspace
    transaction.roleOut_id = data.roleOut_id
    transaction.roleIn_id = data.roleIn_id
    transaction.process_number = data.process_number
    transaction.related_class_id = data.related_class_id
    transaction.data_carrier = data.data_carrier
    transaction.dataformat_available = data.dataformat_available
    transaction.dataformat = data.dataformat
    transaction.timing = data.timing
    transaction.policies = data.policies
    transaction.data_size = data.data_size
    transaction.version += 1
    transaction.updated_by = current_user

    if data.property_uuids is not None:
        props = db.execute(select(models.Property).where(models.Property.UUID.in_(data.property_uuids))).scalars().all()
        transaction.properties = props

    log = create_audit_log("transactions", str(transaction_id), current_user, old_snapshot, data.model_dump(mode="json"))
    db.add(log)
    db.commit()
    db.refresh(transaction)
    return transaction

def delete_transaction(db: Session, transaction_id: int, current_user: str):
    transaction = db.query(models.Transaction).get(transaction_id)
    old_snapshot = jsonable_encoder(build_snapshot(transaction))
    log = create_audit_log("transactions", str(transaction_id), current_user, old_snapshot, "", "deleted")
    db.add(log)
    db.delete(transaction)
    db.commit()
