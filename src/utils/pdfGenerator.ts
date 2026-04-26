import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface ServiceRecord {
  date: string;
  taskTitle: string;
  staffName: string;
  timeIn: string;
  timeOut: string;
  creditHours: number;
}

interface StudentData {
  studentName: string;
  studentNo: string;
  program: string;
  section: string;
  bracket: string;
  totalVerifiedHours: number;
  semester?: string;
  academicYear?: string;
  studentSignature?: string;
  approverName?: string;
  approverRole?: string;
  approverSignature?: string;
  records: ServiceRecord[];
}

const svgDataUriToPng = async (dataUri: string | undefined): Promise<string | undefined> => {
  if (!dataUri || !dataUri.startsWith('data:image/svg')) return dataUri;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 300;
      canvas.height = img.height || 150;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUri); // Fallback
    img.src = dataUri;
  });
};

export const generateObligationPDF = async (data: StudentData): Promise<string> => {
  // Pre-process any SVG signatures to PNG because jsPDF might crash on SVGs natively
  const safeData = { ...data };
  safeData.studentSignature = await svgDataUriToPng(safeData.studentSignature);
  safeData.approverSignature = await svgDataUriToPng(safeData.approverSignature);
  for (let record of safeData.records) {
    if ((record as any).verifierSignature) {
      (record as any).verifierSignature = await svgDataUriToPng((record as any).verifierSignature);
    }
    if ((record as any).studentSignature) {
      (record as any).studentSignature = await svgDataUriToPng((record as any).studentSignature);
    }
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header Section matching img2
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('COLEGIO DE MUNTINLUPA', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('"The Home of Future Engineers and Architects"', pageWidth / 2, 25, { align: 'center' });
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(51, 102, 204); // CDM Blue style
  doc.text('Office of Student Affairs', pageWidth / 2, 31, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(204, 0, 0); // CDM Red style
  const semAY = `${safeData.semester || '1st Semester'} (A.Y. ${safeData.academicYear || '2025 - 2026'})`;
  doc.text(semAY, pageWidth / 2, 36, { align: 'center' });

  // Boxed Title
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  const title = 'SERVICE OBLIGATION COMPLETION FORM';
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, pageWidth / 2, 45, { align: 'center' });
  doc.line(pageWidth / 2 - titleWidth / 2 - 2, 46.5, pageWidth / 2 + titleWidth / 2 + 2, 46.5);

  // Student Info Grid matching img2
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  const infoY = 55;
  const col1X = margin;
  const col2X = pageWidth / 2 + 10;

  doc.text('NAME', col1X, infoY);
  doc.text(`: ${safeData.studentName.toUpperCase()}`, col1X + 25, infoY);
  doc.line(col1X + 27, infoY + 1, col1X + 90, infoY + 1);

  doc.text('STUDENT NO.', col2X, infoY);
  doc.text(`: ${safeData.studentNo}`, col2X + 35, infoY);
  doc.line(col2X + 37, infoY + 1, pageWidth - margin, infoY + 1);

  doc.text('PROGRAM', col1X, infoY + 7);
  doc.text(`: ${safeData.program}`, col1X + 25, infoY + 7);
  doc.line(col1X + 27, infoY + 8, col1X + 90, infoY + 8);

  doc.text('SCHOLARSHIP BRACKET', col2X, infoY + 7);
  doc.text(`: ${safeData.bracket}`, col2X + 35, infoY + 7);
  doc.line(col2X + 37, infoY + 8, pageWidth - margin, infoY + 8);

  doc.text('SECTION', col1X, infoY + 14);
  doc.text(`: ${safeData.section}`, col1X + 25, infoY + 14);
  doc.line(col1X + 27, infoY + 15, col1X + 90, infoY + 15);

  // Table matching img2 Columns
  // DATE | ACTIVITY/TASK | NAME OF AUTHORIZED FACULTY/STAFF & SIGNATURE | IN | SIGN | OUT | SIGN | CH
  (doc as any).autoTable({
    startY: 80,
    head: [['DATE', 'ACTIVITY/TASK', 'NAME OF AUTHORIZED FACULTY/STAFF & SIGNATURE', 'IN', 'SIGN', 'OUT', 'SIGN', 'CH']],
    body: safeData.records.map(r => [
      r.date,
      r.taskTitle,
      r.staffName || '',
      r.timeIn,
      '', // SIGN IN (Space for student signature)
      r.timeOut,
      '', // SIGN OUT (Space for student signature)
      r.creditHours.toFixed(1)
    ]),
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { 
      fillColor: [255, 255, 255], 
      textColor: [0, 0, 0],
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.1,
      lineColor: [0, 0, 0]
    },
    styles: { 
      fontSize: 7,
      cellPadding: 2,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      minCellHeight: 12 // Ensure enough room for signatures
    },
    columnStyles: {
      0: { cellWidth: 18 }, // DATE
      1: { cellWidth: 'auto' }, // TASK
      2: { cellWidth: 45 }, // STAFF & SIGN
      3: { cellWidth: 10, halign: 'center' }, // IN
      4: { cellWidth: 12 }, // SIGN
      5: { cellWidth: 10, halign: 'center' }, // OUT
      6: { cellWidth: 12 }, // SIGN
      7: { cellWidth: 8, halign: 'center' } // CH
    },
    didDrawCell: (cellData: any) => {
      // After drawing the text, we can add the signature image if it exists
      if (cellData.section === 'body') {
        const record = safeData.records[cellData.row.index];
        if (!record) return;

        // Staff/Verifier Signature in Column 2
        if (cellData.column.index === 2) {
          const vSig = (record as any).verifierSignature;
          if (vSig) {
            try {
              // Position signature relative to cell
              const x = cellData.cell.x + 23; 
              const y = cellData.cell.y + 2;
              doc.addImage(vSig, 'PNG', x, y, 18, 8);
            } catch (e) {
              console.error("PDF: Failed to add verifier signature to table", e);
            }
          }
        }

        // Student Signature in Column 4 and 6 (Optional based on requirements)
        if (cellData.column.index === 4 || cellData.column.index === 6) {
          const sSig = (record as any).studentSignature || safeData.studentSignature;
          if (sSig) {
             try {
                const x = cellData.cell.x + 1;
                const y = cellData.cell.y + 2;
                doc.addImage(sSig, 'PNG', x, y, 10, 8);
             } catch (e) {}
          }
        }
      }
    }
  });

  let finalY = (doc as any).lastAutoTable.finalY + 5;

  // Total Hours with Circle matching img2
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`TOTAL HOURS: ${safeData.totalVerifiedHours.toFixed(1)}`, pageWidth - margin - 5, finalY + 4, { align: 'right' });
  doc.setLineWidth(0.3);
  doc.ellipse(pageWidth - margin - 2, finalY + 3, 10, 5); // Simple circle around total

  // Footnote Reminders (img2 list)
  const footnoteY = finalY + 15;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const footnotes = [
    '*Fill-out the form neatly, and completely',
    '*Don\'t forget to "Time In" and "Time Out" in the duty log. Punctuality and accuracy matter.',
    "Let's keep our duty shifts well-documented.",
    '*SIGN, in credit hour(s) column section must be signed before and after the duty',
    'by the OSA Personnel/Representative',
    '*Service obligation completion form must be submitted to Office of Student Affairs',
    'once you fulfill the 20 hours required duty.',
    '*Do not lose this form. Losing service obligation forms can have serious consequences,',
    'as it may result in not receiving credit for your duty hours, effectively resetting your',
    'accumulated hours to zero.'
  ];
  
  let currentFootnoteY = footnoteY;
  footnotes.forEach((note, i) => {
    doc.text(note, margin, currentFootnoteY);
    currentFootnoteY += 3.5;
  });

  // Final Signatures Area matching img2
  const sigY = currentFootnoteY + 15;
  doc.setFontSize(9);
  
  // Left: Scholar Signature
  if (safeData.studentSignature) {
    try {
      doc.addImage(safeData.studentSignature, 'PNG', margin + 5, sigY - 12, 35, 12);
    } catch(e) {}
  }
  doc.setFont('helvetica', 'bold');
  const studentNameLine = `${safeData.studentName.toUpperCase()}  |  ${new Date().toLocaleDateString()}`;
  doc.text(studentNameLine, margin + 5, sigY + 1);
  doc.setFont('helvetica', 'normal');
  doc.setLineWidth(0.2);
  doc.line(margin, sigY + 2, margin + 80, sigY + 2);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHOLAR\'S PRINTED NAME AND SIGNATURE/ DATE', margin + 5, sigY + 6);

  // Right: Noted By
  const approverX = 130;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('NOTED BY:', approverX, sigY - 10);
  
  if (safeData.approverSignature) {
    try {
      doc.addImage(safeData.approverSignature, 'PNG', approverX + 10, sigY - 14, 35, 14);
    } catch(e) {}
  }
  
  doc.text('For:', approverX - 5, sigY + 1);
  doc.setFont('helvetica', 'bold');
  doc.line(approverX, sigY + 2, pageWidth - margin, sigY + 2);
  doc.text(safeData.approverName?.toUpperCase() || 'OFFICE OF STUDENT AFFAIRS', approverX + 3, sigY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(safeData.approverRole || 'Head, Office of Student Affairs', approverX + 3, sigY + 9);

  return doc.output('datauristring');
};
