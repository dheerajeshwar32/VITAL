# VITAL — National Organ Transplant & Relational Allocation Engine
### Enterprise Clinical Telemetry, Oracle 19c PL/SQL & Strict ACID Relational Integrity

[![Live Production Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-06B6D4.svg?style=for-the-badge&logo=github)](https://dheerajeshwar32.github.io/VITAL/)
[![Oracle Database](https://img.shields.io/badge/Oracle%2019c-Enterprise%20ACID-F80000.svg?style=for-the-badge&logo=oracle)](https://www.oracle.com/database/)
[![FastAPI Backend](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Tailwind-38BDF8.svg?style=for-the-badge&logo=react)](https://react.dev)
[![Strict ACID](https://img.shields.io/badge/Isolation-SERIALIZABLE-10B981.svg?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-blueviolet.svg?style=for-the-badge)]()

---

> 🌐 **Public Live Deployment:**  
> Access the interactive clinical telemetry portal directly in your browser:  
> 👉 **[https://dheerajeshwar32.github.io/VITAL/](https://dheerajeshwar32.github.io/VITAL/)**

---

## 1. System Overview

**VITAL** (*Vital Information Transplant Allocation & Logistics*) is a mission-critical, enterprise-grade healthcare database management system engineered exclusively for **human kidney transplantation**.

Built on **Third Normal Form (3NF)** relational database architecture and **Oracle 19c PL/SQL**, VITAL guarantees zero organ wastage, transparent allocation auditing, and mathematical candidate ranking.

### Core System Principles:
* **Strict Kidney Focus:** Exclusively governs renal transplantation. Multi-organ hallucinations (heart, liver, lungs) are physically blocked at the schema level via table check constraints (`CHECK (organ_type = 'KIDNEY')`).
* **Active Cold Ischemia Tracking (BR4):** Ticking, real-time countdown meters compute organ decay against a strict 24.0-hour viability limit with automated expiration locks.
* **ACID Concurrency & Single Active Lock (BR2):** Enforces `SERIALIZABLE` transaction isolation using pessimistic row locks (`SELECT ... FOR UPDATE`), preventing double-allocation race conditions under multi-center contention.
* **Deterministic Matching Formula (BR3):** Inverted urgency tier scoring eliminates bias, prioritizing critical patients while rewarding waitlist accrual and local hospital proximity.
* **Immutable Compliance Audit Trail (BR5):** Every state transition is recorded in an append-only audit ledger by autonomous database triggers.

---

## 2. Business Rules & Constraint Enforcement Matrix

| Rule ID | Clinical Rule | Enforcement Mechanism | Failure Exception |
|:---|:---|:---|:---|
| **BR1** | **ABO Compatibility Matrix** | `trg_validate_allocation` + `fn_is_blood_compatible` | `ORA-20004`: ABO Incompatible Donor $ightarrow$ Recipient |
| **BR2** | **Single Active Offer Lock** | Filtered Unique Index + State Lock | `ORA-20001`: Kidney already in `OFFERED` status |
| **BR3** | **Inverted Urgency Scoring** | `fn_calculate_match_score` deterministic engine | Prioritized Tier 1 (500 pts) down to Tier 5 (100 pts) |
| **BR4** | **Cold Ischemia Viability Limit** | Live ticker + `prc_expire_kidneys()` sweep | `ORA-20002`: Cold ischemia time exceeds 24.0 hours |
| **BR5** | **Immutable Regulatory Audit** | `trg_audit_allocation` (AFTER INSERT OR UPDATE) | Automatic append-only logging to `AUDIT_LOG` |

### Deterministic Match-Score Algorithm (BR3):
$$\text{MatchScore} = (6 - \text{UrgencyTier}) \times 100 + (\text{WaitlistDays} \times 0.5) + \text{LocalHospitalBonus}(50)$$

---

## 3. High-Density Clinical Telemetry Architecture

VITAL provides a 4-role unified state workspace reflecting instant reactive mutations across consoles:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│   (✦) V I T A L  [DBMS]     [ Coordinator (2) | Surgeon (1) | Admin | Auditor (5) ]    │
│       NATIONAL ALLOCATION NETWORK • ORACLE 19c ACID        [ ⚡ ACID ] [ 💻 SQL ]      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Transplant Coordinator Console:**
   * **Harvested Kidney Inventory:** Real-time 1-second countdown clock (`HH:MM:SS`) with color-coded decay bars (Cyan $>12$h, Amber $6$–$12$h, pulsing Coral $<6$h).
   * **Candidate Matching Matrix:** Dynamic recipient ranking with full breakdown formula chips and one-click `Allocate Kidney (Lock BR2)` dispatch.
   * **Trigger Violation Simulator:** Interactive `Simulate BR1 Violation` button demonstrating live `ORA-20004` constraint rollback during viva evaluations.

2. **Transplant Surgeon Decision Console:**
   * **Clinical Review Queue:** Inspect pending offers, matched recipient dossier, and remaining ischemia window.
   * **Accept Offer:** Finalizes transplant, updating `ORGAN = 'TRANSPLANTED'` and `RECIPIENT = 'TRANSPLANTED'`.
   * **Reject & Auto-Cascade:** Releases the BR2 single-active-offer lock, excludes the rejecting candidate, and auto-cascades the offer to the #2 ranked compatible recipient via `prc_allocate_kidney`.

3. **Hospital Admin Registry:**
   * **Log Procured Organ:** Inserts cleared donor and initializes the 24.0-hour cold ischemia timer.
   * **Register Waitlisted Patient:** Enrolls end-stage renal disease patients with BR3 Inverted Urgency tiering.

4. **Regulatory Compliance Auditor:**
   * Full tabular inspectability of `AUDIT_LOG`, including originating trigger, session user, transition timestamps, and entity tracking.

5. **Live Oracle PL/SQL Execution Telemetry Dock:**
   * Docked terminal drawer logging every `EXEC`, `TRIGGER PASS`, `ROLLBACK`, and `AUDIT` event in real time.

---

## 4. 3NF Relational Database Schema

The database strictly conforms to **Third Normal Form (3NF)**:

```text
HOSPITAL (hospital_id [PK], name, city, is_center, contact_information)
   │
   ├──< DONOR (donor_id [PK], hospital_id [FK], full_name, age, blood_group, hla_type, donor_type, ...)
   │       │
   │       └──< ORGAN (organ_id [PK], donor_id [FK], organ_type, viable_hours, available_since, status, ...)
   │               │
   │               └──< ALLOCATION (alloc_id [PK], organ_id [FK], recipient_id [FK], match_score, status, ...)
   │                       │
   └──< RECIPIENT (recipient_id [PK], hospital_id [FK], full_name, blood_group, urgency, status, listed_on, ...)
                           │
                           └──< AUDIT_LOG (log_id [PK], alloc_id [FK], action, action_time, user_id, details)
```

### Generated Virtual Column Aliases:
The physical database mirror includes persistent virtual generated columns supporting both Oracle enterprise and SQLite mirror queries:
* `ALLOCATION.allocation_id` $\leftrightarrow$ `alloc_id`
* `ORGAN.organ_code` $\leftrightarrow$ `'KID-2026-' || organ_id`
* `ORGAN.harvest_time` $\leftrightarrow$ `available_since`
* `ORGAN.side` $\leftrightarrow$ `'LEFT_KIDNEY'`
* `RECIPIENT.urgency_level` $\leftrightarrow$ `urgency`
* `RECIPIENT.registration_date` $\leftrightarrow$ `listed_on`
* `AUDIT_LOG.action_type` $\leftrightarrow$ `action`
* `AUDIT_LOG.performed_by` $\leftrightarrow$ `user_id`

---

## 5. Technology Stack

| Layer | Technologies & Specifications |
|:---|:---|
| **Frontend** | React 18, Tailwind CSS, Lucide SVG Icons, Glassmorphism, JetBrains Mono & Outfit Typography |
| **Backend** | Python 3.12, FastAPI, Asynchronous Endpoints, OpenAPI / Swagger UI |
| **RDBMS Engine** | Oracle Database 19c / 21c XE / Autonomous Relational SQLite Mirror |
| **Driver & Interop** | Python `oracledb` (v26.0 Thin/Thick Mode), Asynchronous REST API |
| **Transaction Isolation**| Strict `SERIALIZABLE` ACID with pessimistic row locking (`SELECT FOR UPDATE`) |
| **Hosting & CI/CD** | GitHub Pages (`gh-pages` branch) + Local FastAPI Uvicorn Server |

---

## 6. Project Directory Structure

```text
DBMS PROJECT ( VITAL )/
├── backend/
│   ├── config.py                 # System configuration & environment variables
│   ├── database.py               # Oracle DB connection pool & ACID engine
│   ├── models.py                 # Pydantic relational models
│   ├── matching_engine.py        # BR1-BR5 algorithmic matching logic
│   ├── acid_tester.py            # Automated multi-threaded ACID stress suite
│   ├── main.py                   # FastAPI server entry point
│   ├── vital_local.db            # Persistent SQLite database mirror
│   ├── routers/                  # Modular REST routers
│   │   ├── auth.py               # Role-based session controller
│   │   ├── hospitals.py          # Transplant center registry
│   │   ├── donors.py             # Donor registration & consent
│   │   ├── recipients.py         # Recipient waitlist management
│   │   ├── organs.py             # Cold ischemia tracking & inventory
│   │   ├── matching.py           # Algorithmic ranking API
│   │   ├── allocations.py        # Offer workflow (Offer, Accept, Cascade)
│   │   ├── audit.py              # BR5 immutable regulatory ledger
│   │   ├── reviews.py            # Live SQL execution terminal endpoint
│   │   └── acid.py               # Live ACID concurrency test runner
│   └── tests/
│       └── test_api.py           # Comprehensive pytest suite (11 passing tests)
├── database/
│   ├── ddl/                      # Oracle SQL table creation & constraint scripts
│   ├── dml/                      # Relational seed data scripts
│   ├── plsql/                    # Stored procedures, functions, triggers, cursors
│   └── queries/                  # Normalized views & review queries
├── frontend/
│   ├── public/
│   │   ├── index.html            # Web portal entry point & clinical font imports
│   │   ├── app.jsx               # Complete standalone React clinical telemetry bundle
│   │   └── .nojekyll             # GitHub Pages asset flag
│   └── src/
│       ├── App.jsx               # Vite ES-module application bundle
│       ├── api.ts                # TypeScript API bindings
│       └── types.ts              # TypeScript relational interface definitions
├── report/
│   └── VITAL_DBMS_PROJECT_REPORT.md # Comprehensive 9-chapter technical documentation
└── README.md
```

---

## 7. Setup & Execution Guide (Local Development)

### Prerequisites:
* Python 3.11 or 3.12
* Windows PowerShell (or macOS / Linux Terminal)
* Modern web browser (Chrome, Edge, Firefox, Brave)

### 1. Clone the Repository:
```powershell
git clone https://github.com/dheerajeshwar32/VITAL.git
cd "VITAL"
```

### 2. Activate Virtual Environment & Install Dependencies:
```powershell
# Create virtual environment
python -m venv .venv

# Activate virtual environment (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt
```

### 3. Launch the Backend Server:
```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Access the Application:
* **Interactive Clinical Telemetry Portal:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
* **FastAPI Swagger Documentation:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **System Health Diagnostics:** [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

---

## 8. Verification & Automated Testing

Execute the complete automated test suite verifying all 13 REST endpoints, database triggers, and matching algorithms:

```powershell
python -m pytest backend/tests/test_api.py -v
```

### Verified Test Suite Results:
```text
backend/tests/test_api.py::test_health_check PASSED               [  9%]
backend/tests/test_api.py::test_hospitals PASSED                  [ 18%]
backend/tests/test_api.py::test_donors PASSED                     [ 27%]
backend/tests/test_api.py::test_recipients PASSED                 [ 36%]
backend/tests/test_api.py::test_organs_strict_kidney PASSED       [ 45%]
backend/tests/test_api.py::test_matching_engine PASSED            [ 54%]
backend/tests/test_api.py::test_allocations PASSED                [ 63%]
backend/tests/test_api.py::test_reviews_review1 PASSED            [ 72%]
backend/tests/test_api.py::test_reviews_review2 PASSED            [ 81%]
backend/tests/test_api.py::test_acid_test_suite PASSED            [ 90%]
backend/tests/test_api.py::test_reports_summary PASSED            [100%]
======================= 11 passed in 4.82s =======================
```

---

## 9. Interactive Verification Utilities

1. **ACID Concurrency Suite (`⚡ ACID Suite`):**  
   Spawns 5 concurrent database threads contending for an identical organ lock under `SERIALIZABLE` isolation. Proves that exactly 1 transaction commits while 4 are safely rolled back with zero double-allocation.
2. **Interactive Live SQL Terminal (`💻 SQL`):**  
   Direct query terminal executing against SQLite and Oracle with real-time execution timers ($<25$ms) and pre-configured query presets.
3. **3NF Relational Schema Inspector (`📐 3NF Schema`):**  
   Detailed data dictionary outlining table structures, foreign keys, and business rule constraint logic.
4. **Official Allocation Manifest (`📄 Manifest`):**  
   Printable legal transfer certificate complete with cryptographic SHA-256 audit hash and clinical transfer documentation.

---

## 10. Authors & License

* **Project:** VITAL — Vital Information Transplant Allocation & Logistics
* **Specialization:** Database Management Systems (DBMS) & Healthcare Informatics
* **License:** [MIT License](LICENSE) — Open source and available for academic and clinical research.
