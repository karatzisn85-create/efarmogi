import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { getCharacterization } from '../data/formOptions';
import { useToast } from './ToastProvider';
import { getProjectChargeDisplay } from '../utils/supervisorChargeDisplay';
import { formatDateEl } from '../utils/dateFormat';
import {
  getProjectAnadoxosNamesExport,
  getProjectAnadoxosVatsExport,
  getProjectKhmdhsAdamExport,
  getProjectAssignmentProcedureExport
} from '../utils/contractorFields';
import {
  KHMDHS_NOTICE_EXPORT_FIELDS,
  getKhmdhsNoticeExportValue,
  isKhmdhsNoticeExportField
} from '../utils/khmdhsExportFields';
import {
  getProjectContractTotalForExport,
  getProjectPayableAmountForExport,
  getProjectContractDatesRawForExport,
  getProjectPaymentTotalForExport,
  getProjectDqrStatusForExport,
  getProjectRequestAdamForExport,
  getProjectAwardAdamForExport,
  getProjectCommitmentAdamsForExport,
} from '../utils/khmdhsExportHelpers';
import { isMultipleContractsForm } from '../utils/khmdhsFields';
import reportsExport from '../../app/core/reportsExport';

/* ─── Layout ─── */

const ExportOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 3vh 1rem 2rem;
  overflow-y: auto;
`;

const ExportContainer = styled.div`
  background: #fff;
  border-radius: 18px;
  width: min(920px, 100%);
  max-height: min(92vh, 980px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 28px 72px rgba(15, 23, 42, 0.28);
  overflow: hidden;
`;

const Hero = styled.div`
  flex-shrink: 0;
  padding: 1.35rem 1.5rem 1.15rem;
  background: linear-gradient(135deg, #312e81 0%, #4f46e5 55%, #6366f1 100%);
  color: #fff;
`;

const HeroTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
`;

const HeroEyebrow = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
  margin-bottom: 0.25rem;
`;

const HeroTitle = styled.h2`
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
`;

const HeroSubtitle = styled.p`
  margin: 0.4rem 0 0;
  font-size: 0.82rem;
  line-height: 1.45;
  opacity: 0.9;
  max-width: 36rem;
`;

const CloseButton = styled.button`
  flex-shrink: 0;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 10px;
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.28);
  }
`;

const StatsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 1rem;
`;

const StatChip = styled.div`
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  padding: 0.28rem 0.75rem;
  font-size: 0.74rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.35rem;

  strong {
    font-weight: 800;
  }
`;

const FilterBanner = styled.div`
  margin-top: 0.85rem;
  background: ${(p) => (p.$warn ? 'rgba(251, 191, 36, 0.22)' : 'rgba(255, 255, 255, 0.12)')};
  border: 1px solid ${(p) => (p.$warn ? 'rgba(251, 191, 36, 0.45)' : 'rgba(255, 255, 255, 0.2)')};
  border-radius: 10px;
  padding: 0.55rem 0.8rem;
  font-size: 0.78rem;
  line-height: 1.4;
`;

const Toolbar = styled.div`
  flex-shrink: 0;
  padding: 0.85rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
`;

const SearchInput = styled.input`
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 0.55rem 0.85rem;
  font-size: 0.86rem;
  font-family: inherit;
  background: #fff;
  color: #0f172a;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const PresetRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
`;

const PresetLabel = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-right: 0.15rem;
`;

const PresetBtn = styled.button`
  border: 1px solid ${(p) => (p.$active ? '#a5b4fc' : '#cbd5e1')};
  background: ${(p) => (p.$active ? '#eef2ff' : '#fff')};
  color: ${(p) => (p.$active ? '#3730a3' : '#334155')};
  border-radius: 999px;
  padding: 0.32rem 0.75rem;
  font-size: 0.74rem;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: ${(p) => (p.$active ? '#e0e7ff' : '#f1f5f9')};
    border-color: ${(p) => (p.$active ? '#818cf8' : '#94a3b8')};
  }
`;

const Body = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0.85rem 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  gap: 0.55rem;
`;

const GroupCard = styled.section`
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  flex: 0 0 auto;
`;

const GroupHeader = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  border: none;
  background: ${(p) => (p.$open ? '#f8fafc' : '#fff')};
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.15s ease;

  &:hover {
    background: #f8fafc;
  }
`;

const GroupHeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
`;

const GroupTitle = styled.div`
  font-size: 0.92rem;
  font-weight: 750;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 0.45rem;
`;

const GroupHint = styled.div`
  font-size: 0.74rem;
  color: #64748b;
  line-height: 1.35;
`;

const GroupMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
`;

const CountBadge = styled.span`
  font-size: 0.7rem;
  font-weight: 700;
  color: ${(p) => (p.$all ? '#047857' : '#4338ca')};
  background: ${(p) => (p.$all ? '#ecfdf5' : '#eef2ff')};
  border: 1px solid ${(p) => (p.$all ? '#a7f3d0' : '#c7d2fe')};
  border-radius: 999px;
  padding: 0.18rem 0.55rem;
  white-space: nowrap;
