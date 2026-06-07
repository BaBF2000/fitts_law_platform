# 00 – System Overview

Weiter:
- [01 Frontend](01_frontend.md)
- [02 Experiment Runtime](02_experiment.md)
- [03 Protocol Design](03_protocol_design.md)
- [04 Monte Carlo](04_montecarlo.md)
- [05 Backend Routes](05_backend.md)
- [06 Database Layer](06_database.md)

---

# Ziel

Dieses Dokument ist die zentrale Übersicht der Anwendung nach dem Refactoring.

Es verbindet:

- Frontend
- Experiment Runtime
- Protocol Design
- Monte Carlo
- Backend
- Database Layer

---

```mermaid
flowchart TD

A[Fitts Display Lab]

A --> B[Frontend<br/>static/javascript]
A --> C[Backend<br/>Flask app]
A --> D[Database Layer<br/>SQLite]

B --> B1[main.js<br/>Bootstrap]
B --> B2[Core Layer]
B --> B3[Modules]
B --> B4[Targets]

B3 --> E[Experiment Runtime]
B3 --> F[Protocol Design]
B3 --> G[Monte Carlo]
B3 --> H[Calibration & Touchability]

C --> C1[routes package]
C1 --> C2[pages.py]
C1 --> C3[protocols.py]
C1 --> C4[results.py]
C1 --> C5[exports.py]
C1 --> C6[dashboard.py]
C1 --> C7[montecarlo_dashboard.py]

D --> D1[db.py<br/>Facade]
D1 --> D2[database/connection.py]
D1 --> D3[database/schema.py]
D1 --> D4[database/csv_export.py]
D1 --> D5[database/utils.py]

F --> C3
E --> C4
G --> C7
C4 --> D
C3 --> D
C5 --> D
C6 --> D
```

---

# Lesereihenfolge

## 1. Frontend

Siehe:

[01 Frontend](01_frontend.md)

Beschreibt:

- `main.js`
- `core/`
- UI Handler
- Frontend-Modulstruktur

---

## 2. Experiment Runtime

Siehe:

[02 Experiment Runtime](02_experiment.md)

Beschreibt:

- Trial-Erzeugung
- Trial-Vorbereitung
- Target-Platzierung
- Pair Engine
- Ergebniszeilen

---

## 3. Protocol Design

Siehe:

[03 Protocol Design](03_protocol_design.md)

Beschreibt:

- Session Design Editor
- Protokollobjekt
- Validierung
- Speicherung

---

## 4. Monte Carlo

Siehe:

[04 Monte Carlo](04_montecarlo.md)

Beschreibt:

- Sampling
- Simulation
- Diagnostics
- Dashboard

---

## 5. Backend Routes

Siehe:

[05 Backend Routes](05_backend.md)

Beschreibt:

- Flask Blueprint
- API Routes
- Dashboard Routes
- Export Routes

---

## 6. Database Layer

Siehe:

[06 Database Layer](06_database.md)

Beschreibt:

- SQLite Connection
- Schema
- CSV Export
- Utility helpers

---

# Grundprinzip

Die Anwendung folgt nach dem Refactoring diesem Prinzip:

```text
main.js / routes.py / db.py
```

sind nur noch Einstiegspunkte oder Fassaden.

Die eigentliche Logik liegt in spezialisierten Modulen.