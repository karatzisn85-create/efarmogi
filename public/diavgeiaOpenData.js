/**
 * Ανάκτηση δημοσιευμένων πράξεων από το OpenData API της Διαύγειας.
 * https://diavgeia.gov.gr/luminapi/opendata/
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DIAVGEIA_BASE = 'https://diavgeia.gov.gr/luminapi/opendata';

function normalizeAda(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function isoDateFromMs(ms) {
  if (!ms || !Number.isFinite(ms)) return '';
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        success: false,
        error: text || `HTTP ${res.status}`,
        httpStatus: res.status,
      };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    if (e?.name === 'AbortError') {
      return { success: false, error: 'Η ανάκτηση από τη Διαύγεια διήρκεσε πολύ.' };
    }
    return { success: false, error: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} adaRaw
 */
async function fetchDiavgeiaDecisionByAda(adaRaw) {
  const ada = normalizeAda(adaRaw);
  if (!ada) {
    return { success: false, error: 'Συμπληρώστε τον ΑΔΑ.' };
  }
  if (!/^[Α-ΩA-Z0-9]+-[Α-ΩA-Z0-9]+$/u.test(ada)) {
    return { success: false, error: 'Μη έγκυρη μορφή ΑΔΑ (π.χ. ΡΩΕΚΩΨΜ-Σ0Υ).' };
  }

  const url = `${DIAVGEIA_BASE}/decisions/${encodeURIComponent(ada)}.json`;
  const res = await fetchJson(url);
  if (!res.success) {
    const msg = String(res.error || '');
    if (res.httpStatus === 404 || /not found/i.test(msg)) {
      return { success: false, error: 'Δεν βρέθηκε πράξη με αυτόν τον ΑΔΑ στη Διαύγεια.' };
    }
    return { success: false, error: res.error || 'Αποτυχία ανάκτησης από Διαύγεια.' };
  }

  const d = res.data || {};
  const issueDate = isoDateFromMs(d.issueDate);
  const publishDate = isoDateFromMs(d.publishTimestamp);

  let organization = '';
  let organizationSupervisor = '';
  if (d.organizationId) {
    const orgRes = await fetchJson(`${DIAVGEIA_BASE}/organizations/${d.organizationId}.json`);
    if (orgRes.success) {
      organization = String(orgRes.data?.label || '').trim();
      organizationSupervisor = String(orgRes.data?.supervisorLabel || '').trim();
    }
  }

  let decisionType = '';
  if (d.decisionTypeId) {
    const typeRes = await fetchJson(
      `${DIAVGEIA_BASE}/types/${encodeURIComponent(d.decisionTypeId)}.json`
    );
    if (typeRes.success) decisionType = String(typeRes.data?.label || d.decisionTypeId).trim();
  }

  let unit = '';
  const unitId = Array.isArray(d.unitIds) ? d.unitIds[0] : '';
  if (unitId) {
    const unitRes = await fetchJson(`${DIAVGEIA_BASE}/units/${unitId}.json`);
    if (unitRes.success) unit = String(unitRes.data?.label || '').trim();
  }

  const documentUrl = d.documentUrl
    || `https://diavgeia.gov.gr/doc/${encodeURIComponent(d.ada || ada)}`;

  return {
    success: true,
    decision: {
      ada: String(d.ada || ada).trim(),
      protocolNumber: String(d.protocolNumber || '').trim(),
      subject: String(d.subject || '').trim(),
      issueDate,
      publishDate,
      status: String(d.status || '').trim(),
      organization,
      organizationSupervisor,
      decisionType,
      unit,
      documentUrl,
      documentType: String(d.extraFieldValues?.documentType || '').trim(),
      budgetType: String(d.extraFieldValues?.budgettype || '').trim(),
      budgetKind: String(d.extraFieldValues?.budgetkind || '').trim(),
      financialYear: d.extraFieldValues?.financialYear ?? null,
      fetchedAt: new Date().toISOString(),
    },
  };
}

