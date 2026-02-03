// SAQR Robot Mode - Zone Configuration

export interface InspectionZone {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  order: number;
  guidance: string;
  guidanceAr: string;
  keywords: string[]; // Keywords to match specs to this zone
  specIds: string[]; // Populated dynamically
  completed: boolean;
  sweepDirections: SweepDirection[];
}

export interface SweepDirection {
  id: string;
  direction: "UP" | "FORWARD" | "DOWN" | "AROUND" | "DETAIL";
  target: string;
  label: string;
  labelAr: string;
  completed: boolean;
}

export const INSPECTION_ZONES: Omit<InspectionZone, "specIds" | "completed" | "sweepDirections">[] = [
  {
    id: "exterior",
    name: "Exterior & Entrance",
    nameAr: "الخارج والمدخل",
    icon: "Building2",
    order: 1,
    guidance: "Start outside. Capture the building front, entrance, and surrounding area.",
    guidanceAr: "ابدأ من الخارج. التقط واجهة المبنى والمدخل والمنطقة المحيطة.",
    keywords: ["entrance", "exterior", "external", "sign", "signage", "parking", "waste", "bin", "ramp", "outdoor", "outside", "front", "facade"]
  },
  {
    id: "main_area",
    name: "Main Hall / Dining",
    nameAr: "الصالة الرئيسية",
    icon: "UtensilsCrossed",
    order: 2,
    guidance: "Enter the main area. Slowly scan ceiling, walls, floor, and windows.",
    guidanceAr: "ادخل المنطقة الرئيسية. امسح ببطء السقف والجدران والأرضية والنوافذ.",
    keywords: ["ceiling", "wall", "floor", "window", "lighting", "light", "ventilation", "air", "screen", "insect", "tile", "smooth", "crack", "surface"]
  },
  {
    id: "kitchen",
    name: "Kitchen / Prep Area",
    nameAr: "المطبخ / منطقة التحضير",
    icon: "ChefHat",
    order: 3,
    guidance: "Move to kitchen. Scan surfaces, equipment, and handwash stations.",
    guidanceAr: "انتقل إلى المطبخ. امسح الأسطح والمعدات ومحطات غسل اليدين.",
    keywords: ["food", "prep", "cook", "kitchen", "wash", "sink", "equipment", "temperature", "stainless", "refriger", "freezer", "oven", "hood", "exhaust"]
  },
  {
    id: "storage",
    name: "Storage Areas",
    nameAr: "مناطق التخزين",
    icon: "Package",
    order: 4,
    guidance: "Check all storage rooms. Scan shelves, labels, and floor clearance.",
    guidanceAr: "افحص جميع غرف التخزين. امسح الأرفف والملصقات والمسافة من الأرض.",
    keywords: ["storage", "shelf", "shelving", "chemical", "label", "FIFO", "store", "stock", "inventory", "dry", "cold"]
  },
  {
    id: "restrooms",
    name: "Restrooms & Facilities",
    nameAr: "دورات المياه والمرافق",
    icon: "Bath",
    order: 5,
    guidance: "Inspect restrooms. Check handwash, soap, ventilation, self-closing doors.",
    guidanceAr: "افحص دورات المياه. تحقق من غسل اليدين والصابون والتهوية والأبواب ذاتية الإغلاق.",
    keywords: ["restroom", "toilet", "handwash", "soap", "sanitary", "bathroom", "lavatory", "tissue", "towel", "dryer"]
  },
  {
    id: "safety",
    name: "Safety & Emergency",
    nameAr: "السلامة والطوارئ",
    icon: "ShieldAlert",
    order: 6,
    guidance: "Check fire safety equipment, exit routes, and emergency signage throughout.",
    guidanceAr: "تحقق من معدات السلامة من الحريق ومسارات الخروج ولافتات الطوارئ.",
    keywords: ["fire", "exit", "extinguisher", "alarm", "emergency", "first aid", "evacuation", "smoke", "detector", "sprinkler"]
  }
];

export const SWEEP_SEQUENCE: Omit<SweepDirection, "completed">[] = [
  { id: "up", direction: "UP", target: "ceiling", label: "Look UP at ceiling", labelAr: "انظر للأعلى نحو السقف" },
  { id: "forward", direction: "FORWARD", target: "walls", label: "Scan walls left to right", labelAr: "امسح الجدران من اليسار لليمين" },
  { id: "down", direction: "DOWN", target: "floor", label: "Look DOWN at floor", labelAr: "انظر للأسفل نحو الأرضية" },
  { id: "around", direction: "AROUND", target: "windows", label: "Pan around for windows & doors", labelAr: "تحرك حول النوافذ والأبواب" },
  { id: "detail", direction: "DETAIL", target: "equipment", label: "Move closer for details", labelAr: "اقترب للتفاصيل" }
];

