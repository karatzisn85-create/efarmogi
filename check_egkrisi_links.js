const fs = require('fs');
const path = require('path');

const dataDir = 'K:\\EFARMOGI\\dedomena_ergon';
const linksDir = path.join(dataDir, 'egkriseis_links');

console.log('=== ΕΛΕΓΧΟΣ ΣΥΣΧΕΤΙΣΜΩΝ ΕΓΚΡΙΣΕΩΝ ===\n');
console.log('Data Directory:', dataDir);
console.log('Links Directory:', linksDir);
console.log('');

if (!fs.existsSync(linksDir)) {
  console.log('❌ Ο φάκελος egkriseis_links δεν υπάρχει!');
  process.exit(1);
}

const linkFiles = fs.readdirSync(linksDir).filter(f => f.endsWith('.json'));
console.log('📋 Βρέθηκαν', linkFiles.length, 'link file(s)\n');

const projectTitle = 'ΑΞΙΟΠΟΙΗΣΗ ΑΡΔΕΥΤΙΚΟΥ ΝΕΡΟΥ ΤΩΝ ΥΔΡΟΤΑΜΙΕΥΤΗΡΩΝ ΑΡΜΑΝΩΓΕΙΩΝ ΚΑΙ ΔΑΜΑΝΙΩΝ ΤΟΥ ΔΗΜΟΥ Ν. ΚΑΖΑΝΤΖΑΚΗ - ΑΝΤΙΠΛΗΜΜΥΡΙΚΗ ΠΡΟΣΤΑΣΙΑ ΕΥΡΥΤΕΡΗΣ ΠΕΡΙΟΧΗΣ';
console.log('🔍 Αναζήτηση για έργο:', projectTitle.substring(0, 50) + '...\n');

const normalizeText = (text) => {
  if (!text) return '';
  return text
    .replace(/\\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const normalizedSearchTitle = normalizeText(projectTitle);
let projectId = null;
let projectDirName = null;
let projectSubprojects = [];

const projectDirs = fs.readdirSync(dataDir).filter(dir => {
  const dirPath = path.join(dataDir, dir);
  return fs.statSync(dirPath).isDirectory() && 
         dir !== 'entaxeis' && 
         dir !== 'ΠΡΟΣΚΛΗΣΕΙΣ' && 
         dir !== 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ' && 
         dir !== 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ' && 
         dir !== 'egkriseis_links';
});

for (const projectDir of projectDirs) {
  const projectPath = path.join(dataDir, projectDir);
  const subprojectDirs = fs.readdirSync(projectPath);
  
  for (const subprojectDir of subprojectDirs) {
    const subprojectPath = path.join(projectPath, subprojectDir);
    if (!fs.statSync(subprojectPath).isDirectory()) continue;
    
    const dataJsonPath = path.join(subprojectPath, 'data.json');
    if (fs.existsSync(dataJsonPath)) {
      try {
        const subprojectData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
        const normalizedProjectTitle = normalizeText(subprojectData.projectTitle || '');
        
        if (normalizedProjectTitle === normalizedSearchTitle) {
          if (!projectId) {
            projectId = subprojectData.projectId;
            projectDirName = projectDir;
            console.log('✅ Βρέθηκε το έργο!');
            console.log('   ProjectId:', projectId);
            console.log('   ProjectDir:', projectDir);
            console.log('');
          }
          
          if (subprojectData.subprojectId && subprojectData.subprojectTitle) {
            projectSubprojects.push({
              subprojectId: subprojectData.subprojectId,
              subprojectTitle: subprojectData.subprojectTitle,
              subprojectDir: subprojectDir
            });
          }
        }
      } catch (err) {
        // Skip invalid JSON files
      }
    }
  }
}

if (!projectId) {
  console.log('❌ Το έργο δεν βρέθηκε!');
  process.exit(1);
}

console.log('📁 Υποέργα του έργου:', projectSubprojects.length);
projectSubprojects.forEach((sp, idx) => {
  console.log(`   ${idx + 1}. ${sp.subprojectTitle.substring(0, 70)}...`);
  console.log(`      ID: ${sp.subprojectId.substring(0, 36)}...`);
});
console.log('');

console.log('🔗 ΣΥΣΧΕΤΙΣΜΟΙ ΜΕ ΕΓΚΡΙΣΕΙΣ:\n');

const relevantLinks = [];

for (const linkFile of linkFiles) {
  try {
    const linkPath = path.join(linksDir, linkFile);
    const linkData = JSON.parse(fs.readFileSync(linkPath, 'utf8'));
    
    if (linkData.subprojectId && projectSubprojects.some(sp => sp.subprojectId === linkData.subprojectId)) {
      relevantLinks.push({
        file: linkFile,
        ...linkData
      });
    }
  } catch (err) {
    // Skip invalid files
  }
}

if (relevantLinks.length === 0) {
  console.log('⚠️ Δεν βρέθηκαν συσχετισμοί για αυτό το έργο!\n');
} else {
  console.log(`✅ Βρέθηκαν ${relevantLinks.length} συσχετισμός/μοί:\n`);
  
  relevantLinks.forEach((link, idx) => {
    const subproject = projectSubprojects.find(sp => sp.subprojectId === link.subprojectId);
    console.log(`${idx + 1}. Link File: ${link.file}`);
    console.log(`   SubprojectId: ${link.subprojectId.substring(0, 36)}...`);
    console.log(`   Subproject Title: ${subproject ? subproject.subprojectTitle.substring(0, 70) + '...' : 'N/A'}`);
    console.log(`   Egkrisi Title: ${link.egkrisiTitle ? link.egkrisiTitle.substring(0, 70) + '...' : 'N/A'}`);
    console.log(`   Egkrisi ProjectKey: ${link.egkrisiProjectKey || 'N/A'}`);
    console.log(`   Egkrisi SubprojectKey: ${link.egkrisiSubprojectKey || 'N/A'}`);
    console.log(`   Manual: ${link.manual ? 'Ναι' : 'Όχι'}`);
    console.log(`   AutoLinked: ${link.autoLinked ? 'Ναι' : 'Όχι'}`);
    console.log('');
  });
  
  // Έλεγχος για πιθανά λάθος links
  console.log('🔍 ΕΛΕΓΧΟΣ ΓΙΑ ΛΑΘΟΣ LINKS:\n');
  let foundIssues = false;
  
  for (const link of relevantLinks) {
    const subproject = projectSubprojects.find(sp => sp.subprojectId === link.subprojectId);
    if (!subproject) {
      console.log(`❌ Link ${link.file}: SubprojectId ${link.subprojectId.substring(0, 8)}... δεν βρέθηκε!`);
      foundIssues = true;
      continue;
    }
    
    const linkTitle = normalizeText(link.subprojectTitle || link.egkrisiTitle || '');
    const actualTitle = normalizeText(subproject.subprojectTitle || '');
    
    if (linkTitle && actualTitle && linkTitle !== actualTitle && 
        !linkTitle.includes(actualTitle.substring(0, 30)) && 
        !actualTitle.includes(linkTitle.substring(0, 30))) {
      console.log(`⚠️ Link ${link.file}: Τίτλος δεν ταιριάζει!`);
      console.log(`   Link Title: "${link.subprojectTitle || link.egkrisiTitle}"`);
      console.log(`   Actual Title: "${subproject.subprojectTitle}"`);
      foundIssues = true;
    }
  }
  
  if (!foundIssues) {
    console.log('✅ Όλα τα links φαίνονται σωστά!\n');
  }
}

