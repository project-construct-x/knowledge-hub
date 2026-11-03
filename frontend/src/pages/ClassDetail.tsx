import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth.ts";
import { useParams, useNavigate } from "react-router-dom";
import {api, ApiError} from "../api/api.ts";
import type {PropertyGroup, Property, VersionConflictDetail} from "../types.ts";
import {Tags, AlertCircle, Boxes} from "lucide-react";
import {getLabel} from "../components/helper.tsx";
import {MultiLangInput} from "../components/MultiLanguageField.tsx";
import {useStaleCheck} from "../hooks/useStaleCheck.ts";
import VersionConflictAlert from "../components/VersionConflictAlert.tsx";
import StaleDataAlert from "../components/StaleDataAlert.tsx";

// hier wird zwar von Klassen geschrieben, im Hintergrund handelt es sich aber technisch um ProjectGroups
// auch im Backend sind Klassen als ProjectGroups gespeichert

const emptyClass: Partial<PropertyGroup> = {
  active: true,
  name: {"de": ""},
  definition: {"de": ""},
  language_of_creator: "de-DE",
  version: 1,
  groups: [],
  category: "Klasse"
};

export default function ClassDetail() {
  const { hasWriteAccess } = useAuth();
  const { uuid } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Partial<PropertyGroup>>(emptyClass);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [relatedProperties, setRelatedProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [conflict, setConflict] = useState<VersionConflictDetail | null>(null);
  const [staleWarning, setStaleWarning] = useStaleCheck(
    item?.version,
    () => api.getPropertyGroupVersion(uuid!),
    uuid !== "new" && !!item,
  );

  useEffect(() => {
    if (uuid !== "new") {
      loadClass();
      loadRelatedProperties();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  async function loadClass() {
    setLoading(true);
    try {
      const data = await api.getPropertyGroup(uuid!);
      setItem(data);
      setConflict(null);
      setStaleWarning(null);
    } catch (error) {
      console.error("Fehler beim Laden:", error);
      alert("Klasse konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }

  async function loadRelatedProperties() {
    if (uuid === "new") return;

    setLoadingProperties(true);
    try {
      const PropertiesByGroup = await api.getPropertiesByGroup(uuid!);
      setRelatedProperties(PropertiesByGroup);
    } catch (error) {
      console.error("Fehler beim Laden der Properties:", error);
    } finally {
      setLoadingProperties(false);
    }
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (uuid === "new") {
        const created = await api.createPropertyGroup(item);
        navigate(`/classes/${created.UUID}`);
      } else {
        const updated = await api.updatePropertyGroup(uuid!, item);
        setItem(updated);
        setConflict(null);
        alert("Klasse erfolgreich aktualisiert");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(error.detail as VersionConflictDetail);
        return;
      }
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern der Klasse");
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: keyof PropertyGroup, value: PropertyGroup[keyof PropertyGroup]) {
    setItem(prev => ({ ...prev, [field]: value }));
  }

  if (loading && uuid !== "new") {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "64px 24px" }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    )
  }

  const tabs = [
    { id: "basic", label: "Grunddaten", icon: Tags},
    { id: "related_properties", label: "Zugeordnete Merkmale", badge: relatedProperties?.length},
    { id: "metadata", label: "Metadaten"}
  ]

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div className="page-header-icon">
          <Boxes size={22} />
        </div>
        <div>
          <div className="page-header-title">
            {uuid === "new" ? "Neue Klasse" : getLabel(item.name ?? {}, "de") || ""}
          </div>
          <div className="page-header-sub">Klasse</div>
        </div>
      </div>

      <VersionConflictAlert
        conflict={conflict}
        onReload={loadClass}
        onForceOverwrite={() => setConflict(null)}
      />

      <StaleDataAlert
        staleInfo={staleWarning}
        onReload={loadClass}
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

        {/* Tab Content */}
        <div className="card">
          <div className="card-body form-section custom-scrollbar">

            {/* Grunddaten*/}
            {activeTab === "basic" && (
              <>
                <div className="form-grid-2">
                  <MultiLangInput
                    label="Name"
                    required
                    value={item.name ?? {}}
                    onChange={(val) => updateField("name", val)}
                  />
                  <div>
                    <label className="form-label form-label-required">Sprache</label>
                    <select
                      required
                      value={item.language_of_creator || ""}
                      onChange={e => updateField("language_of_creator", e.target.value)}
                      className="form-input form-select"
                    >
                      <option value="de-DE">Deutsch (DE)</option>
                      <option value="en-EN">Englisch (EN)</option>
                      <option value="fr-FR">Französisch (FR)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <MultiLangInput
                    label="Definition"
                    required
                    value={item.definition ?? {}}
                    onChange={(val) => updateField("definition", val)}
                    multiline
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={item.active || false}
                    onChange={(e) => updateField("active", e.target.checked)}
                    className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="active" className="text-gray-700 font-medium">
                    Aktiv
                  </label>
                </div>
              </>
            )}

            {/* Verbundene Merkmale */}
            {activeTab === "related_properties" && uuid !== "new" && (
              <>
                {(!relatedProperties || relatedProperties.length === 0) && !loadingProperties && (
                  <div className="alert alert-info">
                    <AlertCircle size={18} />
                    <span>Dieser Klasse sind noch keine Merkmale zugeordnet.</span>
                  </div>
                )}

                {loadingProperties ? (
                  <div className="group-list-empty">
                    <span style={{ fontWeight: 600 }}>Lade Merkmale...</span>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                      Diese Merkmale gehören zu dieser Klasse. Um die Zuordnung zu ändern, bearbeiten Sie die einzelnen Merkmale.
                    </p>

                    <div className="group-list custom-scrollbar">
                      {relatedProperties.length === 0 ? (
                        <div className="group-list-empty">
                          <span style={{ fontWeight: 600 }}>Keine Merkmale vorhanden</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                        Dieser Klasse sind noch keine Merkmale zugeordnet
                                                    </span>
                        </div>
                      ) : (
                        relatedProperties.map(prop => (
                          <div
                            key={prop.UUID}
                            className="group-list-item"
                            style={{ cursor: "default" }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                                                                <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>
                                                                    {getLabel(prop.name ?? {}, "de")}
                                                                </span>
                                {prop.data_type && (
                                  <span className="badge badge-gray">
                                                                        {prop.data_type}
                                                                    </span>
                                )}
                                <span className={`badge ${prop.active ? "badge-primary" : "badge-gray"}`}>
                                                                    {prop.active ? "Aktiv" : "Inaktiv"}
                                                                </span>
                              </div>
                              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                                {getLabel(prop.definition, "de").length > 80
                                  ? `${getLabel(prop.definition, "de").substring(0, 80)}...`
                                  : getLabel(prop.definition, "de")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate(`/properties/${prop.UUID}`)}
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

            {/* Metadaten Tab */}
            {activeTab === "metadata" && (
              <>
                <div className="form-grid-2">
                  <div>
                    <label className="form-label form-label-required">Version</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={item.version || 1}
                      onChange={(e) => updateField("version", parseInt(e.target.value))}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Nummer der Überarbeitung</label>
                    <input
                      type="number"
                      min="1"
                      value={item.number_of_revision || ""}
                      onChange={(e) => updateField("number_of_revision", e.target.value ? parseInt(e.target.value) : null)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="form-label">Ursprungsland</label>
                    <input
                      type="text"
                      value={item.country_of_origin || ""}
                      onChange={(e) => updateField("country_of_origin", e.target.value)}
                      className="form-input"
                      placeholder="z.B. DE, FR, US"
                    />
                  </div>
                  <div>
                    <label className="form-label">Verwendung in Ländern (kommagetrennt)</label>
                    <input
                      type="text"
                      value={item.used_in_countries?.join(", ") || ""}
                      onChange={(e) => updateField("used_in_countries", e.target.value.split(",").map(s => s.trim()))}
                      className="form-input"
                      placeholder="z.B. DE, FR, US"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Bild-URL</label>
                  <input
                    type="url"
                    value={item.picture_url || ""}
                    onChange={(e) => updateField("picture_url", e.target.value)}
                    className="form-input"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="form-label">Beziehung zu anderen Katalogen</label>
                  <textarea
                    rows={3}
                    value={item.relation_to_other_catalogues || ""}
                    onChange={(e) => updateField("relation_to_other_catalogues", e.target.value)}
                    className="form-input form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Erläuterung für Ablehnung</label>
                  <textarea
                    rows={3}
                    value={item.reason_for_rejection || ""}
                    onChange={(e) => updateField("reason_for_rejection", e.target.value)}
                    className="form-input form-textarea"
                  />
                </div>
              </>
            )}

            {/* Buttons */}
            <div className="form-actions">
              <button
                type="submit"
                disabled={loading || !hasWriteAccess}
                title={!hasWriteAccess ? "Nur Schreibrechte können speichern" : undefined}
                className="btn btn-primary"
              >
                {loading ? "Speichern..." : (hasWriteAccess ? "Speichern" : "Speichern (keine Schreibrechte)") }
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn btn-secondary"
              >
                Zurück
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}