function sanitizePdfFileName(name, ada) {
  const base = String(name || `ΑΠΕ — Διαύγεια ${ada}.pdf`)
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim();
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/**
 * Λήψη PDF πράξης Διαύγειας σε προσωρινό αρχείο (για αποθήκευση στα αρχεία υποέργου).
 * @param {string} adaRaw
 * @param {{ documentUrl?: string, fileName?: string }} [opts]
 */
async function downloadDiavgeiaDecisionPdf(adaRaw, opts = {}) {
  const ada = normalizeAda(adaRaw);
  if (!ada) {
    return { success: false, error: 'Συμπληρώστε τον ΑΔΑ.' };
  }

  const candidates = [
    opts.documentUrl,
    `${DIAVGEIA_BASE}/decisions/${encodeURIComponent(ada)}/document`,
    `https://diavgeia.gov.gr/doc/${encodeURIComponent(ada)}.pdf`,
  ].filter(Boolean);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
          signal: controller.signal,
        });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 128) continue;
        const header = buf.slice(0, 5).toString('ascii');
        if (!header.startsWith('%PDF')) continue;

        const fileName = sanitizePdfFileName(opts.fileName, ada);
        const destPath = path.join(os.tmpdir(), `ergohub-diavgeia-${ada}-${Date.now()}.pdf`);
        fs.writeFileSync(destPath, buf);
        return { success: true, path: destPath, fileName };
      } catch {
        /* δοκιμή επόμενου URL */
      }
    }
    return {
      success: false,
      error: 'Δεν ήταν δυνατή η λήψη PDF από τη Διαύγεια — ανεβάστε το αρχείο χειροκίνητα.',
    };
  } catch (e) {
    if (e?.name === 'AbortError') {
      return { success: false, error: 'Η λήψη PDF από τη Διαύγεια διήρκεσε πολύ.' };
    }
    return { success: false, error: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

function addMonthsIso(iso, months) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return dt.toISOString().slice(0, 10);
}

function addDaysIso(iso, days) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function neededIssueDateWindows(fromIso, toIso) {
  const end = String(toIso || todayIso()).slice(0, 10);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(fromIso || '').slice(0, 10))
    ? String(fromIso).slice(0, 10)
    : addMonthsIso(end, -12);
  const fromMs = Date.parse(`${start}T00:00:00Z`);
  const toMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) return 6;
  const months = (toMs - fromMs) / (1000 * 60 * 60 * 24 * 30.44);
  return Math.min(24, Math.max(6, Math.ceil(months / 6) + 1));
}

