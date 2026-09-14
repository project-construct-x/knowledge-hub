import uuid
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from xml.etree import ElementTree as ET
from ..models.users import User
from ..crud.auth import get_current_user_from_token
from ..db import get_db
from ..crud import subUseCases as crud
from ..schemas.subUseCases import *
from ..schemas.logs import VersionInfo
from ..config import IMAGE_DIR

router = APIRouter(prefix="/subusecases", tags=["Sub Use Cases"])

# -------LIST--------
@router.get("/", response_model=list[SubUseCase])
def list_subUseCases(db: Session = Depends(get_db)):
    return crud.get_subUseCases(db)

# ---------GET---------
@router.get("/{id}", response_model=SubUseCase)
def get_subUseCase(id: int, db: Session = Depends(get_db)):
    subUseCase = crud.get_subUseCase_by_id(db, id)
    if not subUseCase:
        raise HTTPException(status_code=404, detail="SubUseCase nicht gefunden")
    return subUseCase

@router.get("/{id}/version", response_model=VersionInfo)
def get_subUseCase_version(id: int, db: Session = Depends(get_db)):
    result = crud.get_subUseCase_version(db, id)
    if not result:
        raise HTTPException(status_code=404, detail="Sub Use Case nicht gefunden")
    return result

@router.get("/by-role/{role_id}", response_model=list[SubUseCase])
def list_subUseCases_by_role(role_id: int, db: Session = Depends(get_db)):
    return crud.get_subUseCases_by_role(db, role_id)

# --------CREATE--------
@router.post("/", response_model=SubUseCase)
def create_subUseCase(data: SubUseCaseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    return crud.create_subUseCase(db, data, current_user.username)

# --------UPDATE--------
@router.put("/{id}", response_model=SubUseCase)
def update_subUseCase(id: int, data: SubUseCaseUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    subUseCase = crud.get_subUseCase_by_id(db, id)
    if not subUseCase:
        raise HTTPException(status_code=404, detail="Sub Use Case nicht gefunden")
    return crud.update_subUseCase(db, id, data, current_user.username)

# ---------DELETE--------
@router.delete("/{id}", status_code=204)
def delete_subUseCase(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user_from_token)):
    subUseCase = crud.get_subUseCase_by_id(db, id)
    if not subUseCase:
        raise HTTPException(status_code=404, detail="Sub Use Case nicht gefunden")

    crud.delete_subUseCase(db, id, current_user.username)
    return None

# --------UPLOAD BPMN---------
@router.post("/{id}/upload-bpmn-png", response_model=SubUseCase)
async def upload_bpmn_for_subUseCase(
        id: int,
        file: UploadFile = File(..., description="BPMN-Modell als PNG-Datei hochladen."),
        db: Session = Depends(get_db)
):
    if not crud.get_subUseCase_by_id(db, id):
        raise HTTPException(status_code=404, detail="Sub Use Caes nicht gefunden.")

    if file.content_type != "image/png":
        raise HTTPException(status_code=400, detail="Nur PNG-Dateien sind erlaubt.")

    file_extension = ".png"
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_location = os.path.join(IMAGE_DIR, unique_filename)

    try:
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Speichern der Datei: {e}")

    public_url = f"/static/images/{unique_filename}"

    updated_subUseCase = crud.update_subUseCase_bpmn_url(db, id, public_url)

    if not updated_subUseCase:
        try:
            os.remove(file_location)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail="Datenbank-Update fehlgeschlagen.")
    return updated_subUseCase


@router.post("/{id}/upload-bpmn-xml", response_model=SubUseCase)
async def upload_bpmn_xml_for_subUseCase(
        id: int,
        file: UploadFile = File(..., description="BPMN-Modell als XML-Datei hochladen."),
        db: Session = Depends(get_db),
):
    if not crud.get_subUseCase_by_id(db, id):
        raise HTTPException(status_code=404, detail="Sub Use Case nicht gefunden.")

    # Erlaube MIME-Types für BPMN-XML
    allowed_types = {"application/xml", "text/xml", "application/bpmn+xml", "application/bpmn"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Nur .bpmn-Dateien sind erlaubt.")

    # Dateiinhalt lesen
    try:
        xml_bytes = await file.read()
        xml_content = xml_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Datei ist kein gültiger UTF-8 Text.")

    # Optional: Grundlegende XML-Validierung
    try:
        ET.fromstring(xml_content)
    except ET.ParseError:
        raise HTTPException(status_code=400, detail="Ungültiges XML.")

    # In DB speichern
    updated = crud.update_subUseCase_bpmn_xml(db, id, xml_content)
    if not updated:
        raise HTTPException(status_code=500, detail="Datenbank-Update fehlgeschlagen.")
    return updated


# --------UPDATE BPMN XML (direkt in DB)--------
@router.put("/{id}/bpmn-xml", response_model=SubUseCase)
def update_bpmn_xml(id: int, data: BpmnXmlUpdate, db: Session = Depends(get_db)):
    subUseCase = crud.get_subUseCase_by_id(db, id)
    if not subUseCase:
        raise HTTPException(status_code=404, detail="Sub Use Case nicht gefunden")
    return crud.update_subUseCase_bpmn_xml(db, id, data.bpmn_xml)
