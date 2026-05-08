/**
 * Standalone Backup Script for Windows Task Scheduler
 * 
 * This script can run independently of the Electron app
 * and is designed to be scheduled via Windows Task Scheduler
 * 
 * Usage: node backup-standalone.js
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Data directory (same as in electron.js)
const dataDir = process.env.DATA_DIR || 'K:\\EFARMOGI\\dedomena_ergon';
const backupDir = path.join(dataDir, 'backups');
const backupMetadataPath = path.join(backupDir, 'metadata.json');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Load backup metadata
function loadBackupMetadata() {
  try {
    if (fs.existsSync(backupMetadataPath)) {
      return JSON.parse(fs.readFileSync(backupMetadataPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading backup metadata:', error);
  }
  return { backups: [] };
}

// Save backup metadata
function saveBackupMetadata(metadata) {
  try {
    fs.writeFileSync(backupMetadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving backup metadata:', error);
    return false;
  }
}

// Get files to backup
function getFilesToBackup() {
  const files = [];
  
  try {
    if (!fs.existsSync(dataDir)) {
      console.error(`❌ Data directory not found: ${dataDir}`);
      return files;
    }
    
    // Projects
    const projectDirs = fs.readdirSync(dataDir);
    for (const projectDir of projectDirs) {
      const projectPath = path.join(dataDir, projectDir);
      if (fs.statSync(projectPath).isDirectory()) {
        // Skip backup, locks, and temp directories
        if (projectDir === 'backups' || projectDir === 'locks' || projectDir === 'temp_uploads') continue;
        
        // Check if it's a project UUID folder
        if (projectDir.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          files.push({
            type: 'project',
            path: projectPath,
            relativePath: projectDir
          });
        }
      }
    }
    
    // Proskliseis
    const proskliseisDir = path.join(dataDir, 'ΠΡΟΣΚΛΗΣΕΙΣ');
    if (fs.existsSync(proskliseisDir)) {
      files.push({
        type: 'proskliseis',
        path: proskliseisDir,
        relativePath: 'ΠΡΟΣΚΛΗΣΕΙΣ'
      });
    }
    
    // Entaxeis
    const entaxeisDir = path.join(dataDir, 'entaxeis');
    if (fs.existsSync(entaxeisDir)) {
      files.push({
        type: 'entaxeis',
        path: entaxeisDir,
        relativePath: 'entaxeis'
      });
    }
    
    // Egkriseis
    const egkriseisDir = path.join(dataDir, 'EGKRISEIS_DIATHESIS_PISTOSIS');
    if (fs.existsSync(egkriseisDir)) {
      files.push({
        type: 'egkriseis',
        path: egkriseisDir,
        relativePath: 'EGKRISEIS_DIATHESIS_PISTOSIS'
      });
    }
  } catch (error) {
    console.error('Error getting files to backup:', error);
  }
  
  return files;
}

// Create backup
async function createBackup() {
  const backupId = uuidv4();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFileName = `backup_${timestamp}_scheduled.zip`;
  const backupPath = path.join(backupDir, backupFileName);
  
  const backupInfo = {
    backupId,
    timestamp: new Date().toISOString(),
    type: 'scheduled',
    fileName: backupFileName,
    path: backupPath,
    status: 'in_progress',
    size: 0,
    contents: {
      projects: 0,
      proskliseis: 0,
      entaxeis: 0,
      egkriseis: 0
    },
    error: null,
    source: 'standalone-script'
  };
  
  try {
    console.log(`🔄 Starting standalone backup: ${backupFileName}`);
    console.log(`📁 Data directory: ${dataDir}`);
    
    // Get files to backup
    const filesToBackup = getFilesToBackup();
    
    if (filesToBackup.length === 0) {
      console.log('⚠️ No files to backup');
      backupInfo.status = 'failed';
      backupInfo.error = 'No files to backup';
      return { success: false, backupInfo };
    }
    
    // Count contents
    backupInfo.contents.projects = filesToBackup.filter(f => f.type === 'project').length;
    backupInfo.contents.proskliseis = filesToBackup.filter(f => f.type === 'proskliseis').length > 0 ? 1 : 0;
    backupInfo.contents.entaxeis = filesToBackup.filter(f => f.type === 'entaxeis').length > 0 ? 1 : 0;
    backupInfo.contents.egkriseis = filesToBackup.filter(f => f.type === 'egkriseis').length > 0 ? 1 : 0;
    
    console.log(`📊 Files to backup: ${filesToBackup.length}`);
    console.log(`   - Projects: ${backupInfo.contents.projects}`);
    console.log(`   - Proskliseis: ${backupInfo.contents.proskliseis}`);
    console.log(`   - Entaxeis: ${backupInfo.contents.entaxeis}`);
    console.log(`   - Egkriseis: ${backupInfo.contents.egkriseis}`);
    
    // Create ZIP archive
    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', {
      zlib: { level: 6 } // Medium compression
    });
    
    // Handle archive events
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.on('progress', (progress) => {
      const percent = ((progress.entries.processed / progress.entries.total) * 100).toFixed(1);
      process.stdout.write(`\r📦 Progress: ${percent}% (${progress.entries.processed}/${progress.entries.total} entries)`);
    });
    
    archive.pipe(output);
    
    // Add files to archive
    for (const file of filesToBackup) {
      // Skip lock files and temp files
      if (file.path.includes('.lock') || file.path.includes('temp_')) continue;
      
      if (fs.existsSync(file.path)) {
        const stat = fs.statSync(file.path);
        if (stat.isDirectory()) {
          archive.directory(file.path, file.relativePath);
        } else {
          archive.file(file.path, { name: file.relativePath });
        }
      }
    }
    
    // Finalize archive
    await archive.finalize();
    
    // Wait for file to be written
    await new Promise((resolve, reject) => {
      output.on('close', () => {
        const stats = fs.statSync(backupPath);
        backupInfo.size = stats.size;
        backupInfo.status = 'success';
        resolve();
      });
      output.on('error', reject);
    });
    
    // Calculate checksum
    console.log('\n🔐 Calculating checksum...');
    const fileBuffer = fs.readFileSync(backupPath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    backupInfo.checksum = hashSum.digest('hex');
    
    // Update metadata
    const metadata = loadBackupMetadata();
    metadata.backups.unshift(backupInfo);
    saveBackupMetadata(metadata);
    
    console.log(`\n✅ Backup completed successfully!`);
    console.log(`   File: ${backupFileName}`);
    console.log(`   Size: ${(backupInfo.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Checksum: ${backupInfo.checksum.substring(0, 16)}...`);
    
    return { success: true, backupInfo };
    
  } catch (error) {
    console.error(`\n❌ Backup failed: ${error.message}`);
    backupInfo.status = 'failed';
    backupInfo.error = error.message;
    
    // Update metadata
    const metadata = loadBackupMetadata();
    metadata.backups.unshift(backupInfo);
    saveBackupMetadata(metadata);
    
    return { success: false, error: error.message, backupInfo };
  }
}

// Main execution
(async () => {
  try {
    console.log('🚀 Standalone Backup Script');
    console.log('===========================\n');
    
    const result = await createBackup();
    
    if (result.success) {
      process.exit(0);
    } else {
      console.error(`\n❌ Backup failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
})();

