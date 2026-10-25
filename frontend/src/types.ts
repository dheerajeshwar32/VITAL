export interface Hospital {
  hospital_id: number;
  name: string;
  city: string;
  is_center: 'Y' | 'N';
  contact_information?: string;
}

export interface Donor {
  donor_id: number;
  hospital_id: number;
  full_name: string;
  age: number;
  blood_group: string;
  hla_type: string;
  donor_type: 'LIVING' | 'DECEASED';
  reg_date?: string;
  consent_status: 'CONSENTED' | 'WITHDRAWN' | 'PENDING';
  evaluation_status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  verification_status: 'PENDING' | 'VERIFIED' | 'FAILED';
  hospital_name?: string;
}

export interface Recipient {
  recipient_id: number;
  hospital_id: number;
  full_name: string;
  age: number;
  blood_group: string;
  hla_type: string;
  urgency: number; // 1 to 5
  status: 'WAITING' | 'MATCHED' | 'TRANSPLANTED' | 'INACTIVE' | 'SUSPENDED';
  listed_on?: string;
  waiting_days?: number;
  eligibility_status: 'ELIGIBLE' | 'INELIGIBLE' | 'PENDING_REVIEW';
  hospital_name?: string;
}

export interface Organ {
  organ_id: number;
  donor_id: number;
  organ_type: 'KIDNEY';
  viable_hours: number;
  available_since?: string;
  expiry_time?: string;
  status: 'AVAILABLE' | 'OFFERED' | 'ALLOCATED' | 'EXPIRED' | 'DISCARDED';
  current_hospital_id: number;
  donor_name?: string;
  donor_blood_group?: string;
  donor_hla?: string;
  donor_type?: string;
  hospital_name?: string;
  hours_remaining?: number;
  is_expired?: boolean;
}

export interface Allocation {
  alloc_id: number;
  organ_id: number;
  recipient_id: number;
  match_score: number;
  status: 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';
  alloc_date?: string;
  response_time?: string;
  decision_reason?: string;
  approved_by?: string;
  organ_status?: string;
  donor_id?: number;
  donor_blood?: string;
  recipient_name?: string;
  recipient_blood?: string;
  recipient_urgency?: number;
  donor_hospital?: string;
  recipient_hospital?: string;
}

export interface CandidateMatch {
  recipient_id: number;
  recipient_name: string;
  blood_group: string;
  urgency: number;
  waiting_days: number;
  hla_type: string;
  hospital_name: string;
  hospital_id: number;
  abo_compatibility: string;
  urgency_points: number;
  seniority_points: number;
  abo_bonus_points: number;
  hla_proximity_points: number;
  total_match_score: number;
  eligibility_status: string;
  is_eligible: boolean;
  exclusion_reason?: string;
}

export interface KidneyMatchReport {
  organ_id: number;
  donor_id: number;
  donor_name: string;
  donor_blood_group: string;
  donor_hla: string;
  organ_status: string;
  hours_remaining: number;
  is_expired: boolean;
  retrieval_hospital: string;
  ranked_candidates: CandidateMatch[];
}

export interface AuditLog {
  log_id: number;
  alloc_id?: number;
  action: string;
  action_time: string;
  user_id?: string;
  entity_type: string;
  entity_id?: number;
  operation_result: string;
  details?: string;
}

export interface SqlReviewResult {
  rubric_item: string;
  title: string;
  description: string;
  sql_text: string;
  columns: string[];
  rows: Record<string, any>[];
  explanation: string;
}

export interface AcidTestResult {
  test_name: string;
  category: string;
  description: string;
  pre_state: Record<string, any>;
  post_state: Record<string, any>;
  sql_executed: string;
  outcome: string;
  message: string;
  duration_ms: number;
}

export interface SystemSummary {
  kpi: {
    total_donors: number;
    total_recipients: number;
    waiting_recipients: number;
    total_organs: number;
    available_kidneys: number;
    expired_kidneys: number;
    total_allocations: number;
    pending_offers: number;
    accepted_offers: number;
    declined_offers: number;
    completed_allocations: number;
    total_audit_logs: number;
  };
  urgency_distribution: { urgency: number; patient_count: number }[];
  available_organs_by_bg: { blood_group: string; organ_count: number }[];
  waiting_recipients_by_bg: { blood_group: string; patient_count: number }[];
  center_activity: {
    hospital_id: number;
    name: string;
    city: string;
    donors_registered: number;
    waiting_patients: number;
    kidneys_procured: number;
  }[];
}

export interface User {
  user_id: string;
  full_name: string;
  role: 'TRANSPLANT_COORDINATOR' | 'HOSPITAL_ADMINISTRATOR' | 'TRANSPLANT_SURGEON' | 'REGULATOR_AUDITOR';
  hospital_id?: number;
  email: string;
  token?: string;
}

export interface HealthStatus {
  status: string;
  project: string;
  version: string;
  database: {
    driver: string;
    oracle_connected: boolean;
    oracle_dsn: string;
    oracle_user: string;
    error_message?: string;
    mirror_active: boolean;
    counts: Record<string, number>;
  };
}
