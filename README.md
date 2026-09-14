# Knowledge Hub

Web-Anwendung zur strukturierten, verknüpften Darstellung der Inhalte aus den Arbeitspaketen 1 und 2 im Projekt **Construct-X**.

## Über das Projekt

Das Repository **knowledge-hub** enthält den Quellcode einer Web-Anwendung, die im Projekt Construct-X eingesetzt wird.  
Die Anwendung sammelt Inhalte aus den Arbeitspaketen 1 und 2, stellt diese für Projektbeteiligte zusammenhängend und nachvollziehbar dar und ermöglicht deren Bearbeitung.  
Für Authentifizierung und Autorisierung wird **Keycloak** eingesetzt.

Die Entwicklung erfolgt vorwiegend durch das Lehr- und Forschungsgebiet **Digitales Planen, Bauen und Betreiben** der **Bergischen Universität Wuppertal**.
<p>
  <img src="docs/Logo_DPBB_02_10092025_RGB.png" alt="Logo Digitales Planen und Betreiben" width="260" />
</p>

## Zielgruppe

Die Anwendung richtet sich insbesondere an:
- Projektpartner im Construct-X-Kontext
- Beteiligte aus Forschung und Entwicklung
- Weitere Stakeholder mit Bedarf an strukturierter Use-Case-Transparenz

## Tech-Stack

- **Frontend:** Vite + React
- **Backend:** FastAPI
- **Datenbank:** PostgreSQL
- **Deployment:** Docker / Docker Compose

## Zugriff

- **Deployment:** `https://beispiel.com/knowledge-hub`
- **Repository:** `https://github.com/project-construct-x/knowledge-hub`

## Projektstruktur

```text
knowledge-hub/
├─ frontend/              # Vite + React Frontend
├─ backend/               # FastAPI Backend
├─ docs/                  # Projektdokumentation / Assets
├─ .env.example           # Ports und Umgebungsvariablen
├─ docker-compose.yml
└─ README.md
```

## License
All code files are distributed under the Apache 2.0 license. See [LICENSE](./LICENSE) for more information.

All non-code files are distributed under the Creative Commons Attribution 4.0 International license. See [LICENSE_non-code](./LICENSE_non-code) for more information.
