const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx-js-style');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * Μετατρέπει ποσό από string (π.χ. "20.000,00") σε number
 */
function parseAmount(amountStr) {
  if (!amountStr) return 0;
  if (typeof amountStr === 'number') return amountStr;
  
  // Αφαιρούμε τελείες (χιλιάδες) και αντικαθιστούμε κόμμα με τελεία
  const cleaned = String(amountStr).replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Μορφοποιεί ποσό σε string με τελεία για χιλιάδες και κόμμα για δεκαδικά
 * Παράδειγμα: 12562.25 -> "12.562,25"
 */
function formatAmount(amount) {
  if (!amount || amount === 0) return '';
  const num = typeof amount === 'number' ? amount : parseAmount(amount);
  
  // Μετατροπή σε string με 2 δεκαδικά
  const fixed = num.toFixed(2);
  const parts = fixed.split('.');
  
  // Προσθήκη τελείας για χιλιάδες
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Αντικατάσταση τελείας με κόμμα για δεκαδικά
  return parts.join(',');
}

/**
 * Μορφοποιεί ημερομηνία σε dd/mm/yy
 */
function formatDate(dateValue) {
  if (!dateValue) return '';
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    return '';
  }
}

/**
 * Υπολογίζει το συνολικό συμβατικό αντικείμενο
 * (Αρχική Σύμβαση + Συμπληρωματικές Συμβάσεις)
 * ΣΗΜΕΙΩΣΗ: ΔΕΝ προσθέτουμε το ΑΠΕ γιατί αυτό ήδη περιλαμβάνει την αρχική σύμβαση + αναθεώρηση
 */
function calculateTotalContractAmount(project) {
  let total = 0;
  
  // Αρχική σύμβαση
  if (project.contractAmount) {
    total += parseAmount(project.contractAmount);
  }
  
  // ΔΕΝ προσθέτουμε το ΑΠΕ - το ΑΠΕ είναι ήδη Σύμβαση + Αναθεώρηση
  
  // Συμπληρωματικές συμβάσεις
  if (project.supplementaryContracts && Array.isArray(project.supplementaryContracts)) {
    project.supplementaryContracts.forEach(contract => {
      if (contract.amount) {
        total += parseAmount(contract.amount);
      }
    });
  }
  
  // Αν δεν υπάρχει τίποτα, επιστρέφουμε κενό
  if (total === 0) {
    return '';
  }
  
  return formatAmount(total);
}

/**
 * Φορτώνει όλα τα έργα από το φάκελο dedomena_ergon
 */
function loadAllProjects(dataDir) {
  const projects = [];
  
  if (!fs.existsSync(dataDir)) {
    return projects;
  }
  
  const projectDirs = fs.readdirSync(dataDir);
  const skipDirs = new Set(['entaxeis', 'ΠΡΟΣΚΛΗΣΕΙΣ', 'locks', 'egkriseis_links', 'subproject_links', 
                             'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ', 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ', 
                             'backups', 'audit_log.json']);
  
  for (const projectDir of projectDirs) {
    if (skipDirs.has(projectDir)) continue;
    
    const projectPath = path.join(dataDir, projectDir);
    if (!fs.statSync(projectPath).isDirectory()) continue;
    
    // Διαβάζουμε όλα τα υποέργα
    const subprojectDirs = fs.readdirSync(projectPath);
    
    for (const subprojectDir of subprojectDirs) {
      const subprojectPath = path.join(projectPath, subprojectDir);
      if (!fs.statSync(subprojectPath).isDirectory()) continue;
      
      const dataPath = path.join(subprojectPath, 'data.json');
      if (!fs.existsSync(dataPath)) continue;
      
      try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        projects.push(data);
      } catch (error) {
        console.error(`Error loading project ${projectDir}/${subprojectDir}:`, error);
      }
    }
  }
  
  return projects;
}

/**
 * Φιλτράρει έργα με βάση τα κριτήρια
 */
function filterProjects(projects, targetYear, targetMonth) {
  return projects.filter(project => {
    // 1. Έλεγχος ύπαρξης ΚΑ
    const kaCode = project.kaCode || '';
    const kaCodeTrimmed = kaCode.trim().toUpperCase();
    
    if (!kaCodeTrimmed || 
        kaCodeTrimmed === '' || 
        kaCodeTrimmed === 'ΔΕΝ ΥΠΑΡΧΕΙ' ||
        kaCodeTrimmed === 'ΔΕΝ ΕΧΕΙ ΚΑ' ||
        kaCodeTrimmed === 'ΧΩΡΙΣ ΚΑ') {
      return false;
    }
    
    // 2. Έλεγχος τύπου έργου
    const validTypes = [
      'ΕΡΓΟ',
      'ΠΡΟΜΗΘΕΙΑ',
      'ΜΕΛΕΤΗ',
      'ΥΠΗΡΕΣΙΑ',
      'ΓΕΝΙΚΕΣ ΥΠΗΡΕΣΙΕΣ',
      'ΠΑΡΟΧΗ ΤΕΧΝΙΚΩΝ ΚΑΙ ΛΟΙΠΩΝ ΣΥΝΑΦΩΝ ΕΠΙΣΤΗΜΟΝΙΚΩΝ ΥΠΗΡΕΣΙΩΝ',
      'ΚΟΙΝΩΝΙΚΕΣ ΚΑΙ ΑΛΛΕΣ ΕΙΔΙΚΕΣ ΥΠΗΡΕΣΙΕΣ'
    ];
    if (!validTypes.includes(project.projectType)) {
      return false;
    }
    
    // 3. Εξαίρεση ολοκληρωμένων και αποπληρωμένων έργων
    if (project.projectStatus === 'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ') {
      return false;
    }
    
    // 4. Έλεγχος προϋπολογισμού >= 20.000€
    const budget = parseAmount(project.projectBudget || project.approvedAmount);
    if (budget < 20000) {
      return false;
    }
    
    // 5. Εξαίρεση "ΙΔΙΟΙ ΠΟΡΟΙ"
    if (project.fundingDetails && project.fundingDetails.includes('ΙΔΙΟΙ ΠΟΡΟΙ')) {
      return false;
    }
    
    // 6. Έλεγχος ημερομηνίας δημιουργίας/ενημέρωσης με βάση το ιστορικό
    // Το έργο πρέπει να υπήρχε μέχρι το τέλος του επιλεγμένου μήνα
    const targetDate = new Date(targetYear, parseInt(targetMonth) - 1, 31, 23, 59, 59);
    
    const createdAt = project.createdAt ? new Date(project.createdAt) : null;
    if (createdAt && createdAt > targetDate) {
      return false; // Το έργο δημιουργήθηκε μετά την επιλεγμένη ημερομηνία
    }
    
    return true;
  });
}

