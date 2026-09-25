import * as XLSX from "xlsx";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";

export interface ExpenseExportItem {
  customerName?: string;
  phone?: string;
  stageName?: string;
  destination: string;
  amount: number;
}

/**
 * Export expense records to an Excel workbook (.xlsx)
 */
export const exportExpensesToExcel = (
  sheetTitle: string,
  items: ExpenseExportItem[],
  grandTotal: number,
  filename: string,
  lang: "ar" | "en" = "ar",
) => {
  try {
    const isAr = lang === "ar";
    const rows = items.map((item, idx) => ({
      [isAr ? "م" : "#"]: idx + 1,
      [isAr ? "اسم العميل" : "Customer"]: item.customerName || "-",
      [isAr ? "رقم الهاتف" : "Phone"]: item.phone || "-",
      [isAr ? "المرحلة" : "Stage"]: item.stageName || "-",
      [isAr ? "جهة الصرف / البيان" : "Destination"]: item.destination || "-",
      [isAr ? "المبلغ (جنيه)" : "Amount (EGP)"]: item.amount,
    }));

    // Add empty separator row
    rows.push({
      [isAr ? "م" : "#"]: "" as any,
      [isAr ? "اسم العميل" : "Customer"]: "",
      [isAr ? "رقم الهاتف" : "Phone"]: "",
      [isAr ? "المرحلة" : "Stage"]: "",
      [isAr ? "جهة الصرف / البيان" : "Destination"]: isAr ? "الإجمالي النهائي" : "Total",
      [isAr ? "المبلغ (جنيه)" : "Amount (EGP)"]: grandTotal,
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 26 },
      { wch: 16 },
      { wch: 18 },
      { wch: 30 },
      { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle.slice(0, 30));
    XLSX.writeFile(wb, `${filename}.xlsx`);
    toast.success(isAr ? "تم تصدير ملف Excel بنجاح" : "Excel exported successfully");
  } catch (err: any) {
    console.error("Excel export error:", err);
    toast.error(err?.message || "Failed to export Excel");
  }
};

/**
 * Export an HTML container to a PNG image file
 */
export const exportElementToImage = async (
  element: HTMLElement,
  filename: string,
  lang: "ar" | "en" = "ar",
) => {
  try {
    const isAr = lang === "ar";
    toast.loading(isAr ? "جاري إنشاء الصورة..." : "Generating image...", { id: "export-img" });

    const canvas = await html2canvas(element, {
      scale: 2, // 2x Retina resolution
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth || 1024,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById(element.id);
        if (clonedEl) {
          clonedEl.style.position = "static";
          clonedEl.style.display = "block";
          clonedEl.style.visibility = "visible";
          clonedEl.style.opacity = "1";
          if (clonedEl.parentElement) {
            clonedEl.parentElement.style.position = "static";
            clonedEl.parentElement.style.display = "block";
            clonedEl.parentElement.style.visibility = "visible";
            clonedEl.parentElement.style.opacity = "1";
            clonedEl.parentElement.style.left = "0px";
            clonedEl.parentElement.style.top = "0px";
          }
        }
      },
    });

    const imgUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imgUrl;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(isAr ? "تم تحميل الصورة بنجاح" : "Image downloaded successfully", { id: "export-img" });
  } catch (err: any) {
    console.error("Image export error:", err);
    toast.error(err?.message || "Failed to export image", { id: "export-img" });
  }
};

/**
 * Export an HTML container to a PDF file (.pdf)
 */
export const exportElementToPdf = async (
  element: HTMLElement,
  filename: string,
  lang: "ar" | "en" = "ar",
) => {
  try {
    const isAr = lang === "ar";
    toast.loading(isAr ? "جاري إنشاء ملف PDF..." : "Generating PDF...", { id: "export-pdf" });

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth || 1024,
      onclone: (clonedDoc) => {
        // Ensure cloned element is visible and positioned at (0,0) in cloned DOM
        const clonedEl = clonedDoc.getElementById(element.id);
        if (clonedEl) {
          clonedEl.style.position = "static";
          clonedEl.style.display = "block";
          clonedEl.style.visibility = "visible";
          clonedEl.style.opacity = "1";
          if (clonedEl.parentElement) {
            clonedEl.parentElement.style.position = "static";
            clonedEl.parentElement.style.display = "block";
            clonedEl.parentElement.style.visibility = "visible";
            clonedEl.parentElement.style.opacity = "1";
            clonedEl.parentElement.style.left = "0px";
            clonedEl.parentElement.style.top = "0px";
          }
        }
      },
    });

    const imgData = canvas.toDataURL("image/png");
    const orientation = canvas.width > canvas.height * 1.2 ? "l" : "p";
    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    if (imgHeight <= usableHeight) {
      // Single page
      pdf.addImage(imgData, "PNG", margin, margin, usableWidth, imgHeight, undefined, "FAST");
    } else {
      // Multi-page split
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imgHeight - heightLeft);
        pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight, undefined, "FAST");
        heightLeft -= pageHeight;
      }
    }

    pdf.save(`${filename}.pdf`);
    toast.success(isAr ? "تم تحميل ملف PDF بنجاح" : "PDF downloaded successfully", { id: "export-pdf" });
  } catch (err: any) {
    console.error("PDF export error:", err);
    toast.error(err?.message || "Failed to export PDF", { id: "export-pdf" });
  }
};
