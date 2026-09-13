import entaxiCatalog from '../../app/core/entaxiCatalog';
import { getEntaxiCurrentTotal } from './entaxiAmountUtils';
import { formatEntaxiAmount } from './entaxiAmountUtils';
import { collectEntaxiApprovalFileNames } from './entaxiFileObjects';

function firstNonEmpty(...values) {
  for (let i = 0; i < values.length; i += 1) {
    const s = String(values[i] || '').replace(/\s+/g, ' ').trim();
    if (s) return s;
  }
  return '';
}

export function buildProjectDraftFromEntaxi(entaxi, matchApi) {
  const e = entaxi || {};
  const titleApi = matchApi && typeof matchApi.extractEntaxiTitle === 'function'
    ? matchApi.extractEntaxiTitle
    : (row) => String(row?.subject || '').trim();
  const title = titleApi(e) || firstNonEmpty(e.subject);
  const amount = getEntaxiCurrentTotal(e);
  const amountLabel = Number.isFinite(amount) && amount > 0
    ? formatEntaxiAmount(amount)
    : String(e.initialAmount || '').trim();
  const acceptanceAda = firstNonEmpty(e.diavgeiaAcceptanceAda, e.diavgeiaAcceptanceMeta?.ada);
  const comments = [
    e.subject ? `Προέρχεται από ένταξη: ${String(e.subject).replace(/\s+/g, ' ').trim()}` : '',
    e.opsCode ? `ΟΠΣ ${e.opsCode}` : '',
    acceptanceAda ? `ΑΔΑ αποδοχής: ${acceptanceAda}` : '',
  ].filter(Boolean).join(' · ');

  return {
    projectTitle: title,
    subprojectTitle: title,
    misPraxhsCode: String(e.opsCode || '').trim(),
    approvedAmount: amountLabel,
    projectBudget: amountLabel,
    comments,
    sourceEntaxiId: String(e.entaxiId || '').trim(),
  };
}

export function entaxiHasStoredAcceptance(entaxi) {
  const e = entaxi || {};
  if (String(e.diavgeiaAcceptanceAda || e.diavgeiaAcceptanceMeta?.ada || '').trim()) return true;
  return collectEntaxiApprovalFileNames(e).length > 0;
}

export function buildEntaxiLinkAfterProjectCreate(entaxi, { projectId, projectTitle, subprojectId }) {
  const title = String(projectTitle || '').trim();
  const pid = String(projectId || '').trim();
  const sid = String(subprojectId || '').trim();
  return entaxiCatalog.buildEntaxiLinkSnapshot(
    title || pid ? [{ projectId: pid, projectTitle: title }] : [],
    sid ? [sid] : []
  );
}
