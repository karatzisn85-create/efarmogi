const fs = require('fs');
const path = require('path');

const dataDir = 'K:\\EFARMOGI\\dedomena_ergon';
const linksDir = path.join(dataDir, 'egkriseis_links');
const egkriseisDataPath = path.join(dataDir, 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ', 'egkriseis-data.json');

console.log('=== ΔΙΟΡΘΩΣΗ ΛΑΘΟΣ LINK ===\n');

// Φορτώνουμε το egkriseis-data.json
const egkriseisData = JSON.parse(fs.readFileSync(egkriseisDataPath, 'utf8'));
const projects = egkriseisData.projects || {};

// Το link file που έχει πρόβλημα
const linkFile = 'manual_egkrisi_ΠΡΟΜΗΘΕΙΑ_ΗΛΕΚΤΡΟΛΟΓΙΚΩΝ_ΥΛΙΚΩΝ_ΥΔΡΟΤΑΜΙΕΥΤΗΡΩΝ_ΑΡ_51aecedb.json';
const linkPath = path.join(linksDir, linkFile);

console.log('📄 Link File:', linkFile);
console.log('');

// Διαβάζουμε το link
const linkData = JSON.parse(fs.readFileSync(linkPath, 'utf8'));

console.log('🔍 ΤΡΕΧΟΝΤΑ ΔΕΔΟΜΕΝΑ LINK:');
console.log('   SubprojectId:', linkData.subprojectId);
console.log('   Egkrisi ProjectKey:', linkData.egkrisiProjectKey);
console.log('   Egkrisi SubprojectKey:', linkData.egkrisiSubprojectKey);
console.log('   Egkrisi Title:', linkData.egkrisiTitle);
console.log('');

// Βρίσκουμε το σωστό έργο και υποέργο στο egkriseis-data.json
// Το έργο έχει projectId "2" και folderName με "__2" στο τέλος
let correctProjectKey = null;
let correctSubprojectKey = null;

for (const [projectKey, project] of Object.entries(projects)) {
  if (project.projectId === '2' || project.folderName && project.folderName.includes('__2')) {
    console.log('✅ Βρέθηκε το έργο:', project.title.substring(0, 60) + '...');
    console.log('   ProjectKey:', projectKey);
    console.log('   FolderName:', project.folderName);
    console.log('');
    
    correctProjectKey = project.folderName || projectKey;
    
    // Ψάχνουμε το υποέργο "ΠΡΟΜΗΘΕΙΑ ΗΛΕΚΤΡΟΛΟΓΙΚΩΝ ΥΛΙΚΩΝ..."
    const subprojects = project.subprojects || {};
    for (const [subprojectKey, subproject] of Object.entries(subprojects)) {
      if (subproject.title && subproject.title.includes('ΠΡΟΜΗΘΕΙΑ ΗΛΕΚΤΡΟΛΟΓΙΚΩΝ ΥΛΙΚΩΝ')) {
        console.log('✅ Βρέθηκε το υποέργο:', subproject.title.substring(0, 60) + '...');
        console.log('   SubprojectKey:', subprojectKey);
        console.log('   Number:', subproject.number);
        console.log('');
        
        correctSubprojectKey = subprojectKey;
        break;
      }
    }
    break;
  }
}

if (!correctProjectKey || !correctSubprojectKey) {
  console.log('❌ Δεν βρέθηκε το σωστό έργο/υποέργο!');
  process.exit(1);
}

// Ενημερώνουμε το link
console.log('🔧 ΕΝΗΜΕΡΩΣΗ LINK:');
console.log('   Old ProjectKey:', linkData.egkrisiProjectKey, '-> New:', correctProjectKey);
console.log('   Old SubprojectKey:', linkData.egkrisiSubprojectKey, '-> New:', correctSubprojectKey);
console.log('');

linkData.egkrisiProjectKey = correctProjectKey;
linkData.egkrisiSubprojectKey = correctSubprojectKey;
linkData.manual = false; // Δεν ήταν manual, ήταν auto
linkData.autoLinked = true; // Ήταν auto-linked

// Αποθήκευση
fs.writeFileSync(linkPath, JSON.stringify(linkData, null, 2), 'utf8');

console.log('✅ Το link διωρθώθηκε επιτυχώς!');
console.log('');
console.log('📋 ΝΕΑ ΔΕΔΟΜΕΝΑ LINK:');
console.log(JSON.stringify(linkData, null, 2));

