import {useEffect, useState} from "react";
import { useAuth } from "../auth/useAuth.ts";
import { useParams, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/api.ts";
import type {UseCase, Role, VersionConflictDetail} from "../types.ts";
import TagInput from "../components/TagInput.tsx";
import CrudTable from "../components/CrudTable.tsx";
import VersionConflictAlert from "../components/VersionConflictAlert.tsx";
import {Tags, AlertCircle, FileText, Layers, Search, Users} from "lucide-react";
import {useStaleCheck} from "../hooks/useStaleCheck.ts";
import StaleDataAlert from "../components/StaleDataAlert.tsx";

const emptyUseCase: UseCase = {
  id: 0,
  version: 0,
  name: "",
  keywords: [],
  description: "",
  relation_to_other_useCases: "",
  uc_owner_institution: "",
  uc_owner: "",
  conx_id: "",
  roles: [],
  subUseCases: [],
}

export default function UseCaseDetail() {
  const { hasWriteAccess } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<UseCase>(emptyUseCase)
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [roles, setRoles] = useState<Role[]>([]);
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([])
  const [searchTerm, setSearchTerm] = useState("");
  const [conflict, setConflict] = useState<VersionConflictDetail | null>(null);
  const [staleWarning, setStaleWarning] = useStaleCheck(
    item?.version,
    () => api.getUseCaseVersion(Number(id)),
    id !== "new" && !!item,
  );

  useEffect(() => {
    loadRoles();
    if (id !== "new") {
      loadUseCase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    filterRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, roles]);

  async function loadUseCase() {
    setLoading(true);
    try {
      const data = await api.getUseCase(Number(id!));
      setItem(data);
      setConflict(null);
      setStaleWarning(null);
    } catch (error) {
      console.error("Fehler beim Laden:", error);
      alert("Use Case konnte nicht geladen werden");
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

  function filterRoles() {
    let filtered = roles;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.name.toLowerCase().includes(term) ||
        g.definition.toLowerCase().includes(term)
      );
    }

    setFilteredRoles(filtered);
  }

  function toggleRole(role: Role) {
    const currentRoles = item.roles || [];
    const isSelected = currentRoles.some(r => r.id === role.id);

    if (isSelected) {
      updateField("roles", currentRoles.filter(r => r.id !== role.id));
    } else {
      updateField("roles", [...currentRoles, role]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name: item.name,
      keywords: item.keywords,
      description: item.description,
      relation_to_other_useCases: item.relation_to_other_useCases,
      uc_owner_institution: item.uc_owner_institution,
      uc_owner: item.uc_owner,
      conx_id: item.conx_id,
      version: item.version,
      roles: item.roles.map((r) => r.id),
    };

    try {
      if (id === "new") {
        console.log(JSON.stringify(item))
        const created = await api.createUseCase(payload);
        navigate(`/usecases/${created.id}`);
      } else {
        const updated = await api.updateUseCase(Number(id)!, payload);
        setItem(updated);
        setConflict(null);
        alert("Use Case erfolgreich aktualisiert");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(error.detail as VersionConflictDetail);
        return;
      }
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern des Use Case");
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof UseCase>(field: K, value: UseCase[K]) {
    setItem(prev => ({ ...prev, [field]: value }));
  }

  const tabs = [
    { id: "basic", label: "Grunddaten", icon: Tags},
    { id: "roles", label: "Rollen", icon: Users, badge: item.roles?.length},
    { id: "subusecases", label: "Sub Use Cases", icon: Layers, badge: item.subUseCases?.length}
  ]

  // TODO alle forms auf react-hook-from umstellen, damit die Validierung vernünftig funktioniert

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div className="page-header-icon">
          <FileText size={22} />
        </div>
        <div>
          <div className="page-header-title">
            {id === "new" ? "Neuer Use Case" : item.conx_id ? `${item.conx_id} - ${item.name}` : item.name}
          </div>
          <div className="page-header-sub">Use Case</div>
        </div>
      </div>

      <VersionConflictAlert
        conflict={conflict}
        onReload={loadUseCase}
        onForceOverwrite={() => setConflict(null)}
      />

      <StaleDataAlert
        staleInfo={staleWarning}
        onReload={loadUseCase}
        onDismiss={() => setStaleWarning(null)}
      />

      <form onSubmit={handleSubmit} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
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
                <div>
                  <label className="form-label form-label-required">Name</label>
                  <input
                    type="text"
                    required
                    value={item.name || ""}
                    onChange={e => updateField("name", e.target.value)}
                    className="form-input"
                    placeholder="Use Case Name eingeben"
                  />
                </div>
                <div className="form-grid-2">
                  <div>
                    <label className="form-label form-label">Use Case Owner</label>
                    <input
                      type="text"
                      value={item.uc_owner || ""}
                      onChange={(e) => updateField("uc_owner", e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label form-label">Institution</label>
                    <input
                      type="text"
                      value={item.uc_owner_institution || ""}
                      onChange={(e) => updateField("uc_owner_institution", e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label form-label-required">Schlagwörter</label>
                  <TagInput
                    value={item.keywords}
                    onChange={(tags) => {
                      setItem({ ...item, keywords: tags });
                    }}
                    placeholder="Schlagwort eingeben..."
                  />
                  <span className="form-hint">Enter oder &quot;Hinzufügen&quot; drücken zum Hinzufügen</span>
                                  </div>
                                  <div>
                                    <label className="form-label">Beschreibung</label>
                  <textarea
                    rows={7}
                    value={item.description || ""}
                    onChange={(e) => updateField("description", e.target.value)}
                    className="form-textarea custom-scrollbar"
                    placeholder="Beschreibe den Use Case..."
                  />
                </div>
                <div>
                  <label className="form-label">Bezug zu anderen Use Cases</label>
                  <textarea
                    rows={7}
                    value={item.relation_to_other_useCases || ""}
                    onChange={(e) => updateField("relation_to_other_useCases", e.target.value)}
                    className="form-textarea custom-scrollbar"
                    placeholder="Beschreibe den Bezug zu anderen Use Cases..."
                  />
                </div>
              </>
            )}

            {/* Rollen */}
            {activeTab === "roles" && (
              <>
                {(!item.roles || item.roles.length === 0) && (
                  <div className="alert alert-info">
                    <AlertCircle size={18} />
                    <span>Wählen Sie mindestens eine Rolle aus.</span>
                  </div>
                )}

                {/* Filter-Zeile */}
                <div className="form-grid-2">
                  <div className="search-wrapper" style={{ maxWidth: "none" }}>
                    <Search className="search-icon" size={16} />
                    <input
                      type="text"
                      placeholder="Name oder Definition suchen…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="search-input"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                {/* Ausgewählte Chips */}
                {item.roles && item.roles.length > 0 && (
                  <div className="selected-gropus-box">
                    <div className="selected-groups-label">
                      Ausgewählt: {item.roles.length} Rolle(n)
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {item.roles.map((role: Role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => toggleRole(role)}
                          className="badge badge-primary badge-removable"
                        >
                          {role.name}
                          <span style={{ marginLeft: 3, opacity: 0.7 }}>×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rollen-Liste */}
                <div className="group-list custom-scrollbar">
                  {filteredRoles.length === 0 ? (
                    <div className="group-list-empty">
                      <span style={{ fontWeight: 600 }}>Keine Rollen gefunden</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                Versuchen Sie einen anderen Suchbegriff
                                            </span>
                    </div>
                  ) : (
                    filteredRoles.map(role => {
                      const isSelected = item.roles?.some(r => r.id === role.id) || false;
                      return (
                        <label
                          key={role.id}
                          className={`group-list-item ${isSelected ? "group-list-item-selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRole(role)}
                            className="form-checkbox"
                            style={{ marginTop: 2, flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                                                            <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>
                                                                {role.name}
                                                            </span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                              {role.definition}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* SubUseCases Tabelle */}
            {activeTab === "subusecases" && (
              <CrudTable
                basePath="/subusecases"
                onDelete={async (id) => {
                  if (!confirm("Löschen?")) return;
                  await api.deleteSubUseCase(id as number);
                  updateField("subUseCases", item.subUseCases.filter(s => s.id !== id));
                }}
                rows={item.subUseCases || []}
                title="Sub Use Cases"
                createLabel={item.id ? "Neuer Sub Use Case" : "Zuerst den Use Case speichern"}
                onCreateClick={item.id
                  ? () => navigate(`/subusecases/new?useCaseId=${item.id}`)
                  : () => {}
                }
                createDisabled={!item.id}
                columns={[
                  {
                    key: "conx_id",
                    title: "ID",
                    render: (r) => <span style={{ fontWeight: 600 }}>{r.conx_id}</span>
                  },
                  {
                    key: "name",
                    title: "Name",
                    render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span>
                  },
                  {
                    key: "description",
                    title: "Beschreibung"
                  },
                  {
                    key: "roles",
                    title: "Rollen",
                    sortable: false,
                    filterable: false,
                    render: (r) => (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {r.subUseCase_roles.slice(0, 2).map((link, idx) => (
                          <span key={idx} className="badge badge-primary">
                                                        {link.role.name}
                                                    </span>
                        ))}
                        {r.subUseCase_roles.length > 2 && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                                        +{r.subUseCase_roles.length - 2} weitere
                                                    </span>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            )}
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