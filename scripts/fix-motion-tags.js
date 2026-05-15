const fs = require('fs');
const path = require('path');
const files = [
  'src/components/TaskAssignmentDetail.js',
  'src/components/TaskAssignmentForm.js',
  'src/components/TaskAssignmentManager.js'
];
const openWrong = '<' + 'motion.div';
const closeWrong = '</' + 'motion.div>';
const openRight = '<div';
const closeRight = '</div>';
files.forEach((rel) => {
  const p = path.join(__dirname, '..', rel);
  if (!fs.existsSync(p)) return;
  let s = fs.readFileSync(p, 'utf8');
  s = s.split(openWrong).join(openRight);
  s = s.split(closeWrong).join(closeRight);
  fs.writeFileSync(p, s, 'utf8');
  console.log('fixed', rel);
});
