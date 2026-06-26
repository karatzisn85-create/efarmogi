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
  if (d.organizationId) {
    const orgRes = await fetchJson(`${DIAVGEIA_BASE}/organizations/${d.organizationId}.json`);
    if (orgRes.success) organization = String(orgRes.data?.label || '').trim();
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
      decisionType,
      unit,
      documentUrl,
      documentType: String(d.extraFieldValues?.documentType || '').trim(),
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

module.exports = {
  normalizeAda,
  fetchDiavgeiaDecisionByAda,
  downloadDiavgeiaDecisionPdf,
};
