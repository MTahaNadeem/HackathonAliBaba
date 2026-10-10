const fs = require('fs');
async function test() {
  const mod = await import('pdf-parse');
  const buffer = fs.readFileSync('C:\\Hacktons\\AIHackathon2\\package.json'); // not a real pdf but testing signature
  try {
    const pdf = new mod.PDFParse();
    console.log('Instance methods:', Object.keys(pdf.__proto__));
  } catch (e) {
    console.log(e.message);
  }
}
test();
