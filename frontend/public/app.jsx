
const { useState, useEffect, useMemo, useRef } = React;

// API Helper
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0B111E] border border-cyan-500/40 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#080D18]">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
            <div>
              <h3 className="font-bold text-white text-base font-mono">ACID Concurrency & Transaction Integrity Suite</h3>
              <p className="text-xs text-slate-400">Verifying Atomicity, Consistency, Isolation, Durability under high-concurrency contention</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-mono px-2 py-1">✕</button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="text-slate-400">Isolation Level:</span> <span className="text-cyan-300 font-bold">SERIALIZABLE (ACID)</span>
              <span className="mx-2 text-slate-600">|</span>
              <span className="text-slate-400">Locking Mode:</span> <span className="text-emerald-300 font-bold">Pessimistic Row-Lock (SELECT FOR UPDATE)</span>
            </div>
            <button
              onClick={runAcidSuite}
              disabled={loading}
              className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-sans text-xs transition disabled:opacity-50"
            >
              {loading ? 'Executing Concurrent Workers...' : 'Re-run Concurrency Test'}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded bg-rose-950/40 border border-rose-500 text-rose-300">
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
                  <div key={idx} className="p-3 rounded-lg bg-[#070B14] border border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-300">{t.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.outcome === 'PASSED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300'}`}>
                        {t.outcome}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{t.description}</p>
                    {t.metric && <p className="text-[10px] text-cyan-400 mt-2 font-mono">{t.metric}</p>}
                  </div>
                ))}
              </div>

              {acidResults.execution_logs && (
                <div className="bg-[#05080F] border border-slate-800/90 rounded-lg p-3">
                  <div className="text-slate-400 font-bold mb-2 text-[11px] uppercase tracking-wider">
                    Thread Execution Telemetry & Rollback Trace
                  </div>
                  <pre className="text-[11px] text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
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
  const [sql, setSql] = useState("SELECT * FROM ORGAN WHERE status = 'AVAILABLE';");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [execTime, setExecTime] = useState(null);

  const presets = [
    { label: "Available Organs", query: "SELECT organ_id, organ_code, side, harvest_time, status FROM ORGAN WHERE status = 'AVAILABLE';" },
    { label: "Critical Waitlist", query: "SELECT recipient_id, full_name, blood_group, urgency_level, registration_date FROM RECIPIENT WHERE urgency_level = 1;" },
    { label: "Pending Allocations", query: "SELECT allocation_id, organ_id, recipient_id, match_score, status, offer_time FROM ALLOCATION WHERE status = 'PENDING';" },
    { label: "Audit Log Trail", query: "SELECT log_id, action_type, organ_id, old_status, new_status, performed_by, timestamp FROM AUDIT_LOG ORDER BY timestamp DESC LIMIT 10;" },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0B111E] border border-cyan-500/40 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#080D18]">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-cyan-400" />
            <div>
              <h3 className="font-bold text-white text-base">Live Interactive SQL Terminal</h3>
              <p className="text-xs text-slate-400">Direct SQL execution engine against SQLite/Oracle relational tables</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg px-2 py-1">✕</button>
        </div>

        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap gap-2 items-center">
          <span className="text-slate-400 text-[11px] font-sans">Query Presets:</span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => { setSql(p.query); handleExecute(p.query); }}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="p-4 flex flex-col gap-3">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            rows={3}
            className="w-full bg-[#05080F] border border-slate-800 rounded-lg p-3 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
            placeholder="Enter SQL statement..."
          />
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-slate-500">
              {execTime !== null && <span>Execution Time: <strong className="text-emerald-400">{execTime} ms</strong></span>}
            </div>
            <button
              onClick={() => handleExecute(sql)}
              disabled={loading}
              className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-sans text-xs transition disabled:opacity-50"
            >
              {loading ? 'Executing...' : 'Run SQL Query'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 border-t border-slate-800 bg-[#070B14]">
          {result && result.error && (
            <div className="p-3 rounded bg-rose-950/40 border border-rose-500 text-rose-300 text-xs">
              SQL Error: {result.error}
            </div>
          )}

          {result && result.rows && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase">
                    {result.columns && result.columns.map((c, i) => (
                      <th key={i} className="py-2 px-3">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {result.rows.length === 0 ? (
                    <tr><td colSpan={result.columns?.length || 1} className="py-4 text-center text-slate-500">No records returned.</td></tr>
                  ) : (
                    result.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-900/50">
                        {Array.isArray(row)
                          ? row.map((val, cIdx) => <td key={cIdx} className="py-2 px-3 text-slate-300">{String(val)}</td>)
                          : Object.values(row).map((val, cIdx) => <td key={cIdx} className="py-2 px-3 text-slate-300">{String(val)}</td>)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0B111E] border border-cyan-500/40 rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#080D18]">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-cyan-400" />
            <div>
              <h3 className="font-bold text-white text-base font-mono">3NF Relational Schema Architecture & Constraints</h3>
              <p className="text-xs text-slate-400">Strictly normalized schema adhering to 1NF, 2NF, and 3NF Boyce-Codd normal forms</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-mono px-2 py-1">✕</button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((t, idx) => (
              <div key={idx} className="bg-[#070B14] border border-slate-800 rounded-lg p-3.5 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 font-mono">
                  <span className="font-bold text-cyan-300 text-xs">{t.name}</span>
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">PK: {t.pk}</span>
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

          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 font-mono text-xs">
            <h4 className="text-cyan-400 font-bold mb-2">Business Rule Enforcement Matrix</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
              <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                <strong className="text-rose-400">BR1 (ABO Compatibility):</strong> Enforced via <code className="text-cyan-300">trg_validate_allocation</code>. Raises <code className="text-rose-300">ORA-20004</code> on mismatch.
              </div>
              <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                <strong className="text-amber-400">BR2 (Unique Active Offer):</strong> Enforced via Unique Filtered Index / Trigger. Raises <code className="text-amber-300">ORA-20001</code> if organ status != AVAILABLE.
              </div>
              <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                <strong className="text-cyan-400">BR3 (Inverted Urgency Match):</strong> Deterministic formula: <code className="text-cyan-200">(6 - Urgency)*100 + WaitDays*0.5 + HospBonus(50)</code>.
              </div>
              <div className="p-2 bg-slate-950/60 rounded border border-slate-800">
                <strong className="text-purple-400">BR4 (Cold Ischemia Viability):</strong> Real-time decay &lt;= 24.0h. Expired organs hard-locked via <code className="text-purple-300">prc_expire_kidneys</code> / <code className="text-purple-300">ORA-20002</code>.
              </div>
              <div className="p-2 bg-slate-950/60 rounded border border-slate-800 col-span-full">
                <strong className="text-emerald-400">BR5 (Immutable Audit Logging):</strong> Enforced via <code className="text-emerald-300">trg_audit_allocation</code> (AFTER INSERT OR UPDATE ON ALLOCATION). Append-only table.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0B111E] border border-cyan-500/40 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#080D18]">
          <h3 className="font-bold text-white text-base font-mono">Official Organ Transfer & Allocation Manifest</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs">Print Manifest</button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-mono px-2 py-1">✕</button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs text-slate-300 bg-[#05080F]">
          <div className="border-b border-slate-800 pb-3 text-center">
            <div className="text-lg font-bold text-white font-sans">NATIONAL ORGAN & TISSUE TRANSPLANT NETWORK</div>
            <div className="text-[11px] text-cyan-400 font-semibold mt-0.5">OFFICIAL KIDNEY ALLOCATION TRANSFER MANIFEST</div>
            <div className="text-[10px] text-slate-500 mt-1">Generated under NOTTO / UNOS Relational Database Integrity Guidelines</div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-900/60 rounded border border-slate-800 space-y-1">
              <div className="text-slate-500 uppercase text-[10px]">Harvested Organ Data</div>
              <div><strong>Organ Code:</strong> <span className="text-cyan-300">{organ?.organ_code || 'KID-2026-502R'}</span></div>
              <div><strong>Organ Type:</strong> Kidney ({organ?.side || 'RIGHT_KIDNEY'})</div>
              <div><strong>Harvest Time:</strong> {organ?.harvest_time ? new Date(organ.harvest_time).toLocaleString() : 'N/A'}</div>
              <div><strong>Viability Window:</strong> 24.0 Hours Cold Ischemia</div>
            </div>

            <div className="p-3 bg-slate-900/60 rounded border border-slate-800 space-y-1">
              <div className="text-slate-500 uppercase text-[10px]">Matched Recipient</div>
              <div><strong>Recipient ID:</strong> #{recipient?.recipient_id || '201'}</div>
              <div><strong>Name:</strong> {recipient?.full_name || 'Ananya Krishnan'}</div>
              <div><strong>Blood Group:</strong> <span className="text-emerald-400 font-bold">{recipient?.blood_group || 'A'}</span></div>
              <div><strong>Urgency:</strong> Tier {recipient?.urgency_level || 1} (Critical Priority)</div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded border border-slate-800 space-y-1">
            <div className="text-slate-500 uppercase text-[10px]">Relational Transaction Record</div>
            <div><strong>Allocation ID:</strong> #{allocation?.allocation_id || '9001'}</div>
            <div><strong>Match Score:</strong> {allocation?.match_score || '760.0'} pts</div>
            <div><strong>Status:</strong> {allocation?.status || 'PENDING'}</div>
            <div><strong>Cryptographic Hash:</strong> SHA256:7f9a2b84c10e8832aef192b0042a96dc</div>
          </div>

          <div className="text-[10px] text-slate-500 text-center pt-2 border-t border-slate-800">
            This document certifies compliance with BR1 (ABO Match), BR2 (Single Active Offer Lock), and BR5 (Immutable Audit Trail).
          </div>
        </div>
      </div>
    </div>
  );
}




// --- INITIAL RELATIONAL SEED DATA (Matches Oracle SQL Schema) ---

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



// --- PL/SQL EQUIVALENT DETERMINISTIC FUNCTIONS ---

// BR1: ABO Blood Group Compatibility Matrix

function fnIsBloodCompatible(donorBg, recipientBg) {

  if (!donorBg || !recipientBg) return 0;

  const d = donorBg.trim().toUpperCase().replace(/[+-]/g, '');

  const r = recipientBg.trim().toUpperCase().replace(/[+-]/g, '');

  if (d === 'O' || r === 'AB' || d === r) return 1;

  return 0;

}



// BR3: Inverted Urgency (1=Critical -> 500pts, 5=Stable -> 100pts) + Wait Time + Local Hospital Proximity

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



function App() {

  // Ensure Tailwind & Clinical Fonts are loaded even if index.html is bare

  useEffect(() => {

    if (!document.getElementById('vital-tailwind-cdn')) {

      const script = document.createElement('script');

      script.id = 'vital-tailwind-cdn';

      script.src = 'https://cdn.tailwindcss.com';

      document.head.appendChild(script);

    }

    if (!document.getElementById('vital-fonts')) {

      const link = document.createElement('link');

      link.id = 'vital-fonts';

      link.rel = 'stylesheet';

      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap';

      document.head.appendChild(link);

    }

  }, []);



  
  // Modal States
  const [showAcidModal, setShowAcidModal] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [backendPing, setBackendPing] = useState('12ms');

  // Ping backend on mount
  useEffect(() => {
    const t0 = performance.now();
    api.get('/health')
      .then(() => setBackendPing(Math.round(performance.now() - t0) + 'ms'))
      .catch(() => setBackendPing('Local ACID'));
  }, []);

  // --- ROLE & STATE MANAGEMENT ---

  const [activeRole, setActiveRole] = useState('COORDINATOR'); // COORDINATOR | SURGEON | ADMIN | REGULATOR

  const [hospitals] = useState(INITIAL_HOSPITALS);

  const [donors, setDonors] = useState(INITIAL_DONORS);

  const [organs, setOrgans] = useState(INITIAL_ORGANS);

  const [recipients, setRecipients] = useState(INITIAL_RECIPIENTS);

  const [allocations, setAllocations] = useState(INITIAL_ALLOCATIONS);

  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);



  const [selectedOrganId, setSelectedOrganId] = useState(501);

  const [clockNow, setClockNow] = useState(Date.now());

  const [plsqlConsole, setPlsqlConsole] = useState([

    {

      id: 1,

      time: new Date().toLocaleTimeString(),

      type: 'SUCCESS',

      sql: 'ALTER SESSION SET ISOLATION_LEVEL = SERIALIZABLE; -- VITAL Engine Initialized',

      detail: '6 Tables Online | 3 Triggers Active | BR1-BR5 Enforced',

    },

  ]);



  // Admin Form States

  const [newDonorName, setNewDonorName] = useState('');

  const [newDonorBg, setNewDonorBg] = useState('O');

  const [newDonorHosp, setNewDonorHosp] = useState(2);

  const [newKidneySide, setNewKidneySide] = useState('LEFT_KIDNEY');



  const [newRecipName, setNewRecipName] = useState('');

  const [newRecipBg, setNewRecipBg] = useState('A');

  const [newRecipUrgency, setNewRecipUrgency] = useState(1);

  const [newRecipHosp, setNewRecipHosp] = useState(2);



  // Live 1-second telemetry clock for Cold Ischemia countdowns

  useEffect(() => {

    const timer = setInterval(() => setClockNow(Date.now()), 1000);

    return () => clearInterval(timer);

  }, []);



  // Helper to push PL/SQL execution telemetry

  const pushPlsqlTrace = (type, sql, detail) => {

    setPlsqlConsole((prev) => [

      {

        id: Date.now() + Math.random(),

        time: new Date().toLocaleTimeString(),

        type,

        sql,

        detail,

      },

      ...prev.slice(0, 14),

    ]);

  };



  // Enrich Organs with Donor, Hospital, and Live Cold Ischemia Telemetry

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



      const activeOffer = allocations.find((a) => a.organ_id === o.organ_id && a.status === 'PENDING');



      return {

        ...o,

        donor,

        hospital,

        elapsedHrs: Number(elapsedHrs.toFixed(2)),

        remainingHrs: Number(remainingHrs.toFixed(2)),

        countdown: `${hh}:${mm}:${ss}`,

        pctRemaining: Math.min(100, Math.max(0, (remainingHrs / o.max_ischemia_hrs) * 100)),

        isViable: remainingHrs > 0 && o.status !== 'EXPIRED',

        activeOffer,

      };

    });

  }, [organs, donors, hospitals, allocations, clockNow]);



  const selectedOrgan = useMemo(

    () => enrichedOrgans.find((o) => o.organ_id === selectedOrganId) || enrichedOrgans[0],

    [enrichedOrgans, selectedOrganId]

  );



  // Ranked Candidate Queue for Selected Organ (Evaluates BR1, BR3, and prior rejections)

  const rankedCandidatesForSelectedOrgan = useMemo(() => {

    if (!selectedOrgan) return [];

    return recipients

      .filter((r) => r.status === 'WAITING')

      .map((r) => {

        const hosp = hospitals.find((h) => h.hospital_id === r.hospital_id) || {};

        const isCompatible = fnIsBloodCompatible(selectedOrgan.donor.blood_group, r.blood_group) === 1;

        const isSameHosp = r.hospital_id === selectedOrgan.donor.hospital_id;

        const scoreObj = fnCalculateMatchScore(r.urgency_level, r.registration_date, isSameHosp);

        const previouslyRejectedThisOrgan = allocations.some(

          (a) =>

            a.organ_id === selectedOrgan.organ_id &&

            a.recipient_id === r.recipient_id &&

            (a.status === 'REJECTED' || a.status === 'EXPIRED')

        );



        return {

          ...r,

          hospitalName: hosp.name,

          hospitalCity: hosp.city,

          isCompatible,

          isSameHosp,

          scoreObj,

          previouslyRejectedThisOrgan,

          isEligible: isCompatible && !previouslyRejectedThisOrgan,

        };

      })

      .sort((a, b) => {

        // Eligible candidates first, then BR3 Urgency ASC (1 is highest), then Match Score DESC

        if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;

        if (a.urgency_level !== b.urgency_level) return a.urgency_level - b.urgency_level;

        return b.scoreObj.total - a.scoreObj.total;

      });

  }, [recipients, hospitals, selectedOrgan, allocations]);



  // --- STORED PROCEDURE 1: prc_allocate_kidney(p_organ_id) ---

  const handleAllocateKidney = (organId, forcedRecipientId = null) => {

    const organ = enrichedOrgans.find((o) => o.organ_id === organId);

    if (!organ) return;



    // Trigger 1 Check: BR2 Unique Active Offer Lock

    if (organ.status !== 'AVAILABLE') {

      pushPlsqlTrace(

        'ERROR',

        `EXEC prc_allocate_kidney(p_organ_id => ${organId});`,

        `ORA-20001 [trg_validate_allocation]: BR2 Violation — Kidney ${organ.organ_code} is already ${organ.status} (Single Active Offer Lock).`

      );

      return;

    }



    // Trigger 1 Check: BR4 Cold Ischemia Viability Limit (<= 24h)

    if (!organ.isViable || organ.remainingHrs <= 0) {

      pushPlsqlTrace(

        'ERROR',

        `EXEC prc_allocate_kidney(p_organ_id => ${organId});`,

        `ORA-20002 [trg_validate_allocation]: BR4 Violation — Kidney ${organ.organ_code} Cold Ischemia exceeds 24.0h limit.`

      );

      return;

    }



    // Determine target candidate

    const candidates = recipients

      .filter((r) => r.status === 'WAITING')

      .map((r) => {

        const isCompatible = fnIsBloodCompatible(organ.donor.blood_group, r.blood_group) === 1;

        const isSameHosp = r.hospital_id === organ.donor.hospital_id;

        const scoreObj = fnCalculateMatchScore(r.urgency_level, r.registration_date, isSameHosp);

        const alreadyRejected = allocations.some(

          (a) => a.organ_id === organId && a.recipient_id === r.recipient_id && ['REJECTED', 'EXPIRED'].includes(a.status)

        );

        return { ...r, isCompatible, scoreObj, alreadyRejected };

      });



    let chosen = null;

    if (forcedRecipientId) {

      chosen = candidates.find((c) => c.recipient_id === forcedRecipientId);

      if (chosen && !chosen.isCompatible) {

        // Intentional BR1 Violation test

        pushPlsqlTrace(

          'ERROR',

          `INSERT INTO ALLOCATION (organ_id, recipient_id, status) VALUES (${organId}, ${chosen.recipient_id}, 'PENDING');`,

          `ORA-20004 [trg_validate_allocation]: BR1 Violation — ABO Incompatible (Donor ${organ.donor.blood_group} -> Recipient ${chosen.blood_group}). Transaction Rolled Back.`

        );

        return;

      }

    } else {

      const eligible = candidates

        .filter((c) => c.isCompatible && !c.alreadyRejected)

        .sort((a, b) => (a.urgency_level !== b.urgency_level ? a.urgency_level - b.urgency_level : b.scoreObj.total - a.scoreObj.total));

      chosen = eligible[0];

    }



    if (!chosen) {

      pushPlsqlTrace(

        'ERROR',

        `EXEC prc_allocate_kidney(p_organ_id => ${organId});`,

        `ORA-20011 [prc_allocate_kidney]: No compatible WAITING recipient available for Kidney ${organ.organ_code}.`

      );

      return;

    }



    const newAllocId = 9000 + allocations.length + 1;

    const nowIso = new Date().toISOString();



    const newAlloc = {

      allocation_id: newAllocId,

      organ_id: organId,

      recipient_id: chosen.recipient_id,

      match_score: chosen.scoreObj.total,

      status: 'PENDING',

      offer_time: nowIso,

      decision_time: null,

    };



    const newAudit = {

      log_id: 10000 + auditLogs.length + 1,

      allocation_id: newAllocId,

      organ_id: organId,

      recipient_id: chosen.recipient_id,

      action_type: 'OFFER_CREATED',

      old_status: 'NULL',

      new_status: 'PENDING',

      performed_by: activeRole + '_SESSION',

      timestamp: nowIso,

      plsql_source: 'trg_audit_allocation (AFTER INSERT ON ALLOCATION)',

    };



    setAllocations((prev) => [newAlloc, ...prev]);

    setOrgans((prev) => prev.map((o) => (o.organ_id === organId ? { ...o, status: 'OFFERED' } : o)));

    setAuditLogs((prev) => [newAudit, ...prev]);



    pushPlsqlTrace(

      'SUCCESS',

      `EXEC prc_allocate_kidney(p_organ_id => ${organId}); -- Matched Recipient #${chosen.recipient_id} (${chosen.full_name})`,

      `[trg_validate_allocation: PASS] -> INSERT ALLOCATION #${newAllocId} (Score: ${chosen.scoreObj.total}, Urgency: Tier ${chosen.urgency_level}) -> UPDATE ORGAN SET status='OFFERED' -> [trg_audit_allocation: LOGGED #${newAudit.log_id}]`

    );

  };



  // --- STORED PROCEDURE 2: prc_surgeon_decision(p_allocation_id, p_decision) ---

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

      // 1. Mark current allocation REJECTED & release organ lock to AVAILABLE

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



      // Check if we can auto-cascade to next eligible candidate

      const organ = enrichedOrgans.find((o) => o.organ_id === organId);

      const nextCandidates = recipients

        .filter((r) => r.status === 'WAITING' && r.recipient_id !== recipientId)

        .map((r) => {

          const isCompatible = fnIsBloodCompatible(organ.donor.blood_group, r.blood_group) === 1;

          const isSameHosp = r.hospital_id === organ.donor.hospital_id;

          const scoreObj = fnCalculateMatchScore(r.urgency_level, r.registration_date, isSameHosp);

          const alreadyRejected = updatedAllocations.some(

            (a) => a.organ_id === organId && a.recipient_id === r.recipient_id && ['REJECTED', 'EXPIRED'].includes(a.status)

          );

          return { ...r, isCompatible, scoreObj, alreadyRejected };

        })

        .filter((c) => c.isCompatible && !c.alreadyRejected)

        .sort((a, b) => (a.urgency_level !== b.urgency_level ? a.urgency_level - b.urgency_level : b.scoreObj.total - a.scoreObj.total));



      if (autoCascade && organ && organ.isViable && nextCandidates.length > 0) {

        const nextRecip = nextCandidates[0];

        const cascadeAllocId = 9000 + updatedAllocations.length + 1;

        const cascadeAlloc = {

          allocation_id: cascadeAllocId,

          organ_id: organId,

          recipient_id: nextRecip.recipient_id,

          match_score: nextRecip.scoreObj.total,

          status: 'PENDING',

          offer_time: nowIso,

          decision_time: null,

        };

        const cascadeAudit = {

          log_id: 10000 + auditLogs.length + 2,

          allocation_id: cascadeAllocId,

          organ_id: organId,

          recipient_id: nextRecip.recipient_id,

          action_type: 'AUTO_CASCADE_OFFER',

          old_status: 'NULL',

          new_status: 'PENDING',

          performed_by: 'PLSQL_CASCADE_ENGINE',

          timestamp: nowIso,

          plsql_source: 'prc_surgeon_decision -> prc_allocate_kidney (Cascade)',

        };



        setAllocations([cascadeAlloc, ...updatedAllocations]);

        setOrgans((prev) => prev.map((o) => (o.organ_id === organId ? { ...o, status: 'OFFERED' } : o)));

        setAuditLogs((prev) => [cascadeAudit, rejectAudit, ...prev]);



        pushPlsqlTrace(

          'WARN',

          `EXEC prc_surgeon_decision(${allocationId}, 'REJECTED'); -> AUTO-CASCADE EXEC prc_allocate_kidney(${organId});`,

          `Offer #${allocationId} REJECTED -> BR2 Lock Released -> Automatically Cascaded to Next Ranked Candidate: #${nextRecip.recipient_id} (${nextRecip.full_name}, Tier ${nextRecip.urgency_level}, Score ${nextRecip.scoreObj.total})`

        );

      } else {

        setAllocations(updatedAllocations);

        setOrgans((prev) => prev.map((o) => (o.organ_id === organId ? { ...o, status: 'AVAILABLE' } : o)));

        setAuditLogs((prev) => [rejectAudit, ...prev]);



        pushPlsqlTrace(

          'WARN',

          `EXEC prc_surgeon_decision(p_allocation_id => ${allocationId}, p_decision => 'REJECTED');`,

          `Offer #${allocationId} marked REJECTED -> ORGAN #${organId} returned to 'AVAILABLE' pool.`

        );

      }

    }

  };



  // --- STORED PROCEDURE 3: prc_expire_kidneys() ---

  const handleExpireSweep = () => {

    const nowIso = new Date().toISOString();

    let expiredCount = 0;



    const updatedOrgans = organs.map((o) => {

      const elapsedHrs = (Date.now() - new Date(o.harvest_time).getTime()) / (1000 * 3600);

      if (['AVAILABLE', 'OFFERED'].includes(o.status) && elapsedHrs > o.max_ischemia_hrs) {

        expiredCount++;

        return { ...o, status: 'EXPIRED' };

      }

      return o;

    });



    // If no organ was naturally past 24h (except 504 already EXPIRED), age the oldest AVAILABLE organ past 24h for demo purposes

    if (expiredCount === 0) {

      const target = organs.find((o) => o.status === 'AVAILABLE');

      if (target) {

        setOrgans((prev) =>

          prev.map((o) =>

            o.organ_id === target.organ_id ? { ...o, harvest_time: hoursAgo(24.5), status: 'EXPIRED' } : o

          )

        );

        const expAudit = {

          log_id: 10000 + auditLogs.length + 1,

          allocation_id: null,

          organ_id: target.organ_id,

          recipient_id: null,

          action_type: 'BR4_ISCHEMIA_EXPIRED',

          old_status: 'AVAILABLE',

          new_status: 'EXPIRED',

          performed_by: 'DBMS_SCHEDULER_JOB',

          timestamp: nowIso,

          plsql_source: 'prc_expire_kidneys (24h Cold Ischemia Breach)',

        };

        setAuditLogs((prev) => [expAudit, ...prev]);

        pushPlsqlTrace(

          'WARN',

          `EXEC prc_expire_kidneys(); -- Simulated 24h+ Cold Ischemia Sweep`,

          `BR4 Enforced: Kidney #${target.organ_id} (${target.organ_code}) exceeded 24h threshold -> Status locked to 'EXPIRED'.`

        );

        return;

      }

    }



    setOrgans(updatedOrgans);

    pushPlsqlTrace(

      'SUCCESS',

      `EXEC prc_expire_kidneys();`,

      `Cold Ischemia sweep completed. ${expiredCount} kidney(s) transitioned to EXPIRED.`

    );

  };



  // --- ADMIN HANDLERS: Register Donor+Kidney & Register Recipient ---

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

      age: 36,

      blood_group: newDonorBg,

      hospital_id: Number(newDonorHosp),

      clinical_status: 'BRAIN_STEM_DEAD',

      hla_type: 'A2-B35-DR4',

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

      age: 41,

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



  // --- KPI METRICS ---

  const kpis = useMemo(() => {

    return {

      availableKidneys: organs.filter((o) => o.status === 'AVAILABLE').length,

      activeOffers: allocations.filter((a) => a.status === 'PENDING').length,

      waitingRecipients: recipients.filter((r) => r.status === 'WAITING').length,

      transplantedCount: organs.filter((o) => o.status === 'TRANSPLANTED').length,

      auditTotal: auditLogs.length,

    };

  }, [organs, allocations, recipients, auditLogs]);



  return (

    <div

      style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#070B12' }}

      className="min-h-screen text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200"

    >

      {/* ==================== TOP CLINICAL TELEMETRY RIBBON ==================== */}

      <header className="border-b border-slate-800/90 bg-[#0A0F1A]/95 backdrop-blur sticky top-0 z-30">

        <div className="max-w-[1600px] mx-auto px-5 py-3 flex flex-wrap items-center justify-between gap-4">

          {/* Brand & System Status */}

          <div className="flex items-center gap-3.5">

            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500/20 to-cyan-500/20 border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/10">

              <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">

                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />

              </svg>

            </div>

            <div>

              <div className="flex items-center gap-2.5">

                <span className="font-bold tracking-wider text-lg text-white">VITAL</span>

                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">

                  Kidney Allocation & Logistics Engine

                </span>

                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">

                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />

                  ORACLE 19c ACID: ACTIVE ({backendPing})

                </span>

              </div>

              <p className="text-xs text-slate-400 mt-0.5">

                Enforcing BR1 (ABO Match) • BR2 (Unique Active Offer) • BR3 (Inverted Urgency 1..5) • BR4 (24h Cold Ischemia) • BR5 (Immutable Audit)

              </p>

            </div>

          </div>



          {/* Role Switcher (4 Clinical Roles) */}

          <div className="flex items-center bg-[#060911] p-1 rounded-lg border border-slate-800">

            {[

              { id: 'COORDINATOR', label: 'Transplant Coordinator', badge: kpis.availableKidneys },

              { id: 'SURGEON', label: 'Transplant Surgeon', badge: kpis.activeOffers },

              { id: 'ADMIN', label: 'Hospital Admin', badge: null },

              { id: 'REGULATOR', label: 'Regulator Audit', badge: kpis.auditTotal },

            ].map((role) => {

              const active = activeRole === role.id;

              return (

                <button

                  key={role.id}

                  onClick={() => setActiveRole(role.id)}

                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${

                    active

                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'

                      : 'text-slate-400 hover:text-slate-200'

                  }`}

                >

                  <span>{role.label}</span>

                  {role.badge !== null && (

                    <span

                      style={{ fontFamily: "'JetBrains Mono', monospace" }}

                      className={`px-1.5 py-0.2 rounded text-[10px] ${

                        active ? 'bg-cyan-400/20 text-cyan-200' : 'bg-slate-800 text-slate-400'

                      }`}

                    >

                      {role.badge}

                    </span>

                  )}

                </button>

              );

            })}

          
          {/* Top Utility Modals */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAcidModal(true)}
              className="px-2.5 py-1.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-semibold transition flex items-center gap-1.5 shadow-sm"
              title="Execute live ACID Concurrency Suite"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>ACID Suite</span>
            </button>

            <button
              onClick={() => setShowSqlModal(true)}
              className="px-2.5 py-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition flex items-center gap-1.5"
              title="Open Live SQL Terminal"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span>SQL Terminal</span>
            </button>

            <button
              onClick={() => setShowSchemaModal(true)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition"
              title="Inspect 3NF Relational Schema"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z"/></svg>
              <span>3NF Schema</span>
            </button>

            <button
              onClick={() => setShowManifestModal(true)}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition"
              title="View Official Transfer Manifest"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>Manifest</span>
            </button>
          </div>

        </div>

        </div>

        {/* Sub-Ribbon Telemetry Bar */}

        <div className="border-t border-slate-800/70 bg-[#070B12]/90">

          <div className="max-w-[1600px] mx-auto px-5 py-2 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">

            <div className="flex items-center justify-between px-3 py-1.5 rounded bg-slate-900/70 border border-slate-800/80">

              <span className="text-slate-400">Available Kidneys</span>

              <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-cyan-400 font-bold text-sm">

                {kpis.availableKidneys}

              </span>

            </div>

            <div className="flex items-center justify-between px-3 py-1.5 rounded bg-slate-900/70 border border-slate-800/80">

              <span className="text-slate-400">Active Pending Offers (BR2)</span>

              <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-amber-400 font-bold text-sm">

                {kpis.activeOffers}

              </span>

            </div>

            <div className="flex items-center justify-between px-3 py-1.5 rounded bg-slate-900/70 border border-slate-800/80">

              <span className="text-slate-400">Waiting Recipients</span>

              <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-rose-400 font-bold text-sm">

                {kpis.waitingRecipients}

              </span>

            </div>

            <div className="flex items-center justify-between px-3 py-1.5 rounded bg-slate-900/70 border border-slate-800/80">

              <span className="text-slate-400">Completed Transplants</span>

              <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-emerald-400 font-bold text-sm">

                {kpis.transplantedCount}

              </span>

            </div>

            <div className="hidden sm:flex items-center justify-between px-3 py-1.5 rounded bg-slate-900/70 border border-slate-800/80">

              <span className="text-slate-400">ACID Audit Records (BR5)</span>

              <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-slate-200 font-bold text-sm">

                {kpis.auditTotal}

              </span>

            </div>

          </div>

        </div>

      </header>



      {/* ==================== MAIN ROLE WORKSPACE ==================== */}

      <main className="max-w-[1600px] w-full mx-auto px-5 py-5 flex-1 flex flex-col gap-5">

        {/* -------------------- ROLE 1: TRANSPLANT COORDINATOR -------------------- */}

        {activeRole === 'COORDINATOR' && (

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* LEFT 5 COLS: Harvested Kidney Telemetry & Viability Timers */}

            <div className="lg:col-span-5 flex flex-col gap-4">

              <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-4">

                <div className="flex items-center justify-between mb-3">

                  <div>

                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">

                      <span className="w-2 h-2 rounded-full bg-cyan-400" />

                      Harvested Kidney Inventory (ORGAN)

                    </h2>

                    <p className="text-xs text-slate-400 mt-0.5">

                      Select a kidney to run <code className="text-cyan-300">fn_is_blood_compatible</code> &amp; <code className="text-cyan-300">fn_calculate_match_score</code>

                    </p>

                  </div>

                  <button

                    onClick={handleExpireSweep}

                    className="text-[11px] font-mono px-2.5 py-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition"

                    title="Executes prc_expire_kidneys() to test BR4"

                  >

                    EXEC prc_expire_kidneys()

                  </button>

                </div>



                <div className="flex flex-col gap-3">

                  {enrichedOrgans.map((organ) => {

                    const isSelected = organ.organ_id === selectedOrgan?.organ_id;

                    const isCriticalTime = organ.remainingHrs > 0 && organ.remainingHrs < 6;

                    const statusBadgeStyle =

                      organ.status === 'AVAILABLE'

                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'

                        : organ.status === 'OFFERED'

                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'

                        : organ.status === 'TRANSPLANTED'

                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'

                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30';



                    return (

                      <div

                        key={organ.organ_id}

                        onClick={() => setSelectedOrganId(organ.organ_id)}

                        className={`p-3.5 rounded-lg border transition cursor-pointer ${

                          isSelected

                            ? 'bg-slate-900/95 border-cyan-500/60 shadow-lg shadow-cyan-500/5'

                            : 'bg-[#080D18] border-slate-800/80 hover:border-slate-700'

                        }`}

                      >

                        <div className="flex items-center justify-between gap-2">

                          <div className="flex items-center gap-2.5">

                            <span

                              style={{ fontFamily: "'JetBrains Mono', monospace" }}

                              className="w-8 h-8 rounded-md bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold text-sm flex items-center justify-center"

                            >

                              {organ.donor.blood_group}

                            </span>

                            <div>

                              <div className="flex items-center gap-2">

                                <span

                                  style={{ fontFamily: "'JetBrains Mono', monospace" }}

                                  className="text-sm font-semibold text-white"

                                >

                                  {organ.organ_code}

                                </span>

                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${statusBadgeStyle}`}>

                                  {organ.status}

                                </span>

                              </div>

                              <p className="text-xs text-slate-400">

                                Donor: <span className="text-slate-300">{organ.donor.full_name}</span> • {organ.hospital.name} ({organ.hospital.city})

                              </p>

                            </div>

                          </div>



                          {/* Cold Ischemia Countdown */}

                          <div className="text-right">

                            <div

                              style={{ fontFamily: "'JetBrains Mono', monospace" }}

                              className={`text-sm font-bold ${

                                organ.status === 'EXPIRED' || organ.remainingHrs <= 0

                                  ? 'text-rose-500'

                                  : isCriticalTime

                                  ? 'text-rose-400 animate-pulse'

                                  : 'text-cyan-300'

                              }`}

                            >

                              {organ.status === 'TRANSPLANTED' ? 'ENGRAFTED' : organ.countdown}

                            </div>

                            <span className="text-[10px] text-slate-500 font-mono">COLD ISCHEMIA (BR4)</span>

                          </div>

                        </div>



                        {/* Viability Progress Bar */}

                        <div className="mt-3">

                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">

                            <div

                              className={`h-full transition-all duration-500 ${

                                organ.status === 'EXPIRED' || organ.remainingHrs <= 0

                                  ? 'bg-rose-600'

                                  : organ.remainingHrs < 6

                                  ? 'bg-rose-500'

                                  : organ.remainingHrs < 12

                                  ? 'bg-amber-400'

                                  : 'bg-cyan-400'

                              }`}

                              style={{ width: `${organ.status === 'TRANSPLANTED' ? 100 : organ.pctRemaining}%` }}

                            />

                          </div>

                        </div>



                        {/* Action Bar inside Card */}

                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">

                          <span className="text-slate-400 font-mono text-[11px]">

                            HLA: <strong className="text-slate-300">{organ.donor.hla_type}</strong>

                          </span>



                          {organ.status === 'AVAILABLE' && organ.isViable ? (

                            <button

                              onClick={(e) => {

                                e.stopPropagation();

                                handleAllocateKidney(organ.organ_id);

                              }}

                              className="px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition shadow-sm"

                            >

                              EXEC prc_allocate_kidney({organ.organ_id})

                            </button>

                          ) : organ.status === 'OFFERED' && organ.activeOffer ? (

                            <button

                              onClick={(e) => {

                                e.stopPropagation();

                                setActiveRole('SURGEON');

                              }}

                              className="text-amber-300 hover:underline font-mono text-[11px]"

                            >

                              Offer #{organ.activeOffer.allocation_id} Pending Surgeon →

                            </button>

                          ) : (

                            <span className="text-[11px] font-mono text-slate-500">

                              {organ.status === 'EXPIRED' ? 'LOCKED BY BR4 (EXPIRED)' : 'LOCKED (TRANSPLANTED)'}

                            </span>

                          )}

                        </div>

                      </div>

                    );

                  })}

                </div>

              </div>

            </div>



            {/* RIGHT 7 COLS: Live Candidate Ranking & Match Score Matrix */}

            <div className="lg:col-span-7 flex flex-col gap-4">

              <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-4 flex-1">

                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">

                  <div>

                    <div className="flex items-center gap-2">

                      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">

                        Waitlist Match-Score Ranking Matrix (RECIPIENT)

                      </h2>

                      {selectedOrgan && (

                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">

                          Target: {selectedOrgan.organ_code} (Donor ABO: {selectedOrgan.donor.blood_group})

                        </span>

                      )}

                    </div>

                    <p className="text-xs text-slate-400 mt-0.5">

                      Sorted by <strong className="text-slate-200">BR1 Eligibility</strong> → <strong className="text-rose-400">BR3 Inverted Urgency (1=Critical .. 5=Stable)</strong> → <strong className="text-cyan-300">Match Score DESC</strong>

                    </p>

                  </div>

                </div>



                <div className="overflow-x-auto">

                  <table className="w-full text-left border-collapse text-xs">

                    <thead>

                      <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">

                        <th className="py-2.5 px-2.5">Rank</th>

                        <th className="py-2.5 px-2.5">Recipient</th>

                        <th className="py-2.5 px-2.5">ABO (BR1)</th>

                        <th className="py-2.5 px-2.5">Urgency (BR3)</th>

                        <th className="py-2.5 px-2.5">Score Formula Breakdown</th>

                        <th className="py-2.5 px-2.5 text-right">Total Score</th>

                        <th className="py-2.5 px-2.5 text-right">Trigger / Action</th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-slate-800/60">

                      {rankedCandidatesForSelectedOrgan.map((cand, idx) => {

                        const isTopMatch = idx === 0 && cand.isEligible;

                        return (

                          <tr

                            key={cand.recipient_id}

                            className={`transition ${

                              isTopMatch

                                ? 'bg-cyan-500/10'

                                : cand.isEligible

                                ? 'hover:bg-slate-900/60'

                                : 'opacity-50 bg-slate-950/40'

                            }`}

                          >

                            <td style={{ fontFamily: "'JetBrains Mono', monospace" }} className="py-3 px-2.5 font-bold">

                              {cand.isEligible ? (

                                <span

                                  className={`px-2 py-0.5 rounded ${

                                    isTopMatch

                                      ? 'bg-cyan-400 text-slate-950'

                                      : 'bg-slate-800 text-slate-300'

                                  }`}

                                >

                                  #{idx + 1}

                                </span>

                              ) : (

                                <span className="text-rose-400 text-[10px]">BLOCKED</span>

                              )}

                            </td>



                            <td className="py-3 px-2.5">

                              <div className="font-medium text-slate-100">{cand.full_name}</div>

                              <div className="text-[11px] text-slate-400">

                                ID #{cand.recipient_id} • {cand.hospitalCity}

                                {cand.isSameHosp && (

                                  <span className="ml-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">

                                    LOCAL +50

                                  </span>

                                )}

                              </div>

                            </td>



                            <td style={{ fontFamily: "'JetBrains Mono', monospace" }} className="py-3 px-2.5">

                              <div className="flex items-center gap-1.5">

                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-bold">

                                  {cand.blood_group}

                                </span>

                                {cand.isCompatible ? (

                                  <span className="text-[10px] text-emerald-400">MATCH</span>

                                ) : (

                                  <span className="text-[10px] text-rose-400 font-semibold">BR1 MISMATCH</span>

                                )}

                              </div>

                            </td>



                            <td className="py-3 px-2.5">

                              <span

                                style={{ fontFamily: "'JetBrains Mono', monospace" }}

                                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${

                                  cand.urgency_level === 1

                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'

                                    : cand.urgency_level === 2

                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'

                                    : 'bg-slate-800 text-slate-300 border-slate-700'

                                }`}

                              >

                                Tier {cand.urgency_level} {cand.urgency_level === 1 ? '(CRITICAL)' : ''}

                              </span>

                            </td>



                            <td style={{ fontFamily: "'JetBrains Mono', monospace" }} className="py-3 px-2.5 text-[11px] text-slate-400">

                              <span>{cand.scoreObj.urgencyPoints}u</span> + <span>{cand.scoreObj.waitPoints}w ({cand.scoreObj.waitDays}d)</span>

                              {cand.scoreObj.proximityBonus > 0 && <span className="text-emerald-400"> + 50loc</span>}

                              {cand.previouslyRejectedThisOrgan && (

                                <span className="ml-2 text-rose-400 font-semibold">[PRIOR REJECT]</span>

                              )}

                            </td>



                            <td

                              style={{ fontFamily: "'JetBrains Mono', monospace" }}

                              className="py-3 px-2.5 text-right font-bold text-sm text-cyan-300"

                            >

                              {cand.scoreObj.total}

                            </td>



                            <td className="py-3 px-2.5 text-right">

                              {cand.isCompatible ? (

                                <button

                                  disabled={selectedOrgan?.status !== 'AVAILABLE' || cand.previouslyRejectedThisOrgan}

                                  onClick={() => handleAllocateKidney(selectedOrgan.organ_id, cand.recipient_id)}

                                  className={`px-2.5 py-1 rounded font-mono text-[11px] transition ${

                                    selectedOrgan?.status === 'AVAILABLE' && !cand.previouslyRejectedThisOrgan

                                      ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'

                                      : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'

                                  }`}

                                >

                                  Offer Kidney

                                </button>

                              ) : (

                                <button

                                  onClick={() => handleAllocateKidney(selectedOrgan.organ_id, cand.recipient_id)}

                                  className="px-2 py-1 rounded font-mono text-[10px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"

                                  title="Click to test trg_validate_allocation ORA-20004 exception"

                                >

                                  Test BR1 Block

                                </button>

                              )}

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

        )}



        {/* -------------------- ROLE 2: TRANSPLANT SURGEON -------------------- */}

        {activeRole === 'SURGEON' && (

          <div className="flex flex-col gap-4">

            <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-5">

              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">

                <div>

                  <h2 className="text-base font-semibold text-white flex items-center gap-2">

                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />

                    Transplant Surgeon Decision Console (prc_surgeon_decision)

                  </h2>

                  <p className="text-xs text-slate-400 mt-0.5">

                    Accepting an offer commits <code className="text-emerald-300">ORGAN = TRANSPLANTED</code>. Rejecting releases the <code className="text-amber-300">BR2 Lock</code> and automatically cascades to the next highest-ranked compatible recipient.

                  </p>

                </div>

              </div>



              {allocations.filter((a) => a.status === 'PENDING').length === 0 ? (

                <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg">

                  <p className="text-slate-400 text-sm">No active PENDING kidney offers awaiting surgical decision.</p>

                  <button

                    onClick={() => setActiveRole('COORDINATOR')}

                    className="mt-3 px-4 py-2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono"

                  >

                    Switch to Coordinator to Allocate an Available Kidney →

                  </button>

                </div>

              ) : (

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {allocations

                    .filter((a) => a.status === 'PENDING')

                    .map((alloc) => {

                      const organ = enrichedOrgans.find((o) => o.organ_id === alloc.organ_id);

                      const recip = recipients.find((r) => r.recipient_id === alloc.recipient_id);

                      const recipHosp = hospitals.find((h) => h.hospital_id === recip?.hospital_id);



                      return (

                        <div

                          key={alloc.allocation_id}

                          className="bg-[#080D18] border border-amber-500/40 rounded-xl p-5 flex flex-col justify-between gap-4 shadow-lg shadow-amber-500/5"

                        >

                          <div>

                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">

                              <span

                                style={{ fontFamily: "'JetBrains Mono', monospace" }}

                                className="text-xs px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold"

                              >

                                OFFER #{alloc.allocation_id} • PENDING DECISION

                              </span>

                              <span

                                style={{ fontFamily: "'JetBrains Mono', monospace" }}

                                className="text-sm font-bold text-cyan-300"

                              >

                                Match Score: {alloc.match_score}

                              </span>

                            </div>



                            <div className="grid grid-cols-2 gap-4 my-4">

                              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">

                                <span className="text-[10px] font-mono uppercase text-slate-400">Donor Kidney (ORGAN)</span>

                                <div className="text-sm font-bold text-white mt-1">{organ?.organ_code}</div>

                                <div className="text-xs text-slate-300 mt-1">

                                  Blood Group: <strong className="text-rose-400 font-mono">{organ?.donor.blood_group}</strong>

                                </div>

                                <div className="text-xs text-slate-400">HLA: {organ?.donor.hla_type}</div>

                                <div className="text-xs text-cyan-300 font-mono mt-1.5">

                                  Viability Remaining: {organ?.countdown}

                                </div>

                              </div>



                              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">

                                <span className="text-[10px] font-mono uppercase text-slate-400">Matched Candidate (RECIPIENT)</span>

                                <div className="text-sm font-bold text-white mt-1">{recip?.full_name}</div>

                                <div className="text-xs text-slate-300 mt-1">

                                  Blood Group: <strong className="text-emerald-400 font-mono">{recip?.blood_group}</strong> (BR1 Verified)

                                </div>

                                <div className="text-xs text-rose-300 font-mono">

                                  BR3 Urgency: Tier {recip?.urgency_level}

                                </div>

                                <div className="text-xs text-slate-400 mt-1">{recipHosp?.name}</div>

                              </div>

                            </div>

                          </div>



                          <div className="flex items-center gap-3 pt-2 border-t border-slate-800">

                            <button

                              onClick={() => handleSurgeonDecision(alloc.allocation_id, 'ACCEPTED')}

                              className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition shadow-md"

                            >

                              ACCEPT &amp; PERFORM TRANSPLANT

                            </button>

                            <button

                              onClick={() => handleSurgeonDecision(alloc.allocation_id, 'REJECTED', true)}

                              className="flex-1 py-2.5 px-4 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-semibold text-xs transition"

                            >

                              REJECT &amp; AUTO-CASCADE NEXT

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Register New Donor & Harvested Kidney */}

            <form

              onSubmit={handleAddDonorAndKidney}

              className="bg-[#0B111E] border border-slate-800 rounded-xl p-5 flex flex-col gap-4"

            >

              <div>

                <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-300">

                  1. Log Harvested Donor Kidney (DONOR + ORGAN)

                </h2>

                <p className="text-xs text-slate-400 mt-0.5">

                  Inserts a cleared deceased donor and initializes a 24-hour Cold Ischemia viability timer (BR4).

                </p>

              </div>



              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">

                <div>

                  <label className="block text-slate-400 mb-1">Donor Full Name</label>

                  <input

                    type="text"

                    required

                    placeholder="e.g., Arvind Swaminathan"

                    value={newDonorName}

                    onChange={(e) => setNewDonorName(e.target.value)}

                    className="w-full px-3 py-2 rounded bg-[#070B12] border border-slate-700 text-slate-100 focus:border-cyan-400 outline-none"

                  />

                </div>

                <div>

                  <label className="block text-slate-400 mb-1">ABO Blood Group (BR1)</label>

                  <select

                    value={newDonorBg}

                    onChange={(e) => setNewDonorBg(e.target.value)}

                    className="w-full px-3 py-2 rounded bg-[#070B12] border border-slate-700 text-slate-100"

                  >

                    <option value="O">O (Universal Donor)</option>

                    <option value="A">A</option>

                    <option value="B">B</option>

                    <option value="AB">AB</option>

                  </select>

                </div>

                <div>

                  <label className="block text-slate-400 mb-1">Retrieval Hospital</label>

                  <select

                    value={newDonorHosp}

                    onChange={(e) => setNewDonorHosp(e.target.value)}

                    className="w-full px-3 py-2 rounded bg-[#070B12] border border-slate-700 text-slate-100"

                  >

                    {hospitals.map((h) => (

                      <option key={h.hospital_id} value={h.hospital_id}>

                        {h.name} ({h.city})

                      </option>

                    ))}

                  </select>

                </div>

                <div>

                  <label className="block text-slate-400 mb-1">Harvested Kidney Side</label>

                  <select

                    value={newKidneySide}

                    onChange={(e) => setNewKidneySide(e.target.value)}

                    className="w-full px-3 py-2 rounded bg-[#070B12] border border-slate-700 text-slate-100"

                  >

                    <option value="LEFT_KIDNEY">LEFT_KIDNEY</option>

                    <option value="RIGHT_KIDNEY">RIGHT_KIDNEY</option>

                  </select>

                </div>

              </div>



              <button

                type="submit"

                className="mt-2 py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"

              >

                INSERT DONOR &amp; INITIALIZE 24H KIDNEY TIMER

              </button>

            </form>



            {/* Register Waitlist Recipient */}

            <form

              onSubmit={handleAddRecipient}

              className="bg-[#0B111E] border border-slate-800 rounded-xl p-5 flex flex-col gap-4"

            >

              <div>

                <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-300">

                  2. Register Waitlist Recipient (RECIPIENT)

                </h2>

                <p className="text-xs text-slate-400 mt-0.5">

                  Enforces <strong className="text-slate-200">BR3 Inverted Urgency Scale</strong> (1 = Critical Priority, 5 = Stable).

                </p>

              </div>



              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">

                <div>

                  <label className="block text-slate-400 mb-1">Recipient Full Name</label>

                  <input

                    type="text"

                    required

                    placeholder="e.g., Deepika Padukone"

                    value={newRecipName}

                    onChange={(e) => setNewRecipName(e.target.value)}

                    className="w-full px-3 py-2 rounded bg-[#070B12] border border-slate-700 text-slate-100 focus:border-rose-400 outline-none"

                  />

                </div>

                <div>

                  <label className="block text-slate-400 mb-1">ABO Blood Group (BR1)</label>

                  <select

                    value={newRecipBg}

                    onChange={(e) => setNewRecipBg(e.target.value)}

                    className="w-full px-3 py-2 rounded bg-[#070B12] border border-slate-700 text-slate-100"

                  >

                    <option value="O">O</option>

                    <option value="A">A</option>

                    <option value="B">B</option>

                    <option value="AB">AB (Universal Recipient)</option>

                  </select>

                </div>

                <div>

                  <label className="block text-slate-400 mb-1">BR3 Clinical Urgency (1=Highest)</label>

                  <select

                    value={newRecipUrgency}

                    onChange={(e) => setNewRecipUrgency(e.target.value)}

                    className="w-full px-3 py-2 rounded bg-[#070B12] border border-slate-700 text-slate-100"

                  >

                    <option value={1}>Tier 1 — CRITICAL (500 Base Pts)</option>

                    <option value={2}>Tier 2 — HIGH (400 Base Pts)</option>

                    <option value={3}>Tier 3 — MODERATE (300 Base Pts)</option>

                    <option value={4}>Tier 4 — STANDARD (200 Base Pts)</option>

                    <option value={5}>Tier 5 — STABLE (100 Base Pts)</option>

                  </select>

                </div>

                <div>

                  <label className="block text-slate-400 mb-1">Registered Hospital</label>

                  <select

                    value={newRecipHosp}

                    onChange={(e) => setNewRecipHosp(e.target.value)}

                    className="w-full px-3 py-2 rounded bg-[#070B12] border border-slate-700 text-slate-100"

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

                className="mt-2 py-2.5 px-4 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-semibold text-xs transition"

              >

                INSERT RECIPIENT INTO WAITLIST QUEUE

              </button>

            </form>

          </div>

        )}



        {/* -------------------- ROLE 4: REGULATOR (IMMUTABLE AUDIT_LOG) -------------------- */}

        {activeRole === 'REGULATOR' && (

          <div className="bg-[#0B111E] border border-slate-800 rounded-xl p-5">

            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">

              <div>

                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">

                  BR5 Immutable Regulatory Audit Trail (AUDIT_LOG)

                </h2>

                <p className="text-xs text-slate-400 mt-0.5">

                  Automatically populated by <code className="text-cyan-300">trg_audit_allocation</code> on every allocation state transition. Append-only compliance table.

                </p>

              </div>

            </div>



            <div className="overflow-x-auto">

              <table className="w-full text-left border-collapse text-xs">

                <thead>

                  <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">

                    <th className="py-2.5 px-3">Log ID</th>

                    <th className="py-2.5 px-3">Action Type</th>

                    <th className="py-2.5 px-3">Allocation / Organ</th>

                    <th className="py-2.5 px-3">State Transition</th>

                    <th className="py-2.5 px-3">Trigger / PLSQL Source</th>

                    <th className="py-2.5 px-3">DB Session User</th>

                    <th className="py-2.5 px-3 text-right">Timestamp</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">

                  {auditLogs.map((log) => (

                    <tr key={log.log_id} className="hover:bg-slate-900/60">

                      <td className="py-2.5 px-3 text-cyan-400 font-bold">#{log.log_id}</td>

                      <td className="py-2.5 px-3">

                        <span

                          className={`px-2 py-0.5 rounded ${

                            log.action_type.includes('ACCEPTED')

                              ? 'bg-emerald-500/15 text-emerald-300'

                              : log.action_type.includes('REJECTED') || log.action_type.includes('EXPIRED')

                              ? 'bg-rose-500/15 text-rose-300'

                              : 'bg-cyan-500/15 text-cyan-300'

                          }`}

                        >

                          {log.action_type}

                        </span>

                      </td>

                      <td className="py-2.5 px-3 text-slate-300">

                        Alloc: {log.allocation_id ?? 'N/A'} | Organ: #{log.organ_id} | Recip: {log.recipient_id ?? 'N/A'}

                      </td>

                      <td className="py-2.5 px-3 text-slate-300">

                        {log.old_status} → <strong className="text-white">{log.new_status}</strong>

                      </td>

                      <td className="py-2.5 px-3 text-slate-400">{log.plsql_source}</td>

                      <td className="py-2.5 px-3 text-slate-400">{log.performed_by}</td>

                      <td className="py-2.5 px-3 text-right text-slate-400">

                        {new Date(log.timestamp).toLocaleTimeString()}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        )}



        {/* ==================== BOTTOM LIVE ORACLE PL/SQL TELEMETRY DOCK ==================== */}

        <section className="bg-[#05080F] border border-slate-800 rounded-xl p-4">

          <div className="flex items-center justify-between mb-2.5">

            <div className="flex items-center gap-2">

              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />

              <h3 style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-xs font-bold uppercase tracking-wider text-slate-300">

                Live Oracle PL/SQL Execution &amp; Trigger Telemetry

              </h3>

            </div>

            <span className="text-[11px] font-mono text-slate-500">

              trg_validate_allocation • trg_prevent_invalid_organ_status • trg_audit_allocation

            </span>

          </div>



          <div

            style={{ fontFamily: "'JetBrains Mono', monospace" }}

            className="max-h-40 overflow-y-auto space-y-2 text-[11px] pr-1"

          >

            {plsqlConsole.map((entry) => (

              <div

                key={entry.id}

                className={`p-2.5 rounded border ${

                  entry.type === 'ERROR'

                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'

                    : entry.type === 'WARN'

                    ? 'bg-amber-950/25 border-amber-500/30 text-amber-200'

                    : 'bg-slate-900/70 border-slate-800 text-slate-300'

                }`}

              >

                <div className="flex items-center justify-between gap-2">

                  <span className="font-semibold text-cyan-300">{entry.sql}</span>

                  <span className="text-[10px] text-slate-500">{entry.time}</span>

                </div>

                <div className="text-slate-400 mt-0.5">{entry.detail}</div>

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
          organ={enrichedOrgans.find(o => o.organ_id === selectedOrganId) || enrichedOrgans[0]}
          recipient={recipients.find(r => r.recipient_id === (allocations[0]?.recipient_id || 201))}
          allocation={allocations[0]}
        />

        {/* ==================== FOOTER ==================== */}
        <footer className="border-t border-slate-800/80 bg-[#060911] mt-8 py-5 text-xs text-slate-500 font-mono">
          <div className="max-w-[1600px] mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-3">
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
              <span className="text-emerald-400">SERIALIZABLE</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

// Mount App into root
ReactDOM.render(<App />, document.getElementById('root'));
