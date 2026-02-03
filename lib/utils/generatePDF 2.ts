import jsPDF from "jspdf";

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

export async function generateInspectionPDF(inspection: InspectionData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 15;

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

  // Helper to add section header
  const addSectionHeader = (title: string, color: [number, number, number], count: number) => {
    checkNewPage(20);
    doc.setFillColor(...color);
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 10, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
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
  doc.setFont("helvetica", "bold");
  doc.text("S", margin + 5.5, yPos + 8);

  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("SAQR", margin + 22, yPos + 6);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("AI-Powered Compliance Inspection Report", margin + 22, yPos + 13);

  // Authority badge
  doc.setFillColor(0, 0, 0);
  doc.roundedRect(pageWidth - margin - 28, yPos, 28, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
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
  doc.setFont("helvetica", "normal");
  doc.text("INSPECTION DETAILS", margin + 5, yPos + 7);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(inspection.category.name, margin + 5, yPos + 15);
  doc.setFont("helvetica", "normal");
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
  doc.setFont("helvetica", "bold");
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
  doc.setFont("helvetica", "normal");
  doc.text(inspection.id.slice(0, 8).toUpperCase(), pageWidth - margin - 5, yPos + 18, { align: "right" });

  yPos += 40;

  // ==================== STATISTICS ====================
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
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
  doc.setFont("helvetica", "bold");
  doc.text(`${passRate}%`, margin + mainBoxW/2, yPos + 18, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("PASS RATE", margin + mainBoxW/2, yPos + 28, { align: "center" });

  // Completion Box
  const compColor: [number, number, number] = completionRate === 100 ? [59, 130, 246] : [100, 116, 139];
  doc.setFillColor(...compColor);
  doc.roundedRect(margin + mainBoxW + 8, yPos, mainBoxW, mainBoxH, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(`${completionRate}%`, margin + mainBoxW + 8 + mainBoxW/2, yPos + 18, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
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
    doc.setFont("helvetica", "bold");
    doc.text(String(s.value), x + statusBoxW/2, yPos + 13, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(s.label, x + statusBoxW/2, yPos + 22, { align: "center" });
  });

  yPos += statusBoxH + 15;

  // ==================== RESULTS SECTIONS ====================

  // PASSED ITEMS
  const passedResults = inspection.results.filter(r => r.status === "PASS");
  if (passedResults.length > 0) {
    addSectionHeader("PASSED - Compliant", statusColors.PASS, passedResults.length);

    for (const result of passedResults) {
      const hasImage = result.photoUrl && result.photoUrl.startsWith("data:image");
      const hasAIComment = result.aiReasoning;
      const itemHeight = hasImage ? 42 : hasAIComment ? 24 : 18;
      checkNewPage(itemHeight + 5);

      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, pageWidth - (margin * 2), itemHeight, 2, 2, "FD");

      const textStartX = hasImage ? margin + 40 : margin + 5;
      if (hasImage && result.photoUrl) {
        try {
          doc.addImage(result.photoUrl, "JPEG", margin + 3, yPos + 3, 34, 34);
        } catch (e) { /* Skip if image fails */ }
      }

      // Code badge
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(textStartX, yPos + 3, 24, 6, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text(result.spec.code, textStartX + 12, yPos + 7, { align: "center" });

      // Requirement text
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const maxLen = hasImage ? 55 : 80;
      const reqText = result.spec.requirement.length > maxLen ? result.spec.requirement.substring(0, maxLen) + "..." : result.spec.requirement;
      doc.text(reqText, textStartX + 28, yPos + 7);

      // AI comment
      if (result.aiReasoning) {
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        const maxReasonLen = hasImage ? 60 : 85;
        const reasoning = result.aiReasoning.length > maxReasonLen ? result.aiReasoning.substring(0, maxReasonLen) + "..." : result.aiReasoning;
        doc.text(`↳ SAQR: ${reasoning}`, textStartX, yPos + 15);
      } else if (result.aiAnalyzed) {
        doc.setFontSize(6);
        doc.setTextColor(100, 100, 100);
        doc.text(`AI Verified (${Math.round((result.aiConfidence || 0) * 100)}%)`, textStartX + 28, yPos + 13);
      }

      yPos += itemHeight + 3;
    }
  }

  // FAILED ITEMS
  const failedResults = inspection.results.filter(r => r.status === "FAIL");
  if (failedResults.length > 0) {
    checkNewPage(30);
    addSectionHeader("FAILED - Action Required", statusColors.FAIL, failedResults.length);

    for (const result of failedResults) {
      const hasImage = result.photoUrl && result.photoUrl.startsWith("data:image");
      const itemHeight = hasImage ? 42 : 24;
      checkNewPage(itemHeight + 5);

      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(239, 68, 68);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, pageWidth - (margin * 2), itemHeight, 2, 2, "FD");

      const textStartX = hasImage ? margin + 40 : margin + 5;
      if (hasImage && result.photoUrl) {
        try {
          doc.addImage(result.photoUrl, "JPEG", margin + 3, yPos + 3, 34, 34);
        } catch (e) { /* Skip if image fails */ }
      }

      doc.setFillColor(239, 68, 68);
      doc.roundedRect(textStartX, yPos + 3, 24, 6, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text(result.spec.code, textStartX + 12, yPos + 7, { align: "center" });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const maxLen = hasImage ? 55 : 80;
      const reqText = result.spec.requirement.length > maxLen ? result.spec.requirement.substring(0, maxLen) + "..." : result.spec.requirement;
      doc.text(reqText, textStartX + 28, yPos + 7);

      if (result.aiReasoning) {
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        const maxReasonLen = hasImage ? 60 : 85;
        const reasoning = result.aiReasoning.length > maxReasonLen ? result.aiReasoning.substring(0, maxReasonLen) + "..." : result.aiReasoning;
        doc.text(`↳ SAQR: ${reasoning}`, textStartX, yPos + 15);
      }

      yPos += itemHeight + 3;
    }
  }

  // UNCERTAIN ITEMS
  const uncertainResults = inspection.results.filter(r => r.status === "UNCERTAIN");
  if (uncertainResults.length > 0) {
    checkNewPage(30);
    addSectionHeader("UNCERTAIN - Needs Review", statusColors.UNCERTAIN, uncertainResults.length);

    for (const result of uncertainResults) {
      const hasImage = result.photoUrl && result.photoUrl.startsWith("data:image");
      const itemHeight = hasImage ? 42 : 22;
      checkNewPage(itemHeight + 5);

      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, pageWidth - (margin * 2), itemHeight, 2, 2, "FD");

      const textStartX = hasImage ? margin + 40 : margin + 5;
      if (hasImage && result.photoUrl) {
        try {
          doc.addImage(result.photoUrl, "JPEG", margin + 3, yPos + 3, 34, 34);
        } catch (e) { /* Skip if image fails */ }
      }

      doc.setFillColor(245, 158, 11);
      doc.roundedRect(textStartX, yPos + 3, 24, 6, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text(result.spec.code, textStartX + 12, yPos + 7, { align: "center" });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const maxLen = hasImage ? 55 : 80;
      const reqText = result.spec.requirement.length > maxLen ? result.spec.requirement.substring(0, maxLen) + "..." : result.spec.requirement;
      doc.text(reqText, textStartX + 28, yPos + 7);

      if (result.aiReasoning) {
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        const reasonText = result.aiReasoning.length > 60 ? result.aiReasoning.substring(0, 60) + "..." : result.aiReasoning;
        doc.text(`↳ SAQR: ${reasonText}`, textStartX, yPos + 15);
      }

      yPos += itemHeight + 3;
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
      doc.setFont("helvetica", "bold");
      doc.text(result.spec.code, margin + 17, yPos + 7, { align: "center" });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
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
