const fs = require('fs');
const path = require('path');

const files = [
  'src/components/TaskAssignmentManager.js',
  'src/components/TaskAssignmentWorkspace.js'
];

for (const rel of files) {
  const file = path.join(__dirname, '..', rel);
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(/<\/?motion\.motion\.motion\.div>/gi, (tag) =>
    tag.toLowerCase().startsWith('</') ? '</motion.div>' : '<motion.div>'
  );
  s = s.replace(/<\/?motion\.div>/gi, (tag) => (tag.toLowerCase().startsWith('</') ? '</motion.div>' : '<motion.div>'));
  s = s.replace(/<motion\.div/gi, '<div');
  s = s.replace(/<\/motion\.div>/gi, '</motion.div>');
  fs.writeFileSync(file, s, 'utf8');
  console.log(rel, s.includes('motion.div') ? 'WARN' : 'ok');
}
