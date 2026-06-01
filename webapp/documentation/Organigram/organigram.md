%%{init: {'flowchart': {'nodeSpacing': 35, 'rankSpacing': 45, 'htmlLabels': true}} }%%

flowchart TD

A([Start der Anwendung<br/>main.js])
--> B[Core Initialisierung<br/>state / dom / ui / storage]
--> C([Startbildschirm])

C --> D[Versuchsdaten<br/>Teilnehmer-ID / Versuch-ID / Kommentar]
C --> E[Kalibrierung]
C --> F[Touchability]
C --> G[Experimentdesign]
C --> H[Admin Settings]

subgraph S1[Core Layer]
direction TB
B1[state.js<br/>Globaler Zustand]
B2[dom.js<br/>DOM Registry]
B3[ui.js<br/>View Switching / HUD]
B4[storage.js<br/>Storage Facade]
B5[server.js<br/>Backend API]
B6[constants.js / adminSettings.js<br/>Globale Constraints]
B7[geometry.js / distributions.js<br/>Mathe & Sampling]
end

B --> S1

subgraph S2[Kalibrierung]
direction TB
E --> E1[calibrationHandlers.js]
E1 --> E2[calibration.js<br/>Orchestrator]
E2 --> E3[calibrationGestures.js<br/>Touch / Mouse Resize]
E2 --> E4[calibrationMath.js<br/>mm/px Berechnung]
E4 --> E5[calibrationStorage.js<br/>Speichern / Laden]
E5 -.-> C
end

subgraph S3[Touchability]
direction TB
F --> F1[touchabilityHandlers.js]
F1 --> F2[fingerTouchability.js<br/>Fingerkontakt messen]
F2 --> F3[touchabilityRuntime.js<br/>Teilnehmerdaten anwenden]
F3 --> F4[touchabilityStorage.js<br/>Participant Storage]
F2 --> F5[W_min je Zielform]
F5 -.-> G
end

subgraph S4[Experimentdesign / Protokoll]
direction TB
G --> G1[protocolDesignHandlers.js]
G1 --> G2[sessionDesign.js<br/>Block Editor]
G2 --> G3[sessionBlockTemplate.js<br/>HTML]
G2 --> G4[sessionBlockState.js<br/>Blockwerte]
G2 --> G5[sessionWarnings.js<br/>Monte-Carlo Warnungen]

G1 --> G6[protocol.js<br/>Build / Validate / Apply]
G6 --> G7[experimentConstraints.js<br/>W_min / W_max / A_min]
G1 --> G8[protocolListController.js<br/>Laden / Löschen]
G8 --> G9[SQLite Protokolle<br/>server.js]
G8 --> G10[protocolStorage.js<br/>lokal, später entfernbar]
end

subgraph S5[Monte Carlo]
direction TB
M1[monteCarlo.js<br/>Facade]
M1 --> M2[monteCarloEngine.js]
M2 --> M3[monteCarloSampling.js]
M2 --> M4[monteCarloDiagnostics.js]
M2 --> M5[monteCarloHistogram.js / Stats / Counts]
M1 --> M6[monteCarloSummaryView.js<br/>UI Summary]
end

G1 --> M1
G5 --> M1

subgraph S6[Experiment Runtime]
direction TB
R1[runHandlers.js<br/>Start / Restart]
R1 --> R2[experiment.js<br/>Runtime Orchestrator]
R2 --> R3[experimentTrials.js<br/>Trial Liste]
R2 --> R4[experimentTrialPreparation.js<br/>A / W / ID vorbereiten]
R2 --> R5[experimentTrialPlacement.js<br/>Target Position]
R2 --> R6[experimentTrialContext.js<br/>Trial Metadata]
R2 --> R7[trialPairEngine.js<br/>Interaktionen / Targetwechsel]
R7 --> R8[Target System]
R7 --> R9[experimentResultRows.js<br/>Result Rows]
R2 --> R10[experimentSummary.js<br/>End Summary]
end

G6 --> R1

subgraph S7[Target System]
direction TB
T1[TargetFactory.js]
T1 --> T2[Target.js<br/>Geometrie / Hit Testing]
T2 --> T3[TouchArea.js]
T2 --> T4[geometry.js]
T2 --> T5[TargetDebugOverlay.js]
end

R8 --> T1

subgraph S8[Ergebnisse / Persistenz]
direction TB
P1[exportHandlers.js]
P1 --> P2[CSV Export<br/>experimentExport.js]
P1 --> P3[Server Save<br/>server.js]
P3 --> P4[Session Snapshot<br/>protocol_json]
P3 --> P5[SQLite DB]
end

R10 --> P1