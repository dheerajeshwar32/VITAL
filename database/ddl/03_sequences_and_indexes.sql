-- =============================================================================
-- VITAL: Performance Indexes and Sequences
-- Optimizes Join Filters, Status Queries, and Foreign Key Integrity
-- =============================================================================

-- Indexes on Foreign Keys (Recommended Oracle best practice to prevent table locking during parent DML)
CREATE INDEX idx_fk_donor_hospital ON DONOR(hospital_id);
CREATE INDEX idx_fk_recipient_hospital ON RECIPIENT(hospital_id);
CREATE INDEX idx_fk_organ_donor ON ORGAN(donor_id);
CREATE INDEX idx_fk_organ_hospital ON ORGAN(current_hospital_id);
CREATE INDEX idx_fk_alloc_organ ON ALLOCATION(organ_id);
CREATE INDEX idx_fk_alloc_recipient ON ALLOCATION(recipient_id);
CREATE INDEX idx_fk_audit_alloc ON AUDIT_LOG(alloc_id);

-- Performance Composite & Filter Indexes for Kidney Matching Engine
CREATE INDEX idx_organ_status_expiry ON ORGAN(status, expiry_time);
CREATE INDEX idx_recipient_match_filter ON RECIPIENT(status, eligibility_status, blood_group);
CREATE INDEX idx_recipient_urgency_list ON RECIPIENT(urgency DESC, listed_on ASC);
CREATE INDEX idx_audit_action_time ON AUDIT_LOG(action_time DESC);
CREATE INDEX idx_alloc_status ON ALLOCATION(status);
