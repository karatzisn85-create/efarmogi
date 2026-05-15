import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ExcelJS = require(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'exceljs')
);

(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.getCell('A1').value = 'Pick';
  ws.dataValidations.add('A2:A100', {
    type: 'list',
    allowBlank: true,
    formulae: ['"One,Two,Three"'],
    showErrorMessage: true,
    error: 'Pick from list',
  });
  const buf = await wb.xlsx.writeBuffer();
  console.log('written', buf.length);
})();
