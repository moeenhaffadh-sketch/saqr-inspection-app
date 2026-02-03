// jsPDF is imported dynamically to avoid Turbopack compatibility issues with core-js
type jsPDFType = import("jspdf").jsPDF;

interface InspectionResult {
  id: string;
  status: "PASS" | "FAIL" | "UNCERTAIN" | null;
  notes: string | null;
  photoUrl: string | null;
  aiAnalyzed: boolean;
  aiConfidence: number | null;
  aiReasoning: string | null;
  aiReasoningAr: string | null;
  spec: {
    code: string;
    requirement: string;
    requirementAr: string;
  };
}

interface InspectionData {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  passRate: number | null;
  totalItems: number;
  passedItems: number;
  failedItems: number;
  category: {
    name: string;
    nameAr: string;
    authority: {
      code: string;
      name: string;
      nameAr: string;
    };
  };
  site?: {
    name: string;
    nameAr: string | null;
    address: string;
  } | null;
  organization?: {
    name: string;
    nameAr: string | null;
  } | null;
  results: InspectionResult[];
}

const statusColors: Record<string, [number, number, number]> = {
  PASS: [34, 197, 94],
  FAIL: [239, 68, 68],
  UNCERTAIN: [245, 158, 11],
  PENDING: [100, 116, 139],
};

