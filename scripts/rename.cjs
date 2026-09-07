const fs = require('fs');
const path = require('path');

const dir = 'd:\\Programming\\Hackathon\\HackathonAliBaba';
const filesToProcess = [
  'SETUP.md',
  'README.md',
  'lib/server.ts',
  'lib/adviser.ts',
  'DESIGN.md',
  'DEMO.md',
  'package.json',
  'components/raah-app.tsx', // It will process this file first before we rename it
  'components/learning.tsx',
  'components/fields.tsx',
  'components/explore.tsx',
  'components/auth-reset.tsx',
  'components/auth-dialog.tsx',
  'components/adviser.tsx',
  'BUILD_PROMPT.md',
  'app/page.tsx',
  'app/layout.tsx',
  'app/globals.css'
];

for (const file of filesToProcess) {
  const fullPath = path.join(dir, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Replace "Raah" with "CourseCompass AI"
    content = content.replace(/Raah/g, 'CourseCompass AI');
    
    // Replace "raah" with "coursecompass"
    content = content.replace(/raah/g, 'coursecompass');
    
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('Updated', file);
  } else {
    console.log('Not found', file);
  }
}

// Rename files
const fileRenames = [
  { old: 'components/raah-app.tsx', new: 'components/coursecompass-app.tsx' },
  { old: 'supabase/migrations/001_raah.sql', new: 'supabase/migrations/001_coursecompass.sql' }
];

for (const r of fileRenames) {
  const oldPath = path.join(dir, r.old);
  const newPath = path.join(dir, r.new);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`Renamed ${r.old} to ${r.new}`);
  }
}
