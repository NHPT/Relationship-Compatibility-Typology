// model.json is the production source; generate an offline browser asset.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'js/depth');
const model = JSON.parse(fs.readFileSync(path.join(target, 'model.json'), 'utf8'));
fs.writeFileSync(path.join(target, 'model.js'), 'window.RCT_MODEL = ' + JSON.stringify(model) + ';\n');
console.log(`Published ${model.items.length} items, ${model.prototypes.length} prototypes: ${model.version}`);
