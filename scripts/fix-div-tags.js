const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'TaskAssignmentForm.js');
let s = fs.readFileSync(file, 'utf8');
const before = (s.match(/motion\.motion\.div/g) || []).length;
s = s.replace(/<\/?motion\.div>/g, (tag) => (tag.startsWith('</') ? '</div>' : '<div>'));
fs.writeFileSync(file, s);
const after = (s.match(/motion\.div/g) || []).length;
console.log('replaced', before, 'tags; remaining motion.div:', after);
