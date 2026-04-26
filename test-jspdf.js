import { jsPDF } from 'jspdf';
import fs from 'fs';

const doc = new jsPDF();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" /></svg>`;
try {
  doc.addSvgAsImage(svg, 0, 0, 100, 100);
  console.log("Success addSvgAsImage");
} catch (e) {
  console.log("Failed addSvgAsImage:", e.message);
}