`;

const Chevron = styled.span`
  color: #94a3b8;
  font-size: 0.7rem;
  transition: transform 0.15s ease;
  transform: rotate(${(p) => (p.$open ? '90deg' : '0deg')});
`;

const GroupBody = styled.div`
  padding: 0.65rem 0.85rem 0.75rem;
  border-top: 1px solid #f1f5f9;
`;

const SubGroup = styled.div`
  & + & {
    margin-top: 0.65rem;
    padding-top: 0.55rem;
    border-top: 1px dashed #e2e8f0;
  }
`;

const SubGroupTitle = styled.div`
  font-size: 0.68rem;
  font-weight: 750;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.4rem;
  padding-left: 0.1rem;
`;

const FieldsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.3rem 0.55rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const FieldItem = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.42rem 0.5rem;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: background 0.12s ease, border-color 0.12s ease;
  font-size: 0.78rem;
  line-height: 1.3;
  min-width: 0;

  &:hover {
    background: #f8fafc;
    border-color: #e2e8f0;
  }

  ${(p) => p.$checked && `
    background: #eef2ff;
    border-color: #c7d2fe;
  `}
`;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  margin-top: 0.1rem;
  cursor: pointer;
  accent-color: #4f46e5;
  flex-shrink: 0;
`;

const FieldLabel = styled.span`
  color: #1e293b;
  font-weight: 550;
  word-break: break-word;
`;

const GroupActions = styled.div`
  display: flex;
  gap: 0.35rem;
  margin-top: 0.55rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #e2e8f0;
`;

const TinyBtn = styled.button`
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
  border-radius: 7px;
  padding: 0.28rem 0.65rem;
  font-size: 0.7rem;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
  }
`;

const EmptySearch = styled.div`
  text-align: center;
  padding: 2.5rem 1rem;
  color: #64748b;
  font-size: 0.88rem;
`;

const Footer = styled.div`
  flex-shrink: 0;
  padding: 0.85rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const FooterLeft = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const FooterBtn = styled.button`
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  border-radius: 9px;
  padding: 0.5rem 0.95rem;
  font-size: 0.78rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #94a3b8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ExportBtn = styled.button`
  border: none;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  border-radius: 9px;
  padding: 0.55rem 1.25rem;
  font-size: 0.82rem;
  font-weight: 750;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(79, 70, 229, 0.28);
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

/* ─── Field catalog (Excel column order — αμετάβλητη λογική εξαγωγής) ─── */

const EXPORT_FIELDS_ORDER = [
  { id: 'rowNumber', label: 'Α/Α', width: 8 },
  { id: 'kaCode', label: 'Κωδικός ΚΑ', width: 14 },
  { id: 'aleCode', label: 'Κωδ. Α.Λ.Ε.', width: 16 },
  { id: 'projectTitle', label: 'Τίτλος Έργου / Τίτλος Πράξης', width: 40 },
  { id: 'subprojectTitle', label: 'Τίτλος Υποέργου', width: 40 },
  { id: 'projectType', label: 'Είδος Υποέργου', width: 25 },
  { id: 'misPraxhsName', label: 'Όνομα Κωδικού Πράξης', width: 20 },
  { id: 'misPraxhsCode', label: 'Κωδικός Πράξης', width: 20 },
  { id: 'approvedAmount', label: 'Εγκεκριμένο Ποσό', width: 16 },
  { id: 'projectBudget', label: 'Προϋπολογισμός', width: 16 },
  { id: 'remainingAmount', label: 'Υπόλοιπα για το Έτος', width: 18 },
  { id: 'remainingAmountYear', label: 'Έτος Υπολοίπων', width: 12 },
  { id: 'remainingAmountComments', label: 'Σχόλια Υπολοίπων', width: 25 },
  { id: 'fundingSource', label: 'Βασική Πηγή Χρηματοδότησης', width: 25 },
  { id: 'fundingDetails', label: 'Εξειδίκευση Πηγής Χρηματοδότησης', width: 35 },
  { id: 'projectStatus', label: 'Κατάσταση Υποέργου', width: 25 },
  { id: 'assignmentProcedure', label: 'Διαδικασία Ανάθεσης', width: 40 },
  { id: 'anadoxosName', label: 'Επωνυμία Αναδόχου (ΚΗΜΔΗΣ)', width: 35 },
  { id: 'anadoxosVat', label: 'ΑΦΜ Αναδόχου (ΚΗΜΔΗΣ)', width: 18 },
  { id: 'khmdhsAdam', label: 'ΑΔΑΜ Σύμβασης (ΚΗΜΔΗΣ)', width: 22 },
  { id: 'contractProcessStartDate', label: 'Ημερομηνία έναρξης διαδικασίας σύναψης Σύμβασης', width: 30 },
  { id: 'contractDate', label: 'Ημερομηνία Υπογραφής Σύμβασης', width: 18 },
  { id: 'contractAmount', label: 'Ποσό Σύμβασης (αλυσίδα)', width: 22 },
  { id: 'apeAmount', label: 'Τελικό πληρωτέο (ΑΠΕ/σύμβαση + συμπληρωματικές)', width: 28 },
  { id: 'khmdhsRequestAdam', label: 'ΑΔΑΜ Αιτήματος (REQ)', width: 22 },
  { id: 'khmdhsAwardAdam', label: 'ΑΔΑΜ Κατακύρωσης (AWRD)', width: 22 },
  { id: 'khmdhsCommitmentAdam', label: 'ΑΔΑΜ Ανάληψης Υποχρέωσης', width: 25 },
  { id: 'khmdhsPaymentTotal', label: 'Σύνολο Πληρωμών (ΚΗΜΔΗΣ)', width: 22 },
  { id: 'dqrStatus', label: 'Ανοιχτά DQR', width: 18 },
  { id: 'chargeTo', label: 'Χρεωμένο σε', width: 25 },
  { id: 'chargeParticipants', label: 'Συμμετέχουν', width: 30 },
  { id: 'comments', label: 'Σχόλια', width: 40 },
  { id: 'eisigitikiEkthesi', label: 'Αναφορά από πρόγραμμα Οικονομικής', width: 60 },
  { id: 'characterization', label: 'Χαρακτηρισμός (ΝΕΟ/ΣΥΝΕΧΙΖΟΜΕΝΟ)', width: 30 },
  ...KHMDHS_NOTICE_EXPORT_FIELDS
];

