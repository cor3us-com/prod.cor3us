import fs from 'fs';
import path from 'path';

const now = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join('00_admin', 'backups', `version-backup-${now}`);
fs.mkdirSync(backupDir, { recursive: true });

const dirsToBackup = ['00_admin', '01_story', '02_breakdown', '03_schedule', '04_budget', 'public'];

function copyFolder(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (let item of fs.readdirSync(src)) {
    if (item === 'backups' || item === 'node_modules') continue;
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    if (fs.statSync(srcPath).isDirectory()) {
      copyFolder(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

dirsToBackup.forEach(d => copyFolder(d, path.join(backupDir, d)));
console.log('✅ FULL PROJECT BACKUP CREATED AT:', backupDir);
