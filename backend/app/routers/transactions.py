from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..crud.auth import get_current_user_from_token
from ..db import get_db
from ..crud import transactions as crud
from ..models.users import User
from ..schemas.transactions import *
from ..schemas.logs import VersionInfo

router = APIRouter(prefix="/transactions", tags=["Transactions"])

# --------LIST--------
@router.get("/", response_model=list[Transaction])
def list_transactions(db: Session = Depends(get_db)):
    return crud.get_transactions(db)

# --------GET---------
@router.get("/{id}", response_model=Transaction)
def get_transaction(id: int, db:Session = Depends(get_db)):
    transaction = crud.get_transaction_by_id(db, id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")
    return transaction

@router.get("/{id}/version", response_model=VersionInfo)
def get_transaction_version(id: int, db: Session = Depends(get_db)):
    result = crud.get_transaction_version(db, id)
    if not result:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")
    return result

@router.get("/by-subusecase/{sub_id}", response_model=list[Transaction])
def list_transactions_by_subusecase(sub_id: int, db: Session = Depends(get_db)):
    return crud.get_transactions_by_subusecase(db, sub_id)

# --------CREATE-------
@router.post("/", response_model=Transaction)
def create_transaction(data: TransactionMutate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    return crud.create_transaction(db, data, current_user.username)

# --------UPDATE-------
@router.put("/{id}", response_model=Transaction)
def update_transaction(id: int, data: TransactionMutate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    transaction = crud.get_transaction_by_id(db, id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")
    return crud.update_transaction(db, id, data, current_user.username)

# --------DELETE-------
@router.delete("/{id}", status_code=204)
def delete_transaction(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    transaction = crud.get_transaction_by_id(db, id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")
    crud.delete_transaction(db, id, current_user.username)
    return None