/** Συντομότερες ετικέτες για την οθόνη (οι επικεφαλίδες Excel μένουν πλήρεις) */
const NOTICE_UI_LABELS = {
  khmdhsNoticeAdam: 'ΑΔΑΜ προκήρυξης / πρόσκλησης',
  khmdhsNoticeTitle: 'Τίτλος δημοσίευσης',
  khmdhsNoticeType: 'Τύπος δημοσίευσης',
  khmdhsNoticeContractType: 'Είδος σύμβασης',
  khmdhsNoticeProcedureKhmdhs: 'Διαδικασία (από ΚΗΜΔΗΣ)',
  khmdhsNoticeProcedureApp: 'Διαδικασία (από εφαρμογή)',
  khmdhsNoticeLegalContext: 'Νομικό πλαίσιο',
  khmdhsNoticeConductingProceedings: 'Τρόπος διεξαγωγής',
  khmdhsNoticeDigitalPlatform: 'Πλατφόρμα',
  khmdhsNoticeCriteriaCode: 'Κριτήριο ανάθεσης',
  khmdhsNoticeOrganization: 'Αναθέτουσα αρχή',
  khmdhsNoticeUnitsOperator: 'Οργανική μονάδα',
  khmdhsNoticeSigner: 'Αποφαινόμενο όργανο',
  khmdhsNoticeSignedDate: 'Ημ. έκδοσης / πρωτοκόλλου',
  khmdhsNoticeFinalSubmissionDate: 'Καταληκτική υποβολής',
  khmdhsNoticeSubmissionDate: 'Ημ. καταχώρισης',
  khmdhsNoticeDeadlineDaysLeft: 'Ημέρες έως καταληκτική',
  khmdhsNoticeCancelled: 'Ματαιωμένη',
  khmdhsNoticeCancellationDate: 'Ημ. ματαίωσης',
  khmdhsNoticeCancellationReason: 'Λόγος ματαίωσης',
  khmdhsNoticeEstimatedAmountNoVat: 'Εκτιμ. αξία χωρίς ΦΠΑ',
  khmdhsNoticeEstimatedAmountWithVat: 'Εκτιμ. αξία με ΦΠΑ',
  khmdhsNoticeContractDuration: 'Διάρκεια σύμβασης',
  khmdhsNoticeOffersValidTime: 'Ισχύς προσφορών',
  khmdhsNoticeBiddingWebsite: 'Ιστότοπος υποβολής',
  khmdhsNoticeSystemicNumber: 'Αρ. ηλεκτρ. δημοσίευσης',
  khmdhsNoticeApprovedRequestAdam: 'Συνδ. αίτημα ΑΔΑΜ',
  khmdhsNoticeAuctionRefNos: 'Συνδ. αναθέσεις ΑΔΑΜ',
  khmdhsNoticeCpvs: 'CPV',
  khmdhsNoticeFundingSummary: 'Χρηματοδότηση (δημοσίευσης)',
  khmdhsNoticeFetchedAt: 'Ημ. ανάκτησης δεδομένων',
  khmdhsContractVarianceAmount: 'Διαφορά σύμβαση − εκτιμ.',
  khmdhsContractVariancePct: 'Απόκλιση % σύμβαση vs εκτιμ.',
};

const noticeField = (id) => {
  const src = KHMDHS_NOTICE_EXPORT_FIELDS.find((f) => f.id === id);
  return {
    id,
    label: NOTICE_UI_LABELS[id] || src?.label || id,
    width: src?.width || 22,
  };
};

/**
 * Ομάδες επιλογής — κάθε πεδίο εμφανίζεται ΜΙΑ φορά.
 * (Παλιά: ανάδοχος / ΑΔΑΜ / διαδικασία επαναλαμβάνονταν σε «Κατάσταση» και «Ανάδοχος».)
 */
