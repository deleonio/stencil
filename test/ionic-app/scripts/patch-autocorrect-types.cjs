const fs = require('fs');
const path = require('path');

const componentsDts = path.join(__dirname, '..', 'node_modules', '@ionic', 'core', 'dist', 'types', 'components.d.ts');

if (!fs.existsSync(componentsDts)) {
  process.exit(0);
}

const original = fs.readFileSync(componentsDts, 'utf8');
const updated = original.replace(/"autocorrect"(\??): 'on' \| 'off'/g, '"autocorrect"$1: boolean');

if (original !== updated) {
  fs.writeFileSync(componentsDts, updated);
}
