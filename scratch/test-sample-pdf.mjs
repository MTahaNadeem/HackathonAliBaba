import fs from 'fs';
import { PDFParse } from 'pdf-parse';

// Polyfills
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix { constructor() {} };
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData { constructor() {} };
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D { constructor() {} };
}

const parser = new PDFParse({ data: fs.readFileSync('scratch/sample-resume.pdf') });
const res = await parser.getText();
console.log('Result text:', res.text);