const EXPORT_FIELD_GROUPS = [
  {
    id: 'basic',
    title: 'Βασικά στοιχεία',
    hint: 'Κωδικοί, τίτλοι και είδος υποέργου',
    fields: [
      { id: 'rowNumber', label: 'Α/Α', width: 8 },
      { id: 'kaCode', label: 'Κωδικός ΚΑ', width: 14 },
      { id: 'aleCode', label: 'Κωδ. Α.Λ.Ε.', width: 16 },
      { id: 'projectTitle', label: 'Τίτλος έργου / πράξης', width: 40 },
      { id: 'subprojectTitle', label: 'Τίτλος υποέργου', width: 40 },
      { id: 'projectType', label: 'Είδος υποέργου', width: 25 },
      { id: 'misPraxhs', label: 'Όνομα & κωδικός πράξης', width: 30, linkedFields: ['misPraxhsName', 'misPraxhsCode'] },
    ],
  },
  {
    id: 'financial',
    title: 'Οικονομικά & χρηματοδότηση',
    hint: 'Ποσά προϋπολογισμού, υπόλοιπα και πηγές',
    fields: [
      { id: 'approvedAmount', label: 'Εγκεκριμένο ποσό', width: 16 },
      { id: 'projectBudget', label: 'Προϋπολογισμός', width: 16 },
      { id: 'remainingAmount', label: 'Υπόλοιπα για το έτος', width: 18 },
      { id: 'remainingAmountYear', label: 'Έτος υπολοίπων', width: 12 },
      { id: 'remainingAmountComments', label: 'Σχόλια υπολοίπων', width: 25 },
      { id: 'fundingSource', label: 'Βασική πηγή χρηματοδότησης', width: 25 },
      { id: 'fundingDetails', label: 'Εξειδίκευση πηγής', width: 35 },
    ],
  },
  {
    id: 'contract',
    title: 'Κατάσταση & σύμβαση',
    hint: 'Πρόοδος υποέργου και ποσά / ημερομηνίες σύμβασης',
    fields: [
      { id: 'projectStatus', label: 'Κατάσταση υποέργου', width: 25 },
      { id: 'contractProcessStartDate', label: 'Έναρξη διαδικασίας σύναψης', width: 30 },
      { id: 'contractDate', label: 'Ημ. υπογραφής σύμβασης', width: 18 },
      { id: 'contractAmount', label: 'Ποσό σύμβασης (αλυσίδα)', width: 22 },
      { id: 'apeAmount', label: 'Τελικό πληρωτέο (ΑΠΕ + συμπληρωματικές)', width: 28 },
    ],
  },
  {
    id: 'khmdhs',
    title: 'Ανάδοχος & αλυσίδα ΚΗΜΔΗΣ',
    hint: 'Διαδικασία ανάθεσης, ανάδοχος, ΑΔΑΜ και πληρωμές',
    fields: [
      { id: 'assignmentProcedure', label: 'Διαδικασία ανάθεσης', width: 40 },
      { id: 'anadoxosName', label: 'Επωνυμία αναδόχου', width: 35 },
      { id: 'anadoxosVat', label: 'ΑΦΜ αναδόχου', width: 18 },
      { id: 'khmdhsAdam', label: 'ΑΔΑΜ σύμβασης (SYMV)', width: 22 },
      { id: 'khmdhsRequestAdam', label: 'ΑΔΑΜ αιτήματος (REQ)', width: 22 },
      { id: 'khmdhsAwardAdam', label: 'ΑΔΑΜ κατακύρωσης (AWRD)', width: 22 },
      { id: 'khmdhsCommitmentAdam', label: 'ΑΔΑΜ ανάληψης υποχρέωσης', width: 25 },
      { id: 'khmdhsPaymentTotal', label: 'Σύνολο πληρωμών', width: 22 },
      { id: 'dqrStatus', label: 'Ανοιχτά DQR', width: 18 },
    ],
  },
  {
    id: 'notes',
    title: 'Χρέωση & σχόλια',
    hint: 'Υπεύθυνοι, σχόλια και χαρακτηρισμός',
    fields: [
      { id: 'chargeTo', label: 'Χρεωμένο σε', width: 25 },
      { id: 'chargeParticipants', label: 'Συμμετέχουν', width: 30 },
      { id: 'comments', label: 'Σχόλια', width: 40 },
      { id: 'eisigitikiEkthesi', label: 'Αναφορά από πρόγραμμα Οικονομικής', width: 60 },
      { id: 'characterization', label: 'Χαρακτηρισμός (ΝΕΟ / ΣΥΝΕΧΙΖΟΜΕΝΟ)', width: 30 },
    ],
  },
  {
    id: 'notice',
    title: 'Δημοσίευση ΚΗΜΔΗΣ',
    hint: 'Στοιχεία προκήρυξης / πρόσκλησης από το ΚΗΜΔΗΣ',
    subgroups: [
      {
        title: 'Ταυτότητα',
        fields: [
          noticeField('khmdhsNoticeAdam'),
          noticeField('khmdhsNoticeTitle'),
          noticeField('khmdhsNoticeType'),
          noticeField('khmdhsNoticeContractType'),
          noticeField('khmdhsNoticeSystemicNumber'),
        ],
      },
      {
        title: 'Διαδικασία & φορείς',
        fields: [
          noticeField('khmdhsNoticeProcedureKhmdhs'),
          noticeField('khmdhsNoticeProcedureApp'),
          noticeField('khmdhsNoticeLegalContext'),
          noticeField('khmdhsNoticeConductingProceedings'),
          noticeField('khmdhsNoticeDigitalPlatform'),
          noticeField('khmdhsNoticeCriteriaCode'),
          noticeField('khmdhsNoticeOrganization'),
          noticeField('khmdhsNoticeUnitsOperator'),
          noticeField('khmdhsNoticeSigner'),
        ],
      },
      {
        title: 'Ημερομηνίες & προθεσμίες',
        fields: [
          noticeField('khmdhsNoticeSignedDate'),
          noticeField('khmdhsNoticeFinalSubmissionDate'),
          noticeField('khmdhsNoticeSubmissionDate'),
          noticeField('khmdhsNoticeDeadlineDaysLeft'),
          noticeField('khmdhsNoticeCancelled'),
          noticeField('khmdhsNoticeCancellationDate'),
          noticeField('khmdhsNoticeCancellationReason'),
        ],
      },
      {
        title: 'Ποσά & διάρκεια',
        fields: [
          noticeField('khmdhsNoticeEstimatedAmountNoVat'),
          noticeField('khmdhsNoticeEstimatedAmountWithVat'),
          noticeField('khmdhsNoticeContractDuration'),
          noticeField('khmdhsNoticeOffersValidTime'),
          noticeField('khmdhsContractVarianceAmount'),
          noticeField('khmdhsContractVariancePct'),
        ],
      },
      {
        title: 'Σύνδεσμοι & λοιπά',
        fields: [
          noticeField('khmdhsNoticeBiddingWebsite'),
          noticeField('khmdhsNoticeApprovedRequestAdam'),
          noticeField('khmdhsNoticeAuctionRefNos'),
          noticeField('khmdhsNoticeCpvs'),
          noticeField('khmdhsNoticeFundingSummary'),
          noticeField('khmdhsNoticeFetchedAt'),
        ],
      },
    ],
  },
];

