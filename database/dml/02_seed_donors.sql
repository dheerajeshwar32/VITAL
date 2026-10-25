-- =============================================================================
-- VITAL: Seed Data - Kidney Donors
-- Synthetic donor identities representing living and deceased clinical profiles
-- =============================================================================

INSERT INTO DONOR (donor_id, hospital_id, full_name, age, blood_group, hla_type, donor_type, reg_date, consent_status, evaluation_status, verification_status)
VALUES (201, 101, 'Donor Ref-K201 (Deceased)', 34, 'O+', 'A2-B7-DR4', 'DECEASED', SYSDATE - 5, 'CONSENTED', 'COMPLETED', 'VERIFIED');

INSERT INTO DONOR (donor_id, hospital_id, full_name, age, blood_group, hla_type, donor_type, reg_date, consent_status, evaluation_status, verification_status)
VALUES (202, 102, 'Donor Ref-K202 (Living)', 42, 'A+', 'A1-B8-DR3', 'LIVING', SYSDATE - 12, 'CONSENTED', 'COMPLETED', 'VERIFIED');

INSERT INTO DONOR (donor_id, hospital_id, full_name, age, blood_group, hla_type, donor_type, reg_date, consent_status, evaluation_status, verification_status)
VALUES (203, 104, 'Donor Ref-K203 (Deceased)', 28, 'B+', 'A24-B44-DR7', 'DECEASED', SYSDATE - 2, 'CONSENTED', 'COMPLETED', 'VERIFIED');

INSERT INTO DONOR (donor_id, hospital_id, full_name, age, blood_group, hla_type, donor_type, reg_date, consent_status, evaluation_status, verification_status)
VALUES (204, 103, 'Donor Ref-K204 (Living)', 50, 'AB+', 'A3-B35-DR15', 'LIVING', SYSDATE - 20, 'CONSENTED', 'COMPLETED', 'VERIFIED');

INSERT INTO DONOR (donor_id, hospital_id, full_name, age, blood_group, hla_type, donor_type, reg_date, consent_status, evaluation_status, verification_status)
VALUES (205, 105, 'Donor Ref-K205 (Deceased)', 61, 'O-', 'A2-B44-DR4', 'DECEASED', SYSDATE - 1, 'CONSENTED', 'COMPLETED', 'VERIFIED');

INSERT INTO DONOR (donor_id, hospital_id, full_name, age, blood_group, hla_type, donor_type, reg_date, consent_status, evaluation_status, verification_status)
VALUES (206, 101, 'Donor Ref-K206 (Pending Eval)', 39, 'A-', 'A11-B51-DR1', 'DECEASED', SYSDATE - 3, 'CONSENTED', 'PENDING', 'PENDING');

INSERT INTO DONOR (donor_id, hospital_id, full_name, age, blood_group, hla_type, donor_type, reg_date, consent_status, evaluation_status, verification_status)
VALUES (207, 104, 'Donor Ref-K207 (Deceased)', 45, 'B-', 'A2-B18-DR11', 'DECEASED', SYSDATE - 8, 'CONSENTED', 'COMPLETED', 'VERIFIED');

COMMIT;