/**
 * Αντιστοιχίζει τα πεδία της εφαρμογής με το Excel format
 */
function mapProjectToExcelRow(project, rowNumber) {
  // Mapping πηγών χρηματοδότησης
  const fundingSourceMap = {
    'ΠΡΟΓΡΑΜΜΑ ΑΝΤΩΝΗΣ ΤΡΙΤΣΗΣ': ' 01. ΠΡΟΓΡΑΜΜΑ ΑΝΤΩΝΗΣ ΤΡΙΤΣΗΣ',
    'ΠΡΟΓΡΑΜΜΑ ΦΙΛΟΔΗΜΟΣ ΙΙ': ' 02. ΠΡΟΓΡΑΜΜΑ ΦΙΛΟΔΗΜΟΣ ΙΙ',
    'ΠΔΕ ΥΠΕΣ ΣΑΕ055': ' 03. ΠΔΕ ΥΠΕΣ ΣΑΕ055',
    'ΕΣΠΑ 2014_2020': ' 04.ΕΣΠΑ 2014_2020',
    'ΕΣΠΑ 2021_2027': ' 05. ΕΣΠΑ 2021_2027',
    'ΕΘΝΙΚΟ ΠΔΕ ή EΠΑ_2021_2025': ' 06. ΕΘΝΙΚΟ ΠΔΕ ή EΠΑ_2021_2025',
    'ΤΑΜΕΙΟ ΑΝΑΚΑΜΨΗΣ και ΑΝΘΕΚΤΙΚΟΤΗΤΑΣ': ' 07. ΤΑΜΕΙΟ ΑΝΑΚΑΜΨΗΣ και ΑΝΘΕΚΤΙΚΟΤΗΤΑΣ',
    'ΛΟΙΠΑ ΠΡΟΓΡΑΜΜΑΤΑ ή ΠΟΡΟΙ': ' 10. ΛΟΙΠΑ ΠΡΟΓΡΑΜΜΑΤΑ ή ΠΟΡΟΙ'
  };
  
  // Mapping καταστάσεων έργου
  const statusMap = {
    'ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ': '02. ΥΠΟ ΒΡΑΧΥΠΡΟΘΕΣΜΗ ΩΡΙΜΑΝΣΗ (3-12 μήνες)',
    'ΣΕ ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ': '04. ΔΙΑΔΙΚΑΣΙΑ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ ΣΕ ΕΞΕΛΙΞΗ',
    'ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ': '05. ΕΚΤΕΛΟΥΜΕΝΟ - ΣΥΜΒΑΣΙΟΠΟΙΗΜΕΝΟ ΕΡΓΟ ',
    'ΟΛΟΚΛΗΡΩΜΕΝΟ': '06. ΟΛΟΚΛΗΡΩΜΕΝΟ ΕΡΓΟ',
    'ΟΛΟΚΛΗΡΩΜΕΝΟ ΚΑΙ ΑΠΟΠΛΗΡΩΜΕΝΟ': '06. ΟΛΟΚΛΗΡΩΜΕΝΟ ΕΡΓΟ'
  };
  
  // Mapping τύπων έργου (INVEST format)
  const typeMap = {
    'ΕΡΓΟ': '01. ΕΡΓΟ',
    'ΜΕΛΕΤΗ': '02. ΜΕΛΕΤΗ',
    'ΠΡΟΜΗΘΕΙΑ': '03. ΠΡΟΜΗΘΕΙΑ',
    'ΥΠΗΡΕΣΙΑ': '04. ΥΠΗΡΕΣΙΑ',
    'ΓΕΝΙΚΕΣ ΥΠΗΡΕΣΙΕΣ': '04. ΥΠΗΡΕΣΙΑ',
    'ΠΑΡΟΧΗ ΤΕΧΝΙΚΩΝ ΚΑΙ ΛΟΙΠΩΝ ΣΥΝΑΦΩΝ ΕΠΙΣΤΗΜΟΝΙΚΩΝ ΥΠΗΡΕΣΙΩΝ': '04. ΥΠΗΡΕΣΙΑ',
    'ΚΟΙΝΩΝΙΚΕΣ ΚΑΙ ΑΛΛΕΣ ΕΙΔΙΚΕΣ ΥΠΗΡΕΣΙΕΣ': '04. ΥΠΗΡΕΣΙΑ'
  };
  
  // Προετοιμασία σχολίων με προσθήκη ΑΠΕ αν υπάρχει
  let comments = project.comments || '';
  
  // Προσθήκη ΑΠΕ στα σχόλια αν είναι > 0
  const apeAmount = parseAmount(project.apeAmount);
  if (apeAmount > 0) {
    const apeFormatted = formatAmount(apeAmount);
    const apeNote = `ΑΠΕ: ${apeFormatted}`;
    
    if (comments) {
      comments = `${comments}\n${apeNote}`;
    } else {
      comments = apeNote;
    }
  }
  
  const row = {
    '(00)\r\nΑΑ ': rowNumber,
    '(01) \r\nΚΩΔΙΚΟΣ ΑΡΙΘΜΟΣ ΕΞΟΔΟΥ / ΛΟΓΑΡΙΑΣΜΟΣ ΠΑΡΑΚΟΛΟΥΘΗΣΗΣ ': project.kaCode || '',
    '(02)\r\nΤΙΤΛΟΣ ΕΡΓΟΥ': project.projectTitle || '',
    '(03)\r\nΤΙΤΛΟΣ ΥΠΟΕΡΓΟΥ': project.subprojectTitle || '',
    '(04)\r\nΕΙΔΟΣ \r\n(Επιλογή από πτυσσόμενη λίστα)': typeMap[project.projectType] || project.projectType,
    '(05)\r\nΒΑΣΙΚΗ ΠΗΓΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ\r\n(Επιλογή από πτυσσόμενη λίστα)': fundingSourceMap[project.fundingSource] || project.fundingSource,
    '(06)\r\nΕΞΕΙΔΙΚΕΥΣΗ ΒΑΣΙΚΗΣ ΠΗΓΗΣ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ\r\n(Επιλογή από πτυσσόμενη λίστα)': project.fundingDetails || '',
    '(07) ΕΓΚΕΚΡΙΜΕΝΟ ΠΟΣΟ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ\r\n(Βάσει της εγκριτικής απόφασης)': formatAmount(project.approvedAmount),
    '(08)\r\nΣΥΜΠΛΗΡΩΜΑΤΙΚΗ ΠΗΓΗ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ\r\n(Επιλογή από πτυσσόμενη λίστα)': '',
    '(09)\r\nΕΞΕΙΔΙΚΕΥΣΗ ΣΥΜΠΛΗΡΩΜΑΤΙΚΗΣ ΠΗΓΗΣ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ\r\n(Επιλογή από πτυσσόμενη λίστα)': '',
    '(10) ΕΓΚΕΚΡΙΜΕΝΟ ΠΟΣΟ ΧΡΗΜΑΤΟΔΟΤΗΣΗΣ\r\n(Βάσει της εγκριτικής απόφασης)': '',
    '(11)\r\n ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΕΡΓΟΥ': formatAmount(project.projectBudget || project.approvedAmount),
    '(12)\r\nΚΑΤΑΣΤΑΣΗ ΕΡΓΟΥ\r\n(Επιλογή από πτυσσόμενη λίστα)': statusMap[project.projectStatus] || project.projectStatus,
    '(13) \r\nΗΜΕΡΟΜΗΝΙΑ ΕΝΑΡΞΗΣ ΔΙΑΔΙΚΑΣΙΑΣ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ\r\n(εάν φάση υλοποίησης = 04, 05 ή 06)': '', // Δεν το έχουμε
    '(14) \r\nΗΜΕΡΟΜΗΝΙΑ ΥΠΟΓΡΑΦΗΣ ΣΥΜΒΑΣΗΣ\r\n(εάν φάση υλοποίησης = 05 ή 06)': formatDate(project.contractDate),
    '(15) ΣΥΜΒΑΤΙΚΟ ΑΝΤΙΚΕΙΜΕΝΟ\r\n(Ποσό αρχικής σύμβασης + ΑΠΕ +συμπληρωματικές συμβάσεις)': calculateTotalContractAmount(project),
    // Στήλες Ν, Q, R, S, T, U, V - Αφήνονται κενές (οικονομική υπηρεσία)
    '(16) ΠΡΑΓΜΑΤΟΠΟΙΗΘΕΙΣΑ ΔΑΠΑΝΗ μέχρι την 31.12.2023\r\n(Εγκεκριμένοι λογαριασμοί έργων ή τιμολόγια δαπανών)': '',
    '(17) ΠΡΑΓΜΑΤΟΠΟΙΗΘΕΙΣΑ ΔΑΠΑΝΗ ΕΤΟΥΣ 2024  μέχρι το μήνα αναφοράς\r\n(Εγκεκριμένοι λογαριασμοί έργων ή τιμολόγια δαπανών)': '',
    '(18)\r\n ΠΛΗΡΩΜΕΣ μέχρι την 31.12.2023': '',
    '(19)\r\n ΠΛΗΡΩΜΕΣ ΕΤΟΥΣ 2024 μέχρι το μήνα αναφοράς': '',
    '(20) \r\nΗΜΕΡΟΜΗΝΙΑ ΟΛΟΚΛΗΡΩΣΗΣ/ ΑΠΕΝΤΑΞΗΣ\r\n(εάν φάση υλοποίησης = 06 ή 07)': '',
    '(21)\r\nΥΛΟΠΟΙΗΣΗ ΜΕΣΩ ΑΝΑΠΤΥΞΙΑΚΟΥ ΟΡΓΑΝΙΣΜΟΥ ή ΆΛΛΟΥ ΦΟΡΕΑ\r\n(Εάν ναι, συμπληρώστε την επωνυμία του φορέα)': '',
    '(22)\r\nΠΑΡΑΤΗΡΗΣΕΙΣ': comments
  };
  
  return row;
}

