# VITAL — Business Rules & Clinical Logic Specification

This document details the five core business rules (BR1 through BR5) governing the **VITAL** (*Vital Information Transplant Allocation & Logistics*) system, specifically adapted for **kidney-only transplantation**.

---

## Business Rule 1 (BR1): Blood-Group Compatibility & Clinical Clearance

### Rule Statement:
> An organ allocation offer must **never** be generated unless the donor-recipient pair satisfies ABO blood-group compatibility rules and the candidate recipient possesses a verified clinical evaluation status of `ELIGIBLE`.

### ABO/Rh Compatibility Matrix for Kidney Transplantation:

| Donor Blood Group | Compatible Recipient Blood Groups | Clinical Note |
|:---|:---|:---|
| **O-** | O-, O+, A-, A+, B-, B+, AB-, AB+ | **Universal Donor** (All recipients compatible) |
| **O+** | O+, A+, B+, AB+ | Compatible with all Rh-positive recipients |
| **A-** | A-, A+, AB-, AB+ | Compatible with A and AB recipients |
| **A+** | A+, AB+ | Compatible with Rh+ A and AB recipients |
| **B-** | B-, B+, AB-, AB+ | Compatible with B and AB recipients |
| **B+** | B+, AB+ | Compatible with Rh+ B and AB recipients |
| **AB-** | AB-, AB+ | Compatible with AB recipients only |
| **AB+** | AB+ | **Universal Recipient** (Can only donate to AB+) |

### Database & Application Enforcement:
1. Enforced by stored function `CHECK_BLOOD_GROUP_COMPATIBILITY(donor_bg, recip_bg)`.
2. Filtered in the SQL matching queries: recipients whose blood group is incompatible are automatically omitted from candidate pools with explicit explanatory codes (`INCOMPATIBLE_ABO`).
3. Recipients with status `PENDING_REVIEW` or `INELIGIBLE` are barred from receiving offers until an authorized hospital administrator or surgeon clears them.

---

## Business Rule 2 (BR2): Prevention of Duplicate Offers & Conflicting Allocations

### Rule Statement:
> A specific kidney graft must never be offered to the same recipient candidate more than once, and concurrent conflicting active offers for the same kidney must be strictly prevented.

### Database & Application Enforcement:
1. **Schema Constraint:** A composite unique constraint on `ALLOCATION(organ_id, recipient_id)` prevents the insertion of duplicate offers:
   ```sql
   CONSTRAINT uq_alloc_organ_recipient UNIQUE (organ_id, recipient_id)
   ```
2. **Concurrency Locking (ACID Isolation):** The procedure `CREATE_ALLOCATION_OFFER` executes:
   ```sql
   SELECT status, expiry_time FROM ORGAN WHERE organ_id = p_organ_id FOR UPDATE;
   ```
   If the organ's status is anything other than `AVAILABLE`, or if another coordinator holds the row lock, the transaction is rejected, preventing simultaneous double allocation across regional transplant centers.
3. Upon offer creation, the organ status immediately transitions to `OFFERED`. Only if the offer is subsequently `DECLINED` by the clinical reviewer is the organ returned to the `AVAILABLE` pool (provided it has not expired).

---

## Business Rule 3 (BR3): Recipient Urgency Standardization

### Rule Statement:
> Recipient medical urgency is strictly standardized on a 5-tier integer scale from Tier 1 (Most Urgent / Critical Emergency Need) down to Tier 5 (Routine / Clinically Stable).

### Urgency Scale Definition (Tier 1 = Most Urgency):

| Urgency Level | Clinical Tier | Description | Weight in Scoring |
|:---|:---|:---|:---|
| **1** | **Tier 1 (Critical Emergency)** | Immediate life threat; exhausted vascular access | **40.0 Points (Highest)** |
| **2** | **Tier 2 (High Urgency)** | Rapid loss of vascular access; severe uremic complications | **32.0 Points** |
| **3** | **Tier 3 (Moderate Urgency)** | Failing fistulas or recurrent line infections | **24.0 Points** |
| **4** | **Tier 4 (Low Urgency)** | Maintenance peritoneal dialysis or stable hemodialysis | **16.0 Points** |
| **5** | **Tier 5 (Routine / Stable)** | Stable on chronic dialysis; no vascular access crises | **8.0 Points (Lowest)** |

### Database & Application Enforcement:
- Enforced at database level via check constraint:
  ```sql
  CONSTRAINT chk_recipient_urgency CHECK (urgency BETWEEN 1 AND 5)
  ```
- Any DML insertion or update with urgency $<1$ or $>5$ triggers `ORA-02290: check constraint violated`.

---

## Business Rule 4 (BR4): Organ Viability & Cold Ischemia Expiry Tracking

### Rule Statement:
> An expired kidney graft (where elapsed preservation time has exceeded the allowable cold ischemia threshold) cannot be matched, offered, or allocated.

### Cold Ischemia Parameters:
- In clinical kidney preservation, static cold storage allows roughly 24 to 36 hours of viability before irreversible ischemic damage occurs.
- In VITAL, each procured kidney is assigned a `viable_hours` parameter upon surgical retrieval.
- `expiry_time` is deterministically computed as:
  $$\text{expiry\_time} = \text{available\_since} + \text{viable\_hours}$$

### Database & Application Enforcement:
1. Checked via stored function `IS_KIDNEY_EXPIRED(organ_id)`.
2. Database trigger `TRG_PREVENT_EXPIRED_ALLOCATION` aborts any attempt to insert an allocation record for an expired organ:
   ```sql
   IF v_expiry_time <= SYSTIMESTAMP THEN
       RAISE_APPLICATION_ERROR(-20031, 'BR4 Expiry Violation: Kidney has expired.');
   END IF;
   ```
3. Scheduled batch procedure `EXPIRE_KIDNEYS` automatically transitions unallocated kidneys past their expiration window from `AVAILABLE` to `EXPIRED` and logs an audit record.

---

## Business Rule 5 (BR5): Comprehensive & Immutable Audit Logging

### Rule Statement:
> Every significant clinical, inventory, and allocation event must generate an immutable, timestamped audit log entry capturing the acting user, entity ID, action type, timestamp, and clinical rationale.

### Audited Actions:
1. `DONOR_REGISTRATION`: Initial registration of living/deceased donor.
2. `ORGAN_RETRIEVAL`: Procurement and inventory registration of kidney.
3. `CREATE_OFFER`: Coordinator generates allocation offer for top-ranked candidate.
4. `OFFER_ACCEPTED`: Surgeon accepts offer; transitions organ to `ALLOCATED` and patient to `TRANSPLANTED`.
5. `OFFER_DECLINED`: Surgeon declines offer with clinical justification; organ returns to pool.
6. `BATCH_EXPIRE_KIDNEYS`: Background job marks expired organs.

### Database & Application Enforcement:
- Managed via `AUDIT_LOG` table and automated trigger `TRG_AUDIT_ALLOCATION_STATUS`.
- Audit records have no `DELETE` or `UPDATE` pathways in normal application APIs; the table is strictly append-only.
- Regulators and auditors have read-only view access to all audit records and decision reasons.
