/**
 * Migration Script V2: All existing remainingAmount values are for 2026
 * 
 * This script will:
 * 1. Read all subprojects
 * 2. Take any existing remainingAmount and assign it to year 2026
 * 3. Ignore any year < 2026
 * 4. Create remainingAmountsByYear[] structure starting from 2026
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'dedomena_ergon');
const backupDir = path.join(__dirname, 'migration_backup_v2_' + Date.now());

// Statistics
let totalProcessed = 0;
let successfulMigrations = 0;
let with2026Amount = 0;
let errors = 0;

const skipRoot = new Set(['entaxeis', 'ΠΡΟΣΚΛΗΣΕΙΣ', 'locks', 'egkriseis_links', 'subproject_links', 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ', 'ΕΓΚΡΙΣΕΙΣ ΔΙΑΘΕΣΗΣ ΠΙΣΤΩΣΗΣ ΔΕΔΟΜΕΝΑ']);

function migrateSubproject(jsonPath) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    totalProcessed++;
    
    // Create backup
    const relativePath = path.relative(dataDir, jsonPath);
    const backupPath = path.join(backupDir, relativePath);
    const backupPathDir = path.dirname(backupPath);
    
    if (!fs.existsSync(backupPathDir)) {
      fs.mkdirSync(backupPathDir, { recursive: true });
    }
    fs.copyFileSync(jsonPath, backupPath);
    
    // Initialize new structure - START FROM 2026 ONLY
    const remainingAmountsByYear = [];
    
    // Get existing amount (regardless of what year it was marked as)
    const oldAmount = (data.remainingAmount || '').toString().trim();
    
    if (oldAmount && oldAmount !== '0' && oldAmount !== '0,00') {
      // ALL existing amounts are for 2026
      remainingAmountsByYear.push({
        year: '2026',
        amount: oldAmount
      });
      with2026Amount++;
    } else {
      // Even if empty, add 2026 as default year
      remainingAmountsByYear.push({
        year: '2026',
        amount: ''
      });
    }
    
    // Update data structure
    data.remainingAmountsByYear = remainingAmountsByYear;
    
    // Update old fields to reflect 2026
    data.remainingAmount = oldAmount;
    data.remainingAmountYear = oldAmount ? '2026' : '';
    
    // Write updated data
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    
    successfulMigrations++;
    console.log(`✓ Migrated: ${data.subprojectTitle || 'Unknown'} - Amount for 2026: ${oldAmount || 'empty'}`);
    
  } catch (error) {
    errors++;
    console.error(`✗ Error processing ${jsonPath}:`, error.message);
  }
}

function migrateAllProjects() {
  console.log('=== Starting Migration V2 (All amounts → 2026) ===');
  console.log(`Data directory: ${dataDir}`);
  console.log(`Backup directory: ${backupDir}\n`);
  
  if (!fs.existsSync(dataDir)) {
    console.error('ERROR: Data directory does not exist!');
    return;
  }
  
  // Create backup directory
  fs.mkdirSync(backupDir, { recursive: true });
  
  const projectDirs = fs.readdirSync(dataDir);
  
  projectDirs.forEach(projectDir => {
    if (skipRoot.has(projectDir)) return;
    
    const projectPath = path.join(dataDir, projectDir);
    if (!fs.statSync(projectPath).isDirectory()) return;
    
    const subprojectDirs = fs.readdirSync(projectPath);
    subprojectDirs.forEach(subprojectDir => {
      const jsonPath = path.join(projectPath, subprojectDir, 'data.json');
      if (fs.existsSync(jsonPath)) {
        migrateSubproject(jsonPath);
      }
    });
  });
  
  console.log('\n=== Migration V2 Complete ===');
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Successfully migrated: ${successfulMigrations}`);
  console.log(`With 2026 amount > 0: ${with2026Amount}`);
  console.log(`Errors: ${errors}`);
  console.log(`\nBackup created at: ${backupDir}`);
}

// Run migration
migrateAllProjects();

