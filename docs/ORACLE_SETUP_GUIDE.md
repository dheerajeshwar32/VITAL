# VITAL — Oracle Database Setup & Execution Guide

This document provides complete instructions for establishing an actual Oracle Database instance, creating the VITAL schema, running the DDL/DML/PLSQL scripts, and running automated tests using Windows PowerShell.

---

## 1. Supported Oracle Database Versions

VITAL is fully compatible with:
* **Oracle Database 23ai Free** (Docker or Windows Native)
* **Oracle Database 21c Express Edition (XE)**
* **Oracle Database 19c Enterprise / Standard Edition**
* **Oracle Autonomous Database (Cloud ATP / ADW)**

---

## 2. Oracle Schema & User Setup

Connect as `SYS AS SYSDBA` or a privileged DBA user in SQL*Plus:

```sql
-- Connect to the Pluggable Database (e.g., XEPDB1 or FREEPDB1)
ALTER SESSION SET CONTAINER = XEPDB1;

-- Create the dedicated VITAL application user
CREATE USER VITAL IDENTIFIED BY "VitalSecure2026!"
    DEFAULT TABLESPACE USERS
    TEMPORARY TABLESPACE TEMP
    QUOTA UNLIMITED ON USERS;

-- Grant required developer and execution privileges
GRANT CONNECT, RESOURCE TO VITAL;
GRANT CREATE VIEW TO VITAL;
GRANT CREATE PROCEDURE TO VITAL;
GRANT CREATE TRIGGER TO VITAL;
GRANT CREATE SEQUENCE TO VITAL;
GRANT EXECUTE ON DBMS_LOCK TO VITAL;
```

---

## 3. Executing Database Scripts in Sequence

Execute the SQL scripts in this exact order using SQL*Plus or Oracle SQL Developer:

```powershell
# In Windows PowerShell, navigate to the project directory:
cd "c:\Users\gorij\OneDrive\Documents\DBMS PROJECT ( VITAL )"

# Run DDL scripts
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/ddl/01_create_tables.sql
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/ddl/03_sequences_and_indexes.sql

# Run Seed DML scripts
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/dml/01_seed_hospitals.sql
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/dml/02_seed_donors.sql
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/dml/03_seed_recipients.sql
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/dml/04_seed_organs.sql
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/dml/05_seed_allocations_audit.sql

# Compile PL/SQL Functions, Procedures, Cursors, and Triggers
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/plsql/01_functions.sql
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/plsql/02_procedures.sql
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/plsql/03_cursors.sql
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/plsql/04_triggers.sql

# Create Relational Views
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/queries/review2_views.sql

# Execute Automated Validation Tests
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/tests/test_constraints.sql
sqlplus VITAL/VitalSecure2026!@localhost:1521/XEPDB1 @database/tests/test_acid_transactions.sql
```

---

## 4. Environment Variables Configuration

Create a `.env` file in the project root:

```env
# Oracle Connection Parameters
ORACLE_USER=VITAL
ORACLE_PASSWORD=VitalSecure2026!
ORACLE_DSN=localhost:1521/XEPDB1
# Set to 'thin' (default, pure Python oracledb) or 'thick' (if using Oracle Instant Client)
ORACLE_MODE=thin

# Backend API Configuration
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000

# Security
JWT_SECRET_KEY=vital_jwt_secret_key_demo_2026_kidney_matching
JWT_ALGORITHM=HS256
```

---

## 5. Automated Fallback Architecture

If Oracle Database XE is not running on `localhost:1521` (e.g. during preliminary grading or when testing on a portable laptop without an active Oracle service), the VITAL backend automatically detects this condition upon startup. It provides:
1. Clear system status notification in the UI header and health check endpoint (`/api/health`).
2. An autonomous ACID mirror driver executing the identical relational constraints, transactions, and matching logic.
3. Once the Oracle database listener is brought online, the backend seamlessly connects to real Oracle via Python `oracledb`.
