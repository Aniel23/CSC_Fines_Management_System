import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const path = 'c:/Users/Rens_Space.DESKTOP-M98PN4K/CSC_Fines_Management_System/ENROLLMENT DATA (1).pdf';
const data = new Uint8Array(fs.readFileSync(path));
const doc = await pdfjsLib.getDocument({ data }).promise;
console.log('pages', doc.numPages);
for (let i = 1; i <= Math.min(doc.numPages, 8); i++) {
  const page = await doc.getPage(i);
  const textContent = await page.getTextContent();
  const text = textContent.items.map((it) => it.str).join(' ');
  console.log(`--- PAGE ${i} START ---`);
  console.log((text || '').slice(0, 5000));
  console.log(`--- PAGE ${i} END ---`);
}
