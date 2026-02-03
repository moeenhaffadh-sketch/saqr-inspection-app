import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create Bahrain Authorities
  const authorities = await Promise.all([
    prisma.authority.upsert({
      where: { code: "MOH" },
      update: {},
      create: {
        code: "MOH",
        name: "Ministry of Health",
        nameAr: "وزارة الصحة",
        countryCode: "BH",
        description: "Public health and food safety regulations",
      },
    }),
    prisma.authority.upsert({
      where: { code: "MOIC" },
      update: {},
      create: {
        code: "MOIC",
        name: "Ministry of Industry and Commerce",
        nameAr: "وزارة الصناعة والتجارة",
        countryCode: "BH",
        description: "Commercial registration and business licensing",
      },
    }),
    prisma.authority.upsert({
      where: { code: "GDCD" },
      update: {},
      create: {
        code: "GDCD",
        name: "General Directorate of Civil Defense",
        nameAr: "الإدارة العامة للدفاع المدني",
        countryCode: "BH",
        description: "Fire safety and emergency preparedness",
      },
    }),
    prisma.authority.upsert({
      where: { code: "NHRA" },
      update: {},
      create: {
        code: "NHRA",
        name: "National Health Regulatory Authority",
        nameAr: "الهيئة الوطنية لتنظيم المهن والخدمات الصحية",
        countryCode: "BH",
        description: "Healthcare facility licensing and standards",
      },
    }),
    prisma.authority.upsert({
      where: { code: "MUN" },
      update: {},
      create: {
        code: "MUN",
        name: "Municipalities Affairs",
        nameAr: "شؤون البلديات",
        countryCode: "BH",
        description: "Premise suitability and local permits",
      },
    }),
  ]);

  console.log(`✅ Created ${authorities.length} authorities`);

  // Create MOH Categories
  const mohCategories = [
    {
      code: "FL",
      name: "Facility & Layout",
      nameAr: "المنشأة والتخطيط",
      description: "Site location, engineering plans, construction finishes, workflow verification",
      descriptionAr: "موقع المنشأة والمخططات الهندسية والتشطيبات وسير العمل",
      icon: "building",
      color: "#10b981",
    },
    {
      code: "PC",
      name: "Pest Control & Building Protection",
      nameAr: "مكافحة الآفات وحماية المبنى",
      description: "Insect/rodent prevention, periodic pest control contracts, entry prevention measures",
      descriptionAr: "منع الحشرات والقوارض وعقود المكافحة الدورية وإجراءات المنع",
      icon: "shield",
      color: "#ef4444",
    },
    {
      code: "HW",
      name: "Handwashing, Waste & Hygiene",
      nameAr: "غسل اليدين والنفايات والنظافة",
      description: "Handwashing basins, waste disposal, hygiene facilities, temperature requirements",
      descriptionAr: "أحواض غسل اليدين والتخلص من النفايات ومرافق النظافة",
      icon: "droplets",
      color: "#06b6d4",
    },
    {
      code: "WR",
      name: "Worker Requirements",
      nameAr: "متطلبات العمال",
      description: "Staff register, medical fitness certificates, hygiene practices, training records",
      descriptionAr: "سجل الموظفين وشهادات اللياقة الطبية وممارسات النظافة",
      icon: "users",
      color: "#8b5cf6",
    },
    {
      code: "LL",
      name: "Labeling & Licensing Display",
      nameAr: "العلامات والتراخيص",
      description: "Trade name signage, registration numbers, license display requirements",
      descriptionAr: "لافتات الاسم التجاري وأرقام التسجيل ومتطلبات عرض الترخيص",
      icon: "clipboard",
      color: "#f59e0b",
    },
    {
      code: "ST",
      name: "Storage & Temperature Monitoring",
      nameAr: "التخزين ومراقبة الحرارة",
      description: "Dry/chilled/frozen storage, thermometer placement, cold-chain transport",
      descriptionAr: "التخزين الجاف والمبرد والمجمد ووضع الثرمومترات",
      icon: "flame",
      color: "#dc2626",
    },
  ];

  const moh = authorities.find((a) => a.code === "MOH")!;

  for (const cat of mohCategories) {
    const category = await prisma.inspectionCategory.upsert({
      where: { code: cat.code },
      update: {},
      create: {
        ...cat,
        authorityId: moh.id,
      },
    });

    // Add specs for each category
    const specs = getSpecsForCategory(cat.code);
    for (let i = 0; i < specs.length; i++) {
      await prisma.inspectionSpec.upsert({
        where: {
          categoryId_code: {
            categoryId: category.id,
            code: specs[i].code,
          },
        },
        update: {},
        create: {
          ...specs[i],
          categoryId: category.id,
          sortOrder: i,
        },
      });
    }
  }

  // Create GDCD Fire Safety Category
  const gdcd = authorities.find((a) => a.code === "GDCD")!;
  const fireCategory = await prisma.inspectionCategory.upsert({
    where: { code: "FS" },
    update: {},
    create: {
      code: "FS",
      name: "Civil Defense / Fire Safety",
      nameAr: "الدفاع المدني والسلامة من الحرائق",
      description: "Fire extinguishers, exit signage, emergency lighting, evacuation routes",
      descriptionAr: "طفايات الحريق ولافتات المخارج والإضاءة الطارئة",
      icon: "flame",
      color: "#dc2626",
      authorityId: gdcd.id,
    },
  });

  const fireSpecs = [
    { code: "FS-01", requirement: "Fire extinguishers properly placed and accessible", requirementAr: "طفايات الحريق موضوعة بشكل صحيح ويمكن الوصول إليها", category: "Extinguishers", evidenceType: "PHOTO" as const, aiFeasibility: "HIGH" as const },
    { code: "FS-02", requirement: "Fire extinguishers inspected and certified", requirementAr: "طفايات الحريق مفحوصة ومعتمدة", category: "Certification", evidenceType: "QR_BARCODE" as const, aiFeasibility: "MEDIUM" as const },
    { code: "FS-03", requirement: "Emergency exit signage clearly visible", requirementAr: "لافتات المخارج الطارئة مرئية بوضوح", category: "Exit Signs", evidenceType: "PHOTO" as const, aiFeasibility: "HIGH" as const },
    { code: "FS-04", requirement: "Emergency lighting functional", requirementAr: "الإضاءة الطارئة تعمل", category: "Emergency Lighting", evidenceType: "PHOTO" as const, aiFeasibility: "MEDIUM" as const },
    { code: "FS-05", requirement: "Fire alarm panel operational", requirementAr: "لوحة إنذار الحريق تعمل", category: "Alarm", evidenceType: "PHOTO" as const, aiFeasibility: "MEDIUM" as const },
    { code: "FS-06", requirement: "Evacuation routes clearly marked", requirementAr: "مسارات الإخلاء محددة بوضوح", category: "Evacuation", evidenceType: "PHOTO" as const, aiFeasibility: "HIGH" as const },
    { code: "FS-07", requirement: "Civil Defense approval certificate available", requirementAr: "شهادة موافقة الدفاع المدني متوفرة", category: "Approval", evidenceType: "DOCUMENT" as const, aiFeasibility: "LOW" as const },
  ];

  for (let i = 0; i < fireSpecs.length; i++) {
    await prisma.inspectionSpec.upsert({
      where: {
        categoryId_code: {
          categoryId: fireCategory.id,
          code: fireSpecs[i].code,
        },
      },
      update: {},
      create: {
        ...fireSpecs[i],
        categoryId: fireCategory.id,
        sortOrder: i,
      },
    });
  }

  // Create NHRA Healthcare Category
  const nhra = authorities.find((a) => a.code === "NHRA")!;
  const healthcareCategory = await prisma.inspectionCategory.upsert({
    where: { code: "HC" },
    update: {},
    create: {
      code: "HC",
      name: "Healthcare Facilities",
      nameAr: "المنشآت الصحية",
      description: "Healthcare licenses, infection control, staff credentials, facility standards",
      descriptionAr: "تراخيص الرعاية الصحية ومكافحة العدوى وبيانات الموظفين",
      icon: "users",
      color: "#7c3aed",
      authorityId: nhra.id,
    },
  });

  const healthcareSpecs = [
    { code: "HC-01", requirement: "Valid NHRA healthcare facility license", requirementAr: "ترخيص منشأة رعاية صحية NHRA صالح", category: "License", evidenceType: "DOCUMENT" as const, aiFeasibility: "LOW" as const },
    { code: "HC-02", requirement: "Staff credentials and certifications current", requirementAr: "بيانات اعتماد الموظفين والشهادات حالية", category: "Credentials", evidenceType: "DOCUMENT" as const, aiFeasibility: "LOW" as const },
    { code: "HC-03", requirement: "Infection control protocols visible", requirementAr: "بروتوكولات مكافحة العدوى مرئية", category: "Infection Control", evidenceType: "PHOTO" as const, aiFeasibility: "HIGH" as const },
    { code: "HC-04", requirement: "Hand hygiene signage posted", requirementAr: "لافتات نظافة اليدين معلقة", category: "Signage", evidenceType: "PHOTO" as const, aiFeasibility: "HIGH" as const },
    { code: "HC-05", requirement: "Proper storage of medical supplies", requirementAr: "التخزين المناسب للإمدادات الطبية", category: "Storage", evidenceType: "PHOTO" as const, aiFeasibility: "HIGH" as const },
    { code: "HC-06", requirement: "Facility meets NHRA design standards", requirementAr: "المنشأة تلبي معايير تصميم NHRA", category: "Standards", evidenceType: "DOCUMENT" as const, aiFeasibility: "LOW" as const },
  ];

  for (let i = 0; i < healthcareSpecs.length; i++) {
    await prisma.inspectionSpec.upsert({
      where: {
        categoryId_code: {
          categoryId: healthcareCategory.id,
          code: healthcareSpecs[i].code,
        },
      },
      update: {},
      create: {
        ...healthcareSpecs[i],
        categoryId: healthcareCategory.id,
        sortOrder: i,
      },
    });
  }

  // Create MOIC Commercial Registration Category
  const moic = authorities.find((a) => a.code === "MOIC")!;
  const crCategory = await prisma.inspectionCategory.upsert({
    where: { code: "CR" },
    update: {},
    create: {
      code: "CR",
      name: "Commercial Registration",
      nameAr: "السجل التجاري",
      description: "CR validation, business licensing, activity approvals, compliance documents",
      descriptionAr: "التحقق من السجل التجاري والترخيص التجاري والموافقات",
      icon: "filetext",
      color: "#0891b2",
      authorityId: moic.id,
    },
  });

  const crSpecs = [
    { code: "CR-01", requirement: "Valid Commercial Registration (CR) certificate", requirementAr: "شهادة السجل التجاري (CR) صالحة", category: "CR Certificate", evidenceType: "DOCUMENT" as const, aiFeasibility: "LOW" as const },
    { code: "CR-02", requirement: "CR details match business activity", requirementAr: "تفاصيل السجل التجاري تطابق نشاط العمل", category: "Activity Match", evidenceType: "DOCUMENT" as const, aiFeasibility: "LOW" as const },
    { code: "CR-03", requirement: "MOH approval attached to CR", requirementAr: "موافقة وزارة الصحة مرفقة بالسجل التجاري", category: "MOH Approval", evidenceType: "DOCUMENT" as const, aiFeasibility: "LOW" as const },
    { code: "CR-04", requirement: "Municipality approval attached", requirementAr: "موافقة البلدية مرفقة", category: "Municipality", evidenceType: "DOCUMENT" as const, aiFeasibility: "LOW" as const },
    { code: "CR-05", requirement: "Civil Defense approval attached", requirementAr: "موافقة الدفاع المدني مرفقة", category: "Civil Defense", evidenceType: "DOCUMENT" as const, aiFeasibility: "LOW" as const },
  ];

  for (let i = 0; i < crSpecs.length; i++) {
    await prisma.inspectionSpec.upsert({
      where: {
        categoryId_code: {
          categoryId: crCategory.id,
          code: crSpecs[i].code,
        },
      },
      update: {},
      create: {
        ...crSpecs[i],
        categoryId: crCategory.id,
        sortOrder: i,
      },
    });
  }

  // Create Municipality Premises Category
  const mun = authorities.find((a) => a.code === "MUN")!;
  const munCategory = await prisma.inspectionCategory.upsert({
    where: { code: "MP" },
    update: {},
    create: {
      code: "MP",
      name: "Municipality Premises",
      nameAr: "مباني البلدية",
      description: "Shop licensing, premise suitability, toilets, drainage, waste areas",
      descriptionAr: "ترخيص المحل وملاءمة المبنى والمراحيض والصرف",
      icon: "home",
      color: "#059669",
      authorityId: mun.id,
    },
  });

  const munSpecs = [
    { code: "MP-01", requirement: "Shop license valid and displayed", requirementAr: "ترخيص المحل صالح ومعروض", category: "License", evidenceType: "PHOTO" as const, aiFeasibility: "HIGH" as const },
    { code: "MP-02", requirement: "Adequate toilet facilities for staff", requirementAr: "مرافق المراحيض كافية للموظفين", category: "Toilets", evidenceType: "PHOTO" as const, aiFeasibility: "HIGH" as const },
    { code: "MP-03", requirement: "Proper drainage system in place", requirementAr: "نظام صرف صحي مناسب موجود", category: "Drainage", evidenceType: "PHOTO" as const, aiFeasibility: "HIGH" as const },
    { code: "MP-04", requirement: "Designated waste collection area", requirementAr: "منطقة جمع النفايات المخصصة", category: "Waste Area", evidenceType: "PHOTO" as const, aiFeasibility: "HIGH" as const },
    { code: "MP-05", requirement: "Rental/tenancy documents available", requirementAr: "مستندات الإيجار/الإيجار متوفرة", category: "Tenancy", evidenceType: "DOCUMENT" as const, aiFeasibility: "LOW" as const },
  ];

  for (let i = 0; i < munSpecs.length; i++) {
    await prisma.inspectionSpec.upsert({
      where: {
        categoryId_code: {
          categoryId: munCategory.id,
          code: munSpecs[i].code,
        },
      },
      update: {},
      create: {
        ...munSpecs[i],
        categoryId: munCategory.id,
        sortOrder: i,
      },
    });
  }

  console.log("✅ Seeding complete!");
}

