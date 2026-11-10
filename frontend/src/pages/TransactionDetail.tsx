import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth.ts";
import { useParams, useNavigate } from "react-router-dom";
import {api, ApiError} from "../api/api.ts";
import type {
  Role,
  SubUseCase,
  Transaction,
  TransactionMutate,
  ClassWithProperties,
  Property,
  VersionConflictDetail
} from "../types.ts";
import {ArrowLeftRight, Tags, Search, Boxes, AlertCircle} from "lucide-react";
import {getLabel} from "../components/helper.tsx";
import {useStaleCheck} from "../hooks/useStaleCheck.ts";
import VersionConflictAlert from "../components/VersionConflictAlert.tsx";
import StaleDataAlert from "../components/StaleDataAlert.tsx";

const emptyTransaction: TransactionMutate = {
  version: 1,
  process_number: "",
  name: "",
  subUseCase_id: null,
  usesDataspace: true,
  roleIn_id: 0,
  roleOut_id: 0,
  related_class_id: "",
  data_carrier: "",
  dataformat_available: "",
  dataformat: "",
  timing: "",
  policies: "",
  data_size: "",
  property_uuids: [],
}

export default function TransactionDetail() {
  const { hasWriteAccess } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<TransactionMutate>(emptyTransaction);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [roles, setRoles] = useState<Role[]>([])
  const [subUseCases, setSubUseCases] = useState<SubUseCase[]>([])
  const [classPropertyTree, setClassPropertyTree] = useState<ClassWithProperties[]>([]);
  const [selectedClassUuid, setSelectedClassUuid] = useState<string>("");
  const [propertySearchTerm, setPropertySearchTerm] = useState("");
  const [conflict, setConflict] = useState<VersionConflictDetail | null>(null);
  const [staleWarning, setStaleWarning] = useStaleCheck(
    item?.version,
    () => api.getTransactionVersion(Number(id)),
    id !== "new" && !!item,
  );


  useEffect(() => {
    loadRoles();
    loadSubUseCases();
    loadClassPropertyTree();
    if (id !== "new") {
      loadTransaction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toMutate = (data: Transaction): TransactionMutate => ({
    version: data.version,
    process_number: data.process_number,
    name: data.name,
    subUseCase_id: data.subUseCase_id,
    usesDataspace: data.usesDataspace,
    roleOut_id: data.roleOut.id,
    roleIn_id: data.roleIn.id,
    related_class_id: data.related_class_id,
    data_carrier: data.data_carrier,
    dataformat_available: data.dataformat_available,
    dataformat: data.dataformat,
    timing: data.timing,
    policies: data.policies,
    data_size: data.data_size,
    property_uuids: data.properties.map(p => p.UUID),
  });

  async function loadTransaction() {
    setLoading(true);
    try {
      const data = await api.getTransaction(Number(id));
      setItem(toMutate(data));
      setConflict(null);
      setStaleWarning(null);
    } catch (error) {
      console.error("Fehler beim Laden: ", error);
      alert("Transaktion konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRoles() {
    setLoading(true);
    try {
      const roles = await api.listRoles();
      setRoles(roles);
    } catch (error) {
      console.error("Fehler beim Laden: ", error);
      alert("Rollen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSubUseCases() {
    setLoading(true);
    try {
      const subUseCases = await api.listSubUseCases();
      setSubUseCases(subUseCases);
    } catch (error) {
      console.error("Fehler beim Laden: ", error);
      alert("Sub Use Cases konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function loadClassPropertyTree() {
    setLoading(true);
    try {
      const classPropertyTree = await api.getClassPropertyTree();
      setClassPropertyTree(classPropertyTree)
    } catch (error) {
      console.error("Fehler beim Laden: ", error);
      alert("Klassen mit Merkmalen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  function toggleProperty(uuid: string) {
    setItem(prev => {
      const already = prev.property_uuids.includes(uuid);
      return {
        ...prev,
        property_uuids: already
          ? prev.property_uuids.filter(u => u !== uuid)
          : [...prev.property_uuids, uuid],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (id === "new") {
        const created = await api.createTransaction(item);
        navigate(`/transactions/${created.id}`);
      } else {
        const updated = await api.updateTransaction(Number(id)!, item);
        setItem(toMutate(updated));
        setConflict(null);
        alert("Transaktion erfolgreich aktualisiert");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(error.detail as VersionConflictDetail);
        return;
      }
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern der Transaktion");
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof TransactionMutate>(
    field: K,
    value: TransactionMutate[K]
  ) {
    setItem(prev => ({ ...prev, [field]: value }));
  }

  if (loading && id !== "new") {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "64px 24px" }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    )
  }

  const tabs = [
    { id: "basic", label: "Grunddaten", badge: undefined, icon: Tags},
    { id: "properties", label: "Klassen & Merkmale", icon: Boxes,
      badge: item.property_uuids.length > 0 ? item.property_uuids.length : undefined}
  ]

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div className="page-header-icon">
          <ArrowLeftRight size={22} />
        </div>
        <div>
          <div className="page-header-title">
            {id === "new" ? "Neue Transaktion" : item.name}
          </div>
          <div className="page-header-sub">Transaktion</div>
        </div>
      </div>

      <VersionConflictAlert
        conflict={conflict}
        onReload={loadTransaction}
        onForceOverwrite={() => setConflict(null)}
      />

      <StaleDataAlert
        staleInfo={staleWarning}
        onReload={loadTransaction}
        onDismiss={() => setStaleWarning(null)}
      />

      <form onSubmit={handleSubmit} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {/* Tabs */}
        <div className="tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`tab ${activeTab === tab.id ? "tab-active" : "tab-inactive"}`}
              >
                {Icon && <Icon size={15} />}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="badge badge-primary">{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="card">
          <div className="card-body form-section custom-scrollbar">

            {/* Grunddaten */}
            {activeTab === "basic" && (
              <>
                <div className="form-grid-2">
                  <div>
                    <label className="form-label form-label-required">Nummer im Prozess</label>
                    <input
                      type="text"
                      required
                      value={item.process_number || ""}
                      onChange={(e) => updateField("process_number", e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label form-label-required">Name</label>
                    <input
                      type="text"
                      required
                      value={item.name || ""}
                      onChange={(e) => updateField("name", e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label form-label-required">Sub Use Case</label>
                  <select
                    required
                    value={item.subUseCase_id || ""}
                    onChange={(e) => updateField("subUseCase_id", Number(e.target.value))}
                    className="form-input form-select"
                  >
                    <option value="">Bitte wählen</option>
                    {subUseCases.map((suc) => (
                      <option key={suc.id} value={suc.id}>
                        {suc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-grid-2">

                  <div className="form-check-row">
                    <input
                      type="checkbox"
                      id="usesDataspace"
                      checked={item.usesDataspace || false}
                      onChange={e => updateField("usesDataspace", e.target.checked)}
                      className="form-checkbox"
                    />
                    <label htmlFor="usesDataspace" className="form-check-label">
                      Transaktion nutzt den Datenraum
                    </label>
                  </div>

                  <div>
                    <label className="form-label form-label">Datenträger</label>
                    <input
                      type="text"
                      required
                      value={item.data_carrier || ""}
                      onChange={(e) => updateField("data_carrier", e.target.value)}
                      className="form-input"
                    />
                  </div>

                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="form-label form-label-required">Ausgehende Rolle</label>
                    <select
                      required
                      value={item.roleOut_id ?? ""}
                      onChange={e => updateField("roleOut_id", Number(e.target.value))}
                      className="form-input form-select"
                    >
                      <option value="" disabled>Bitte wählen</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label form-label-required">Eingehende Rolle</label>
                    <select
                      required
                      value={item.roleIn_id ?? ""}
                      onChange={e => updateField("roleIn_id", Number(e.target.value))}
                      className="form-input form-select"
                    >
                      <option value="" disabled>Bitte wählen</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label form-label">Klasse</label>
                  <input
                    type="text"
                    required
                    value={item.related_class_id || ""}
                    onChange={(e) => updateField("related_class_id", e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="form-label form-label">Ist ein Datenformat vorhanden?</label>
                    <input
                      type="text"
                      required
                      value={item.dataformat_available || ""}
                      onChange={(e) => updateField("dataformat_available", e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label form-label">Datenformat</label>
                    <input
                      type="text"
                      required
                      value={item.dataformat || ""}
                      onChange={(e) => updateField("dataformat", e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="form-label form-label">Häufigkeit/Zyklus</label>
                    <input
                      type="text"
                      required
                      value={item.timing || ""}
                      onChange={(e) => updateField("timing", e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label form-label">Geschätzte Datengröße</label>
                    <input
                      type="text"
                      required
                      value={item.data_size || ""}
                      onChange={(e) => updateField("data_size", e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div>
                    <label className="form-label form-label">Zugriffsbeschränkungen</label>
                    <input
                      type="text"
                      required
                      value={item.policies || ""}
                      onChange={(e) => updateField("policies", e.target.value)}
                      className="form-input"
                    />
                  </div>

              </>
            )}

            {/* Klassen und Merkmale */}
            {activeTab === "properties" && (() => {
              const selectedClass = classPropertyTree.find(c => c.uuid === selectedClassUuid);

              const filteredProperties = selectedClass
                ? selectedClass.properties.filter(p =>
                  getLabel(p.name).toLowerCase().includes(propertySearchTerm.toLowerCase()) ||
                  getLabel(p.definition).toLowerCase().includes(propertySearchTerm.toLowerCase())
                )
                : [];

              // Alle ausgewählten Properties über alle Klassen hinweg mit Name anzeigen
              const allSelectedWithLabel = item.property_uuids.map(uuid => {
                for (const cls of classPropertyTree) {
                  const found = cls.properties.find(p => p.UUID === uuid);
                  if (found) return { ...found, className: getLabel(cls.name) };
                }
                return null;
              }).filter(Boolean) as (Property & { className: string })[];

              return (
                <>
                  {item.property_uuids.length === 0 && (
                    <div className="alert alert-info">
                      <AlertCircle size={18} />
                      <span>Es sind noch keine Merkmale ausgewählt.</span>
                    </div>
                  )}

                  {/* Klassen-Auswahl */}
                  <div>
                    <label className="form-label">Klasse auswählen</label>
                    <select
                      value={selectedClassUuid}
                      onChange={e => {
                          setSelectedClassUuid(e.target.value);
                          setPropertySearchTerm("");
                      }}
                      className="form-input form-select"
                    >
                      <option value="">-- Klasse wählen --</option>
                      {classPropertyTree.map(cls => (
                        <option key={cls.uuid} value={cls.uuid}>
                          {getLabel(cls.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ausgewählte Merkmale als Chips */}
                  {allSelectedWithLabel.length > 0 && (
                    <div className="selected-groups-box">
                      <div className="selected-groups-label">
                        Ausgewählt: {allSelectedWithLabel.length} Merkmal(e)
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {allSelectedWithLabel.map(p => (
                          <button
                            key={p.UUID}
                            type="button"
                            onClick={() => toggleProperty(p.UUID)}
                            className="badge badge-primary badge-removable"
                            title={p.className}
                          >
                            {getLabel(p.name)}
                            <span style={{ marginLeft: 3, opacity: 0.7 }}>×</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Merkmale der gewählten Klasse */}
                  {selectedClass && (
                    <>
                      <div className="search-wrapper" style={{ maxWidth: "none" }}>
                        <Search className="search-icon" size={16} />
                        <input
                          type="text"
                          placeholder="Merkmal suchen…"
                          value={propertySearchTerm}
                          onChange={e => setPropertySearchTerm(e.target.value)}
                          className="search-input"
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div className="group-list custom-scrollbar">
                        {filteredProperties.length === 0 ? (
                          <div className="group-list-empty">
                            <span style={{ fontWeight: 600 }}>
                              {selectedClass.properties.length === 0
                                ? "Diese Klasse hat keine Merkmale"
                                : "Keine Merkmale gefunden"}
                            </span>
                          </div>
                        ) : (
                          filteredProperties.map(prop => {
                            const isSelected = item.property_uuids.includes(prop.UUID);
                            return (
                              <label
                                key={prop.UUID}
                                className={`group-list-item ${isSelected ? "group-list-item-selected" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleProperty(prop.UUID)}
                                  className="form-checkbox"
                                  style={{ marginTop: 2, flexShrink: 0 }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13, marginBottom: 3 }}>
                                    {getLabel(prop.name)}
                                  </div>
                                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                                    {getLabel(prop.definition)}
                                  </p>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </>
              );
            })()}




          </div>
        </div>

        {/* Aktionen */}
        <div className="form-actions">
          <button type="submit" disabled={loading || !hasWriteAccess} title={!hasWriteAccess ? "Nur Schreibrechte können speichern" : undefined} className="btn btn-primary">
            {loading ? "Speichern…" : (hasWriteAccess ? "Speichern" : "Speichern (keine Schreibrechte)") }
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
            Zurück
          </button>
        </div>
      </form>
    </div>
  );
}
