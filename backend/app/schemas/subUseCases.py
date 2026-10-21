from pydantic import BaseModel
from typing import List, Optional
from .roles import Role
from datetime import datetime

class SubUseCaseRoleBase(BaseModel):
    role_id: int
    motivation: Optional[str] = None
    goal: Optional[str] = None
    monetary_benefit: Optional[str] = None

class SubUseCaseRoleRead(SubUseCaseRoleBase):
    role: Role
    class Config:
        from_attributes = True

class SubUseCaseBase(BaseModel):
    name: str
    short_name: Optional[str] = None
    useCase_id: int
    description: str
    conx_id: Optional[str] = None
    objective: Optional[str] = None
    inputs: Optional[str] = None
    outputs: Optional[str] = None
    potential_risks: Optional[str] = None
    distinction_from_other_sucs: Optional[str] = None
    dependency_of_other_sucs: Optional[str] = None
    assumptions: Optional[str] = None
    bpmn_xml: Optional[str] = None

class SubUseCaseCreate(SubUseCaseBase):
    subUseCase_roles: List[SubUseCaseRoleBase] = []

class SubUseCaseUpdate(SubUseCaseBase):
    subUseCase_roles: List[SubUseCaseRoleBase] = []
    version: int

class BpmnXmlUpdate(BaseModel):
    bpmn_xml: str

class SubUseCase(SubUseCaseBase):
    id: int
    version: int
    updated_at: datetime | None = None
    updated_by: str | None = None
    subUseCase_roles: List[SubUseCaseRoleRead] = []
    bpmn_png_url: Optional[str] = None
    class Config:
        from_attributes = True