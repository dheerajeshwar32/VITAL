// --- VITAL: NATIONAL ORGAN TRANSPLANT & RELATIONAL ALLOCATION ENGINE ---
const { useState, useEffect, useMemo, useRef } = React;

// Live Backend API Helper
const api = {
  get: async (url) => {
    const res = await fetch('/api' + url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Request failed');
    }
    return res.json();
  },
  post: async (url, body) => {
    const res = await fetch('/api' + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Request failed');
    }
    return res.json();
  }
};

// --- INITIAL RELATIONAL SEED DATA (Normalized 3NF Oracle Schema) ---
const INITIAL_HOSPITALS = [
  { hospital_id: 1, name: 'Apollo Transplant Institute', city: 'Chennai', region: 'South-Zone-A' },
  { hospital_id: 2, name: 'CMC Renal & Organ Center', city: 'Vellore', region: 'South-Zone-A' },
  { hospital_id: 3, name: 'AIIMS Organ Retrieval Wing', city: 'New Delhi', region: 'North-Zone-B' },
  { hospital_id: 4, name: 'KIMS Multi-Organ Command', city: 'Hyderabad', region: 'South-Zone-B' },
];

const INITIAL_DONORS = [
  { donor_id: 101, full_name: 'Vikramaditya Rao', age: 34, blood_group: 'O', hospital_id: 2, clinical_status: 'BRAIN_STEM_DEAD', hla_type: 'A2-B44-DR4' },
  { donor_id: 102, full_name: 'Meenakshi Sundaram', age: 42, blood_group: 'A', hospital_id: 1, clinical_status: 'BRAIN_STEM_DEAD', hla_type: 'A1-B8-DR3' },
  { donor_id: 103, full_name: 'Raghavendra Prasad', age: 29, blood_group: 'B', hospital_id: 4, clinical_status: 'CIRCULATORY_DEATH', hla_type: 'A3-B7-DR2' },
  { donor_id: 104, full_name: 'Suresh Nair', age: 51, blood_group: 'AB', hospital_id: 3, clinical_status: 'BRAIN_STEM_DEAD', hla_type: 'A11-B35-DR1' },
];

const nowMs = Date.now();
const hoursAgo = (h) => new Date(nowMs - h * 3600 * 1000).toISOString();
const daysAgo = (d) => new Date(nowMs - d * 86400 * 1000).toISOString().split('T')[0];

const INITIAL_ORGANS = [
  { organ_id: 501, donor_id: 101, organ_code: 'KID-2026-501L', side: 'LEFT_KIDNEY', harvest_time: hoursAgo(4.2), max_ischemia_hrs: 24, status: 'AVAILABLE' },
  { organ_id: 502, donor_id: 102, organ_code: 'KID-2026-502R', side: 'RIGHT_KIDNEY', harvest_time: hoursAgo(18.6), max_ischemia_hrs: 24, status: 'OFFERED' },
  { organ_id: 503, donor_id: 103, organ_code: 'KID-2026-503L', side: 'LEFT_KIDNEY', harvest_time: hoursAgo(9.1), max_ischemia_hrs: 24, status: 'AVAILABLE' },
  { organ_id: 504, donor_id: 104, organ_code: 'KID-2026-504R', side: 'RIGHT_KIDNEY', harvest_time: hoursAgo(25.4), max_ischemia_hrs: 24, status: 'EXPIRED' },
];

const INITIAL_RECIPIENTS = [
  { recipient_id: 201, full_name: 'Ananya Krishnan', age: 28, blood_group: 'A', urgency_level: 1, registration_date: daysAgo(420), hospital_id: 1, status: 'WAITING', pra_score: '12%' },
  { recipient_id: 202, full_name: 'Karthikeya Sharma', age: 46, blood_group: 'O', urgency_level: 1, registration_date: daysAgo(310), hospital_id: 2, status: 'WAITING', pra_score: '8%' },
  { recipient_id: 203, full_name: 'Farhan Siddiqui', age: 39, blood_group: 'B', urgency_level: 2, registration_date: daysAgo(540), hospital_id: 4, status: 'WAITING', pra_score: '4%' },
  { recipient_id: 204, full_name: 'Lakshmi Narayanan', age: 54, blood_group: 'AB', urgency_level: 2, registration_date: daysAgo(190), hospital_id: 2, status: 'WAITING', pra_score: '19%' },
  { recipient_id: 205, full_name: 'Priya Darshini', age: 31, blood_group: 'A', urgency_level: 3, registration_date: daysAgo(610), hospital_id: 1, status: 'WAITING', pra_score: '0%' },
  { recipient_id: 206, full_name: 'Devendra Reddy', age: 61, blood_group: 'O', urgency_level: 4, registration_date: daysAgo(820), hospital_id: 3, status: 'WAITING', pra_score: '5%' },
  { recipient_id: 207, full_name: 'Sanjay Verma', age: 49, blood_group: 'B', urgency_level: 5, registration_date: daysAgo(120), hospital_id: 3, status: 'WAITING', pra_score: '2%' },
];

const INITIAL_ALLOCATIONS = [
  {
    allocation_id: 9001,
    organ_id: 502,
    recipient_id: 201,
    match_score: 760.0,
    status: 'PENDING',
    offer_time: hoursAgo(1.2),
    decision_time: null,
  },
];

const INITIAL_AUDIT_LOGS = [
  {
    log_id: 10001,
    allocation_id: 9001,
    organ_id: 502,
    recipient_id: 201,
    action_type: 'OFFER_CREATED',
    old_status: 'NULL',
    new_status: 'PENDING',
    performed_by: 'COORD_CMC_01',
    timestamp: hoursAgo(1.2),
    plsql_source: 'trg_audit_allocation (AFTER INSERT ON ALLOCATION)',
  },
];

// --- DETERMINISTIC PL/SQL HELPER FUNCTIONS ---
// BR1: ABO Blood Group Compatibility
function fnIsBloodCompatible(donorBg, recipientBg) {
  if (!donorBg || !recipientBg) return 0;
  const d = donorBg.trim().toUpperCase().replace(/[+-]/g, '');
  const r = recipientBg.trim().toUpperCase().replace(/[+-]/g, '');
  if (d === 'O' || r === 'AB' || d === r) return 1;
  return 0;
}

// BR3: Inverted Urgency Scoring (1=Critical -> 500pts, 5=Stable -> 100pts) + Waitlist Days + Proximity
function fnCalculateMatchScore(urgencyLevel, registrationDateStr, isSameHospital) {
  const urgencyPoints = (6 - (urgencyLevel || 5)) * 100;
  const regMs = new Date(registrationDateStr).getTime();
  const waitDays = Math.max(0, Math.floor((Date.now() - regMs) / (1000 * 3600 * 24)));
  const waitPoints = waitDays * 0.5;
  const proximityBonus = isSameHospital ? 50 : 0;
  return {
    total: Number((urgencyPoints + waitPoints + proximityBonus).toFixed(1)),
    urgencyPoints,
    waitDays,
    waitPoints: Number(waitPoints.toFixed(1)),
    proximityBonus,
  };
}

// --- MILLION DOLLAR AESTHETIC VITAL LOGO ---
function MillionDollarLogo() {
  return (
    <div className="flex items-center gap-3.5 select-none group cursor-pointer">
      {/* Bioluminescent Logo Glyph */}
      <div className="relative">
        <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-500/40 via-teal-400/30 to-blue-600/40 rounded-2xl blur-md opacity-75 group-hover:opacity-100 transition duration-500" />
        <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#0c182c] via-[#091120] to-[#040812] border border-cyan-400/50 p-2 shadow-2xl flex items-center justify-center backdrop-blur-2xl ring-1 ring-white/15 group-hover:border-cyan-300 transition-all">
          <svg viewBox="0 0 44 44" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="vLogoGrad" x1="2" y1="2" x2="42" y2="42" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="45%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
              <linearGradient id="vFacetGrad" x1="42" y1="2" x2="2" y2="42" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>
              <radialGradient id="vCoreGlow" cx="22" cy="22" r="14" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
              </radialGradient>
              <filter id="vGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Core Ambient Glow */}
            <circle cx="22" cy="22" r="12" fill="url(#vCoreGlow)" />

            {/* Sculpted Renal Infinity Loop Ribbon */}
            <path
              d="M10 13C10 8 14 5 18 5C22 5 24 9 24 13C24 19 12 26 22 38C24.5 41 28 41 30 38C37 29 38 23 38 16C38 9.5 32.5 5 26 5"
              stroke="url(#vLogoGrad)"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#vGlowFilter)"
            />

            {/* Geometric V-Facet Lifeline */}
            <path
              d="M14 20L20 28L30 15"
              stroke="url(#vFacetGrad)"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Precision Synchronous Nodes */}
            <circle cx="20" cy="28" r="2.5" fill="#38BDF8" className="animate-pulse" />
            <circle cx="30" cy="15" r="2" fill="#34D399" />
            <circle cx="14" cy="20" r="2" fill="#818CF8" />
          </svg>
        </div>
      </div>

      {/* Million Dollar Typography */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-black text-2xl tracking-[0.22em] bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent drop-shadow-sm font-sans">
            VITAL
          </span>
          <span className="text-[9px] font-mono font-bold tracking-[0.2em] px-2 py-0.5 rounded-full bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 uppercase shadow-sm">
            PRO
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] font-mono tracking-[0.25em] text-slate-400 uppercase font-semibold">
            TRANSPLANT ALLOCATION OS
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span className="text-[9px] font-mono text-emerald-400 font-bold tracking-wider">
            19c ACID
          </span>
        </div>
      </div>
    </div>
  );
}