// Assign specs to zones based on keyword matching
export function assignSpecsToZones(specs: { id: string; requirement: string }[]): Map<string, string[]> {
  const zoneSpecMap = new Map<string, string[]>();

  // Initialize empty arrays for each zone
  INSPECTION_ZONES.forEach(zone => {
    zoneSpecMap.set(zone.id, []);
  });
  zoneSpecMap.set("general", []); // For specs that don't match any zone

  specs.forEach(spec => {
    const reqLower = spec.requirement.toLowerCase();
    let assigned = false;

    for (const zone of INSPECTION_ZONES) {
      const matches = zone.keywords.some(keyword => reqLower.includes(keyword.toLowerCase()));
      if (matches) {
        zoneSpecMap.get(zone.id)!.push(spec.id);
        assigned = true;
        break; // Assign to first matching zone only
      }
    }

    if (!assigned) {
      zoneSpecMap.get("general")!.push(spec.id);
    }
  });

  return zoneSpecMap;
}

// Get zone for a specific spec
export function getZoneForSpec(specRequirement: string): string {
  const reqLower = specRequirement.toLowerCase();

  for (const zone of INSPECTION_ZONES) {
    const matches = zone.keywords.some(keyword => reqLower.includes(keyword.toLowerCase()));
    if (matches) {
      return zone.id;
    }
  }

  return "general";
}

// Calculate compliance score
export interface ComplianceScore {
  overall: number;
  byZone: { zoneId: string; zoneName: string; score: number; total: number; passed: number }[];
  bySeverity: { critical: number; major: number; minor: number; ok: number };
  priorityActions: { severity: string; description: string; descriptionAr: string; zone: string }[];
}

export function calculateComplianceScore(
  results: { specId: string; result: "PASS" | "FAIL"; severity?: string; zoneId: string; finding: string; findingAr: string }[]
): ComplianceScore {
  const byZone: ComplianceScore["byZone"] = [];
  const bySeverity = { critical: 0, major: 0, minor: 0, ok: 0 };
  const priorityActions: ComplianceScore["priorityActions"] = [];

  // Group by zone
  const zoneGroups = new Map<string, typeof results>();
  results.forEach(r => {
    if (!zoneGroups.has(r.zoneId)) {
      zoneGroups.set(r.zoneId, []);
    }
    zoneGroups.get(r.zoneId)!.push(r);
  });

  let totalPassed = 0;
  let totalSpecs = results.length;

  zoneGroups.forEach((zoneResults, zoneId) => {
    const zone = INSPECTION_ZONES.find(z => z.id === zoneId);
    const passed = zoneResults.filter(r => r.result === "PASS").length;
    const total = zoneResults.length;
    const score = total > 0 ? Math.round((passed / total) * 100) : 0;

    totalPassed += passed;

    byZone.push({
      zoneId,
      zoneName: zone?.name || "General",
      score,
      total,
      passed
    });

    // Count by severity and collect priority actions
    zoneResults.forEach(r => {
      const sev = (r.severity || "OK").toUpperCase();
      if (sev === "CRITICAL") bySeverity.critical++;
      else if (sev === "MAJOR") bySeverity.major++;
      else if (sev === "MINOR") bySeverity.minor++;
      else bySeverity.ok++;

      if (r.result === "FAIL") {
        priorityActions.push({
          severity: sev,
          description: r.finding,
          descriptionAr: r.findingAr,
          zone: zone?.name || "General"
        });
      }
    });
  });

  // Sort priority actions by severity
  const severityOrder = { CRITICAL: 0, MAJOR: 1, MINOR: 2, OK: 3 };
  priorityActions.sort((a, b) =>
    (severityOrder[a.severity as keyof typeof severityOrder] || 3) -
    (severityOrder[b.severity as keyof typeof severityOrder] || 3)
  );

  const overall = totalSpecs > 0 ? Math.round((totalPassed / totalSpecs) * 100) : 0;

  return { overall, byZone, bySeverity, priorityActions };
}
