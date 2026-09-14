from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from ..crud.auth import get_current_user_from_token, require_role
from ..schemas.users import User as UserSchema, UserUpdate
from ..models.users import User, RoleEnum, APIKey

user_router = APIRouter(prefix="/users", tags=["Users"])
@user_router.get("/me", response_model=UserSchema)
async def read_users_me(current_user: User = Depends(get_current_user_from_token)):
    if isinstance(current_user, dict):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    return current_user

@user_router.get("/", response_model=List[UserSchema])
async def list_users(db: Session = Depends(get_db), current_user = Depends(require_role(RoleEnum.READ))):
    users = db.query(User).all()
    return users

@user_router.put("/{user_id}", response_model=UserSchema)
async def update_user(
        user_id: int,
        user_update: UserUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(require_role(RoleEnum.WRITE)),
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in user_update.dict(exclude_unset=True).items():
        setattr(db_user, field, value)

    db.commit()
    db.refresh(db_user)
    return db_user

@user_router.delete("/{user_id}", status_code=204)
async def delete_user(
        user_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(require_role(RoleEnum.WRITE)),
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(db_user)
    db.commit()
    return None