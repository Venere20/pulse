const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');const moduleValue={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/datePicker.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleValue,exports:moduleValue.exports});
const{validPickerDate,movePickerMonth,pickerMonthCells,clampPickerDate,formatPickerDate}=moduleValue.exports;
assert.equal(validPickerDate('2024-02-29'),true);assert.equal(validPickerDate('2000-02-29'),true);
for(const day of ['1900-02-29','2026-02-29','2026-02-30','2026-13-01','2026-00-10','2026-1-1','x'])assert.equal(validPickerDate(day),false);
assert.equal(movePickerMonth('2026-12',1),'2027-01');assert.equal(movePickerMonth('2026-01',-1),'2025-12');
const cells=pickerMonthCells('2024-02').flat().filter(Boolean);assert.equal(cells.length,29);assert.equal(cells.at(-1),'2024-02-29');assert.equal(pickerMonthCells('2026-06')[0][0],'2026-06-01');
assert.equal(clampPickerDate('2027-01-01','2026-01-01','2026-12-31'),'2026-12-31');assert.equal(clampPickerDate('2025-01-01','2026-01-01','2026-12-31'),'2026-01-01');assert.equal(formatPickerDate('2024-02-29'),'29 febbraio 2024');
let count=0;for(let year=1900;year<=2199;year++)for(let month=1;month<=12;month++){const key=`${year}-${String(month).padStart(2,'0')}`;for(const day of pickerMonthCells(key).flat().filter(Boolean)){assert.equal(validPickerDate(day),true);count++}}
console.log(`PASS date picker: ${count} valid calendar days, leap centuries, Monday-first grid, year transitions, bounds, Italian display without timezone shifts.`);
