import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Import the logos from your src directory
import cdmLogoUrl from '../logo/images/cdmlogo.png';
import osaLogoUrl from '../logo/images/osalogo.png';

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

// 1. SAFETY FIX: Converts React-Signature-Canvas SVGs to standard PNGs so jsPDF doesn't crash
const svgDataUriToPng = async (dataUri: string | undefined): Promise<string | undefined> => {
  if (!dataUri || !dataUri.startsWith('data:image/svg')) return dataUri;
  return new Promise((resolve) => {
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

const loadLogo = async (url: string): Promise<{ base64: string; ratio: number } | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ base64, ratio: img.width / img.height });
      img.onerror = () => resolve({ base64, ratio: 1 });
      img.src = base64;
    });
  } catch (error) {
    console.warn(`Could not load logo at ${url}`, error);
    return null; 
  }
};

export const generateObligationPDF = async (data: StudentData): Promise<string> => {
  // 2. SAFETY FIX: Pre-process all signatures into safe PNGs
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

  // Set to Legal Size & Landscape Orientation (Your original layout)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'legal',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 355.6 mm
  const margin = 15;

  const cdmLogo = await loadLogo(cdmLogoUrl);
  const osaLogo = await loadLogo(osaLogoUrl);

  // ==========================================
  // HEADER SECTION 
  // ==========================================
  const targetHeight = 22;
  const centerDistance = 79; 

  if (cdmLogo) {
    const cdmWidth = targetHeight * cdmLogo.ratio;
    const cdmX = (pageWidth / 2) - centerDistance - (cdmWidth / 2);
    doc.addImage(cdmLogo.base64, 'PNG', cdmX, 10, cdmWidth, targetHeight);
  }
  
  if (osaLogo) {
    const osaWidth = targetHeight * osaLogo.ratio;
    const osaX = (pageWidth / 2) + centerDistance - (osaWidth / 2);
    doc.addImage(osaLogo.base64, 'PNG', osaX, 10, osaWidth, targetHeight);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('COLEGIO DE MUNTINLUPA', pageWidth / 2, 14, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('"The Home of Future Engineers and Architects"', pageWidth / 2, 18.5, { align: 'center' });
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(51, 102, 204); 
  doc.text('Office of Student Affairs', pageWidth / 2, 23, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(204, 0, 0); 
  const semAY = `${safeData.semester || '1st Semester'} (A.Y. ${safeData.academicYear || '2025 - 2026'})`;
  doc.text(semAY, pageWidth / 2, 28, { align: 'center' });

  // ==========================================
  // STUDENT INFO SECTION
  // ==========================================
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  
  const infoY = 38;
  const col1X = margin + 10;
  const col2X = pageWidth / 2 + 10;

  doc.text('NAME', col1X, infoY);
  doc.text(`:  ${safeData.studentName.toUpperCase()}`, col1X + 25, infoY);
  doc.line(col1X + 28, infoY + 1, col1X + 110, infoY + 1);

  doc.text('PROGRAM', col1X, infoY + 6);
  doc.text(`:  ${safeData.program}`, col1X + 25, infoY + 6);
  doc.line(col1X + 28, infoY + 7, col1X + 110, infoY + 7);

  doc.text('SECTION', col1X, infoY + 12);
  doc.text(`:  ${safeData.section}`, col1X + 25, infoY + 12);
  doc.line(col1X + 28, infoY + 13, col1X + 110, infoY + 13);

  doc.text('STUDENT NO.', col2X, infoY);
  doc.text(`:  ${safeData.studentNo}`, col2X + 45, infoY);
  doc.line(col2X + 48, infoY + 1, pageWidth - margin - 10, infoY + 1);

  doc.text('SCHOLARSHIP BRACKET', col2X, infoY + 6);
  doc.text(`:  ${safeData.bracket}`, col2X + 45, infoY + 6);
  doc.line(col2X + 48, infoY + 7, pageWidth - margin - 10, infoY + 7);

  // ==========================================
  // MAIN TABLE SECTION
  // ==========================================
  const MIN_ROWS = 10; 
  const bodyData: any[] = safeData.records.map(r => [
    r.date,
    r.taskTitle,
    r.staffName || '',
    r.timeIn,
    '', 
    r.timeOut,
    '', 
    r.creditHours.toFixed(1)
  ]);

  while (bodyData.length < MIN_ROWS) {
    bodyData.push(['', '', '', '', '', '', '', '']);
  }

  bodyData.push([
    { content: 'TOTAL HOURS:', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: safeData.totalVerifiedHours.toFixed(1), styles: { halign: 'center', fontStyle: 'bold', valign: 'middle' } }
  ]);

  autoTable(doc, {
    startY: 54, 
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [{ content: 'SERVICE OBLIGATION COMPLETION FORM', colSpan: 8, styles: { halign: 'center', fontStyle: 'bold', fontSize: 10, fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.2 } }],
      [
        { content: 'DATE', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'ACTIVITY/TASK', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'NAME OF AUTHORIZED\nFACULTY/STAFF & SIGNATURE', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'CREDIT HOUR(S) (CH)', colSpan: 5, styles: { halign: 'center' } }
      ],
      [
        { content: 'IN', styles: { halign: 'center' } },
        { content: 'SIGN', styles: { halign: 'center' } },
        { content: 'OUT', styles: { halign: 'center' } },
        { content: 'SIGN', styles: { halign: 'center' } },
        { content: 'CH', styles: { halign: 'center' } }
      ]
    ],
    body: bodyData,
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontSize: 7.5, lineWidth: 0.2, lineColor: [0, 0, 0] },
    styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, minCellHeight: 7.5 },
    columnStyles: {
      0: { cellWidth: 30 }, 
      1: { cellWidth: 'auto' }, 
      2: { cellWidth: 65 }, 
      3: { cellWidth: 18, halign: 'center' }, 
      4: { cellWidth: 22 }, 
      5: { cellWidth: 18, halign: 'center' }, 
      6: { cellWidth: 22 }, 
      7: { cellWidth: 15, halign: 'center' }  
    },
    didDrawCell: (cellData: any) => {
      if (cellData.section === 'body' && cellData.row.index < safeData.records.length) {
        const record = safeData.records[cellData.row.index];
        
        if (cellData.column.index === 2 && (record as any).verifierSignature) {
          try {
            const x = cellData.cell.x + 35; 
            const y = cellData.cell.y + 1;
            doc.addImage((record as any).verifierSignature, 'PNG', x, y, 20, 5);
          } catch (e) {}
        }
        if ((cellData.column.index === 4 || cellData.column.index === 6)) {
          const sSig = (record as any).studentSignature || safeData.studentSignature;
          if (sSig) {
             try {
                const x = cellData.cell.x + 2;
                const y = cellData.cell.y + 1;
                doc.addImage(sSig, 'PNG', x, y, 18, 5);
             } catch (e) {}
          }
        }
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 3;

  // ==========================================
  // FOOTNOTES & SIGNATURES SECTION
  // ==========================================
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const footnotes = [
    '*Fill-out the form neatly, and completely',
    '*Don\'t forget to "Time In" and "Time Out" in the duty log. Punctuality and accuracy matter.',
    " Let's keep our duty shifts well-documented.",
    '*SIGN, in credit hour(s) column section must be signed before and after the duty',
    ' by the OSA Personnel/Representative',
    '*Service obligation completion form must be submitted to Office of Student Affairs',
    ' once you fulfill the 20 hours required duty.',
    '*Do not lose this form. Losing service obligation forms can have serious consequences,',
    ' as it may result in not receiving credit for your duty hours, effectively resetting your',
    ' accumulated hours to zero.'
  ];
  
  let currentFootnoteY = finalY;
  footnotes.forEach((note) => {
    doc.text(note, margin, currentFootnoteY);
    currentFootnoteY += 3.2; 
  });

  const sigY = currentFootnoteY + 8; 
  
  const studentLineStartX = margin;
  if (safeData.studentSignature) {
    try {
      doc.addImage(safeData.studentSignature, 'PNG', studentLineStartX + 22, sigY - 10, 35, 10);
    } catch(e) {}
  }
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const studentNameLine = `${safeData.studentName.toUpperCase()}   |   ${new Date().toLocaleDateString()}`;
  doc.text(studentNameLine, studentLineStartX + 40, sigY + 1, { align: 'center' });
  doc.setLineWidth(0.2);
  doc.line(studentLineStartX, sigY + 2, studentLineStartX + 80, sigY + 2);
  doc.setFontSize(8);
  doc.text('SCHOLAR\'S PRINTED NAME AND SIGNATURE/ DATE', studentLineStartX + 40, sigY + 6, { align: 'center' });

  const approverLineStartX = pageWidth - margin - 80; 
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('NOTED BY:', approverLineStartX, sigY - 8);
  
  if (safeData.approverSignature) {
    try {
      doc.addImage(safeData.approverSignature, 'PNG', approverLineStartX + 22, sigY - 12, 35, 12);
    } catch(e) {}
  }
  
  const approverNameText = safeData.approverName?.toUpperCase() || 'OFFICE OF STUDENT AFFAIRS';
  doc.text(approverNameText, approverLineStartX + 40, sigY + 1, { align: 'center' });
  doc.setLineWidth(0.2);
  doc.line(approverLineStartX, sigY + 2, approverLineStartX + 80, sigY + 2); 
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(safeData.approverRole || 'Head, Office of Student Affairs', approverLineStartX + 40, sigY + 6, { align: 'center' });

  return doc.output('datauristring');
};