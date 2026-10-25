-- =============================================================================
-- VITAL: Seed Data - Transplant Recipients (Kidney Waiting List)
-- =============================================================================

INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
VALUES (301, 101, 'Patient Rec-R301', 48, 'O+', 'A2-B7-DR4', 5, 'WAITING', SYSDATE - 180, 'ELIGIBLE');

INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
VALUES (302, 102, 'Patient Rec-R302', 36, 'O+', 'A2-B8-DR4', 4, 'WAITING', SYSDATE - 90, 'ELIGIBLE');

INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
VALUES (303, 104, 'Patient Rec-R303', 55, 'A+', 'A1-B8-DR3', 4, 'WAITING', SYSDATE - 240, 'ELIGIBLE');

INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
VALUES (304, 103, 'Patient Rec-R304', 29, 'B+', 'A24-B44-DR7', 3, 'WAITING', SYSDATE - 60, 'ELIGIBLE');

INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
VALUES (305, 105, 'Patient Rec-R305', 62, 'AB+', 'A3-B35-DR15', 2, 'WAITING', SYSDATE - 320, 'ELIGIBLE');

INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
VALUES (306, 101, 'Patient Rec-R306', 41, 'A-', 'A1-B8-DR4', 3, 'WAITING', SYSDATE - 110, 'ELIGIBLE');

INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
VALUES (307, 102, 'Patient Rec-R307', 50, 'O-', 'A2-B44-DR4', 5, 'WAITING', SYSDATE - 400, 'ELIGIBLE');

INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
VALUES (308, 104, 'Patient Rec-R308', 33, 'B-', 'A2-B18-DR11', 1, 'WAITING', SYSDATE - 45, 'ELIGIBLE');

INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
VALUES (309, 103, 'Patient Rec-R309 (Review Required)', 47, 'O+', 'A2-B7-DR15', 4, 'WAITING', SYSDATE - 80, 'PENDING_REVIEW');

INSERT INTO RECIPIENT (recipient_id, hospital_id, full_name, age, blood_group, hla_type, urgency, status, listed_on, eligibility_status)
VALUES (310, 105, 'Patient Rec-R310 (Inactive)', 59, 'A+', 'A1-B35-DR3', 2, 'INACTIVE', SYSDATE - 500, 'INELIGIBLE');

COMMIT;
