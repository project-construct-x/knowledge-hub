import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth.ts";
import { useParams, useNavigate } from "react-router-dom";
import {api, ApiError} from "../api/api.ts";
import type {Role, SubUseCase, VersionConflictDetail} from "../types.ts";
import { AlertCircle, Users, Layers } from "lucide-react";
import {useStaleCheck} from "../hooks/useStaleCheck.ts";
import VersionConflictAlert from "../components/VersionConflictAlert.tsx";
import StaleDataAlert from "../components/StaleDataAlert.tsx";

const emptyRole: Partial<Role> = {
  name: "",
  definition: "",
  version: 1,
};

export default function RoleDetail() {
  const { hasWriteAccess } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Partial<Role>>(emptyRole);
  const [loading, setLoading] = useState(false);
  const [loadingSubUseCases, setLoadingSubUseCases] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [relatedSubUseCases, setRelatedSubUseCases] = useState<SubUseCase[]>([]);
  const [conflict, setConflict] = useState<VersionConflictDetail | null>(null);
  const [staleWarning, setStaleWarning] = useStaleCheck(
    item?.version,
    () => api.getRoleVersion(Number(id)),
    id !== "new" && !!item,
  );

  useEffect(() => {
    if (id !== "new") {
      loadRole();
      loadRelatedSubUseCases();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadRole() {
    setLoading(true);
    try {
      const data = await api.getRole(Number(id));
      setItem(data);
      setConflict(null);
      setStaleWarning(null);
    } catch (error) {
      console.error("Fehler beim Laden: ", error);
      alert("Rolle konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRelatedSubUseCases() {
    setLoadingSubUseCases(true);
    try {
      const subUseCasesByRole = await api.listSubUseCasesByRole(Number(id))
      setRelatedSubUseCases(subUseCasesByRole)
    } catch (error) {
      console.error("Fehler beim Laden der Sub Use Cases: ", error);
    } finally {
      setLoadingSubUseCases(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (id === "new") {
        console.log(JSON.stringify(item))
        const created = await api.createRole(item);
        navigate(`/roles/${created.id}`);
      } else {
        const updated = await api.updateRole(Number(id)!, item);
        setItem(updated);
        setConflict(null);
        alert("Role erfolgreich aktualisiert");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(error.detail as VersionConflictDetail);
        return;
      }
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern der Rolle");
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: keyof Role, value: Role[keyof Role]) {
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
    { id: "basic", label: "Grunddaten"},
    { id: "related_subUseCases", label: "Zugeordnete Sub Use Cases", icon: Layers},
  ]

  return (
    <div className="page-container animate-fade-in">

      <div className="page-header">
        <div className="page-header-icon">
          <Users size={22} />
        </div>
        <div>
          <div className="page-header-title">
            {id === "new" ? "Neue Rolle" : item.name}
          </div>
          <div className="page-header-sub">Rolle</div>
        </div>
      </div>

      <VersionConflictAlert
        conflict={conflict}
        onReload={loadRole}
        onForceOverwrite={() => setConflict(null)}
      />

      <StaleDataAlert
        staleInfo={staleWarning}
        onReload={loadRole}
        onDismiss={() => setStaleWarning(null)}
      />

      <form onSubmit={handleSubmit} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {/* Tabs */}
        <div className="tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const badge = tab.id === "related_subUseCases" ? relatedSubUseCases?.length : undefined;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`tab ${activeTab === tab.id ? "tab-active": "tab-inactive"}`}
              >
                {Icon && <Icon size={15} />}
                {tab.label}
                {badge !== undefined && badge > 0 && (
                  <span className="badge badge-primary">{badge}</span>
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
                    onChange={(e) => updateField("name", e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label form-label-required">Definition</label>
                  <textarea
                    required
                    rows={10}
                    value={item.definition || ""}
                    onChange={(e) => updateField("definition", e.target.value)}
                    className="form-input form-textarea custom-scrollbar"
                  />
                </div>
              </>
            )}

            {/* Zugeordnete Sub Use Cases */}
            {activeTab === "related_subUseCases" && id !== "new" && (
              <>
                {(!relatedSubUseCases || relatedSubUseCases.length === 0) && !loadingSubUseCases && (
                  <div className="alert alert-info">
                    <AlertCircle size={18} />
                    <span>Diese Rolle ist noch keinen Sub Use Cases zugeordnet.</span>
                  </div>
                )}

                {loadingSubUseCases ? (
                  <div className="group-list-empty">
                    <span style={{ fontWeight: 600 }}>Lade Sub Use Cases...</span>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                      Die Rolle ist diesen Sub Use Cases zugeordnet. Um die Zuordnung zu ändern, bearbeiten Sie die einzelnen Sub Use Cases.
                    </p>

                    <div className="group-list custom-scrollbar">
                      {relatedSubUseCases.length === 0 ? (
                        <div className="group-list-empty">
                          <span style={{ fontWeight: 600 }}>Keine Sub Use Cases vorhanden</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                        Diese Rolle ist noch keinen Sub Use Cases zugeordnet
                                                    </span>
                        </div>
                      ) : (
                        relatedSubUseCases.map(prop => (
                          <div
                            key={prop.id}
                            className="group-list-item"
                            style={{ cursor: "default" }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                                                                <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>
                                                                    {prop.name}
                                                                </span>
                              </div>
                              <span style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>{prop.useCase_id} </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate(`/subusecases/${prop.id}`)}
                              className="btn btn-secondary"
                              style={{ flexShrink: 0, fontSize: 12, padding: "4px 10px" }}
                            >
                              Bearbeiten
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </>
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