function buildIssueDateWindows(fromIso, toIso, { maxWindows = 6 } = {}) {
  const end = String(toIso || todayIso()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return [];
  let cursor = /^\d{4}-\d{2}-\d{2}$/.test(String(fromIso || '').slice(0, 10))
    ? String(fromIso).slice(0, 10)
    : addMonthsIso(end, -12);
  if (!cursor || cursor > end) cursor = addMonthsIso(end, -12) || end;
  const windows = [];
  while (cursor <= end && windows.length < maxWindows) {
    const rawEnd = addMonthsIso(cursor, 6);
    const windowEnd = !rawEnd || rawEnd > end ? end : rawEnd;
    windows.push({ from: cursor, to: windowEnd });
    if (windowEnd >= end) break;
    cursor = addDaysIso(windowEnd, 1);
    if (!cursor) break;
  }
  return windows;
}

async function searchDiavgeiaDecisions({
  term = '',
  org = '',
  fromIssueDate = '',
  toIssueDate = '',
  size = 50,
} = {}) {
  const params = new URLSearchParams();
  if (term) params.set('term', term);
  if (org) params.set('org', org);
  if (fromIssueDate) params.set('from_issue_date', fromIssueDate);
  if (toIssueDate) params.set('to_issue_date', toIssueDate);
  params.set('size', String(Math.min(100, Math.max(1, Number(size) || 50))));
  const url = `${DIAVGEIA_BASE}/search.json?${params.toString()}`;
  const res = await fetchJson(url);
  if (!res.success) return res;
  const decisions = Array.isArray(res.data?.decisions) ? res.data.decisions : [];
  return {
    success: true,
    decisions: decisions.map((d) => ({
      ada: String(d.ada || '').trim(),
      subject: String(d.subject || '').trim(),
      protocolNumber: String(d.protocolNumber || '').trim(),
      issueDate: isoDateFromMs(d.issueDate),
      publishDate: isoDateFromMs(d.publishTimestamp),
      organizationId: String(d.organizationId || '').trim(),
      decisionTypeId: String(d.decisionTypeId || '').trim(),
      documentUrl: d.documentUrl || (d.ada ? `https://diavgeia.gov.gr/doc/${encodeURIComponent(d.ada)}` : ''),
    })),
    total: Number(res.data?.info?.total) || decisions.length,
  };
}

function foldOrganizationName(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ς/g, 'σ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_/.,]/g, ' ')
    .replace(/[^a-z0-9α-ω\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function organizationCoreName(folded) {
  return String(folded || '')
    .replace(/\b(δημοσ|δημου|του)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function organizationSearchQueries(name) {
  const folded = foldOrganizationName(name);
  const core = organizationCoreName(folded);
  const tokens = core.split(' ').filter((w) => w.length >= 4);
  const out = [];
  const add = (value) => {
    const s = String(value || '').trim();
    if (s && !out.includes(s)) out.push(s);
  };
  add(name);
  add(core);
  if (tokens[0]) add(tokens[0]);
  return out;
}

function organizationNameScore(query, label) {
  const qFull = foldOrganizationName(query);
  const lFull = foldOrganizationName(label);
  const q = organizationCoreName(qFull);
  const lCore = organizationCoreName(lFull);
  if (!q || !lFull) return 0;

  let score = 0;
  if (lFull === qFull || lCore === q) score += 3;
  else if (lCore.includes(q) || (q.length >= 8 && q.includes(lCore))) score += 1.1;

  const tokens = q.split(' ').filter((w) => w.length >= 4);
  if (tokens.length) {
    const hits = tokens.filter((w) => lFull.includes(w)).length;
    score += hits / tokens.length;
  }

  if (/^δημοσ\s/.test(lFull)) score += 1.5;
  if (/^(μητρωο|ληξιαρχειο|δημοτολογιο|γραμματεια)\b/.test(lFull)) score -= 2.2;

  return score;
}

function pickOrganizationFromList(name, list) {
  let best = null;
  let bestScore = 0;
  (Array.isArray(list) ? list : []).forEach((org) => {
    const labelScore = organizationNameScore(name, org?.label);
    const latinScore = organizationNameScore(name, org?.latinName);
    const score = Math.max(labelScore, latinScore);
    if (score > bestScore) {
      bestScore = score;
      best = org;
    }
  });
  return { best, bestScore };
}

async function resolveDiavgeiaOrganization(nameRaw) {
  const name = String(nameRaw || '').trim();
  if (!name) {
    return { success: false, error: 'Δεν έχει οριστεί ο φορέας του δήμου στις ρυθμίσεις.' };
  }
  let lastError = '';
  for (const query of organizationSearchQueries(name)) {
    const url = `${DIAVGEIA_BASE}/organizations.json?term=${encodeURIComponent(query)}`;
    const res = await fetchJson(url);
    const list = Array.isArray(res.data?.organizations)
      ? res.data.organizations
      : (Array.isArray(res.data) ? res.data : []);
    if (!res.success && !list.length) {
      lastError = res.error || 'Δεν βρέθηκε ο δήμος στη Διαύγεια.';
      continue;
    }
    const { best, bestScore } = pickOrganizationFromList(name, list);
    if (best && bestScore >= 0.5 && best.uid) {
      return {
        success: true,
        organization: {
          uid: String(best.uid),
          label: String(best.label || name).trim(),
        },
      };
    }
  }
  return {
    success: false,
    error: lastError || `Δεν ταυτοποιήθηκε ο δήμος «${name}» στη Διαύγεια.`,
  };
}

module.exports = {
  normalizeAda,
  fetchDiavgeiaDecisionByAda,
  downloadDiavgeiaDecisionPdf,
  searchDiavgeiaDecisions,
  resolveDiavgeiaOrganization,
  organizationNameScore,
  organizationSearchQueries,
  buildIssueDateWindows,
  neededIssueDateWindows,
  todayIso,
};
