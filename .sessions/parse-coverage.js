const d = require('fs').readFileSync('.sessions/test-results-unit.json', 'utf8');
const r = JSON.parse(d);
const cov = r.coverageMap;
const mods = { cooperative: [], product: [], certification: [], notification: [], common: [] };

Object.keys(cov).forEach(function(file) {
  const n = file.split('\\').join('/');
  if (n.includes('/modules/cooperative/')) mods.cooperative.push(cov[file]);
  else if (n.includes('/modules/product/')) mods.product.push(cov[file]);
  else if (n.includes('/modules/certification/')) mods.certification.push(cov[file]);
  else if (n.includes('/modules/notification/')) mods.notification.push(cov[file]);
  else if (n.includes('/common/')) mods.common.push(cov[file]);
});

let totalSt = 0, totalSc = 0, totalFt = 0, totalFc = 0;
Object.keys(mods).forEach(function(m) {
  const files = mods[m];
  let st = 0, sc = 0, ft = 0, fc = 0;
  files.forEach(function(f) {
    Object.values(f.s).forEach(function(v) { st++; if (v > 0) sc++; });
    Object.values(f.f).forEach(function(v) { ft++; if (v > 0) fc++; });
  });
  totalSt += st; totalSc += sc; totalFt += ft; totalFc += fc;
  const stPct = st ? Math.round(sc / st * 100) : 0;
  const fnPct = ft ? Math.round(fc / ft * 100) : 0;
  console.log(m + ': stmts ' + stPct + '% (' + sc + '/' + st + '), fns ' + fnPct + '% (' + fc + '/' + ft + ')');
});
console.log('---');
console.log('TOTAL stmts: ' + Math.round(totalSc / totalSt * 100) + '% (' + totalSc + '/' + totalSt + ')');
console.log('TOTAL fns:   ' + Math.round(totalFc / totalFt * 100) + '% (' + totalFc + '/' + totalFt + ')');
console.log('Total files covered: ' + Object.keys(cov).length);

// Global coverage from jest summary
if (r.coverageMap) {
  const allBranches = Object.values(cov).reduce((a, f) => {
    const bTotal = Object.keys(f.b).length;
    const bCov = Object.values(f.b).filter(arr => arr.some(v => v > 0)).length;
    return { t: a.t + bTotal, c: a.c + bCov };
  }, { t: 0, c: 0 });
  console.log('TOTAL branches: ' + (allBranches.t ? Math.round(allBranches.c / allBranches.t * 100) : 0) + '% (' + allBranches.c + '/' + allBranches.t + ')');
}