function getSpecsForCategory(code: string) {
  const specs: Record<string, Array<{
    code: string;
    requirement: string;
    requirementAr: string;
    category: string;
    evidenceType: "PHOTO" | "DOCUMENT" | "QR_BARCODE" | "MANUAL";
    aiFeasibility: "HIGH" | "MEDIUM" | "LOW";
  }>> = {
    FL: [
      { code: "FL-01", requirement: "Site located away from major contamination sources", requirementAr: "الموقع بعيد عن مصادر التلوث الرئيسية", category: "Location", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "FL-02", requirement: "Engineering layout plan matches actual facility", requirementAr: "المخطط الهندسي يطابق المنشأة الفعلية", category: "Layout", evidenceType: "DOCUMENT", aiFeasibility: "LOW" },
      { code: "FL-03", requirement: "Work zones clearly defined and separated", requirementAr: "مناطق العمل محددة ومفصولة بوضوح", category: "Zones", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "FL-04", requirement: "Floors smooth, non-porous, easy to clean", requirementAr: "الأرضيات ملساء وغير مسامية وسهلة التنظيف", category: "Flooring", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "FL-05", requirement: "Walls properly finished and cleanable", requirementAr: "الجدران مشطبة بشكل صحيح وقابلة للتنظيف", category: "Walls", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "FL-06", requirement: "Ceilings free from cracks and leaks", requirementAr: "الأسقف خالية من الشقوق والتسريبات", category: "Ceilings", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "FL-07", requirement: "Windows equipped with insect screens", requirementAr: "النوافذ مزودة بشبكات حشرية", category: "Windows", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
    ],
    PC: [
      { code: "PC-01", requirement: "Premises designed to prevent insect/rodent entry", requirementAr: "المبنى مصمم لمنع دخول الحشرات والقوارض", category: "Prevention", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "PC-02", requirement: "Active pest control contract in place", requirementAr: "عقد مكافحة آفات نشط ساري المفعول", category: "Contract", evidenceType: "DOCUMENT", aiFeasibility: "LOW" },
      { code: "PC-03", requirement: "Pest control records maintained and current", requirementAr: "سجلات مكافحة الآفات محفوظة ومحدثة", category: "Records", evidenceType: "DOCUMENT", aiFeasibility: "LOW" },
      { code: "PC-04", requirement: "No visible signs of pest infestation", requirementAr: "لا توجد علامات واضحة للإصابة بالآفات", category: "Inspection", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
    ],
    HW: [
      { code: "HW-01", requirement: "Adequate handwashing basins with warm/hot water", requirementAr: "أحواض غسل اليدين كافية بمياه دافئة/ساخنة", category: "Handwashing", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "HW-02", requirement: "Soap dispensers available at all handwash stations", requirementAr: "موزعات الصابون متوفرة عند جميع أحواض الغسل", category: "Soap", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "HW-03", requirement: "Paper towel dispensers functional and stocked", requirementAr: "موزعات المناشف الورقية تعمل ومجهزة", category: "Towels", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "HW-04", requirement: "Lidded waste bins provided in all areas", requirementAr: "صناديق النفايات المغطاة متوفرة في جميع المناطق", category: "Waste Bins", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "HW-05", requirement: "Waste bags used in all bins", requirementAr: "أكياس النفايات مستخدمة في جميع الصناديق", category: "Bags", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "HW-06", requirement: "Regular waste disposal schedule maintained", requirementAr: "جدول التخلص من النفايات منتظم ومحفوظ", category: "Disposal", evidenceType: "DOCUMENT", aiFeasibility: "LOW" },
    ],
    WR: [
      { code: "WR-01", requirement: "Complete staff register with names and roles", requirementAr: "سجل الموظفين الكامل بالأسماء والأدوار", category: "Register", evidenceType: "DOCUMENT", aiFeasibility: "LOW" },
      { code: "WR-02", requirement: "Medical fitness certificates for all workers", requirementAr: "شهادات اللياقة الطبية لجميع العمال", category: "Medical", evidenceType: "DOCUMENT", aiFeasibility: "LOW" },
      { code: "WR-03", requirement: "Medical certificates renewed periodically", requirementAr: "الشهادات الطبية مجددة دوريًا", category: "Renewal", evidenceType: "DOCUMENT", aiFeasibility: "LOW" },
      { code: "WR-04", requirement: "Staff maintain proper hand hygiene practices", requirementAr: "الموظفون يحافظون على ممارسات نظافة اليدين", category: "Hygiene", evidenceType: "PHOTO", aiFeasibility: "MEDIUM" },
      { code: "WR-05", requirement: "No smoking in closed work areas", requirementAr: "لا يُسمح بالتدخين في مناطق العمل المغلقة", category: "No Smoking", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "WR-06", requirement: "Staff files maintained with complete documentation", requirementAr: "ملفات الموظفين محفوظة بالوثائق الكاملة", category: "Files", evidenceType: "DOCUMENT", aiFeasibility: "LOW" },
    ],
    LL: [
      { code: "LL-01", requirement: "Trade name displayed on front facade", requirementAr: "الاسم التجاري معروض على الواجهة الأمامية", category: "Signage", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "LL-02", requirement: "Registration number visible on facade", requirementAr: "رقم التسجيل مرئي على الواجهة", category: "Registration", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "LL-03", requirement: "Health registration certificate displayed prominently", requirementAr: "شهادة التسجيل الصحي معروضة بشكل بارز", category: "Certificate", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "LL-04", requirement: "All licenses current and valid", requirementAr: "جميع التراخيص حالية وصالحة", category: "Validity", evidenceType: "DOCUMENT", aiFeasibility: "MEDIUM" },
    ],
    ST: [
      { code: "ST-01", requirement: "Dry storage areas equipped with thermometers", requirementAr: "مناطق التخزين الجاف مزودة بثرمومترات", category: "Dry Storage", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "ST-02", requirement: "Chilled storage maintains proper temperature", requirementAr: "التخزين المبرد يحافظ على درجة الحرارة المناسبة", category: "Chilled", evidenceType: "PHOTO", aiFeasibility: "MEDIUM" },
      { code: "ST-03", requirement: "Frozen storage with functional thermometers", requirementAr: "التخزين المجمد مع ثرمومترات فعالة", category: "Frozen", evidenceType: "PHOTO", aiFeasibility: "HIGH" },
      { code: "ST-04", requirement: "Transport vehicles equipped with thermometers", requirementAr: "مركبات النقل مزودة بثرمومترات", category: "Transport", evidenceType: "PHOTO", aiFeasibility: "MEDIUM" },
      { code: "ST-05", requirement: "Cold-chain temperature ranges documented", requirementAr: "نطاقات درجات حرارة سلسلة التبريد موثقة", category: "Documentation", evidenceType: "DOCUMENT", aiFeasibility: "LOW" },
      { code: "ST-06", requirement: "Temperature monitoring logs maintained", requirementAr: "سجلات مراقبة الحرارة محفوظة", category: "Logs", evidenceType: "DOCUMENT", aiFeasibility: "LOW" },
    ],
  };

  return specs[code] || [];
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
