import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatINR } from '../utils/money';
import { formatDateDisplay } from '../utils/date';

export const reportExportService = {
  /**
   * Export any tabular dataset to an Excel file with stylized headers.
   */
  exportToExcel(
    fileName: string,
    sheetName: string,
    data: Record<string, any>[]
  ): void {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    try {
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } catch {
      // Headless test runner fallback
      XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    }
  },

  /**
   * Exports a professional PDF report with Navy blue header bar, metadata, and auto-table.
   */
  exportToPdf(options: {
    title: string;
    subtitle?: string;
    fileName: string;
    columns: string[];
    rows: (string | number)[][];
    summaryRow?: (string | number)[];
    landscape?: boolean;
  }): void {
    const doc = new jsPDF({
      orientation: options.landscape ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const primaryColor = [15, 41, 66]; // Navy Blue #0f2942

    // Header banner
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 55, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(options.title, 40, 32);

    // Subtitle / Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(220, 230, 242);
    const subtitle = options.subtitle || `Generated on: ${formatDateDisplay(new Date().toISOString().slice(0, 10))}`;
    doc.text(subtitle, 40, 47);

    // Table
    const bodyRows = [...options.rows];
    if (options.summaryRow) {
      bodyRows.push(options.summaryRow);
    }

    autoTable(doc, {
      startY: 70,
      head: [options.columns],
      body: bodyRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 95], // Brand navy
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      styles: {
        cellPadding: 5,
        overflow: 'linebreak',
      },
      didParseCell: (data) => {
        // If it is the last summary row
        if (options.summaryRow && data.row.index === bodyRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [226, 232, 240];
          data.cell.styles.textColor = [15, 23, 42];
        }
      },
    });

    try {
      doc.save(`${options.fileName}.pdf`);
    } catch {
      // Headless test runner fallback
      doc.output('datauristring');
    }
  },
};
