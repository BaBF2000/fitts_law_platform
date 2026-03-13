# Fitts' Law Experiment Platform
![HTML5](https://img.shields.io/badge/HTML5-structure-orange)
![CSS3](https://img.shields.io/badge/CSS3-style-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-interaction-yellow)
![Python](https://img.shields.io/badge/python-3.x-blue)
![Flask](https://img.shields.io/badge/backend-flask-green)
![License](https://img.shields.io/badge/license-academic-lightgrey)
![Status](https://img.shields.io/badge/status-research%20prototype-orange)
![HCI](https://img.shields.io/badge/HCI-experiment-purple)

Web-based experimental platform developed for a **Bachelor thesis in Human–Computer Interaction (HCI)**.

The system allows controlled execution of **Fitts’ Law pointing experiments** using configurable experimental blocks, calibrated physical measurements, and automated data collection.

The application was designed as a **research tool** to support experimental studies involving target acquisition tasks and movement-time analysis.

---

# Research Context

Fitts’ Law is one of the most fundamental models in **Human–Computer Interaction (HCI)**.

It describes the relationship between:

- movement distance **A**
- target width **W**
- movement time **MT**

The Index of Difficulty (ID) is commonly defined as:

ID = log₂(A / W + 1)

This model is widely used in:

- usability studies
- interface design evaluation
- ergonomics research
- motor control studies

The goal of this project is to provide a **reliable experimental platform** that allows systematic collection of Fitts’ Law data.

---

# Project Goals

The platform was designed to support the following requirements:

- controlled experimental trials
- configurable experimental blocks
- physical calibration of screen dimensions
- automatic logging of experiment data
- reproducible datasets for analysis

The system aims to provide **accurate and reproducible measurements** for research purposes.

---

# System Architecture Diagram

```text
┌──────────────────────┐
│       Browser        │
│  HTML / CSS / JS     │
│  Experiment Engine   │
└──────────┬───────────┘
           │
           │ REST API (JSON)
           ▼
┌──────────────────────┐
│     Flask Backend    │
│  routes / security   │
│  database handling   │
└──────────┬───────────┘
           │
           │ SQL
           ▼
┌──────────────────────┐
│     SQLite DB        │
│ participants         │
│ sessions             │
│ trials               │
└──────────────────────┘
```

---

# Repository Structure

```text
fitt_law
│
├── .git
├── README.md
├── LICENSE
├── .gitignore
│
├── webapp
│   ├── app
│   ├── static
│   ├── templates
│   └── server.py
│
└── tools
```

The repository is organized into:

- **webapp/** : main application
- **app/** : backend Flask modules
- **static/** : frontend assets (CSS, JavaScript, icons)
- **templates/** : HTML templates
- **data/** : local database and exports
- **tools/** : development utilities
---

# Database Schema

```text
participant
────────────
participant_id (PK)


session
────────────
id (PK)
participant_id (FK)
session_code
experiment_parameters
device_context
screen_calibration


trial
────────────
id (PK)
session_id (FK)
trial_no
movement_time
target_coordinates
touch_coordinates
errors
click_count
effective_distance
effective_index_of_difficulty

Each **trial** corresponds to one pointing action in the experiment.
```
---


# Main Features

## Experiment configuration

- configurable blocks of trials
- adjustable parameters (distance A, width W, index of difficulty ID)
- strict experimental mode for controlled experiments
- automatic trial counting

---

## Target shapes

The system supports multiple target geometries:

- circle
- square
- triangle
- pentagon
- hexagon
- octagon
- diamond
- 1D horizontal band
- 1D vertical band

---

## Calibration system

To allow measurements in **millimeters**, the system includes a calibration procedure.

Calibration uses a reference object:

- standard bank card  
- known width: **85.60 mm**

This allows conversion between:

pixel coordinates → physical distances

The calibration procedure also estimates measurement uncertainty.

---

## Data acquisition

For each trial, the system records:

- movement time
- target distance
- target width
- index of difficulty
- pointer coordinates
- number of errors
- number of clicks before success

Additional device context is recorded:

- screen resolution
- viewport size
- device pixel ratio
- pointer capabilities
- touch support
- hardware information
- language and timezone

This allows **reproducibility of experimental conditions**.



---

# Frontend Architecture

The frontend is implemented using **modular JavaScript (ES modules)**.

## Core modules

core/

- device context detection
- DOM access layer
- mathematical helpers
- experiment state management
- UI management
- server communication

Main files:

- device.js  
- dom.js  
- helpers.js  
- state.js  
- storage.js  
- server.js  
- ui.js  

---

## Experiment modules

modules/

- calibration.js  
- experiment.js  

These modules implement the experimental workflow.

---

## Debug tools

debug/

Contains an optional debugging interface used during development.

Features include:

- runtime logging
- error capture
- debug overlay

---

# Backend Architecture

The backend is implemented using **Flask**.

Main components:

## Application factory

app/__init__.py

Handles:

- environment configuration
- security policy
- request filtering
- cache policy
- database initialization

---

## Database layer

app/db.py

Responsible for:

- SQLite connection management
- schema creation
- lightweight migrations
- CSV export utilities

---

## API routes

app/routes.py

Main endpoints:

| Endpoint | Purpose |
|--------|--------|
| / | main experiment interface |
| /save_results | store experiment data |
| /check_ids | verify participant/session identifiers |
| /sessions/<participant> | list recorded sessions |
| /export/... | export datasets as CSV |
| /dashboard | administrative interface |

---

# Database Structure

The SQLite database contains three main tables.

## participant

Stores unique participant identifiers.

## session

Stores metadata about experiment sessions.

Example attributes:

- participant ID
- session code
- experiment parameters
- device context
- screen calibration
- display resolution

## trial

Stores individual trial data.

Example attributes:

- movement time
- target coordinates
- effective distance
- effective index of difficulty
- error count
- click count

Each trial corresponds to a **single pointing task**.

---

# Installation

Clone the repository:

git clone <repository-url>

Install dependencies:

pip install flask

Run the server:

python server.py

Open the application in a browser:

http://localhost:8000

---

# Running an Experiment

Typical workflow:

1. Open the application in a browser.
2. Configure experimental blocks.
3. Perform screen calibration (optional but recommended).
4. Enter participant and session identifiers.
5. Run the experiment.
6. Export the collected data.

---

# Data Export

The system supports CSV export for further analysis.

Example export endpoints:

/export/participant/<participant>.csv  
/export/session/<participant>/<session>.csv  
/export/session_id/<id>.csv  

The exported dataset includes:

- participant information
- session metadata
- trial-level measurements
- device context information

This dataset can be used for **statistical analysis of Fitts’ Law performance**.

---

# Security Model

The system is designed for **controlled laboratory environments**.

Security features include:

- LAN-only access
- optional admin token protection
- input sanitization
- SQLite write locking
- restricted administrative endpoints

Environment variables:

ALLOW_PUBLIC=1  
ADMIN_TOKEN=secret  
DEV_NO_CACHE=1  
TRUST_PROXY=1  

---

# Technologies Used

- Python
- Flask
- JavaScript (ES modules)
- HTML
- CSS
- SQLite
- Progressive Web App technologies
- Service Workers

---

# Academic Context

This software was developed as part of a **Bachelor thesis project** focused on experimental methods in Human–Computer Interaction.

The platform provides a reproducible environment for conducting Fitts’ Law experiments and collecting quantitative interaction data.

---

# Future Work

Possible extensions include:

- automatic throughput analysis
- graphical visualization of results
- statistical analysis tools
- experiment configuration templates
- remote experiment deployment

---

# Author

Bachelor thesis project  
Human–Computer Interaction research tool

## License

This project is released under the MIT License.