const DEFAULT_SELECTED = [
  'rowNumber', 'kaCode', 'aleCode', 'projectTitle', 'subprojectTitle',
  'projectType', 'fundingSource', 'fundingDetails', 'projectStatus',
];

const PRESETS = [
  {
    id: 'basic',
    label: 'Βασικό',
    fields: DEFAULT_SELECTED,
  },
  {
    id: 'financial',
    label: 'Οικονομικά',
    fields: [
      ...DEFAULT_SELECTED,
      'approvedAmount', 'projectBudget', 'remainingAmount', 'remainingAmountYear',
      'remainingAmountComments', 'contractAmount', 'apeAmount', 'khmdhsPaymentTotal',
    ],
  },
  {
    id: 'contract',
    label: 'Σύμβαση & ανάδοχος',
    fields: [
      ...DEFAULT_SELECTED,
      'assignmentProcedure', 'anadoxosName', 'anadoxosVat', 'khmdhsAdam',
      'contractProcessStartDate', 'contractDate', 'contractAmount', 'apeAmount',
      'khmdhsRequestAdam', 'khmdhsAwardAdam', 'khmdhsCommitmentAdam',
      'khmdhsPaymentTotal', 'chargeTo',
    ],
  },
  {
    id: 'notice',
    label: 'Δημοσίευση ΚΗΜΔΗΣ',
    fields: [
      'rowNumber', 'subprojectTitle', 'projectStatus',
      ...KHMDHS_NOTICE_EXPORT_FIELDS.map((f) => f.id),
    ],
  },
];

const APP_NAME = 'ERGOHUB';

function xmlEsc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getGroupFields(group) {
  if (group.subgroups) {
    return group.subgroups.flatMap((sg) => sg.fields);
  }
  return group.fields || [];
}

function expandFieldIds(fields) {
  const ids = [];
  fields.forEach((field) => {
    if (field.linkedFields?.length) {
      field.linkedFields.forEach((lid) => {
        if (!ids.includes(lid)) ids.push(lid);
      });
    } else if (!ids.includes(field.id)) {
      ids.push(field.id);
    }
  });
  return ids;
}

function findFieldDef(fieldId) {
  for (const group of EXPORT_FIELD_GROUPS) {
    const found = getGroupFields(group).find((f) => f.id === fieldId);
    if (found) return found;
  }
  return null;
}

function isFieldChecked(field, selectedFields) {
  if (field.linkedFields?.length) {
    return field.linkedFields.every((id) => selectedFields.includes(id));
  }
  return selectedFields.includes(field.id);
}

function fieldMatchesSearch(field, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return String(field.label || '').toLowerCase().includes(q)
    || String(field.id || '').toLowerCase().includes(q);
}