// Load Amiri font for Arabic text support
async function loadAmiriFont(): Promise<string | null> {
  try {
    const response = await fetch("/fonts/Amiri-Regular.ttf");
    if (!response.ok) {
      console.error("Failed to load Amiri font:", response.status);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error("Error loading Amiri font:", e);
    return null;
  }
}

export async function generateInspectionPDF(inspection: InspectionData): Promise<void> {
  // Dynamic import to avoid Turbopack build issues with core-js
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 15;

  // Load and register Amiri font for Arabic text
  const amiriFontBase64 = await loadAmiriFont();
  let hasArabicFont = false;
  if (amiriFontBase64) {
    try {
      doc.addFileToVFS("Amiri-Regular.ttf", amiriFontBase64);
      doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      hasArabicFont = true;
      console.log("Amiri font loaded successfully");
    } catch (e) {
      console.error("Failed to register Amiri font:", e);
    }
  }

  // Calculate statistics
  const totalItems = inspection.results.length;
  const passedItems = inspection.results.filter(r => r.status === "PASS").length;
  const failedItems = inspection.results.filter(r => r.status === "FAIL").length;
  const uncertainItems = inspection.results.filter(r => r.status === "UNCERTAIN").length;
  const pendingItems = inspection.results.filter(r => !r.status).length;
  const completedItems = passedItems + failedItems + uncertainItems;

  const completionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const definitiveItems = passedItems + failedItems;
  const passRate = definitiveItems > 0 ? Math.round((passedItems / definitiveItems) * 100) : 0;

  // Helper to check if we need a new page
  const checkNewPage = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 25) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Helper to set font - use Amiri for Arabic, Helvetica for English
  const setEnglishFont = (style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
  };

  const setArabicFont = () => {
    if (hasArabicFont) {
      doc.setFont("Amiri", "normal");
    } else {
      doc.setFont("helvetica", "normal");
    }
  };

  // Helper to add section header
  const addSectionHeader = (title: string, color: [number, number, number], count: number) => {
    checkNewPage(20);
    doc.setFillColor(...color);
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 10, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    setEnglishFont("bold");
    doc.text(`${title} (${count})`, margin + 5, yPos + 7);
    yPos += 15;
  };

  // ==================== WHITE BACKGROUND ====================
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // ==================== HEADER ====================
  // Amber accent bar at top
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 0, pageWidth, 4, "F");

  // Logo area
  yPos = 12;
  doc.setFillColor(245, 158, 11);
  doc.circle(margin + 8, yPos + 5, 8, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  setEnglishFont("bold");
  doc.text("S", margin + 5.5, yPos + 8);

  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(22);
  setEnglishFont("bold");
  doc.text("SAQR", margin + 22, yPos + 6);

  // Arabic title using Amiri font
  if (hasArabicFont) {
    setArabicFont();
    doc.setFontSize(14);
    doc.text("صقر", margin + 50, yPos + 6);
  }

  doc.setFontSize(9);
  setEnglishFont("normal");
  doc.setTextColor(100, 100, 100);
  doc.text("AI-Powered Compliance Inspection Report", margin + 22, yPos + 13);

  // Authority badge
  doc.setFillColor(0, 0, 0);
  doc.roundedRect(pageWidth - margin - 28, yPos, 28, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  setEnglishFont("bold");
  doc.text(inspection.category.authority.code, pageWidth - margin - 14, yPos + 8, { align: "center" });

  yPos = 35;

  // Divider line
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // ==================== INSPECTION INFO ====================
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 32, 3, 3, "F");
  doc.setDrawColor(230, 230, 230);
  doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 32, 3, 3, "S");

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  setEnglishFont("normal");
  doc.text("INSPECTION DETAILS", margin + 5, yPos + 7);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  setEnglishFont("bold");
  doc.text(inspection.category.name, margin + 5, yPos + 15);
  setEnglishFont("normal");
  doc.text(inspection.site?.name || "No Site Specified", margin + 5, yPos + 22);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(inspection.site?.address || "", margin + 5, yPos + 28);

  // Right side info
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.text("Date", pageWidth - margin - 50, yPos + 7);
  doc.text("ID", pageWidth - margin - 50, yPos + 18);

  doc.setTextColor(0, 0, 0);
  setEnglishFont("bold");
  doc.text(
    inspection.completedAt ? new Date(inspection.completedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) : "In Progress",
    pageWidth - margin - 5,
    yPos + 7,
    { align: "right" }
  );
  setEnglishFont("normal");
  doc.text(inspection.id.slice(0, 8).toUpperCase(), pageWidth - margin - 5, yPos + 18, { align: "right" });

  yPos += 40;

  // ==================== STATISTICS ====================
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  setEnglishFont("bold");
  doc.text("Summary", margin, yPos);
  yPos += 8;

  // Two main stat boxes
  const mainBoxW = (pageWidth - (margin * 2) - 8) / 2;
  const mainBoxH = 35;

  // Pass Rate Box
  const passColor: [number, number, number] = passRate >= 80 ? [34, 197, 94] : passRate >= 60 ? [245, 158, 11] : [239, 68, 68];
  doc.setFillColor(...passColor);
  doc.roundedRect(margin, yPos, mainBoxW, mainBoxH, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  setEnglishFont("bold");
  doc.text(`${passRate}%`, margin + mainBoxW/2, yPos + 18, { align: "center" });
  doc.setFontSize(9);
  setEnglishFont("normal");
  doc.text("PASS RATE", margin + mainBoxW/2, yPos + 28, { align: "center" });

  // Completion Box
  const compColor: [number, number, number] = completionRate === 100 ? [59, 130, 246] : [100, 116, 139];
  doc.setFillColor(...compColor);
  doc.roundedRect(margin + mainBoxW + 8, yPos, mainBoxW, mainBoxH, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  setEnglishFont("bold");
  doc.text(`${completionRate}%`, margin + mainBoxW + 8 + mainBoxW/2, yPos + 18, { align: "center" });
  doc.setFontSize(9);
  setEnglishFont("normal");
  doc.text("COMPLETION", margin + mainBoxW + 8 + mainBoxW/2, yPos + 28, { align: "center" });

  yPos += mainBoxH + 8;

  // Status breakdown
  const statusBoxW = (pageWidth - (margin * 2) - 12) / 4;
  const statusBoxH = 28;
  const statuses = [
    { label: "Passed", value: passedItems, color: statusColors.PASS },
    { label: "Failed", value: failedItems, color: statusColors.FAIL },
    { label: "Uncertain", value: uncertainItems, color: statusColors.UNCERTAIN },
    { label: "Pending", value: pendingItems, color: statusColors.PENDING },
  ];

  statuses.forEach((s, i) => {
    const x = margin + (i * (statusBoxW + 4));
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(x, yPos, statusBoxW, statusBoxH, 2, 2, "F");
    doc.setDrawColor(...s.color);
    doc.setLineWidth(2);
    doc.line(x, yPos, x, yPos + statusBoxH);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    setEnglishFont("bold");
    doc.text(String(s.value), x + statusBoxW/2, yPos + 13, { align: "center" });
    doc.setFontSize(7);
    setEnglishFont("normal");
    doc.setTextColor(100, 100, 100);
    doc.text(s.label, x + statusBoxW/2, yPos + 22, { align: "center" });
  });

  yPos += statusBoxH + 15;

  // ==================== RESULTS SECTIONS ====================

  // Helper to render a result item with full SAQR comment
  const renderResultItem = (
    result: InspectionResult,
    bgColor: [number, number, number],
    borderColor: [number, number, number],
    badgeColor: [number, number, number]
  ) => {
    // Make a COPY of the photoUrl to ensure each item has its own reference
    const imageData = result.photoUrl ? String(result.photoUrl) : null;
    const hasImage = imageData && imageData.startsWith("data:image");
    const hasAIComment = result.aiReasoning || result.aiReasoningAr;

    // Calculate height based on content - allow more space for full comments
    let itemHeight = 20; // Base height
    if (hasImage) itemHeight = Math.max(itemHeight, 44); // Image needs at least 44px
    if (hasAIComment) {
      // Estimate lines needed for full comment
      const enLen = result.aiReasoning?.length || 0;
      const arLen = result.aiReasoningAr?.length || 0;
      const totalLen = enLen + arLen;
      const extraLines = Math.ceil(totalLen / 70);
      itemHeight = Math.max(itemHeight, 28 + (extraLines * 4));
    }

    checkNewPage(itemHeight + 5);

    // Background
    doc.setFillColor(...bgColor);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), itemHeight, 2, 2, "FD");

    const textStartX = hasImage ? margin + 40 : margin + 5;
    const textMaxWidth = hasImage ? pageWidth - margin - textStartX - 5 : pageWidth - (margin * 2) - 10;

    // Image - each result uses its OWN image data
    if (hasImage && imageData) {
      try {
        doc.addImage(imageData, "JPEG", margin + 3, yPos + 3, 34, 34);
      } catch (e) {
        console.error("Failed to add image for", result.spec.code, e);
      }
    }

    // Code badge
    doc.setFillColor(...badgeColor);
    doc.roundedRect(textStartX, yPos + 3, 24, 6, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    setEnglishFont("bold");
    doc.text(result.spec.code, textStartX + 12, yPos + 7, { align: "center" });

    // Requirement text (English)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    setEnglishFont("normal");
    const reqLines = doc.splitTextToSize(result.spec.requirement, textMaxWidth - 30);
    doc.text(reqLines[0], textStartX + 28, yPos + 7);

    // SAQR Finding - FULL text, bilingual with proper fonts
    let commentY = yPos + 14;
    if (result.aiReasoning || result.aiReasoningAr) {
      // English finding - FULL text with wrapping
      if (result.aiReasoning) {
        doc.setFontSize(7);
        setEnglishFont("normal");
        doc.setTextColor(60, 60, 60);
        const enLines = doc.splitTextToSize(`SAQR: ${result.aiReasoning}`, textMaxWidth);
        for (const line of enLines) {
          if (commentY < yPos + itemHeight - 3) {
            doc.text(line, textStartX, commentY);
            commentY += 3.5;
          }
        }
      }

      // Arabic finding - FULL text with Amiri font
      if (result.aiReasoningAr && hasArabicFont) {
        setArabicFont();
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        const arLines = doc.splitTextToSize(result.aiReasoningAr, textMaxWidth);
        for (const line of arLines) {
          if (commentY < yPos + itemHeight - 3) {
            doc.text(line, textStartX, commentY);
            commentY += 4;
          }
        }
        setEnglishFont("normal"); // Reset to English font
      }

      // Confidence
      if (result.aiConfidence) {
        doc.setFontSize(6);
        setEnglishFont("normal");
        doc.setTextColor(120, 120, 120);
        doc.text(`Confidence: ${Math.round(result.aiConfidence * 100)}%`, pageWidth - margin - 25, yPos + 7);
      }
    }

    yPos += itemHeight + 3;
  };

  // PASSED ITEMS
  const passedResults = inspection.results.filter(r => r.status === "PASS");
  if (passedResults.length > 0) {
    addSectionHeader("PASSED - Compliant", statusColors.PASS, passedResults.length);

    for (const result of passedResults) {
      renderResultItem(
        result,
        [240, 253, 244], // bg
        [34, 197, 94],   // border
        [34, 197, 94]    // badge
      );
    }
  }

  // FAILED ITEMS
  const failedResults = inspection.results.filter(r => r.status === "FAIL");
  if (failedResults.length > 0) {
    checkNewPage(30);
    addSectionHeader("FAILED - Action Required", statusColors.FAIL, failedResults.length);

    for (const result of failedResults) {
      renderResultItem(
        result,
        [254, 242, 242], // bg
        [239, 68, 68],   // border
        [239, 68, 68]    // badge
      );
    }
  }

  // UNCERTAIN ITEMS
  const uncertainResults = inspection.results.filter(r => r.status === "UNCERTAIN");
  if (uncertainResults.length > 0) {
    checkNewPage(30);
    addSectionHeader("UNCERTAIN - Needs Review", statusColors.UNCERTAIN, uncertainResults.length);

    for (const result of uncertainResults) {
      renderResultItem(
        result,
        [255, 251, 235], // bg
        [245, 158, 11],  // border
        [245, 158, 11]   // badge
      );
    }
  }

  // PENDING ITEMS
  const pendingResults = inspection.results.filter(r => !r.status);
  if (pendingResults.length > 0) {
    checkNewPage(30);
    addSectionHeader("PENDING - Not Inspected", statusColors.PENDING, pendingResults.length);

    for (const result of pendingResults) {
      checkNewPage(16);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 13, 2, 2, "FD");

      doc.setFillColor(100, 116, 139);
      doc.roundedRect(margin + 5, yPos + 3, 24, 6, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      setEnglishFont("bold");
      doc.text(result.spec.code, margin + 17, yPos + 7, { align: "center" });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      setEnglishFont("normal");
      const reqText = result.spec.requirement.length > 85 ? result.spec.requirement.substring(0, 85) + "..." : result.spec.requirement;
      doc.text(reqText, margin + 33, yPos + 8);

      yPos += 16;
    }
  }

  // ==================== FOOTER ON ALL PAGES ====================
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // White background for footer area
    doc.setFillColor(255, 255, 255);
    doc.rect(0, pageHeight - 18, pageWidth, 18, "F");

    // Footer line
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    // Footer text
    doc.setFontSize(7);
    setEnglishFont("normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated by Saqr AI • ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • saqr.ai`,
      margin,
      pageHeight - 8
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  // Download
  const filename = `saqr-report-${inspection.category.authority.code}-${inspection.id.slice(0, 8)}-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}
