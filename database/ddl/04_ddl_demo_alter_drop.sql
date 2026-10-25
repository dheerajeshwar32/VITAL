-- =============================================================================
-- VITAL: DDL Demonstration Script (Review 1: 10 Marks Rubric)
-- Demonstrates CREATE TABLE, ALTER TABLE (ADD, MODIFY, DROP COLUMN), and DROP TABLE
-- Safe execution on disposable demonstration staging table
-- =============================================================================

-- Step 1: Create a disposable demonstration table
CREATE TABLE DEMO_LOGISTICS_STAGING (
    dispatch_id     NUMBER(10) PRIMARY KEY,
    organ_id        NUMBER(10) NOT NULL,
    courier_agency  VARCHAR2(100) NOT NULL,
    temp_celsius    NUMBER(4,2),
    departure_time  TIMESTAMP DEFAULT SYSTIMESTAMP
);

-- Step 2: ALTER TABLE - Add a new column
ALTER TABLE DEMO_LOGISTICS_STAGING 
ADD (gps_tracking_code VARCHAR2(64) DEFAULT 'PENDING_ASSIGNMENT' NOT NULL);

-- Step 3: ALTER TABLE - Modify column datatype / constraint
ALTER TABLE DEMO_LOGISTICS_STAGING 
MODIFY (courier_agency VARCHAR2(150));

-- Step 4: ALTER TABLE - Add check constraint
ALTER TABLE DEMO_LOGISTICS_STAGING 
ADD CONSTRAINT chk_demo_temp CHECK (temp_celsius BETWEEN -2.0 AND 10.0);

-- Step 5: ALTER TABLE - Drop a column
ALTER TABLE DEMO_LOGISTICS_STAGING 
DROP COLUMN temp_celsius;

-- Step 6: DROP TABLE - Cleanup disposable demo table
DROP TABLE DEMO_LOGISTICS_STAGING PURGE;
