import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth.ts";
import { useParams, useNavigate } from "react-router-dom";
import {api, ApiError} from "../api/api.ts";
import type { Property, PropertyGroup, VersionConflictDetail } from "../types.ts";
import { Search, Tags, AlertCircle } from "lucide-react";
import {getLabel} from "../components/helper.tsx";
import {MultiLangInput} from "../components/MultiLanguageField.tsx";
import {useStaleCheck} from "../hooks/useStaleCheck.ts";
import VersionConflictAlert from "../components/VersionConflictAlert.tsx";
import StaleDataAlert from "../components/StaleDataAlert.tsx";

const emptyProperty: Partial<Property> = {
  active: true,
  name: {"de": ""},
  definition: {"de": ""},
  language_of_creator: "de-DE",
  version: 1,
  groups: [],
  dynamic: false,
};

export default function PropertyDetail() {
  const { hasWriteAccess } = useAuth();
  const { uuid } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Partial<Property>>(emptyProperty);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [allPropertyGroups, setAllPropertyGroups] = useState<PropertyGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<PropertyGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [conflict, setConflict] = useState<VersionConflictDetail | null>(null);
  const [staleWarning, setStaleWarning] = useStaleCheck(
    item?.version,
    () => api.getPropertyVersion(uuid!),
    uuid !== "new" && !!item,
  );

  useEffect(() => {
    loadPropertyGroups();
    if (uuid !== "new") {
      loadProperty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  useEffect(() => {
    filterPropertyGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, categoryFilter, allPropertyGroups]);

  async function loadPropertyGroups() {
    try {
      const groups = await api.listPropertyGroups();
      setAllPropertyGroups(groups);
    } catch (error) {
      console.error("Fehler beim Laden der PropertyGroups:", error);
    }
  }

  function filterPropertyGroups() {
    let filtered = allPropertyGroups;

    if (categoryFilter !== "all") {
      filtered = filtered.filter(g => g.category === categoryFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        getLabel(g.name).toLowerCase().includes(term) ||
        getLabel(g.definition).toLowerCase().includes(term)
      );
    }

    setFilteredGroups(filtered);
  }

  async function loadProperty() {
    setLoading(true);
    try {
      const data = await api.getProperty(uuid!);
      setItem(data);
      setConflict(null);
      setStaleWarning(null);
    } catch (error) {
      console.error("Fehler beim Laden:", error);
      alert("Property konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!item.groups || item.groups.length === 0) {
      alert("Bitte wählen Sie mindestens eine PropertyGroup aus");
      return;
    }

    setLoading(true);

    try {
      if (uuid === "new") {
        const created = await api.createProperty(item);
        navigate(`/properties/${created.UUID}`);
      } else {
        const updated = await api.updateProperty(uuid!, item);
        setItem(updated);
        setConflict(null);
        alert("Property erfolgreich aktualisiert");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(error.detail as VersionConflictDetail);
        return;
      }
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern des Properties");
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof Property>(field: K, value: Property[K]) {
    setItem(prev => ({ ...prev, [field]: value }));
  }

  function togglePropertyGroup(groupUuid: string) {
    const currentGroups = item.groups || [];
    const isSelected = currentGroups.includes(groupUuid);

    if (isSelected) {
      updateField("groups", currentGroups.filter(g => g !== groupUuid));
    } else {
      updateField("groups", [...currentGroups, groupUuid]);
    }
  }

  const uniqueCategories = Array.from(new Set(allPropertyGroups.map(g => g.category)));

  if (loading && uuid !== "new") {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "64px 24px" }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  const tabs = [
    { id: "basic", label: "Grunddaten", icon: Tags },
    { id: "groups", label: "Merkmalsgruppen", badge: item.groups?.length },
    { id: "technical", label: "Technische Daten" },
    { id: "metadata", label: "Metadaten" },
  ];

  return (
    <div className="page-container animate-fade-in">

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-icon">
          <Tags size={22} />
        </div>
        <div>
          <div className="page-header-title">
            {uuid === "new" ? "Neues Merkmal" : getLabel(item.name ?? {}, "de") || ""}
          </div>
          <div className="page-header-sub">Merkmal</div>
        </div>
      </div>

      <VersionConflictAlert
        conflict={conflict}
        onReload={loadProperty}
        onForceOverwrite={() => setConflict(null)}
      />

      <StaleDataAlert
        staleInfo={staleWarning}
        onReload={loadProperty}
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

            {/* ── Grunddaten ── */}
            {activeTab === "basic" && (
              <>
                <div className="form-grid-2">
                  <div>
                    <MultiLangInput
                    label="Name"
                    required
                    value={item.name ?? {}}
                    onChange={(val) => updateField("name", val)}
                    />
                  </div>
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

                <div>
                  <MultiLangInput
                    label="Beschreibung"
                    value={item.description ?? {}}
                    onChange={(val) => updateField("description", val)}
                    multiline
                  />
                </div>

                <div>
                  <MultiLangInput
                    label="Beispiele"
                    value={item.examples ?? {}}
                    onChange={(val) => updateField("examples", val)}
                    multiline
                  />
                </div>

                <div className="form-check-row">
                  <input
                    type="checkbox"
                    id="active"
                    checked={item.active || false}
                    onChange={e => updateField("active", e.target.checked)}
                    className="form-checkbox"
                  />
                  <label htmlFor="active" className="form-check-label">
                    Merkmal ist aktiv
                  </label>
                </div>
              </>
            )}

            {/* ── Merkmalsgruppen ── */}
            {activeTab === "groups" && (
              <>
                {(!item.groups || item.groups.length === 0) && (
                  <div className="alert alert-info">
                    <AlertCircle size={18} />
                    <span>Wählen Sie mindestens eine Merkmalsgruppe aus.</span>
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
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="form-input form-select"
                  >
                    <option value="all">Alle Kategorien</option>
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ausgewählte Chips */}
                {item.groups && item.groups.length > 0 && (
                  <div className="selected-groups-box">
                    <div className="selected-groups-label">
                      Ausgewählt: {item.groups.length} Gruppe(n)
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {item.groups.map((groupUuid: string) => {
                        const group = allPropertyGroups.find(g => g.UUID === groupUuid);
                        return group ? (
                          <button
                            key={groupUuid}
                            type="button"
                            onClick={() => togglePropertyGroup(groupUuid)}
                            className="badge badge-primary badge-removable"
                          >
                            {getLabel(group.name)}
                            <span style={{ marginLeft: 3, opacity: 0.7 }}>×</span>
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Gruppen-Liste */}
                <div className="group-list custom-scrollbar">
                  {filteredGroups.length === 0 ? (
                    <div className="group-list-empty">
                      <span style={{ fontWeight: 600 }}>Keine Merkmalsgruppen gefunden</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                Versuchen Sie einen anderen Suchbegriff
                                            </span>
                    </div>
                  ) : (
                    filteredGroups.map(group => {
                      const isSelected = item.groups?.includes(group.UUID) || false;
                      return (
                        <label
                          key={group.UUID}
                          className={`group-list-item ${isSelected ? "group-list-item-selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePropertyGroup(group.UUID)}
                            className="form-checkbox"
                            style={{ marginTop: 2, flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                                                            <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>
                                                                {getLabel(group.name)}
                                                            </span>
                              <span className="badge badge-gray">
                                                                {group.category.replace(/_/g, " ")}
                                                            </span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                              {getLabel(group.definition)}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* ── Technische Daten ── */}
            {activeTab === "technical" && (
              <>
                <div className="form-grid-2">
                  <div>
                    <label className="form-label">Datentyp</label>
                    <select
                      value={item.data_type || ""}
                      onChange={e => updateField("data_type", e.target.value)}
                      className="form-input form-select"
                    >
                      <option value="">Bitte wählen</option>
                      <option value="numerisch">Numerisch</option>
                      <option value="reell">Reell</option>
                      <option value="ganze Zahl">Ganze Zahl</option>
                      <option value="Text">Text</option>
                      <option value="Boolean">Boolean</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Physikalische Größe</label>
                    <input
                      type="text"
                      value={item.physical_quantity?.[0] || ""}
                      onChange={e => updateField("physical_quantity", [e.target.value])}
                      className="form-input"
                      placeholder="z.B. Mass, Length, Temperature"
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="form-label">Dimension</label>
                    <input
                      type="text"
                      value={item.dimension || ""}
                      onChange={e => updateField("dimension", e.target.value)}
                      className="form-input"
                      placeholder="z.B. 10 −20000"
                    />
                  </div>
                  <div>
                    <label className="form-label">Einheiten (kommagetrennt)</label>
                    <input
                      type="text"
                      value={item.units?.join(", ") || ""}
                      onChange={e =>
                        updateField("units", e.target.value.split(",").map(s => s.trim()))
                      }
                      className="form-input"
                      placeholder="z.B. m, mm, kg"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Messverfahren</label>
                  <textarea
                    rows={3}
                    value={item.measurement_method || ""}
                    onChange={e => updateField("measurement_method", e.target.value)}
                    className="form-input form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Mögliche Werte (kommagetrennt)</label>
                  <input
                    type="text"
                    value={item.possible_values?.join(", ") || ""}
                    onChange={e =>
                      updateField("possible_values", e.target.value.split(",").map(s => s.trim()))
                    }
                    className="form-input"
                    placeholder="z.B. Yes, No, Not Applicable"
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-check-row">
                    <input
                      type="checkbox"
                      id="dynamic"
                      checked={item.dynamic || false}
                      onChange={e => updateField("dynamic", e.target.checked)}
                      className="form-checkbox"
                    />
                    <label htmlFor="dynamic" className="form-check-label">
                      Dynamisches Merkmal
                    </label>
                  </div>
                  <div>
                    <label className="form-label">Toleranz</label>
                    <input
                      type="text"
                      value={item.tolerance?.[0] || ""}
                      onChange={e => updateField("tolerance", [e.target.value])}
                      className="form-input"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ── Metadaten ── */}
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
                      onChange={e => updateField("version", parseInt(e.target.value))}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Nummer der Überarbeitung</label>
                    <input
                      type="number"
                      min="1"
                      value={item.number_of_revision || ""}
                      onChange={e =>
                        updateField("number_of_revision", e.target.value ? parseInt(e.target.value) : null)
                      }
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
                      onChange={e => updateField("country_of_origin", e.target.value)}
                      className="form-input"
                      placeholder="z.B. DE, FR, US"
                    />
                  </div>
                  <div>
                    <label className="form-label">Verwendung in Ländern (kommagetrennt)</label>
                    <input
                      type="text"
                      value={item.used_in_countries?.join(", ") || ""}
                      onChange={e =>
                        updateField("used_in_countries", e.target.value.split(",").map(s => s.trim()))
                      }
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
                    onChange={e => updateField("picture_url", e.target.value)}
                    className="form-input"
                    placeholder="https://…"
                  />
                </div>

                <div>
                  <label className="form-label">Beziehung zu anderen Katalogen</label>
                  <textarea
                    rows={3}
                    value={item.relation_to_other_catalogues || ""}
                    onChange={e => updateField("relation_to_other_catalogues", e.target.value)}
                    className="form-input form-textarea"
                  />
                </div>

                <div>
                  <label className="form-label">Erläuterung für Ablehnung</label>
                  <textarea
                    rows={3}
                    value={item.reason_for_rejection || ""}
                    onChange={e => updateField("reason_for_rejection", e.target.value)}
                    className="form-input form-textarea"
                  />
                </div>
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