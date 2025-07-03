const fs = require('fs');
const path = require('path');
const { createCoverageMap } = require('istanbul-lib-coverage');

const root = process.cwd();
const coverageDir = path.join(root, 'coverage');
const map = createCoverageMap({});

const vitestFile = path.join(coverageDir, 'vitest', 'coverage-final.json');
if (fs.existsSync(vitestFile)) {
  map.merge(JSON.parse(fs.readFileSync(vitestFile, 'utf8')));
}

const nycDir = path.join(root, '.nyc_output');
if (fs.existsSync(nycDir)) {
  for (const file of fs.readdirSync(nycDir)) {
    if (file.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(path.join(nycDir, file), 'utf8'));
      map.merge(data);
    }
  }
}

fs.mkdirSync(coverageDir, { recursive: true });
fs.writeFileSync(path.join(coverageDir, 'coverage-final.json'), JSON.stringify(map));
console.log('Merged coverage saved to coverage/coverage-final.json');