function ExportData({
  isOpen,
  onClose,
  projects,
  totalProjects,
  organizationName = '',
  appVersion = '',
  engineerCatalog = [],
}) {
  const { showToast } = useToast();
  const [selectedFields, setSelectedFields] = useState(DEFAULT_SELECTED);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState(() => ({
    basic: true,
    financial: false,
    contract: false,
    khmdhs: false,
    notes: false,
    notice: false,
  }));
  const [activePreset, setActivePreset] = useState('basic');

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EXPORT_FIELD_GROUPS.map((group) => {
      if (group.subgroups) {
        const subgroups = group.subgroups
          .map((sg) => ({
            ...sg,
            fields: sg.fields.filter((f) => fieldMatchesSearch(f, q)),
          }))
          .filter((sg) => sg.fields.length > 0);
        return { ...group, subgroups, fields: subgroups.flatMap((sg) => sg.fields) };
      }
      return {
        ...group,
        fields: (group.fields || []).filter((f) => fieldMatchesSearch(f, q)),
      };
    }).filter((g) => getGroupFields(g).length > 0);
  }, [search]);

  const allSelectableIds = useMemo(
    () => expandFieldIds(EXPORT_FIELD_GROUPS.flatMap(getGroupFields)),
    []
  );

  const selectableCount = useMemo(() => {
    // Μετράμε «κλικ» (συμπεριλαμβανομένου του misPraxhs ως ένα)
    return EXPORT_FIELD_GROUPS.reduce((n, g) => n + getGroupFields(g).length, 0);
  }, []);

  const handleFieldChange = (fieldId, checked) => {
    const fieldDef = findFieldDef(fieldId);

    if (checked) {
      setSelectedFields((prev) => {
        const next = [...prev];
        if (fieldDef?.linkedFields?.length) {
          fieldDef.linkedFields.forEach((lid) => {
            if (!next.includes(lid)) next.push(lid);
          });
        } else if (!next.includes(fieldId)) {
          next.push(fieldId);
        }
        return next;
      });
    } else {
      setSelectedFields((prev) => {
        if (fieldDef?.linkedFields?.length) {
          return prev.filter((id) => !fieldDef.linkedFields.includes(id));
        }
        return prev.filter((id) => id !== fieldId);
      });
    }
    setActivePreset(null);
  };

  const selectGroupFields = (group, select) => {
    const ids = expandFieldIds(getGroupFields(group));
    setSelectedFields((prev) => {
      if (select) return [...new Set([...prev, ...ids])];
      return prev.filter((id) => !ids.includes(id));
    });
    setActivePreset(null);
  };

  const handleSelectAll = () => {
    setSelectedFields([...allSelectableIds]);
    setActivePreset('all');
  };

  const handleDeselectAll = () => {
    setSelectedFields([]);
    setActivePreset(null);
  };

  const applyPreset = (preset) => {
    setSelectedFields([...new Set(preset.fields)]);
    setActivePreset(preset.id);
    if (preset.id === 'notice') {
      setOpenGroups((prev) => ({ ...prev, notice: true, basic: true }));
    } else if (preset.id === 'contract') {
      setOpenGroups((prev) => ({ ...prev, contract: true, khmdhs: true }));
    } else if (preset.id === 'financial') {
      setOpenGroups((prev) => ({ ...prev, financial: true, contract: true }));
    }
  };

  const toggleGroupOpen = (groupId) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const exportToExcel = () => {
    const gate = reportsExport.evaluateDataExport(selectedFields.length);
    if (!gate.ok) {
      showToast(gate.error, 'warning');
      return;
    }

    try {
      const fieldsInOrder = EXPORT_FIELDS_ORDER.filter((field) =>
        selectedFields.includes(field.id)
      );

      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const exportDateTime = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      const versionSuffix = appVersion ? ` v${appVersion}` : '';
      const brandHeaderText = organizationName
        ? `${APP_NAME}${versionSuffix} — Εξαγωγή Δεδομένων | ${organizationName} | ${exportDateTime}`
        : `${APP_NAME}${versionSuffix} — Εξαγωγή Δεδομένων | ${exportDateTime}`;
      const brandFooterText = organizationName
        ? `${organizationName} | Δημιουργήθηκε με ${APP_NAME}${versionSuffix}`
        : `Δημιουργήθηκε με ${APP_NAME}${versionSuffix}`;
      const mergeAcross = Math.max(0, fieldsInOrder.length - 1);

      let htmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${APP_NAME} — Εξαγωγή Δεδομένων</Title>
    <Author>${APP_NAME}</Author>
    <Company>${APP_NAME}</Company>
    <Created>${now.toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="10"/>
    </Style>
    <Style ss:ID="HeaderStyle">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#366092" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="EvenRow">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10"/>
      <Interior ss:Color="#F8F9FA" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="OddRow">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D0D0D0"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="BrandHeader">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#4338CA" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6366F1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6366F1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6366F1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6366F1"/>
      </Borders>
    </Style>
    <Style ss:ID="BrandFooter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="9" ss:Italic="1" ss:Color="#4338CA"/>
      <Interior ss:Color="#EEF2FF" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#6366F1"/>
      </Borders>
    </Style>
  </Styles>
  <Worksheet ss:Name="Εξαγωγή Έργων">
    <Table>
`;

      fieldsInOrder.forEach((field) => {
        htmlContent += `      <Column ss:Width="${field.width * 8}"/>\n`;
      });

      htmlContent += `      <Row ss:Height="30">
        <Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="BrandHeader">
          <Data ss:Type="String">${xmlEsc(brandHeaderText)}</Data>
        </Cell>
      </Row>\n`;

      htmlContent += `      <Row>\n`;

      fieldsInOrder.forEach((field) => {
        htmlContent += `        <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${xmlEsc(field.label)}</Data></Cell>\n`;
      });

      htmlContent += `      </Row>\n`;

      projects.forEach((project, index) => {
        const styleID = index % 2 === 0 ? 'EvenRow' : 'OddRow';
        htmlContent += `      <Row>\n`;

        fieldsInOrder.forEach((field) => {
          let value = '';

          if (field.id === 'rowNumber') {
            value = index + 1;
          } else if (field.id === 'aleCode') {
            if (project.aleCodes && Array.isArray(project.aleCodes) && project.aleCodes.length > 0) {
              value = project.aleCodes.filter((c) => c && c.trim()).join(' • ');
            } else if (project.aleCode) {
              value = project.aleCode;
            } else {
              value = '';
            }
          } else if (field.id === 'characterization') {
            value = getCharacterization(project) || '';
          } else if (field.id === 'chargeTo') {
            value = getProjectChargeDisplay(project, engineerCatalog).displayChargePrimary;
          } else if (field.id === 'chargeParticipants') {
            value = getProjectChargeDisplay(project, engineerCatalog).displayChargeParticipants;
          } else if (field.id === 'anadoxosName') {
            value = getProjectAnadoxosNamesExport(project);
          } else if (field.id === 'anadoxosVat') {
            value = getProjectAnadoxosVatsExport(project);
          } else if (field.id === 'khmdhsAdam') {
            value = getProjectKhmdhsAdamExport(project);
          } else if (field.id === 'assignmentProcedure') {
            value = getProjectAssignmentProcedureExport(project);
          } else if (field.id === 'contractAmount') {
            value = getProjectContractTotalForExport(project);
          } else if (field.id === 'apeAmount') {
            // Στήλη «ΑΠΕ + συμπληρωματικές» = τελικό πληρωτέο (όπως στην εφαρμογή)
            value = getProjectPayableAmountForExport(project);
          } else if (field.id === 'khmdhsPaymentTotal') {
            value = getProjectPaymentTotalForExport(project);
          } else if (field.id === 'dqrStatus') {
            value = getProjectDqrStatusForExport(project);
          } else if (field.id === 'khmdhsRequestAdam') {
            value = getProjectRequestAdamForExport(project);
          } else if (field.id === 'khmdhsAwardAdam') {
            value = getProjectAwardAdamForExport(project);
          } else if (field.id === 'khmdhsCommitmentAdam') {
            value = getProjectCommitmentAdamsForExport(project);
          } else if (field.id === 'contractDate') {
            const raw = getProjectContractDatesRawForExport(project);
            if (isMultipleContractsForm(project.implementationForm)) {
              value = raw
                .split(' • ')
                .map((d) => formatDateEl(d, ''))
                .filter(Boolean)
                .join(' • ');
            } else {
              value = raw ? formatDateEl(raw, '') : '';
            }
          } else if (isKhmdhsNoticeExportField(field.id)) {
            value = getKhmdhsNoticeExportValue(project, field.id);
          } else {
            value = project[field.id] || '';
            if (field.id === 'contractProcessStartDate' && value) {
              value = formatDateEl(value, '');
            }
          }

          value = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          htmlContent += `        <Cell ss:StyleID="${styleID}"><Data ss:Type="String">${value}</Data></Cell>\n`;
        });

        htmlContent += `      </Row>\n`;
      });

      htmlContent += `      <Row>
        <Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="BrandFooter">
          <Data ss:Type="String">${xmlEsc(brandFooterText)}</Data>
        </Cell>
      </Row>\n`;

      htmlContent += `    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <PageSetup>
        <Layout x:Orientation="Landscape"/>
        <Header x:Margin="0.3" x:Data="${APP_NAME} | Ημερομηνία Εξαγωγής: ${exportDateTime}"/>
        <Footer x:Margin="0.3" x:Data="${APP_NAME} | Σελίδα &amp;P από &amp;N"/>
      </PageSetup>
      <Print>
        <ValidPrinterInfo/>
      </Print>
    </WorksheetOptions>
  </Worksheet>
</Workbook>
      `;

      const blob = new Blob([htmlContent], {
        type: 'application/vnd.ms-excel'
      });

      const fileName = `${APP_NAME}_Εξαγωγή_Έργων_${day}-${month}-${year}.xls`;
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onClose();
    } catch (error) {
      console.error('Error exporting data:', error);
      showToast('Προέκυψε σφάλμα κατά την εξαγωγή. Παρακαλώ δοκιμάστε ξανά.', 'error');
    }
  };

  if (!isOpen) return null;

  const filtersActive = reportsExport.isExportFilterActive(projects.length, totalProjects);
  const selectedColumnCount = selectedFields.length;

  return (
    <ExportOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ExportContainer onClick={(e) => e.stopPropagation()}>
        <Hero>
          <HeroTop>
            <div>
              <HeroEyebrow>Εξαγωγές</HeroEyebrow>
              <HeroTitle>Εξαγωγή δεδομένων</HeroTitle>
              <HeroSubtitle>
                Επιλέξτε στήλες για το Excel. Τα πεδία εμφανίζονται μία φορά, ομαδοποιημένα με σαφή νόημα.
              </HeroSubtitle>
            </div>
            <CloseButton type="button" onClick={onClose} aria-label="Κλείσιμο">×</CloseButton>
          </HeroTop>

          <StatsRow>
            <StatChip><strong>{totalProjects}</strong> συνολικά</StatChip>
            <StatChip><strong>{projects.length}</strong> προς εξαγωγή</StatChip>
            <StatChip><strong>{selectedColumnCount}</strong> στήλες επιλεγμένες</StatChip>
            <StatChip><strong>{selectableCount}</strong> διαθέσιμα πεδία</StatChip>
          </StatsRow>

          {filtersActive ? (
            <FilterBanner $warn>
              Ενεργά φίλτρα: θα εξαχθούν {projects.length} από {totalProjects} υποέργα.
              Καθαρίστε τα φίλτρα αν θέλετε όλα.
            </FilterBanner>
          ) : (
            <FilterBanner>
              Θα εξαχθούν όλα τα {totalProjects} υποέργα με τις στήλες που επιλέγετε παρακάτω.
            </FilterBanner>
          )}
        </Hero>

        <Toolbar>
          <SearchInput
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Αναζήτηση πεδίου… π.χ. ΑΔΑΜ, ανάδοχος, προϋπολογισμός"
          />
          <PresetRow>
            <PresetLabel>Πακέτα</PresetLabel>
            {PRESETS.map((p) => (
              <PresetBtn
                key={p.id}
                type="button"
                $active={activePreset === p.id}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </PresetBtn>
            ))}
            <PresetBtn
              type="button"
              $active={activePreset === 'all'}
              onClick={handleSelectAll}
            >
              Όλα
            </PresetBtn>
          </PresetRow>
        </Toolbar>

        <Body>
          {filteredGroups.length === 0 ? (
            <EmptySearch>Δεν βρέθηκαν πεδία για «{search}».</EmptySearch>
          ) : (
            filteredGroups.map((group) => {
              const groupFields = getGroupFields(group);
              const groupIds = expandFieldIds(groupFields);
              const selectedInGroup = groupIds.filter((id) => selectedFields.includes(id)).length;
              const allSelected = groupIds.length > 0 && groupIds.every((id) => selectedFields.includes(id));
              const isOpen = search.trim() ? true : !!openGroups[group.id];

              return (
                <GroupCard key={group.id}>
                  <GroupHeader
                    type="button"
                    $open={isOpen}
                    onClick={() => !search.trim() && toggleGroupOpen(group.id)}
                  >
                    <GroupHeaderLeft>
                      <GroupTitle>{group.title}</GroupTitle>
                      <GroupHint>{group.hint}</GroupHint>
                    </GroupHeaderLeft>
                    <GroupMeta>
                      <CountBadge $all={allSelected}>
                        {selectedInGroup}/{groupIds.length}
                      </CountBadge>
                      {!search.trim() && <Chevron $open={isOpen}>▶</Chevron>}
                    </GroupMeta>
                  </GroupHeader>

                  {isOpen && (
                    <GroupBody>
                      {group.subgroups ? (
                        group.subgroups.map((sg) => (
                          <SubGroup key={sg.title}>
                            <SubGroupTitle>{sg.title}</SubGroupTitle>
                            <FieldsGrid>
                              {sg.fields.map((field) => {
                                const checked = isFieldChecked(field, selectedFields);
                                return (
                                  <FieldItem key={field.id} $checked={checked}>
                                    <Checkbox
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                                    />
                                    <FieldLabel>{field.label}</FieldLabel>
                                  </FieldItem>
                                );
                              })}
                            </FieldsGrid>
                          </SubGroup>
                        ))
                      ) : (
                        <FieldsGrid>
                          {group.fields.map((field) => {
                            const checked = isFieldChecked(field, selectedFields);
                            return (
                              <FieldItem key={field.id} $checked={checked}>
                                <Checkbox
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                                />
                                <FieldLabel>{field.label}</FieldLabel>
                              </FieldItem>
                            );
                          })}
                        </FieldsGrid>
                      )}

                      <GroupActions>
                        <TinyBtn type="button" onClick={() => selectGroupFields(group, true)}>
                          Όλη η ομάδα
                        </TinyBtn>
                        <TinyBtn type="button" onClick={() => selectGroupFields(group, false)}>
                          Καμία στην ομάδα
                        </TinyBtn>
                      </GroupActions>
                    </GroupBody>
                  )}
                </GroupCard>
              );
            })
          )}
        </Body>

        <Footer>
          <FooterLeft>
            <FooterBtn type="button" onClick={handleSelectAll}>Επιλογή όλων</FooterBtn>
            <FooterBtn type="button" onClick={handleDeselectAll}>Καθαρισμός</FooterBtn>
            <FooterBtn type="button" onClick={onClose}>Κλείσιμο</FooterBtn>
          </FooterLeft>
          <ExportBtn
            type="button"
            onClick={exportToExcel}
            disabled={!reportsExport.canCommitDataExport(selectedFields.length)}
          >
            Εξαγωγή σε Excel ({selectedColumnCount})
          </ExportBtn>
        </Footer>
      </ExportContainer>
    </ExportOverlay>
  );
}

export default ExportData;
