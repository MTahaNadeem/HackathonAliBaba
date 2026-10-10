const fs = require('fs');
async function test() {
  const mod = await import('pdf-parse');
  console.log('mod type:', typeof mod);
  console.log('mod keys:', Object.keys(mod));
  console.log('mod.default type:', typeof mod.default);
  console.log('mod.default keys:', Object.keys(mod.default || {}));
}
test();
