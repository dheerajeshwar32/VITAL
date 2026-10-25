import { 
  HealthStatus, SystemSummary, Hospital, Donor, Recipient, Organ, 
  Allocation, KidneyMatchReport, AuditLog, SqlReviewResult, AcidTestResult, User 
} from './types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorDetail = 'API request failed';
    try {
      const err = await response.json();
      errorDetail = err.detail || JSON.stringify(err);
    } catch {
      errorDetail = `${response.status} ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Health & Summary
  getHealth: () => request<HealthStatus>('/health'),
  getSummary: () => request<SystemSummary>('/reports/summary'),

  // Hospitals
  getHospitals: () => request<Hospital[]>('/hospitals'),
  createHospital: (data: Omit<Hospital, 'hospital_id'>) => request<Hospital>('/hospitals', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Donors
  getDonors: () => request<Donor[]>('/donors'),
  createDonor: (data: Omit<Donor, 'donor_id' | 'hospital_name' | 'reg_date'>) => request<Donor>('/donors', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Recipients
  getRecipients: () => request<Recipient[]>('/recipients'),
  createRecipient: (data: Omit<Recipient, 'recipient_id' | 'hospital_name' | 'listed_on' | 'waiting_days'>) => request<Recipient>('/recipients', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Organs
  getOrgans: (status?: string) => request<Organ[]>(`/organs${status ? `?status=${status}` : ''}`),
  registerKidney: (data: { donor_id: number; organ_type: 'KIDNEY'; viable_hours: number; current_hospital_id: number }) => request<Organ>('/organs', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  batchExpireKidneys: () => request<{ status: string; expired_count: number; message: string }>('/organs/batch-expire', {
    method: 'POST',
  }),

  // Matching
  getMatches: (organId: number) => request<KidneyMatchReport>(`/matching/${organId}`),

  // Allocations
  getAllocations: (status?: string) => request<Allocation[]>(`/allocations${status ? `?status=${status}` : ''}`),
  createOffer: (organ_id: number, recipient_id: number, approved_by?: string) => request<Allocation>('/allocations', {
    method: 'POST',
    body: JSON.stringify({ organ_id, recipient_id, approved_by: approved_by || 'coord_chennai' }),
  }),
  respondOffer: (alloc_id: number, decision: 'ACCEPTED' | 'DECLINED', decision_reason: string, reviewer: string) => request<Allocation>(`/allocations/${alloc_id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ decision, decision_reason, reviewer }),
  }),

  // Audit Logs
  getAuditLogs: (entityType?: string, action?: string) => {
    const params = new URLSearchParams();
    if (entityType) params.append('entity_type', entityType);
    if (action) params.append('action', action);
    const query = params.toString();
    return request<AuditLog[]>(`/audit${query ? `?${query}` : ''}`);
  },

  // Review SQL/PLSQL Demonstrations
  getReview1: () => request<SqlReviewResult[]>('/reviews/review1'),
  getReview2: () => request<SqlReviewResult[]>('/reviews/review2'),

  // ACID Tests
  getAcidTests: () => request<AcidTestResult[]>('/acid/run'),

  // Users & Auth
  getUsers: () => request<User[]>('/auth/users'),
  login: (username: string, password: string) => request<User>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),
};
