-- =============================================================================
-- VITAL: Seed Data - Hospitals & Transplant Centers
-- =============================================================================

INSERT INTO HOSPITAL (hospital_id, name, city, is_center, contact_information)
VALUES (101, 'Apollo Speciality Transplant Institute', 'Chennai', 'Y', 'organs@apollo-chennai.org | +91 44 2829 0200');

INSERT INTO HOSPITAL (hospital_id, name, city, is_center, contact_information)
VALUES (102, 'AIIMS Organ Retrieval and Banking Org', 'New Delhi', 'Y', 'orbo@aiims.edu | +91 11 2658 8500');

INSERT INTO HOSPITAL (hospital_id, name, city, is_center, contact_information)
VALUES (103, 'Fortis Memorial Research Institute', 'Gurugram', 'Y', 'transplant@fortis.com | +91 124 492 1021');

INSERT INTO HOSPITAL (hospital_id, name, city, is_center, contact_information)
VALUES (104, 'Manipal Comprehensive Kidney Center', 'Bengaluru', 'Y', 'kidney@manipal.edu | +91 80 2502 4444');

INSERT INTO HOSPITAL (hospital_id, name, city, is_center, contact_information)
VALUES (105, 'King Edward Memorial Regional Hospital', 'Mumbai', 'Y', 'kemtransplant@mcgm.gov.in | +91 22 2410 7000');

INSERT INTO HOSPITAL (hospital_id, name, city, is_center, contact_information)
VALUES (106, 'Coimbatore District Healthcare Facility', 'Coimbatore', 'N', 'admin@coimbatore-health.org | +91 422 230 1122');

-- Seed Authorized System Users for Each Role
-- Password hash corresponds to 'VitalSecure2026!'
INSERT INTO APP_USER (user_id, password_hash, full_name, role, hospital_id, email, is_active, created_at)
VALUES ('coord_chennai', '$2b$12$K8y43kR7xG8mKxQ2tPZ2Ou8K.32sB2vHnQvL7WlU5mYwQzR1G6e3y', 'Dr. Radhika Raman (Coordinator)', 'TRANSPLANT_COORDINATOR', 101, 'radhika.raman@apollo-chennai.org', 'Y', SYSDATE);

INSERT INTO APP_USER (user_id, password_hash, full_name, role, hospital_id, email, is_active, created_at)
VALUES ('admin_aiims', '$2b$12$K8y43kR7xG8mKxQ2tPZ2Ou8K.32sB2vHnQvL7WlU5mYwQzR1G6e3y', 'Arjun Verma (Hospital Admin)', 'HOSPITAL_ADMINISTRATOR', 102, 'admin.verma@aiims.edu', 'Y', SYSDATE);

INSERT INTO APP_USER (user_id, password_hash, full_name, role, hospital_id, email, is_active, created_at)
VALUES ('surgeon_manipal', '$2b$12$K8y43kR7xG8mKxQ2tPZ2Ou8K.32sB2vHnQvL7WlU5mYwQzR1G6e3y', 'Dr. Sandeep Hegde (Chief Surgeon)', 'TRANSPLANT_SURGEON', 104, 'sandeep.hegde@manipal.edu', 'Y', SYSDATE);

INSERT INTO APP_USER (user_id, password_hash, full_name, role, hospital_id, email, is_active, created_at)
VALUES ('auditor_national', '$2b$12$K8y43kR7xG8mKxQ2tPZ2Ou8K.32sB2vHnQvL7WlU5mYwQzR1G6e3y', 'Priya Kulkarni (National Regulator)', 'REGULATOR_AUDITOR', 102, 'auditor@notto.gov.in', 'Y', SYSDATE);

COMMIT;