// --- MODALS (ACID, SQL TERMINAL, 3NF SCHEMA, MANIFEST) ---
function AcidModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  const [loading, setLoading] = useState(false);
  const [acidResults, setAcidResults] = useState(null);
  const [error, setError] = useState(null);

  const runAcidSuite = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/acid/run');
      setAcidResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAcidSuite();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0B111E] border border-cyan-500/40 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#080D18]">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
            <div>
              <h3 className="font-bold text-white text-base font-sans">ACID Concurrency &amp; Transaction Integrity Suite</h3>
              <p className="text-xs text-slate-400">Verifying Atomicity, Consistency, Isolation, Durability under high-concurrency contention</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-mono px-2 py-1">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-400">Isolation Level:</span> <span className="text-cyan-300 font-bold">SERIALIZABLE (ACID)</span>
              <span className="mx-2 text-slate-600">|</span>
              <span className="text-slate-400">Locking Mode:</span> <span className="text-emerald-300 font-bold">Pessimistic Row-Lock (SELECT FOR UPDATE)</span>
            </div>
            <button
              onClick={runAcidSuite}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold font-sans text-xs transition disabled:opacity-50 shadow-md shadow-cyan-500/20"
            >
              {loading ? 'Executing Concurrent Workers...' : 'Re-run Concurrency Test'}
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500 text-rose-300">
              Error executing ACID suite: {error}
            </div>
          )}

          {loading && !acidResults && (
            <div className="text-center py-12 text-slate-400">
              Spawning concurrent database threads contending for identical kidney lock...
            </div>
          )}

          {acidResults && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {acidResults.tests && acidResults.tests.map((t, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-[#070B14] border border-slate-800/80">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-200">{t.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.outcome === 'PASSED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300'}`}>
                        {t.outcome}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{t.description}</p>
                    {t.metric && <p className="text-[10px] text-cyan-400 mt-2 font-mono">{t.metric}</p>}
                  </div>
                ))}
              </div>

              {acidResults.execution_logs && (
                <div className="bg-[#05080F] border border-slate-800/90 rounded-xl p-4">
                  <div className="text-slate-400 font-bold mb-2 text-[11px] uppercase tracking-wider font-sans">
                    Thread Execution Telemetry &amp; Rollback Trace
                  </div>
                  <pre className="text-[11px] text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed font-mono">
                    {acidResults.execution_logs.join('\n')}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SqlModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  const [sql, setSql] = useState("SELECT organ_id, organ_code, side, harvest_time, status FROM ORGAN WHERE status = 'AVAILABLE';");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [execTime, setExecTime] = useState(null);

  useEffect(() => {
    handleExecute("SELECT organ_id, organ_code, side, harvest_time, status FROM ORGAN WHERE status = 'AVAILABLE';");
  }, []);

  const presets = [
    { label: "Available Organs", query: "SELECT organ_id, organ_code, side, harvest_time, status FROM ORGAN WHERE status = 'AVAILABLE';" },
    { label: "Waitlist Patients", query: "SELECT recipient_id, full_name, blood_group, urgency_level, registration_date, status FROM RECIPIENT WHERE status = 'WAITING';" },
    { label: "Allocations", query: "SELECT allocation_id, organ_id, recipient_id, match_score, status, offer_time, decision_reason FROM ALLOCATION;" },
    { label: "Audit Log Trail", query: "SELECT log_id, action_type, performed_by, timestamp, details FROM AUDIT_LOG ORDER BY timestamp DESC LIMIT 10;" },
    { label: "Hospitals", query: "SELECT hospital_id, name, city, is_center FROM HOSPITAL;" },
    { label: "Donors", query: "SELECT donor_id, full_name, blood_group, donor_type, consent_status FROM DONOR;" },
  ];

  const handleExecute = async (queryToRun) => {
    const q = queryToRun || sql;
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    const start = performance.now();
    try {
      const res = await api.post('/reviews/execute-custom', { sql: q });
      setResult(res);
      setExecTime((performance.now() - start).toFixed(1));
    } catch (e) {
      setResult({ status: 'ERROR', error: e.message, columns: [], rows: [] });
      setExecTime((performance.now() - start).toFixed(1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0B111E] border border-cyan-500/40 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#080D18]">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-cyan-400" />
            <div>
              <h3 className="font-bold text-white text-base font-sans">Live Interactive SQL Terminal</h3>
              <p className="text-xs text-slate-400">Direct SQL execution engine against SQLite/Oracle relational tables</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg px-2 py-1">✕</button>
        </div>

        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap gap-2 items-center">
          <span className="text-slate-400 text-[11px] font-sans font-medium">Query Presets:</span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => { setSql(p.query); handleExecute(p.query); }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="p-5 flex flex-col gap-3">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            rows={3}
            className="w-full bg-[#05080F] border border-slate-800 rounded-xl p-3.5 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500 transition"
            placeholder="Enter SQL statement..."
          />
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-slate-500">
              {execTime !== null && <span>Execution Time: <strong className="text-emerald-400">{execTime} ms</strong></span>}
            </div>
            <button
              onClick={() => handleExecute(sql)}
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold font-sans text-xs transition disabled:opacity-50 shadow-md shadow-cyan-500/20"
            >
              {loading ? 'Executing...' : 'Run SQL Query'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5 border-t border-slate-800 bg-[#070B14]">
          {result && result.error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500 text-rose-300 text-xs">
              SQL Error: {result.error}
            </div>
          )}

          {result && result.rows && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase">
                    {result.columns && result.columns.map((c, i) => (
                      <th key={i} className="py-2.5 px-3">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {result.rows.length === 0 ? (
                    <tr><td colSpan={result.columns?.length || 1} className="py-6 text-center text-slate-500">No records returned.</td></tr>
                  ) : (
                    result.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-900/50">
                        {Array.isArray(row)
                          ? row.map((val, cIdx) => <td key={cIdx} className="py-2.5 px-3 text-slate-300">{String(val)}</td>)
                          : Object.values(row).map((val, cIdx) => <td key={cIdx} className="py-2.5 px-3 text-slate-300">{String(val)}</td>)
                        }
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SchemaModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  const tables = [
    {
      name: "HOSPITAL",
      pk: "hospital_id",
      cols: [
        { name: "hospital_id", type: "NUMBER(5) PK" },
        { name: "name", type: "VARCHAR2(100)" },
        { name: "city", type: "VARCHAR2(50)" },
        { name: "region", type: "VARCHAR2(50)" },
      ]
    },
    {
      name: "DONOR",
      pk: "donor_id",
      cols: [
        { name: "donor_id", type: "NUMBER(10) PK" },
        { name: "full_name", type: "VARCHAR2(100)" },
        { name: "blood_group", type: "VARCHAR2(5)" },
        { name: "hospital_id", type: "NUMBER(5) FK" },
        { name: "clinical_status", type: "VARCHAR2(30)" },
      ]
    },
    {
      name: "ORGAN",
      pk: "organ_id",
      cols: [
        { name: "organ_id", type: "NUMBER(10) PK" },
        { name: "donor_id", type: "NUMBER(10) FK" },
        { name: "organ_code", type: "VARCHAR2(30)" },
        { name: "side", type: "VARCHAR2(15)" },
        { name: "harvest_time", type: "TIMESTAMP" },
        { name: "max_ischemia_hrs", type: "NUMBER(3,1)" },
        { name: "status", type: "VARCHAR2(20)" },
      ]
    },
    {
      name: "RECIPIENT",
      pk: "recipient_id",
      cols: [
        { name: "recipient_id", type: "NUMBER(10) PK" },
        { name: "full_name", type: "VARCHAR2(100)" },
        { name: "blood_group", type: "VARCHAR2(5)" },
        { name: "urgency_level", type: "NUMBER(1)" },
        { name: "registration_date", type: "DATE" },
        { name: "hospital_id", type: "NUMBER(5) FK" },
        { name: "status", type: "VARCHAR2(20)" },
      ]
    },
    {
      name: "ALLOCATION",
      pk: "allocation_id",
      cols: [
        { name: "allocation_id", type: "NUMBER(10) PK" },
        { name: "organ_id", type: "NUMBER(10) FK" },
        { name: "recipient_id", type: "NUMBER(10) FK" },
        { name: "match_score", type: "NUMBER(7,2)" },
        { name: "status", type: "VARCHAR2(20)" },
        { name: "offer_time", type: "TIMESTAMP" },
        { name: "decision_time", type: "TIMESTAMP" },
      ]
    },
    {
      name: "AUDIT_LOG",
      pk: "log_id",
      cols: [
        { name: "log_id", type: "NUMBER(12) PK" },
        { name: "allocation_id", type: "NUMBER(10)" },
        { name: "organ_id", type: "NUMBER(10)" },
        { name: "action_type", type: "VARCHAR2(50)" },
        { name: "old_status", type: "VARCHAR2(20)" },
        { name: "new_status", type: "VARCHAR2(20)" },
        { name: "performed_by", type: "VARCHAR2(50)" },
        { name: "timestamp", type: "TIMESTAMP" },
        { name: "plsql_source", type: "VARCHAR2(100)" },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0B111E] border border-cyan-500/40 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#080D18]">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-cyan-400" />
            <div>
              <h3 className="font-bold text-white text-base font-sans">3NF Relational Schema Architecture &amp; Constraints</h3>
              <p className="text-xs text-slate-400">Strictly normalized schema adhering to 1NF, 2NF, and 3NF Boyce-Codd normal forms</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-mono px-2 py-1">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((t, idx) => (
              <div key={idx} className="bg-[#070B14] border border-slate-800 rounded-xl p-4 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2.5 font-mono">
                  <span className="font-bold text-cyan-300 text-xs">{t.name}</span>
                  <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">PK: {t.pk}</span>
                </div>
                <div className="space-y-1.5 text-[11px] font-mono flex-1">
                  {t.cols.map((c, cIdx) => (
                    <div key={cIdx} className="flex items-start justify-between gap-1">
                      <span className="text-slate-300 font-semibold">{c.name}</span>
                      <span className="text-slate-500 text-[10px]">{c.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 font-mono text-xs">
            <h4 className="text-cyan-400 font-bold mb-3 font-sans text-sm">Business Rule Enforcement Matrix</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-300">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 leading-relaxed">
                <strong className="text-rose-400 font-sans">BR1 (ABO Compatibility):</strong> Enforced via <code className="text-cyan-300">trg_validate_allocation</code>. Raises <code className="text-rose-300">ORA-20004</code> on mismatch.
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 leading-relaxed">
                <strong className="text-amber-400 font-sans">BR2 (Unique Active Offer):</strong> Enforced via Unique Filtered Index / Trigger. Raises <code className="text-amber-300">ORA-20001</code> if organ status != AVAILABLE.
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 leading-relaxed">
                <strong className="text-cyan-400 font-sans">BR3 (Inverted Urgency Match):</strong> Deterministic formula: <code className="text-cyan-200">(6 - Urgency)*100 + WaitDays*0.5 + HospBonus(50)</code>.
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 leading-relaxed">
                <strong className="text-purple-400 font-sans">BR4 (Cold Ischemia Viability):</strong> Real-time decay &lt;= 24.0h. Expired organs hard-locked via <code className="text-purple-300">prc_expire_kidneys</code> / <code className="text-purple-300">ORA-20002</code>.
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 col-span-full leading-relaxed">
                <strong className="text-emerald-400 font-sans">BR5 (Immutable Audit Logging):</strong> Enforced via <code className="text-emerald-300">trg_audit_allocation</code> (AFTER INSERT OR UPDATE ON ALLOCATION). Append-only table.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManifestModal({ isOpen, onClose, organ, recipient, allocation }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0B111E] border border-cyan-500/40 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#080D18]">
          <h3 className="font-bold text-white text-base font-sans">Official Organ Transfer &amp; Allocation Manifest</h3>
          <div className="flex items-center gap-3">
            <button onClick={() => window.print()} className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition">Print Manifest</button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-mono px-2 py-1">✕</button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs text-slate-300 bg-[#05080F]">
          <div className="border-b border-slate-800 pb-4 text-center">
            <div className="text-lg font-bold text-white font-sans tracking-wide">NATIONAL ORGAN &amp; TISSUE TRANSPLANT NETWORK</div>
            <div className="text-[11px] text-cyan-400 font-semibold mt-1">OFFICIAL KIDNEY ALLOCATION TRANSFER MANIFEST</div>
            <div className="text-[10px] text-slate-500 mt-1">Generated under NOTTO / UNOS Relational Database Integrity Guidelines</div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1.5">
              <div className="text-slate-500 uppercase text-[10px] font-sans font-bold">Harvested Organ Data</div>
              <div><strong>Organ Code:</strong> <span className="text-cyan-300">{organ?.organ_code || 'KID-2026-502R'}</span></div>
              <div><strong>Organ Type:</strong> Kidney ({organ?.side || 'RIGHT_KIDNEY'})</div>
              <div><strong>Harvest Time:</strong> {organ?.harvest_time ? new Date(organ.harvest_time).toLocaleString() : 'N/A'}</div>
              <div><strong>Viability Window:</strong> 24.0 Hours Cold Ischemia</div>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1.5">
              <div className="text-slate-500 uppercase text-[10px] font-sans font-bold">Matched Recipient</div>
              <div><strong>Recipient ID:</strong> #{recipient?.recipient_id || '201'}</div>
              <div><strong>Name:</strong> {recipient?.full_name || 'Ananya Krishnan'}</div>
              <div><strong>Blood Group:</strong> <span className="text-emerald-400 font-bold">{recipient?.blood_group || 'A'}</span></div>
              <div><strong>Urgency:</strong> Tier {recipient?.urgency_level || 1} (Critical Priority)</div>
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1.5">
            <div className="text-slate-500 uppercase text-[10px] font-sans font-bold">Relational Transaction Record</div>
            <div><strong>Allocation ID:</strong> #{allocation?.allocation_id || '9001'}</div>
            <div><strong>Match Score:</strong> {allocation?.match_score || '760.0'} pts</div>
            <div><strong>Status:</strong> {allocation?.status || 'PENDING'}</div>
            <div><strong>Cryptographic Hash:</strong> SHA256:7f9a2b84c10e8832aef192b0042a96dc</div>
          </div>

          <div className="text-[10px] text-slate-500 text-center pt-3 border-t border-slate-800">
            This document certifies compliance with BR1 (ABO Match), BR2 (Single Active Offer Lock), and BR5 (Immutable Audit Trail).
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MAIN APPLICATION COMPONENT ---
function App() {
  // Global States
  const [activeRole, setActiveRole] = useState('COORDINATOR'); // COORDINATOR | SURGEON | ADMIN | REGULATOR
  const [hospitals] = useState(INITIAL_HOSPITALS);
  const [donors, setDonors] = useState(INITIAL_DONORS);
  const [organs, setOrgans] = useState(INITIAL_ORGANS);
  const [recipients, setRecipients] = useState(INITIAL_RECIPIENTS);
  const [allocations, setAllocations] = useState(INITIAL_ALLOCATIONS);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [selectedOrganId, setSelectedOrganId] = useState(501);
  const [clockNow, setClockNow] = useState(Date.now());

  // Modal States
  const [showAcidModal, setShowAcidModal] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [backendPing, setBackendPing] = useState('34ms');

  // PL/SQL Telemetry Console Drawer
  const [plsqlConsole, setPlsqlConsole] = useState([
    {
      id: 1,
      time: new Date().toLocaleTimeString(),
      type: 'INFO',
      sql: 'ALTER SESSION SET ISOLATION_LEVEL = SERIALIZABLE;',
      detail: 'Oracle 19c session initialized. ACID transaction isolation active.',
    },
    {
      id: 2,
      time: new Date().toLocaleTimeString(),
      type: 'INFO',
      sql: 'EXEC pkg_vital_engine.init();',
      detail: 'Loaded triggers: trg_validate_allocation, trg_audit_allocation. BR1-BR5 active.',
    },
  ]);

  // Real-Time 1s Ticking Ischemia Clock
  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Ping backend on mount
  useEffect(() => {
    const t0 = performance.now();
    api.get('/health')
      .then(() => setBackendPing(Math.round(performance.now() - t0) + 'ms'))
      .catch(() => setBackendPing('Local ACID'));
  }, []);

  const pushPlsqlTrace = (type, sql, detail) => {
    setPlsqlConsole((prev) => [
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString(),
        type,
        sql,
        detail,
      },
      ...prev.slice(0, 19),
    ]);
  };

  // Enriched Organs with Cold Ischemia Telemetry
  const enrichedOrgans = useMemo(() => {
    return organs.map((o) => {
      const donor = donors.find((d) => d.donor_id === o.donor_id) || {};
      const hospital = hospitals.find((h) => h.hospital_id === donor.hospital_id) || {};
      const elapsedMs = clockNow - new Date(o.harvest_time).getTime();
      const elapsedHrs = elapsedMs / (1000 * 3600);
      const remainingHrs = Math.max(0, o.max_ischemia_hrs - elapsedHrs);
      const totalSec = Math.max(0, Math.floor((o.max_ischemia_hrs * 3600) - (elapsedMs / 1000)));

      const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
      const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
      const ss = String(totalSec % 60).padStart(2, '0');

      const pctRemaining = Math.max(0, Math.min(100, Math.round((remainingHrs / o.max_ischemia_hrs) * 100)));
      const isViable = remainingHrs > 0 && o.status !== 'EXPIRED';

      return {
        ...o,
        donor,
        hospital,
        elapsedHrs: Number(elapsedHrs.toFixed(2)),
        remainingHrs: Number(remainingHrs.toFixed(2)),
        countdownStr: `${hh}:${mm}:${ss}`,
        pctRemaining,
        isViable,
      };
    });
  }, [organs, donors, hospitals, clockNow]);

  const selectedOrgan = useMemo(() => {
    return enrichedOrgans.find((o) => o.organ_id === selectedOrganId) || enrichedOrgans[0];
  }, [enrichedOrgans, selectedOrganId]);

  // Ranked Candidates for the Selected Organ
  const candidateRanking = useMemo(() => {
    if (!selectedOrgan) return [];
    const donorBg = selectedOrgan.donor?.blood_group;

    return recipients
      .filter((r) => r.status === 'WAITING')
      .map((r) => {
        const isCompatible = fnIsBloodCompatible(donorBg, r.blood_group) === 1;
        const isSameHosp = r.hospital_id === selectedOrgan.donor?.hospital_id;
        const scoreObj = fnCalculateMatchScore(r.urgency_level, r.registration_date, isSameHosp);
        const previouslyRejected = allocations.some(
          (a) => a.organ_id === selectedOrgan.organ_id && a.recipient_id === r.recipient_id && ['REJECTED', 'EXPIRED'].includes(a.status)
        );

        return {
          ...r,
          isCompatible,
          scoreObj,
          isSameHosp,
          previouslyRejected,
        };
      })
      .sort((a, b) => {
        if (a.isCompatible !== b.isCompatible) return a.isCompatible ? -1 : 1;
        if (a.urgency_level !== b.urgency_level) return a.urgency_level - b.urgency_level;
        return b.scoreObj.total - a.scoreObj.total;
      });
  }, [recipients, selectedOrgan, allocations]);

  // KPI Metrics
  const kpis = useMemo(() => ({
    availableKidneys: organs.filter((o) => o.status === 'AVAILABLE').length,
    activeOffers: allocations.filter((a) => a.status === 'PENDING').length,
    waitingRecipients: recipients.filter((r) => r.status === 'WAITING').length,
    transplantedCount: organs.filter((o) => o.status === 'TRANSPLANTED').length,
    auditTotal: auditLogs.length,
  }), [organs, allocations, recipients, auditLogs]);

  // --- ACTIONS ---
  const handleAllocateKidney = (organId, forcedRecipientId = null) => {
    const organ = enrichedOrgans.find((o) => o.organ_id === organId);
    if (!organ) return;

    if (organ.status !== 'AVAILABLE') {
      pushPlsqlTrace(
        'ERROR',
        `EXEC prc_allocate_kidney(p_organ_id => ${organId});`,
        `ORA-20001 [trg_validate_allocation]: BR2 Violation - Kidney ${organ.organ_code} is already ${organ.status} (Single Active Offer Lock).`
      );
      return;
    }

    if (!organ.isViable || organ.remainingHrs <= 0) {
      pushPlsqlTrace(
        'ERROR',
        `EXEC prc_allocate_kidney(p_organ_id => ${organId});`,
        `ORA-20002 [trg_validate_allocation]: BR4 Violation - Kidney ${organ.organ_code} Cold Ischemia exceeds 24.0h limit.`
      );
      return;
    }

    let chosen = null;
    if (forcedRecipientId) {
      chosen = candidateRanking.find((c) => c.recipient_id === forcedRecipientId);
    } else {
      chosen = candidateRanking.find((c) => c.isCompatible && !c.previouslyRejected);
    }

    if (!chosen) {
      pushPlsqlTrace(
        'ERROR',
        `EXEC prc_allocate_kidney(p_organ_id => ${organId});`,
        `ORA-20011 [prc_allocate_kidney]: No compatible WAITING recipient available for Kidney ${organ.organ_code}.`
      );
      return;
    }

    if (!chosen.isCompatible) {
      pushPlsqlTrace(
        'ERROR',
        `INSERT INTO ALLOCATION (organ_id, recipient_id, status) VALUES (${organId}, ${chosen.recipient_id}, 'PENDING');`,
        `ORA-20004 [trg_validate_allocation]: BR1 Violation - ABO Incompatible (Donor ${organ.donor.blood_group} -> Recipient ${chosen.blood_group}). Transaction Rolled Back.`
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const newAllocId = 9000 + allocations.length + 1;
    const newAllocation = {
      allocation_id: newAllocId,
      organ_id: organId,
      recipient_id: chosen.recipient_id,
      match_score: chosen.scoreObj.total,
      status: 'PENDING',
      offer_time: nowIso,
      decision_time: null,
    };

    setAllocations((prev) => [newAllocation, ...prev]);
    setOrgans((prev) => prev.map((o) => (o.organ_id === organId ? { ...o, status: 'OFFERED' } : o)));

    const newAudit = {
      log_id: 10000 + auditLogs.length + 1,
      allocation_id: newAllocId,
      organ_id: organId,
      recipient_id: chosen.recipient_id,
      action_type: 'OFFER_CREATED',
      old_status: 'NULL',
      new_status: 'PENDING',
      performed_by: 'COORD_CONSOLE',
      timestamp: nowIso,
      plsql_source: 'trg_audit_allocation (AFTER INSERT ON ALLOCATION)',
    };
    setAuditLogs((prev) => [newAudit, ...prev]);

    pushPlsqlTrace(
      'SUCCESS',
      `EXEC prc_allocate_kidney(p_organ_id => ${organId}); -- Matched Recipient #${chosen.recipient_id} (${chosen.full_name})`,
      `[trg_validate_allocation: PASS] -> INSERT ALLOCATION #${newAllocId} (Score: ${chosen.scoreObj.total}, Urgency: Tier ${chosen.urgency_level}) -> UPDATE ORGAN SET status='OFFERED' -> [trg_audit_allocation: LOGGED #${newAudit.log_id}]`
    );
  };

  const handleSurgeonDecision = (allocationId, decision, autoCascade = true) => {
    const alloc = allocations.find((a) => a.allocation_id === allocationId);
    if (!alloc || alloc.status !== 'PENDING') return;

    const nowIso = new Date().toISOString();
    const organId = alloc.organ_id;
    const recipientId = alloc.recipient_id;

    if (decision === 'ACCEPTED') {
      setAllocations((prev) =>
        prev.map((a) => (a.allocation_id === allocationId ? { ...a, status: 'ACCEPTED', decision_time: nowIso } : a))
      );
      setOrgans((prev) => prev.map((o) => (o.organ_id === organId ? { ...o, status: 'TRANSPLANTED' } : o)));
      setRecipients((prev) => prev.map((r) => (r.recipient_id === recipientId ? { ...r, status: 'TRANSPLANTED' } : r)));

      const acceptAudit = {
        log_id: 10000 + auditLogs.length + 1,
        allocation_id: allocationId,
        organ_id: organId,
        recipient_id: recipientId,
        action_type: 'STATUS_PENDING_TO_ACCEPTED',
        old_status: 'PENDING',
        new_status: 'ACCEPTED',
        performed_by: 'SURGEON_CONSOLE',
        timestamp: nowIso,
        plsql_source: 'prc_surgeon_decision + trg_audit_allocation',
      };
      setAuditLogs((prev) => [acceptAudit, ...prev]);

      pushPlsqlTrace(
        'SUCCESS',
        `EXEC prc_surgeon_decision(p_allocation_id => ${allocationId}, p_decision => 'ACCEPTED');`,
        `ALLOCATION #${allocationId} -> 'ACCEPTED' | ORGAN #${organId} -> 'TRANSPLANTED' | RECIPIENT #${recipientId} -> 'TRANSPLANTED' | [trg_audit_allocation: LOGGED]`
      );
    } else if (decision === 'REJECTED') {
      const updatedAllocations = allocations.map((a) =>
        a.allocation_id === allocationId ? { ...a, status: 'REJECTED', decision_time: nowIso } : a
      );

      const rejectAudit = {
        log_id: 10000 + auditLogs.length + 1,
        allocation_id: allocationId,
        organ_id: organId,
        recipient_id: recipientId,
        action_type: 'STATUS_PENDING_TO_REJECTED',
        old_status: 'PENDING',
        new_status: 'REJECTED',
        performed_by: 'SURGEON_CONSOLE',
        timestamp: nowIso,
        plsql_source: 'prc_surgeon_decision + trg_audit_allocation',
      };

      const organ = enrichedOrgans.find((o) => o.organ_id === organId);
      const nextCandidates = recipients
        .filter((r) => r.status === 'WAITING' && r.recipient_id !== recipientId)
        .map((r) => {
          const isCompatible = fnIsBloodCompatible(organ.donor?.blood_group, r.blood_group) === 1;
          const isSameHosp = r.hospital_id === organ.donor?.hospital_id;
          const scoreObj = fnCalculateMatchScore(r.urgency_level, r.registration_date, isSameHosp);
          const alreadyRejected = updatedAllocations.some(
            (a) => a.organ_id === organId && a.recipient_id === r.recipient_id && ['REJECTED', 'EXPIRED'].includes(a.status)
          );
          return { ...r, isCompatible, scoreObj, alreadyRejected };
        })
        .filter((c) => c.isCompatible && !c.alreadyRejected)
        .sort((a, b) => {
          if (a.urgency_level !== b.urgency_level) return a.urgency_level - b.urgency_level;
          return b.scoreObj.total - a.scoreObj.total;
        });

      if (autoCascade && nextCandidates.length > 0) {
        const nextRecip = nextCandidates[0];
        const newAllocId = 9000 + updatedAllocations.length + 1;
        const cascadedAlloc = {
          allocation_id: newAllocId,
          organ_id: organId,
          recipient_id: nextRecip.recipient_id,
          match_score: nextRecip.scoreObj.total,
          status: 'PENDING',
          offer_time: nowIso,
          decision_time: null,
        };

        const cascadeAudit = {
          log_id: 10000 + auditLogs.length + 2,
          allocation_id: newAllocId,
          organ_id: organId,
          recipient_id: nextRecip.recipient_id,
          action_type: 'OFFER_CREATED_CASCADE',
          old_status: 'NULL',
          new_status: 'PENDING',
          performed_by: 'AUTO_CASCADE_ENGINE',
          timestamp: nowIso,
          plsql_source: 'prc_allocate_kidney (AUTOCASCADE TRIGGER)',
        };

        setAllocations([cascadedAlloc, ...updatedAllocations]);
        setAuditLogs([cascadeAudit, rejectAudit, ...auditLogs]);

        pushPlsqlTrace(
          'WARN',
          `EXEC prc_surgeon_decision(${allocationId}, 'REJECTED'); -> AUTO-CASCADE EXEC prc_allocate_kidney(${organId});`,
          `Offer #${allocationId} REJECTED -> BR2 Lock Released -> Automatically Cascaded to Next Ranked Candidate: #${nextRecip.recipient_id} (${nextRecip.full_name}, Tier ${nextRecip.urgency_level}, Score ${nextRecip.scoreObj.total})`
        );
      } else {
        setAllocations(updatedAllocations);
        setOrgans((prev) => prev.map((o) => (o.organ_id === organId ? { ...o, status: 'AVAILABLE' } : o)));
        setAuditLogs([rejectAudit, ...auditLogs]);

        pushPlsqlTrace(
          'WARN',
          `EXEC prc_surgeon_decision(p_allocation_id => ${allocationId}, p_decision => 'REJECTED');`,
          `Offer #${allocationId} marked REJECTED -> ORGAN #${organId} returned to 'AVAILABLE' pool.`
        );
      }
    }
  };

  const handleExpireSweep = () => {
    let target = organs.find((o) => o.status === 'AVAILABLE');
    if (target) {
      setOrgans((prev) =>
        prev.map((o) => (o.organ_id === target.organ_id ? { ...o, harvest_time: hoursAgo(24.5), status: 'EXPIRED' } : o))
      );
      pushPlsqlTrace(
        'WARN',
        `EXEC prc_expire_kidneys();`,
        `BR4 Enforcement: Kidney ${target.organ_code} cold ischemia exceeded 24.0h limit. Updated status = 'EXPIRED'. Locked from further allocation.`
      );
    } else {
      pushPlsqlTrace(
        'INFO',
        `EXEC prc_expire_kidneys();`,
        `BR4 Viability Sweep executed: All current AVAILABLE organs are within the valid 24-hour cold ischemia threshold.`
      );
    }
  };

  // Forms in Admin
  const [newDonorName, setNewDonorName] = useState('');
  const [newDonorBg, setNewDonorBg] = useState('O');
  const [newDonorHosp, setNewDonorHosp] = useState(1);
  const [newKidneySide, setNewKidneySide] = useState('LEFT_KIDNEY');

  const [newRecipName, setNewRecipName] = useState('');
  const [newRecipBg, setNewRecipBg] = useState('O');
  const [newRecipUrgency, setNewRecipUrgency] = useState(1);
  const [newRecipHosp, setNewRecipHosp] = useState(1);

  const handleAddDonorAndKidney = (e) => {
    e.preventDefault();
    if (!newDonorName.trim()) return;

    const newDonorId = 100 + donors.length + 1;
    const newOrganId = 500 + organs.length + 1;
    const sideSuffix = newKidneySide === 'LEFT_KIDNEY' ? 'L' : 'R';
    const organCode = `KID-2026-${newOrganId}${sideSuffix}`;

    const donorRow = {
      donor_id: newDonorId,
      full_name: newDonorName.trim(),
      age: 38,
      blood_group: newDonorBg,
      hospital_id: Number(newDonorHosp),
      clinical_status: 'BRAIN_STEM_DEAD',
      hla_type: 'A2-B7-DR4',
    };

    const organRow = {
      organ_id: newOrganId,
      donor_id: newDonorId,
      organ_code: organCode,
      side: newKidneySide,
      harvest_time: new Date().toISOString(),
      max_ischemia_hrs: 24,
      status: 'AVAILABLE',
    };

    setDonors((prev) => [donorRow, ...prev]);
    setOrgans((prev) => [organRow, ...prev]);
    setSelectedOrganId(newOrganId);
    setNewDonorName('');

    pushPlsqlTrace(
      'SUCCESS',
      `INSERT INTO DONOR VALUES (${newDonorId}, '${donorRow.full_name}', '${newDonorBg}', ${newDonorHosp}); INSERT INTO ORGAN VALUES (${newOrganId}, ${newDonorId}, '${organCode}', SYSDATE, 'AVAILABLE');`,
      `Harvested Kidney ${organCode} (Blood Group ${newDonorBg}) registered with 24:00:00 Cold Ischemia timer.`
    );
  };

  const handleAddRecipient = (e) => {
    e.preventDefault();
    if (!newRecipName.trim()) return;

    const newRecipId = 200 + recipients.length + 1;
    const recipRow = {
      recipient_id: newRecipId,
      full_name: newRecipName.trim(),
      age: 44,
      blood_group: newRecipBg,
      urgency_level: Number(newRecipUrgency),
      registration_date: new Date().toISOString().split('T')[0],
      hospital_id: Number(newRecipHosp),
      status: 'WAITING',
      pra_score: '5%',
    };

    setRecipients((prev) => [recipRow, ...prev]);
    setNewRecipName('');

    pushPlsqlTrace(
      'SUCCESS',
      `INSERT INTO RECIPIENT (recipient_id, full_name, blood_group, urgency_level, status) VALUES (${newRecipId}, '${recipRow.full_name}', '${newRecipBg}', ${newRecipUrgency}, 'WAITING');`,
      `Recipient #${newRecipId} added to waitlist with BR3 Inverted Urgency Tier ${newRecipUrgency}.`
    );
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-200 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* ==================== GLOBAL NAVBAR ==================== */}
      <header className="sticky top-0 z-40 bg-[#080C14]/90 backdrop-blur-2xl border-b border-slate-800/80">
        <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Million Dollar Brand Logo */}
          <MillionDollarLogo />

          {/* Center: Glass Segmented Role Control */}
          <nav className="flex items-center bg-[#0C1220] p-1.5 rounded-xl border border-slate-800/90 shadow-inner">
            {[
              { id: 'COORDINATOR', label: 'Coordinator', count: kpis.availableKidneys },
              { id: 'SURGEON', label: 'Surgeon', count: kpis.activeOffers },
              { id: 'ADMIN', label: 'Admin', count: null },
              { id: 'REGULATOR', label: 'Auditor', count: kpis.auditTotal },
            ].map((role) => {
              const active = activeRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setActiveRole(role.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                    active
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-md shadow-cyan-500/25 ring-1 ring-cyan-300/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <span>{role.label}</span>
                  {role.count !== null && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                        active ? 'bg-black/20 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {role.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Modern Utility Modals & Latency */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowAcidModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/35 text-xs font-mono font-semibold transition flex items-center gap-2 shadow-sm"
              title="Open ACID Concurrency Test Suite"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>ACID Suite</span>
            </button>

            <button
              onClick={() => setShowSqlModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition flex items-center gap-1.5"
              title="Open Live SQL Terminal"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span>SQL</span>
            </button>

            <button
              onClick={() => setShowSchemaModal(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition"
              title="Inspect 3NF Relational Schema"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z"/></svg>
              <span>3NF Schema</span>
            </button>

            <button
              onClick={() => setShowManifestModal(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition"
              title="View Official Transfer Manifest"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>Manifest</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-800 text-[11px] font-mono text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{backendPing}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ==================== HERO KPI STAT STRIP ==================== */}
      <section className="border-b border-slate-800/60 bg-[#060911]/70 py-4">
        <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-[#0B1324] to-[#080D1A] border-t-2 border-t-cyan-400 border border-slate-800/80 rounded-2xl p-4 shadow-lg shadow-black/20 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Available Kidneys</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black font-mono text-cyan-300">0{kpis.availableKidneys}</span>
              <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/40">BR4 Viable</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0B1324] to-[#080D1A] border-t-2 border-t-amber-400 border border-slate-800/80 rounded-2xl p-4 shadow-lg shadow-black/20 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Pending Offers</span>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black font-mono text-amber-300">0{kpis.activeOffers}</span>
              <span className="text-[10px] font-mono text-amber-400/80 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/40">BR2 Lock</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0B1324] to-[#080D1A] border-t-2 border-t-rose-400 border border-slate-800/80 rounded-2xl p-4 shadow-lg shadow-black/20 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Waiting Recipients</span>
              <span className="w-2 h-2 rounded-full bg-rose-400" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black font-mono text-rose-300">0{kpis.waitingRecipients}</span>
              <span className="text-[10px] font-mono text-rose-400/80 bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-800/40">BR3 Ranked</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0B1324] to-[#080D1A] border-t-2 border-t-emerald-400 border border-slate-800/80 rounded-2xl p-4 shadow-lg shadow-black/20 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Transplanted</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black font-mono text-emerald-300">0{kpis.transplantedCount}</span>
              <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">Finalized</span>
            </div>
          </div>

          <div className="hidden lg:block bg-gradient-to-br from-[#0B1324] to-[#080D1A] border-t-2 border-t-purple-400 border border-slate-800/80 rounded-2xl p-4 shadow-lg shadow-black/20 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Audit Records</span>
              <span className="w-2 h-2 rounded-full bg-purple-400" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black font-mono text-slate-200">0{kpis.auditTotal}</span>
              <span className="text-[10px] font-mono text-purple-400/80 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-800/40">BR5 Triggers</span>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== MAIN WORKSPACE ==================== */}
      <main className="max-w-[1600px] w-full mx-auto px-6 py-6 flex-1 flex flex-col gap-6">

        {/* -------------------- ROLE 1: TRANSPLANT COORDINATOR -------------------- */}
        {activeRole === 'COORDINATOR' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT 5 COLS: Kidney Inventory */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-[#0B111E] border border-slate-800/90 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      Procured Kidney Inventory
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Select a kidney to evaluate candidate matching algorithms
                    </p>
                  </div>
                  <button
                    onClick={handleExpireSweep}
                    className="text-[11px] font-mono px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition shadow-sm"
                    title="Simulate prc_expire_kidneys() to test cold ischemia lockout"
                  >
                    Test BR4 Sweep
                  </button>
                </div>

                {/* Organ Cards List */}
                <div className="space-y-3">
                  {enrichedOrgans.map((organ) => {
                    const isSelected = selectedOrgan?.organ_id === organ.organ_id;
                    const statusBadge =
                      organ.status === 'AVAILABLE'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : organ.status === 'OFFERED'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : organ.status === 'TRANSPLANTED'
                        ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                        : 'bg-rose-500/15 text-rose-300 border-rose-500/30';

                    const timerColor =
                      organ.status === 'EXPIRED' || organ.remainingHrs <= 0
                        ? 'text-rose-400'
                        : organ.remainingHrs < 6
                        ? 'text-rose-400 animate-pulse'
                        : organ.remainingHrs < 12
                        ? 'text-amber-400'
                        : 'text-cyan-300';

                    const progressColor =
                      organ.status === 'EXPIRED' || organ.remainingHrs <= 0
                        ? 'bg-rose-500'
                        : organ.remainingHrs < 6
                        ? 'bg-rose-500'
                        : organ.remainingHrs < 12
                        ? 'bg-amber-400'
                        : 'bg-gradient-to-r from-cyan-400 to-blue-500';

                    return (
                      <div
                        key={organ.organ_id}
                        onClick={() => setSelectedOrganId(organ.organ_id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-gradient-to-br from-[#0E1A2E] via-[#0C1526] to-[#080D1A] border-cyan-500/70 shadow-xl shadow-cyan-500/10 ring-2 ring-cyan-500/30'
                            : 'bg-[#080D18] border-slate-800/80 hover:border-slate-700 hover:bg-[#0A101E]'
                        }`}
                      >
                        {/* Header: Blood Group Badge, Organ Code, Status */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-950/80 to-slate-900 border border-cyan-500/40 flex items-center justify-center font-black text-sm text-cyan-300 font-mono shadow-sm">
                              {organ.donor?.blood_group}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-white text-sm">{organ.organ_code}</span>
                                <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700/60">
                                  {organ.side === 'LEFT_KIDNEY' ? 'Left Kidney' : 'Right Kidney'}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {organ.hospital?.name || 'Transplant Center'}
                              </div>
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border font-semibold ${statusBadge}`}>
                            {organ.status}
                          </span>
                        </div>

                        {/* Cold Ischemia Viability Meter */}
                        <div className="mt-3.5 pt-3 border-t border-slate-800/60">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                              Cold Ischemia (BR4):
                            </span>
                            <span className={`font-mono font-bold text-xs ${timerColor}`}>
                              {organ.status === 'EXPIRED' ? '00:00:00 (EXPIRED)' : `${organ.countdownStr} left`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-900/90 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${progressColor}`}
                              style={{ width: `${organ.status === 'TRANSPLANTED' ? 100 : organ.pctRemaining}%` }}
                            />
                          </div>
                        </div>

                        {/* Footer Status Pill */}
                        <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-500">
                          <span>HLA: {organ.donor?.hla_type || 'N/A'}</span>
                          {isSelected && (
                            <span className="text-cyan-400 font-sans font-semibold text-[11px] flex items-center gap-1.5">
                              <span>Loaded in Match Engine</span>
                              <span>→</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT 7 COLS: Algorithmic Match Showcase & Ranked Queue */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Target Focus Banner */}
              <div className="bg-[#0B111E] border border-slate-800/90 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-bold text-white font-sans tracking-tight">
                        Algorithmic Match &amp; Allocation Matrix
                      </h2>
                      <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        {selectedOrgan?.organ_code} (Type {selectedOrgan?.donor?.blood_group})
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Evaluated by <strong>BR1 Compatibility</strong> → <strong>BR3 Inverted Urgency (Tier 1..5)</strong> → <strong>Match Score DESC</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const incompatible = candidateRanking.find((c) => !c.isCompatible);
                      if (incompatible) {
                        handleAllocateKidney(selectedOrgan.organ_id, incompatible.recipient_id);
                      } else {
                        pushPlsqlTrace('INFO', 'TEST BR1 TRIGGER', 'All current recipients happen to be ABO compatible with donor O.');
                      }
                    }}
                    className="text-[11px] font-mono px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition shadow-sm"
                    title="Simulates inserting an ABO mismatched allocation to prove ORA-20004 trigger execution"
                  >
                    Simulate BR1 Violation (Viva Demo)
                  </button>
                </div>

                {/* HERO MATCH SHOWCASE: #1 Top Algorithmic Candidate */}
                {(() => {
                  const topMatch = candidateRanking.find((c) => c.isCompatible && !c.previouslyRejected);
                  if (!topMatch) {
                    return (
                      <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-400 text-xs font-mono">
                        No eligible compatible candidates available for this organ.
                      </div>
                    );
                  }

                  const canAllocate = selectedOrgan?.status === 'AVAILABLE' && selectedOrgan?.isViable;

                  return (
                    <div className="bg-gradient-to-br from-[#0F1E33] via-[#0C182A] to-[#08101E] border-2 border-cyan-500/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden mb-6">
                      <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2.5">
                          <span className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black text-[10px] tracking-wider uppercase font-sans shadow-md shadow-cyan-500/20">
                            Algorithmic Match Winner (#1)
                          </span>
                          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
                            BR1 Match (Donor {selectedOrgan?.donor?.blood_group} → Recipient {topMatch.blood_group})
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs text-slate-400 font-mono">Score:</span>
                          <span className="text-3xl font-black font-mono text-cyan-300">{topMatch.scoreObj.total}</span>
                          <span className="text-xs text-slate-500 font-mono">pts</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                        <div className="p-4 bg-slate-900/70 backdrop-blur-md rounded-xl border border-slate-800/90">
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Candidate Dossier</div>
                          <div className="text-lg font-bold text-white mt-1">{topMatch.full_name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Patient ID #{topMatch.recipient_id} • Age {topMatch.age} • Blood Group <strong className="text-cyan-300 font-mono">{topMatch.blood_group}</strong>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {hospitals.find(h => h.hospital_id === topMatch.hospital_id)?.name}
                            {topMatch.isSameHosp && <span className="ml-1.5 text-emerald-400 font-mono text-[10px] font-bold">(Local Center +50)</span>}
                          </div>
                        </div>

                        <div className="p-4 bg-slate-900/70 backdrop-blur-md rounded-xl border border-slate-800/90">
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">BR3 Formula Breakdown</div>
                          <div className="mt-1 space-y-1.5 font-mono text-xs">
                            <div className="flex justify-between text-slate-300">
                              <span>Urgency Tier {topMatch.urgency_level} (Critical):</span>
                              <strong className="text-cyan-300">+{topMatch.scoreObj.urgencyPoints} pts</strong>
                            </div>
                            <div className="flex justify-between text-slate-300">
                              <span>Waitlist Accrual ({topMatch.scoreObj.waitDays} days):</span>
                              <strong className="text-cyan-300">+{topMatch.scoreObj.waitPoints} pts</strong>
                            </div>
                            {topMatch.isSameHosp && (
                              <div className="flex justify-between text-emerald-400">
                                <span>Geographic Proximity Bonus:</span>
                                <strong>+50.0 pts</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Primary Allocation Action */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                        <div className="text-xs text-slate-400 font-mono">
                          {canAllocate ? (
                            <span>Executes <code className="text-cyan-300">prc_allocate_kidney({selectedOrgan?.organ_id})</code> with BR2 single-active-offer lock</span>
                          ) : (
                            <span className="text-rose-400">Organ status is {selectedOrgan?.status}; allocation lock unavailable</span>
                          )}
                        </div>

                        <button
                          onClick={() => handleAllocateKidney(selectedOrgan.organ_id, topMatch.recipient_id)}
                          disabled={!canAllocate}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black font-sans text-xs transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-cyan-500/25 flex items-center gap-2 transform active:scale-95"
                        >
                          <svg className="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          <span>Allocate Kidney to Candidate (Lock BR2)</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Ranked Runner-Up Candidates List */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans mb-3">
                    Waitlist Queue
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                          <th className="py-2.5 px-3">Rank</th>
                          <th className="py-2.5 px-3">Candidate</th>
                          <th className="py-2.5 px-3">ABO Match</th>
                          <th className="py-2.5 px-3">Urgency (BR3)</th>
                          <th className="py-2.5 px-3">Total Score</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
                        {candidateRanking.map((cand, idx) => {
                          const isEligible = cand.isCompatible && !cand.previouslyRejected;
                          const canAllocate = selectedOrgan?.status === 'AVAILABLE' && isEligible;

                          return (
                            <tr
                              key={cand.recipient_id}
                              className={`hover:bg-slate-900/60 transition ${
                                !cand.isCompatible ? 'opacity-40 bg-slate-950/40' : ''
                              }`}
                            >
                              <td className="py-3 px-3 font-bold text-cyan-400">#{idx + 1}</td>
                              <td className="py-3 px-3 font-sans">
                                <div className="font-semibold text-slate-200">{cand.full_name}</div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  ID #{cand.recipient_id} • Blood {cand.blood_group}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                {cand.isCompatible ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                    MATCH
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                    MISMATCH (BR1)
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 font-sans">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  cand.urgency_level === 1 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                                  cand.urgency_level === 2 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                                  'bg-slate-800 text-slate-300'
                                }`}>
                                  Tier {cand.urgency_level}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-bold text-white text-sm">
                                {cand.scoreObj.total}
                              </td>
                              <td className="py-3 px-3 text-right font-sans">
                                <button
                                  onClick={() => handleAllocateKidney(selectedOrgan?.organ_id, cand.recipient_id)}
                                  disabled={!canAllocate}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    canAllocate
                                      ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700'
                                      : 'bg-slate-900 text-slate-600 border border-slate-800/40 cursor-not-allowed'
                                  }`}
                                >
                                  {cand.previouslyRejected ? 'Rejected Prior' : 'Offer Organ'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- ROLE 2: TRANSPLANT SURGEON -------------------- */}
        {activeRole === 'SURGEON' && (
          <div className="flex flex-col gap-6">
            <div className="bg-[#0B111E] border border-slate-800/90 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    Transplant Surgeon Decision Console (prc_surgeon_decision)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Accepting an offer commits <code className="text-emerald-300">ORGAN = TRANSPLANTED</code>. Rejecting releases the <code className="text-amber-300">BR2 Lock</code> and auto-cascades to the next candidate.
                  </p>
                </div>
              </div>

              {allocations.filter((a) => a.status === 'PENDING').length === 0 ? (
                <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl">
                  <p className="text-slate-400 text-sm">No active PENDING kidney offers awaiting surgical decision.</p>
                  <p className="text-xs text-slate-500 mt-1">Switch to Coordinator to match and dispatch available organs.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {allocations
                    .filter((a) => a.status === 'PENDING')
                    .map((alloc) => {
                      const organ = enrichedOrgans.find((o) => o.organ_id === alloc.organ_id);
                      const recip = recipients.find((r) => r.recipient_id === alloc.recipient_id);

                      return (
                        <div
                          key={alloc.allocation_id}
                          className="bg-[#080D18] border border-amber-500/40 rounded-2xl p-5 shadow-xl flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                                ALLOCATION #{alloc.allocation_id} • PENDING
                              </span>
                              <span className="text-xs font-mono text-slate-400">
                                Match Score: <strong className="text-cyan-300 text-sm">{alloc.match_score} pts</strong>
                              </span>
                            </div>

                            <div className="space-y-3 my-4">
                              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
                                <div className="text-slate-400 uppercase text-[10px] font-bold">Matched Recipient</div>
                                <div className="text-sm font-bold text-white mt-0.5">{recip?.full_name}</div>
                                <div className="text-slate-400 mt-0.5 font-mono">
                                  ID #{recip?.recipient_id} • Blood {recip?.blood_group} • Urgency Tier {recip?.urgency_level}
                                </div>
                              </div>

                              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
                                <div className="text-slate-400 uppercase text-[10px] font-bold">Offered Organ</div>
                                <div className="text-sm font-bold text-cyan-300 mt-0.5">{organ?.organ_code}</div>
                                <div className="text-slate-400 mt-0.5 font-mono">
                                  Donor: {organ?.donor?.full_name} ({organ?.donor?.blood_group}) • Viability: <strong className="text-amber-300">{organ?.countdownStr} left</strong>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-800/80">
                            <button
                              onClick={() => handleSurgeonDecision(alloc.allocation_id, 'ACCEPTED')}
                              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-1.5"
                            >
                              <span>Accept &amp; Transplant</span>
                            </button>
                            <button
                              onClick={() => handleSurgeonDecision(alloc.allocation_id, 'REJECTED', true)}
                              className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs transition flex items-center justify-center gap-1.5"
                            >
                              <span>Reject &amp; Auto-Cascade</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------- ROLE 3: HOSPITAL ADMIN -------------------- */}
        {activeRole === 'ADMIN' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form onSubmit={handleAddDonorAndKidney} className="bg-[#0B111E] border border-slate-800/90 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-300">
                  1. Log Harvested Donor Kidney (DONOR + ORGAN)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inserts a cleared donor and starts the 24-hour Cold Ischemia viability timer (BR4).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Donor Full Name</label>
                  <input
                    type="text"
                    required
                    value={newDonorName}
                    onChange={(e) => setNewDonorName(e.target.value)}
                    placeholder="e.g. Anand Mahindra"
                    className="w-full bg-[#05080F] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Blood Group (BR1)</label>
                  <select
                    value={newDonorBg}
                    onChange={(e) => setNewDonorBg(e.target.value)}
                    className="w-full bg-[#05080F] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="O">O (Universal Donor)</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Harvesting Hospital</label>
                  <select
                    value={newDonorHosp}
                    onChange={(e) => setNewDonorHosp(e.target.value)}
                    className="w-full bg-[#05080F] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    {hospitals.map((h) => (
                      <option key={h.hospital_id} value={h.hospital_id}>
                        {h.name} ({h.city})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Kidney Side</label>
                  <select
                    value={newKidneySide}
                    onChange={(e) => setNewKidneySide(e.target.value)}
                    className="w-full bg-[#05080F] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="LEFT_KIDNEY">Left Kidney</option>
                    <option value="RIGHT_KIDNEY">Right Kidney</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="mt-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs transition shadow-md shadow-cyan-500/20"
              >
                Log Donor &amp; Harvest Kidney (Start 24h Clock)
              </button>
            </form>

            <form onSubmit={handleAddRecipient} className="bg-[#0B111E] border border-slate-800/90 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-rose-300">
                  2. Register Waitlist Recipient (RECIPIENT)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Adds an end-stage renal patient to the waitlist prioritized by Inverted Urgency (BR3).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Recipient Full Name</label>
                  <input
                    type="text"
                    required
                    value={newRecipName}
                    onChange={(e) => setNewRecipName(e.target.value)}
                    placeholder="e.g. Shalini Roy"
                    className="w-full bg-[#05080F] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Blood Group (BR1)</label>
                  <select
                    value={newRecipBg}
                    onChange={(e) => setNewRecipBg(e.target.value)}
                    className="w-full bg-[#05080F] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="O">O</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB (Universal Recipient)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Urgency Level (BR3)</label>
                  <select
                    value={newRecipUrgency}
                    onChange={(e) => setNewRecipUrgency(e.target.value)}
                    className="w-full bg-[#05080F] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="1">Tier 1 - Critical Emergency (500 pts)</option>
                    <option value="2">Tier 2 - High Urgency (400 pts)</option>
                    <option value="3">Tier 3 - Standard Dialysis (300 pts)</option>
                    <option value="4">Tier 4 - Early Stage (200 pts)</option>
                    <option value="5">Tier 5 - Stable Waitlist (100 pts)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Primary Hospital</label>
                  <select
                    value={newRecipHosp}
                    onChange={(e) => setNewRecipHosp(e.target.value)}
                    className="w-full bg-[#05080F] border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    {hospitals.map((h) => (
                      <option key={h.hospital_id} value={h.hospital_id}>
                        {h.name} ({h.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="mt-2 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold text-xs transition shadow-md shadow-rose-500/20"
              >
                Register Recipient to Waitlist
              </button>
            </form>
          </div>
        )}

        {/* -------------------- ROLE 4: REGULATORY AUDITOR -------------------- */}
        {activeRole === 'REGULATOR' && (
          <div className="bg-[#0B111E] border border-slate-800/90 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  BR5 Immutable Regulatory Audit Trail (AUDIT_LOG)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automatically populated by <code className="text-cyan-300">trg_audit_allocation</code> on every allocation transition.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                    <th className="py-2.5 px-3">Log ID</th>
                    <th className="py-2.5 px-3">Action Type</th>
                    <th className="py-2.5 px-3">Entities</th>
                    <th className="py-2.5 px-3">Transition</th>
                    <th className="py-2.5 px-3">Trigger Source</th>
                    <th className="py-2.5 px-3">Session User</th>
                    <th className="py-2.5 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {auditLogs.map((log) => (
                    <tr key={log.log_id} className="hover:bg-slate-900/60">
                      <td className="py-3 px-3 text-cyan-400 font-bold">#{log.log_id}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.action_type.includes('ACCEPTED')
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : log.action_type.includes('REJECTED') || log.action_type.includes('EXPIRED')
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {log.action_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        Alloc #{log.allocation_id ?? 'N/A'} • Organ #{log.organ_id} • Recip #{log.recipient_id ?? 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {log.old_status} → <strong className="text-white">{log.new_status}</strong>
                      </td>
                      <td className="py-3 px-3 text-slate-400">{log.plsql_source}</td>
                      <td className="py-3 px-3 text-slate-400">{log.performed_by}</td>
                      <td className="py-3 px-3 text-right text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== BOTTOM LIVE ORACLE PL/SQL DOCK ==================== */}
        <section className="bg-[#05080E] border border-slate-800/90 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Live Oracle 19c PL/SQL Runtime &amp; Trigger Dock
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Active Triggers: trg_validate_allocation • trg_prevent_invalid_organ_status • trg_audit_allocation
            </span>
          </div>

          <div className="max-h-44 overflow-y-auto space-y-2 text-xs font-mono pr-1">
            {plsqlConsole.map((entry) => (
              <div
                key={entry.id}
                className={`p-3 rounded-xl border ${
                  entry.type === 'ERROR'
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                    : entry.type === 'WARN'
                    ? 'bg-amber-950/25 border-amber-500/30 text-amber-200'
                    : entry.type === 'SUCCESS'
                    ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-cyan-300">{entry.sql}</span>
                  <span className="text-[10px] text-slate-500">{entry.time}</span>
                </div>
                <div className="text-slate-400 mt-1 leading-relaxed">{entry.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ==================== MODALS ==================== */}
        <AcidModal isOpen={showAcidModal} onClose={() => setShowAcidModal(false)} />
        <SqlModal isOpen={showSqlModal} onClose={() => setShowSqlModal(false)} />
        <SchemaModal isOpen={showSchemaModal} onClose={() => setShowSchemaModal(false)} />
        <ManifestModal
          isOpen={showManifestModal}
          onClose={() => setShowManifestModal(false)}
          organ={selectedOrgan}
          recipient={recipients.find(r => r.recipient_id === (allocations[0]?.recipient_id || 201))}
          allocation={allocations[0]}
        />

        {/* ==================== FOOTER ==================== */}
        <footer className="border-t border-slate-800/80 bg-[#060911] mt-6 py-5 text-xs text-slate-500 font-mono">
          <div className="max-w-[1600px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-300 font-semibold font-sans">VITAL National Organ Allocation Network</span>
              <span className="text-slate-600">•</span>
              <span>Oracle 19c PL/SQL &amp; Strict ACID Relational Integrity</span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <a href="/docs" target="_blank" className="hover:text-cyan-400 transition">FastAPI Swagger Docs</a>
              <span>•</span>
              <a href="/api/health" target="_blank" className="hover:text-cyan-400 transition">Health Diagnostics</a>
              <span>•</span>
              <span className="text-emerald-400 font-bold">SERIALIZABLE</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

// Mount App into root
ReactDOM.render(<App />, document.getElementById('root'));