/**
 * Μετατρέπει Excel serial date σε μορφοποιημένη ημερομηνία
 */
function formatExcelDate(value) {
  if (!value) return '';
  
  // Αν είναι ήδη string ημερομηνίας, το επιστρέφουμε
  if (typeof value === 'string' && value.includes('/')) {
    return value;
  }
  
  // Αν είναι αριθμός (Excel serial date)
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30); // Excel epoch
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    
    return `${day}/${month}/${year}`;
  }
  
  return value;
}

/**
 * Διορθώνει τη μορφή ποσού από το παλιό Excel
 * Μετατρέπει: 937.287 -> 937.287,00 ή 55.795 -> 55.795,00
 */
function fixOldExcelAmount(value) {
  // Αν είναι κενό, undefined, null ή το string "0", επιστρέφουμε κενό
  if (!value || value === '' || value === '0' || value === 0) {
    return '';
  }
  
  const valueStr = String(value).trim();
  
  // Αν είναι "0" ή κενό string, επιστρέφουμε κενό
  if (valueStr === '0' || valueStr === '') {
    return '';
  }
  
  // Αν είναι ήδη στη σωστή μορφή (έχει κόμμα και τελεία), το επιστρέφουμε
  if (valueStr.includes(',') && valueStr.includes('.')) {
    return valueStr; // π.χ. 110.989,00
  }
  
  // Αν έχει κόμμα αλλά ΟΧΙ τελεία (π.χ. 123,45), προσθέτουμε τελείες
  if (valueStr.includes(',') && !valueStr.includes('.')) {
    // Χωρίζουμε σε ακέραιο και δεκαδικό μέρος
    const parts = valueStr.split(',');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '00';
    
    // Προσθέτουμε τελείες στο ακέραιο μέρος
    const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${formatted},${decimalPart}`;
  }
  
  // Αν έχει μόνο τελεία (π.χ. 110.989 ή 55.795), προσθέτουμε ,00
  if (valueStr.includes('.') && !valueStr.includes(',')) {
    return valueStr + ',00';
  }
  
  // Αν είναι απλός αριθμός χωρίς μορφοποίηση (π.χ. 200000), το μορφοποιούμε πλήρως
  const num = parseFloat(valueStr);
  if (!isNaN(num) && num !== 0) {
    return formatAmount(num); // Θα γίνει 200.000,00
  }
  
  // Αν δεν είναι κανένα από τα παραπάνω, το επιστρέφουμε όπως είναι
  return valueStr;
}

/**
 * Διαβάζει το προηγούμενο Excel αρχείο και επιστρέφει ΟΛΑ τα δεδομένα ανά γραμμή
 * ΣΗΜΑΝΤΙΚΟ: Διατηρεί ΑΚΡΙΒΩΣ όλα τα δεδομένα χωρίς αλλοίωση
 */
function readPreviousExcelData(excelPath) {
  const previousData = new Map(); // Key: KA Code, Value: economic data by column index
  
  if (!fs.existsSync(excelPath)) {
    return previousData;
  }
  
  try {
    // Διαβάζουμε το Excel
    const workbook = XLSX.readFile(excelPath, { cellDates: false });
    const sheetName = '02. ΠΙΝΑΚΑΣ ΕΡΓΩΝ';
    
    if (!workbook.SheetNames.includes(sheetName)) {
      return previousData;
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    console.log(`📋 Reading previous Excel with ${range.e.r} rows...`);
    
    // Διαβάζουμε κάθε γραμμή δεδομένων (skip header row 0)
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      // Στήλη B (index 1) = ΚΑ
      const kaCellAddress = XLSX.utils.encode_cell({ r: R, c: 1 });
      const kaCell = worksheet[kaCellAddress];
      const kaCode = kaCell ? (kaCell.w || kaCell.v || '') : '';
      
      if (!kaCode || kaCode.trim() === '') continue;
      
      // Διαβάζουμε τις στήλες που μας ενδιαφέρουν (οικονομικά δεδομένα)
      const economicData = {
        col13: '', // N = index 13 (Ημερομηνία Έναρξης)
        col14: '', // O = index 14 (Ημερομηνία Υπογραφής)
        col16: '', // Q = index 16 (Δαπάνη 2023)
        col17: '', // R = index 17 (Δαπάνη 2024)
        col18: '', // S = index 18 (Πληρωμές 2023)
        col19: '', // T = index 19 (Πληρωμές 2024)
        col20: ''  // U = index 20 (Ημερομηνία Ολοκλήρωσης)
      };
      
      // Διαβάζουμε κάθε στήλη
      [13, 14, 16, 17, 18, 19, 20].forEach(colIndex => {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: colIndex });
        const cell = worksheet[cellAddress];
        if (cell) {
          const value = cell.w !== undefined ? cell.w : (cell.v || '');
          
          // Αν είναι ποσό (στήλες 16, 17, 18, 19), διορθώνουμε τη μορφή
          if ([16, 17, 18, 19].includes(colIndex)) {
            economicData[`col${colIndex}`] = fixOldExcelAmount(value);
          } else {
            // Ημερομηνίες - διατηρούμε όπως είναι
            economicData[`col${colIndex}`] = value;
          }
        }
      });
      
      previousData.set(kaCode.trim(), economicData);
    }
    
    console.log(`✅ Successfully read ${previousData.size} rows from previous Excel`);
    
    // Debug: Εμφάνιση ενός δείγματος
    if (previousData.size > 0) {
      const firstEntry = Array.from(previousData.entries())[0];
      console.log(`📝 Sample entry - KA: ${firstEntry[0]}, Data:`, firstEntry[1]);
    }
    
  } catch (error) {
    console.error('❌ Error reading previous Excel:', error);
  }
  
  return previousData;
}

/**
 * Διορθώνει τα ποσά στο εξαγόμενο Excel (προσθέτει ,00)
 * ΣΗΜΕΙΩΣΗ: Οι data validation lists πρέπει να προστεθούν manually από το template
 */
function fixAmountsInExcel(workbook, sheet, numRows) {
  try {
    console.log('📝 Fixing amounts format...');
    
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    // Στήλες Q, R, S, T (indices 16, 17, 18, 19)
    const amountColumns = [16, 17, 18, 19];
    
    // Για κάθε γραμμή δεδομένων (skip header)
    for (let R = 1; R <= numRows; R++) {
      amountColumns.forEach(C => {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = sheet[cellAddress];
        
        if (cell && cell.v) {
          const valueStr = String(cell.v);
          
          // Αν έχει μόνο τελεία (π.χ. 110.989), προσθέτουμε ,00
          if (valueStr.includes('.') && !valueStr.includes(',') && valueStr !== '0') {
            const newValue = valueStr + ',00';
            cell.v = newValue;
            cell.w = newValue;
            cell.t = 's'; // String type
          }
        }
      });
    }
    
    console.log('✅ Amounts format fixed');
    
  } catch (error) {
    console.error('❌ Error fixing amounts:', error);
  }
}

/**
 * Αφαιρεί τις στήλες ελέγχου σφαλμάτων (Y και μετά)
 */
function removeErrorCheckColumns(sheet) {
  if (!sheet['!ref']) return;
  
  const range = XLSX.utils.decode_range(sheet['!ref']);
  
  // Η στήλη Y είναι η 24η (index 24, γιατί A=0)
  // Θέλουμε να κρατήσουμε μόνο τις στήλες A-W (0-22, δηλαδή 23 στήλες)
  const maxCol = 22; // W column (0-indexed)
  
  if (range.e.c > maxCol) {
    // Διαγραφή κελιών από τη στήλη X και μετά
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = maxCol + 1; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        delete sheet[cellAddress];
      }
    }
    
    // Ενημέρωση του range
    range.e.c = maxCol;
    sheet['!ref'] = XLSX.utils.encode_range(range);
  }
}

/**
 * Υπολογίζει το βέλτιστο ύψος γραμμής με βάση το περιεχόμενο
 */
function calculateRowHeight(sheet, rowIndex, maxCol) {
  let maxLines = 1;
  
  for (let C = 0; C <= maxCol; C++) {
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: C });
    const cell = sheet[cellAddress];
    
    if (cell && cell.v) {
      const cellValue = String(cell.v);
      const lines = cellValue.split('\n').length;
      
      // Υπολογισμός πόσες γραμμές χρειάζονται με βάση το μήκος
      // Υποθέτουμε ~60 χαρακτήρες ανά γραμμή (ανάλογα με το πλάτος στήλης)
      const charsPerLine = 60;
      const estimatedLines = Math.ceil(cellValue.length / charsPerLine);
      
      maxLines = Math.max(maxLines, lines, estimatedLines);
    }
  }
  
  // Βασικό ύψος 20pt + 15pt ανά επιπλέον γραμμή
  return Math.max(20 + (maxLines - 1) * 15, 30);
}

/**
 * Εφαρμόζει μορφοποίηση στο Excel sheet
 */
function applyExcelFormatting(sheet, rows) {
  if (!sheet['!ref']) return;
  
  const range = XLSX.utils.decode_range(sheet['!ref']);
  
  // Στυλ για headers
  const headerStyle = {
    font: { bold: true, sz: 11, color: { rgb: "000000" } },
    fill: { fgColor: { rgb: "B4C7E7" } }, // Απαλό μπλε
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  };
  
  // Στυλ για κανονικά κελιά
  const cellStyle = {
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "D0D0D0" } },
      bottom: { style: "thin", color: { rgb: "D0D0D0" } },
      left: { style: "thin", color: { rgb: "D0D0D0" } },
      right: { style: "thin", color: { rgb: "D0D0D0" } }
    }
  };
  
  // Στυλ για νέες γραμμές
  const newRowStyle = {
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { fgColor: { rgb: "E2EFDA" } }, // Απαλό πράσινο
    border: {
      top: { style: "thin", color: { rgb: "D0D0D0" } },
      bottom: { style: "thin", color: { rgb: "D0D0D0" } },
      left: { style: "thin", color: { rgb: "D0D0D0" } },
      right: { style: "thin", color: { rgb: "D0D0D0" } }
    }
  };
  
  // Εφαρμογή στυλ σε όλα τα κελιά
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      
      if (!sheet[cellAddress]) {
        sheet[cellAddress] = { t: 's', v: '' };
      }
      
      // Header row (πρώτη γραμμή)
      if (R === 0) {
        sheet[cellAddress].s = headerStyle;
      } else {
        // Έλεγχος αν είναι νέα γραμμή
        const isNewRow = rows[R - 1] && rows[R - 1]._isNew;
        sheet[cellAddress].s = isNewRow ? newRowStyle : cellStyle;
      }
    }
  }
  
  // Ορισμός πλάτους στηλών με βάση το περιεχόμενο
  const colWidths = [];
  
  for (let C = range.s.c; C <= range.e.c; C++) {
    let maxWidth = 10; // Minimum width
    
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[cellAddress];
      
      if (cell && cell.v) {
        const cellValue = String(cell.v);
        // Υπολογισμός πλάτους με βάση το μήκος του κειμένου
        const lines = cellValue.split('\n');
        const maxLineLength = Math.max(...lines.map(line => line.length));
        
        // Ειδική διαχείριση για διαφορετικούς τύπους περιεχομένου
        let width;
        if (maxLineLength > 100) {
          // Μεγάλα κείμενα (τίτλοι έργων)
          width = 50;
        } else if (maxLineLength > 50) {
          // Μεσαία κείμενα
          width = 35;
        } else if (maxLineLength > 20) {
          // Μικρά κείμενα
          width = 20;
        } else {
          // Αριθμοί, κωδικοί
          width = Math.max(maxLineLength * 1.2, 12);
        }
        
        maxWidth = Math.max(maxWidth, width);
      }
    }
    
    colWidths.push({ wch: Math.min(maxWidth, 60) }); // Max 60 characters
  }
  
  sheet['!cols'] = colWidths;
  
  // Freeze panes (σταθερή πρώτη γραμμή)
  sheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
  
  // Ορισμός ύψους γραμμών με βάση το περιεχόμενο
  const rowHeights = [];
  const maxCol = Math.min(range.e.c, 22); // Μέχρι τη στήλη W
  
  for (let R = range.s.r; R <= range.e.r; R++) {
    if (R === 0) {
      // Header row - σταθερό μεγαλύτερο ύψος
      rowHeights.push({ hpt: 50 });
    } else {
      // Υπολογισμός βέλτιστου ύψους για κάθε γραμμή
      const height = calculateRowHeight(sheet, R, maxCol);
      rowHeights.push({ hpt: height });
    }
  }
  sheet['!rows'] = rowHeights;
}

/**
 * Βρίσκει το προηγούμενο αρχείο Excel
 */
function findPreviousExcelFile(exportDir, currentYear, currentMonth) {
  if (!fs.existsSync(exportDir)) {
    return null;
  }
  
  const files = fs.readdirSync(exportDir);
  const investFiles = files.filter(f => f.startsWith('INVEST') && f.endsWith('.xlsx'));
  
  if (investFiles.length === 0) {
    return null;
  }
  
  // Ταξινόμηση κατά ημερομηνία (από το όνομα)
  investFiles.sort((a, b) => {
    const yearA = parseInt(a.substring(6, 10));
    const monthA = parseInt(a.substring(10, 12));
    const yearB = parseInt(b.substring(6, 10));
    const monthB = parseInt(b.substring(10, 12));
    
    if (yearA !== yearB) return yearB - yearA;
    return monthB - monthA;
  });
  
  // Βρίσκουμε το αμέσως προηγούμενο
  const currentDate = currentYear * 100 + parseInt(currentMonth);
  
  for (const file of investFiles) {
    const fileYear = parseInt(file.substring(6, 10));
    const fileMonth = parseInt(file.substring(10, 12));
    const fileDate = fileYear * 100 + fileMonth;
    
    if (fileDate < currentDate) {
      return path.join(exportDir, file);
    }
  }
  
  return null;
}

/**
 * Δημιουργεί το Excel αρχείο με τα εκτελεστέα έργα
 */
async function exportInvestProjects(options) {
  const { year, month, dataDir, exportDir, templatePath } = options;
  
  console.log(`📊 Starting INVEST export for ${year}-${month}...`);
  
  // 1. Φόρτωση όλων των έργων
  const allProjects = loadAllProjects(dataDir);
  console.log(`📁 Loaded ${allProjects.length} total projects`);
  
  // 2. Φιλτράρισμα με βάση τα κριτήρια
  const filteredProjects = filterProjects(allProjects, year, month);
  console.log(`✅ Filtered to ${filteredProjects.length} projects matching criteria`);
  
  // 2.5. Ταξινόμηση με βάση τον ΚΑ (από μικρότερο σε μεγαλύτερο)
  filteredProjects.sort((a, b) => {
    const kaA = a.kaCode || '';
    const kaB = b.kaCode || '';
    return kaA.localeCompare(kaB, 'el', { numeric: true, sensitivity: 'base' });
  });
  console.log(`📊 Sorted ${filteredProjects.length} projects by KA code`);
  
  // 3. Εύρεση προηγούμενου αρχείου
  const previousFile = findPreviousExcelFile(exportDir, year, month);
  console.log(previousFile ? `📂 Found previous file: ${path.basename(previousFile)}` : '📂 No previous file found');
  
  // 4. Ανάγνωση οικονομικών δεδομένων και ΚΑ από προηγούμενο αρχείο
  const economicData = previousFile ? readPreviousExcelData(previousFile) : new Map();
  const previousKACodes = new Set(economicData.keys());
  const previousProjectsCount = previousKACodes.size;
  console.log(`💰 Loaded economic data for ${economicData.size} projects`);
  
  // 5. Δημιουργία νέου workbook από template
  const workbook = XLSX.readFile(templatePath);
  
  // 6. Ενημέρωση του φύλλου "01. ΣΤΟΙΧΕΙΑ ΦΟΡΕΑ"
  const infoSheet = workbook.Sheets['01. ΣΤΟΙΧΕΙΑ ΦΟΡΕΑ'];
  if (infoSheet) {
    // Ενημέρωση έτους και μήνα
    const infoData = XLSX.utils.sheet_to_json(infoSheet, { header: 1 });
    if (infoData.length > 1) {
      infoData[1][0] = year;
      const monthNames = ['01. ΙΑΝΟΥΑΡΙΟΣ', '02. ΦΕΒΡΟΥΑΡΙΟΣ', '03. ΜΑΡΤΙΟΣ', '04. ΑΠΡΙΛΙΟΣ', 
                          '05. ΜΑΙΟΣ', '06. ΙΟΥΝΙΟΣ', '07. ΙΟΥΛΙΟΣ', '08. ΑΥΓΟΥΣΤΟΣ', 
                          '09. ΣΕΠΤΕΜΒΡΙΟΣ', '10. ΟΚΤΩΒΡΙΟΣ', '11. ΝΟΕΜΒΡΙΟΣ', '12. ΔΕΚΕΜΒΡΙΟΣ'];
      infoData[1][1] = monthNames[parseInt(month) - 1];
      
      const newInfoSheet = XLSX.utils.aoa_to_sheet(infoData);
      workbook.Sheets['01. ΣΤΟΙΧΕΙΑ ΦΟΡΕΑ'] = newInfoSheet;
    }
  }
  
  // 7. Δημιουργία δεδομένων για το φύλλο "02. ΠΙΝΑΚΑΣ ΕΡΓΩΝ"
  const projectRows = filteredProjects.map((project, index) => {
    const row = mapProjectToExcelRow(project, index + 1);
    
    // Προσθήκη flag για νέες γραμμές (για χρωματισμό)
    const kaCode = project.kaCode;
    row._isNew = kaCode ? !previousKACodes.has(kaCode) : true;
    
    // Merge οικονομικών δεδομένων από προηγούμενο αρχείο
    const kaCodeTrimmed = kaCode ? kaCode.trim() : '';
    if (kaCodeTrimmed && economicData.has(kaCodeTrimmed)) {
      const econ = economicData.get(kaCodeTrimmed);
      
      console.log(`🔄 Merging data for KA: ${kaCodeTrimmed}`);
      
      // Αντιγραφή δεδομένων με σωστή μορφοποίηση
      if (econ.col13) row['(13) \r\nΗΜΕΡΟΜΗΝΙΑ ΕΝΑΡΞΗΣ ΔΙΑΔΙΚΑΣΙΑΣ ΣΥΝΑΨΗΣ ΣΥΜΒΑΣΗΣ\r\n(εάν φάση υλοποίησης = 04, 05 ή 06)'] = econ.col13;
      if (econ.col14) row['(14) \r\nΗΜΕΡΟΜΗΝΙΑ ΥΠΟΓΡΑΦΗΣ ΣΥΜΒΑΣΗΣ\r\n(εάν φάση υλοποίησης = 05 ή 06)'] = econ.col14;
      
      // Οικονομικά ποσά - ΔΙΟΡΘΩΣΗ ΜΟΡΦΗΣ με fixOldExcelAmount
      if (econ.col16) row['(16) ΠΡΑΓΜΑΤΟΠΟΙΗΘΕΙΣΑ ΔΑΠΑΝΗ μέχρι την 31.12.2023\r\n(Εγκεκριμένοι λογαριασμοί έργων ή τιμολόγια δαπανών)'] = fixOldExcelAmount(econ.col16);
      if (econ.col17) row['(17) ΠΡΑΓΜΑΤΟΠΟΙΗΘΕΙΣΑ ΔΑΠΑΝΗ ΕΤΟΥΣ 2024  μέχρι το μήνα αναφοράς\r\n(Εγκεκριμένοι λογαριασμοί έργων ή τιμολόγια δαπανών)'] = fixOldExcelAmount(econ.col17);
      if (econ.col18) row['(18)\r\n ΠΛΗΡΩΜΕΣ μέχρι την 31.12.2023'] = fixOldExcelAmount(econ.col18);
      if (econ.col19) row['(19)\r\n ΠΛΗΡΩΜΕΣ ΕΤΟΥΣ 2024 μέχρι το μήνα αναφοράς'] = fixOldExcelAmount(econ.col19);
      if (econ.col20) row['(20) \r\nΗΜΕΡΟΜΗΝΙΑ ΟΛΟΚΛΗΡΩΣΗΣ/ ΑΠΕΝΤΑΞΗΣ\r\n(εάν φάση υλοποίησης = 06 ή 07)'] = econ.col20;
      
      // Σημειώνουμε ότι ΔΕΝ είναι νέα γραμμή
      row._isNew = false;
    }
    
    return row;
  });
  
  // 8. Χρησιμοποιούμε το template sheet για να διατηρήσουμε τις data validations
  const templateSheet = workbook.Sheets['02. ΠΙΝΑΚΑΣ ΕΡΓΩΝ'];
  
  // Διαγραφή μόνο των τιμών των κελιών (ΟΧΙ των validations)
  const templateRange = XLSX.utils.decode_range(templateSheet['!ref']);
  for (let R = templateRange.s.r + 1; R <= templateRange.e.r; R++) {
    for (let C = templateRange.s.c; C <= templateRange.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = templateSheet[cellAddress];
      if (cell) {
        // Διαγράφουμε μόνο την τιμή, ΟΧΙ το cell object (που έχει τις validations)
        cell.v = undefined;
        cell.w = undefined;
        cell.t = 'z'; // Empty cell type
      }
    }
  }
  
  // Προσθήκη νέων δεδομένων χωρίς να αλλάξουμε τις validations
  const headers = Object.keys(projectRows[0]);
  
  // Ενημέρωση headers (πρώτη γραμμή)
  headers.forEach((header, colIdx) => {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!templateSheet[cellAddress]) {
      templateSheet[cellAddress] = {};
    }
    templateSheet[cellAddress].v = header;
    templateSheet[cellAddress].t = 's';
  });
  
  // Ενημέρωση δεδομένων (διατηρώντας τα cell objects για validations)
  projectRows.forEach((row, rowIdx) => {
    // Φιλτράρουμε το _isNew από τα values
    const rowData = { ...row };
    delete rowData._isNew;
    
    const values = Object.values(rowData);
    values.forEach((value, colIdx) => {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
      
      // Αν το cell δεν υπάρχει, δημιουργούμε νέο
      if (!templateSheet[cellAddress]) {
        templateSheet[cellAddress] = {};
      }
      
      // Ενημέρωση τιμής (διατηρώντας validations αν υπάρχουν)
      const cell = templateSheet[cellAddress];
      
      if (value === null || value === undefined || value === '') {
        cell.v = '';
        cell.t = 'z';
      } else if (typeof value === 'number') {
        cell.v = value;
        cell.t = 'n';
      } else {
        cell.v = String(value);
        cell.t = 's';
      }
    });
  });
  
  // Ενημέρωση του range
  const newEndRow = projectRows.length;
  const newEndCol = headers.length - 1;
  templateSheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: newEndRow, c: newEndCol }
  });
  
  // Εφαρμογή μορφοποίησης
  applyExcelFormatting(templateSheet, projectRows);
  
  // Αφαίρεση στηλών ελέγχου σφαλμάτων (Y και μετά)
  removeErrorCheckColumns(templateSheet);
  
  workbook.Sheets['02. ΠΙΝΑΚΑΣ ΕΡΓΩΝ'] = templateSheet;
  
  // 9. Αποθήκευση αρχείου
  const filename = `INVEST${year}${month}_.xlsx`;
  const outputPath = path.join(exportDir, filename);
  
  // Διαγραφή παλιού αρχείου για τον ίδιο μήνα αν υπάρχει
  if (fs.existsSync(outputPath)) {
    console.log(`🗑️ Deleting previous export for ${year}-${month}`);
    fs.unlinkSync(outputPath);
  }
  
  // Αποθήκευση στον φάκελο της εφαρμογής
  XLSX.writeFile(workbook, outputPath);
  
  console.log(`✅ Export completed: ${filename}`);
  
  // Εφαρμογή data validations από το template χρησιμοποιώντας Python
  // Το κάνουμε με timeout για να μην κολλήσει η εφαρμογή
  try {
    // Αναζήτηση του πιο πρόσφατου template (προηγούμενου μήνα)
    const files = fs.readdirSync(exportDir)
      .filter(f => f.startsWith('INVEST') && f.endsWith('.xlsx') && f !== filename)
      .sort()
      .reverse();
    
    const templatePath = files.length > 0 
      ? path.join(exportDir, files[0])
      : null;
    
    // Βρίσκουμε το Python script - διαφορετικό path για development vs portable
    let pythonScript;
    if (process.env.NODE_ENV === 'development') {
      pythonScript = path.join(__dirname, '..', 'apply_excel_validations.py');
    } else {
      // Στο portable mode, το script είναι στο resources folder
      pythonScript = path.join(process.resourcesPath, 'apply_excel_validations.py');
    }
    
    console.log(`🔍 Looking for Python script at: ${pythonScript}`);
    
    if (templatePath && fs.existsSync(templatePath) && fs.existsSync(pythonScript)) {
      console.log(`🔧 Applying data validations from template: ${path.basename(templatePath)}`);
      
      // Εκτέλεση Python script με timeout 30 δευτερολέπτων
      const command = `python "${pythonScript}" "${templatePath}" "${outputPath}"`;
      
      await Promise.race([
        execAsync(command, { 
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 30000 // 30 seconds timeout
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000)
        )
      ]);
      
      console.log('✅ Data validations applied successfully');
    } else {
      console.warn('⚠️ Template or Python script not found, skipping validation application');
      if (!templatePath || !fs.existsSync(templatePath)) {
        console.warn(`   No previous template found in ${exportDir}`);
      }
      if (!fs.existsSync(pythonScript)) {
        console.warn(`   Python script not found: ${pythonScript}`);
      }
    }
  } catch (error) {
    console.error('❌ Error applying data validations:', error.message);
    console.warn('⚠️ Continuing without validations - you can apply them manually later');
    // Συνεχίζουμε παρόλα αυτά, το αρχείο είναι έτοιμο
  }
  
  // Υπολογισμός διαγραμμένων γραμμών
  const currentKACodes = new Set(filteredProjects.map(p => p.kaCode));
  const deletedProjectsCount = previousProjectsCount > 0 
    ? Array.from(previousKACodes).filter(ka => !currentKACodes.has(ka)).length 
    : 0;
  
  return {
    success: true,
    filename,
    outputPath,
    projectsCount: filteredProjects.length,
    newProjectsCount: projectRows.filter(r => r._isNew).length,
    deletedProjectsCount: deletedProjectsCount
  };
}

module.exports = {
  exportInvestProjects,
  parseAmount,
  formatAmount
};

