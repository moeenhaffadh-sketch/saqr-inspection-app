'use client';

import React, { useState, useRef } from 'react';
import { Check, X, ChevronRight, FileText, Flame, Zap, Building, Camera, Users, Droplets, Wrench, ClipboardList, Home, Utensils, Globe, Upload, QrCode } from 'lucide-react';
import Image from 'next/image';

const VERSION = '0.0.7';

const COUNTRIES = [
  { code: 'BH', name_en: 'Bahrain', name_ar: 'البحرين', flag: '🇧🇭' },
  { code: 'SA', name_en: 'Saudi Arabia', name_ar: 'السعودية', flag: '🇸🇦' },
  { code: 'AE', name_en: 'UAE', name_ar: 'الإمارات', flag: '🇦🇪' },
  { code: 'QA', name_en: 'Qatar', name_ar: 'قطر', flag: '🇶🇦' },
  { code: 'KW', name_en: 'Kuwait', name_ar: 'الكويت', flag: '🇰🇼' },
  { code: 'OM', name_en: 'Oman', name_ar: 'عمان', flag: '🇴🇲' },
];

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
];

const TRANSLATIONS = {
  en: {
    selectCountry: 'Select Country',
    selectLanguage: 'Select Language',
    startInspection: 'Start Inspection',
    selectCategory: 'Select Inspection Category',
    back: 'Back',
    completed: 'Completed',
    remaining: 'remaining',
    allCompleted: 'All items completed',
    generateReport: 'Generate Report',
    complianceReport: 'Compliance Report',
    total: 'Total',
    passed: 'Passed',
    failed: 'Failed',
    passRate: 'Pass Rate',
    startNew: 'Start New Inspection',
    aiAnalysis: 'AI Compliance Analysis',
    capturePhotos: 'Capture photos for AI validation.',
    aiGuidance: 'AI Guidance:',
    captureEvidence: 'Capture Evidence',
    retakePhoto: 'Retake Photo',
    aiAnalyzing: 'AI Analyzing...',
    pass: 'Pass',
    fail: 'Fail',
    aiVerified: '🤖 AI Verified',
    notesPlaceholder: 'AI analysis or manual notes',
    source: 'Source:',
    uploadDocument: 'Upload Document',
    scanQR: 'Scan QR/Barcode',
  },
  ar: {
    selectCountry: 'اختر الدولة',
    selectLanguage: 'اختر اللغة',
    startInspection: 'ابدأ التفتيش',
    selectCategory: 'اختر فئة التفتيش',
    back: 'رجوع',
    completed: 'مكتمل',
    remaining: 'متبقي',
    allCompleted: 'جميع العناصر مكتملة',
    generateReport: 'إنشاء التقرير',
    complianceReport: 'تقرير الامتثال',
    total: 'الإجمالي',
    passed: 'نجح',
    failed: 'فشل',
    passRate: 'معدل النجاح',
    startNew: 'ابدأ تفتيشًا جديدًا',
    aiAnalysis: 'تحليل الامتثال بالذكاء الاصطناعي',
    capturePhotos: 'التقط صورًا للتحقق بالذكاء الاصطناعي.',
    aiGuidance: 'إرشادات الذكاء الاصطناعي:',
    captureEvidence: 'التقط الدليل',
    retakePhoto: 'أعد التقاط الصورة',
    aiAnalyzing: 'جارٍ التحليل...',
    pass: 'نجح',
    fail: 'فشل',
    aiVerified: '🤖 تم التحقق بالذكاء الاصطناعي',
    notesPlaceholder: 'تحليل الذكاء الاصطناعي أو ملاحظات يدوية',
    source: 'المصدر:',
    uploadDocument: 'رفع المستند',
    scanQR: 'مسح الباركود',
  }
};

// KSA Specifications (keeping existing)
const INSPECTION_TYPES_SA = [
  {
    id: 'compliance_display',
    name_en: 'Compliance Display',
    name_ar: 'عرض المتطلبات واللوحات',
    icon: 'clipboard',
    description_en: 'Required documentation, signage, and informational displays',
    description_ar: 'الوثائق المطلوبة واللافتات والعروض المعلوماتية',
    color: '#10b981',
    source: 'KSA Restaurant Requirements'
  },
  {
    id: 'security_cctv',
    name_en: 'Security & CCTV',
    name_ar: 'كاميرات المراقبة الأمنية',
    icon: 'shield',
    description_en: 'Security camera installation per KSA regulations',
    description_ar: 'تركيب كاميرات المراقبة وفقًا لأنظمة المملكة',
    color: '#3b82f6',
    source: 'KSA Security Camera Regulations'
  },
  {
    id: 'food_contact_surfaces',
    name_en: 'Food-Contact Surfaces',
    name_ar: 'الأسطح الملامسة للأغذية',
    icon: 'utensils',
    description_en: 'Materials, cleanliness, and safety of food preparation surfaces',
    description_ar: 'المواد والنظافة وسلامة أسطح تحضير الطعام',
    color: '#f59e0b',
    source: 'KSA Food Safety Standards'
  },
  {
    id: 'water_ice',
    name_en: 'Water & Ice Safety',
    name_ar: 'المياه والثلج',
    icon: 'droplets',
    description_en: 'Potable water supply, ice production, and hygiene',
    description_ar: 'إمدادات المياه الصالحة للشرب وإنتاج الثلج والنظافة',
    color: '#06b6d4',
    source: 'KSA Water & Ice Standards'
  },
  {
    id: 'temperature_control',
    name_en: 'Temperature Control & Storage',
    name_ar: 'التحكم بالحرارة والتخزين',
    icon: 'flame',
    description_en: 'Cold chain management, danger zone compliance (5-60°C)',
    description_ar: 'إدارة سلسلة التبريد والامتثال لمنطقة الخطر (5-60 درجة)',
    color: '#ef4444',
    source: 'KSA Food Storage Guidelines'
  },
  {
    id: 'food_preparation',
    name_en: 'Food Preparation & Handling',
    name_ar: 'التحضير وتداول الأغذية',
    icon: 'utensils',
    description_en: 'Preparation procedures, hygiene, cross-contamination prevention',
    description_ar: 'إجراءات التحضير والنظافة ومنع التلوث المتبادل',
    color: '#8b5cf6',
    source: 'SFDA (Saudi Food & Drug Authority)'
  },
];

// NEW: Comprehensive Bahrain MOH Specifications
const INSPECTION_TYPES_BH = [
  {
    id: 'facility_layout',
    name_en: 'Facility & Layout',
    name_ar: 'المنشأة والتخطيط',
    icon: 'building',
    description_en: 'Site location, engineering plans, construction finishes, workflow verification',
    description_ar: 'موقع المنشأة والمخططات الهندسية والتشطيبات وسير العمل',
    color: '#10b981',
    source: 'MOH Bahrain - Public Health'
  },
  {
    id: 'pest_control',
    name_en: 'Pest Control & Building Protection',
    name_ar: 'مكافحة الآفات وحماية المبنى',
    icon: 'shield',
    description_en: 'Insect/rodent prevention, periodic pest control contracts, entry prevention measures',
    description_ar: 'منع الحشرات والقوارض وعقود المكافحة الدورية وإجراءات المنع',
    color: '#ef4444',
    source: 'MOH Bahrain - Public Health'
  },
  {
    id: 'handwashing_waste',
    name_en: 'Handwashing, Waste & Hygiene',
    name_ar: 'غسل اليدين والنفايات والنظافة',
    icon: 'droplets',
    description_en: 'Handwashing basins, waste disposal, hygiene facilities, temperature requirements',
    description_ar: 'أحواض غسل اليدين والتخلص من النفايات ومرافق النظافة',
    color: '#06b6d4',
    source: 'MOH Bahrain - Public Health'
  },
  {
    id: 'worker_requirements',
    name_en: 'Worker Requirements',
    name_ar: 'متطلبات العمال',
    icon: 'users',
    description_en: 'Staff register, medical fitness certificates, hygiene practices, training records',
    description_ar: 'سجل الموظفين وشهادات اللياقة الطبية وممارسات النظافة',
    color: '#8b5cf6',
    source: 'MOH Bahrain - Public Health'
  },
  {
    id: 'labeling_licensing',
    name_en: 'Labeling & Licensing Display',
    name_ar: 'العلامات والتراخيص',
    icon: 'clipboard',
    description_en: 'Trade name signage, registration numbers, license display requirements',
    description_ar: 'لافتات الاسم التجاري وأرقام التسجيل ومتطلبات عرض الترخيص',
    color: '#f59e0b',
    source: 'MOH Bahrain - Public Health'
  },
  {
    id: 'storage_temperature',
    name_en: 'Storage & Temperature Monitoring',
    name_ar: 'التخزين ومراقبة الحرارة',
    icon: 'flame',
    description_en: 'Dry/chilled/frozen storage, thermometer placement, cold-chain transport',
    description_ar: 'التخزين الجاف والمبرد والمجمد ووضع الثرمومترات',
    color: '#dc2626',
    source: 'MOH Bahrain - Public Health'
  },
  {
    id: 'commercial_registration',
    name_en: 'Commercial Registration (MOIC)',
    name_ar: 'السجل التجاري',
    icon: 'filetext',
    description_en: 'CR validation, business licensing, activity approvals, compliance documents',
    description_ar: 'التحقق من السجل التجاري والترخيص التجاري والموافقات',
    color: '#0891b2',
    source: 'Ministry of Industry & Commerce'
  },
  {
    id: 'municipality_premises',
    name_en: 'Municipality Premises',
    name_ar: 'مباني البلدية',
    icon: 'home',
    description_en: 'Shop licensing, premise suitability, toilets, drainage, waste areas',
    description_ar: 'ترخيص المحل وملاءمة المبنى والمراحيض والصرف',
    color: '#059669',
    source: 'Municipalities Affairs'
  },
  {
    id: 'fire_safety',
    name_en: 'Civil Defense / Fire Safety',
    name_ar: 'الدفاع المدني والسلامة من الحرائق',
    icon: 'flame',
    description_en: 'Fire extinguishers, exit signage, emergency lighting, evacuation routes',
    description_ar: 'طفايات الحريق ولافتات المخارج والإضاءة الطارئة',
    color: '#dc2626',
    source: 'General Directorate of Civil Defense (GDCD)'
  },
  {
    id: 'healthcare_nhra',
    name_en: 'Healthcare Facilities (NHRA)',
    name_ar: 'المنشآت الصحية',
    icon: 'users',
    description_en: 'Healthcare licenses, infection control, staff credentials, facility standards',
    description_ar: 'تراخيص الرعاية الصحية ومكافحة العدوى وبيانات الموظفين',
    color: '#7c3aed',
    source: 'National Health Regulatory Authority (NHRA)'
  },
];

const CHECKLISTS: any = {
  // KSA Checklists (keeping existing)
  compliance_display: [
    { code: 'CD-01', desc_en: 'Required documents/data displayed on screen/tablet/frame', desc_ar: 'عرض المستندات/البيانات المطلوبة على شاشة أو إطار', category: 'Documentation', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'CD-02', desc_en: 'Educational and guidance signage displayed (allergens, calories)', desc_ar: 'عرض اللوحات التوعوية والإرشادية', category: 'Signage', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'CD-03', desc_en: 'Meat types and sources clearly indicated', desc_ar: 'توضيح أنواع اللحوم ومصدرها', category: 'Menu', evidenceType: 'Photo', aiFeasibility: 'Medium' },
  ],
  security_cctv: [
    { code: 'SC-01', desc_en: 'Security cameras installed per KSA regulations', desc_ar: 'تركيب كاميرات أمنية وفق الأنظمة', category: 'CCTV', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'SC-02', desc_en: 'Camera coverage includes all critical areas', desc_ar: 'تغطية الكاميرات لجميع المناطق الحرجة', category: 'Coverage', evidenceType: 'Photo', aiFeasibility: 'Medium' },
  ],
  food_contact_surfaces: [
    { code: 'FC-01', desc_en: 'Surfaces made of suitable, safe materials', desc_ar: 'الأسطح من مواد مناسبة وآمنة', category: 'Materials', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'FC-02', desc_en: 'Surfaces smooth, non-porous, easy to clean', desc_ar: 'الأسطح ملساء وغير مسامية', category: 'Cleanability', evidenceType: 'Photo', aiFeasibility: 'High' },
  ],
  water_ice: [
    { code: 'WI-01', desc_en: 'Potable water with adequate pressure/temperature', desc_ar: 'مياه صالحة للشرب بضغط وحرارة مناسبة', category: 'Water', evidenceType: 'Photo', aiFeasibility: 'Medium' },
    { code: 'WI-02', desc_en: 'Ice equipment away from contamination sources', desc_ar: 'معدات الثلج بعيدة عن مصادر التلوث', category: 'Ice', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'WI-03', desc_en: 'Ice machines with proper covers', desc_ar: 'ماكينات الثلج مزودة بأغطية مناسبة', category: 'Protection', evidenceType: 'Photo', aiFeasibility: 'High' },
  ],
  temperature_control: [
    { code: 'TC-01', desc_en: 'Danger zone (5-60°C) avoided', desc_ar: 'تجنب منطقة الخطر الحرارية', category: 'Safety', evidenceType: 'Photo', aiFeasibility: 'Medium' },
    { code: 'TC-02', desc_en: 'Chilled foods at proper temperature', desc_ar: 'الأطعمة المبردة في درجة حرارة مناسبة', category: 'Cold Chain', evidenceType: 'Photo', aiFeasibility: 'Medium' },
  ],
  food_preparation: [
    { code: 'FP-01', desc_en: 'SFDA regulations compliance', desc_ar: 'الالتزام بأنظمة الهيئة العامة للغذاء والدواء', category: 'Compliance', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'FP-02', desc_en: 'Foods inspected before use', desc_ar: 'فحص الأغذية قبل الاستخدام', category: 'Inspection', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'FP-03', desc_en: 'FIFO system implemented', desc_ar: 'نظام ما يرد أولاً يُصرف أولاً مطبق', category: 'Inventory', evidenceType: 'Photo', aiFeasibility: 'Medium' },
  ],

  // NEW: Bahrain MOH Comprehensive Checklists
  facility_layout: [
    { code: 'FL-01', desc_en: 'Site located away from major contamination sources', desc_ar: 'الموقع بعيد عن مصادر التلوث الرئيسية', category: 'Location', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'FL-02', desc_en: 'Engineering layout plan matches actual facility', desc_ar: 'المخطط الهندسي يطابق المنشأة الفعلية', category: 'Layout', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'FL-03', desc_en: 'Work zones clearly defined and separated', desc_ar: 'مناطق العمل محددة ومفصولة بوضوح', category: 'Zones', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'FL-04', desc_en: 'Floors smooth, non-porous, easy to clean', desc_ar: 'الأرضيات ملساء وغير مسامية وسهلة التنظيف', category: 'Flooring', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'FL-05', desc_en: 'Walls properly finished and cleanable', desc_ar: 'الجدران مشطبة بشكل صحيح وقابلة للتنظيف', category: 'Walls', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'FL-06', desc_en: 'Ceilings free from cracks and leaks', desc_ar: 'الأسقف خالية من الشقوق والتسريبات', category: 'Ceilings', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'FL-07', desc_en: 'Windows equipped with insect screens', desc_ar: 'النوافذ مزودة بشبكات حشرية', category: 'Windows', evidenceType: 'Photo', aiFeasibility: 'High' },
  ],
  
  pest_control: [
    { code: 'PC-01', desc_en: 'Premises designed to prevent insect/rodent entry', desc_ar: 'المبنى مصمم لمنع دخول الحشرات والقوارض', category: 'Prevention', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'PC-02', desc_en: 'Active pest control contract in place', desc_ar: 'عقد مكافحة آفات نشط ساري المفعول', category: 'Contract', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'PC-03', desc_en: 'Pest control records maintained and current', desc_ar: 'سجلات مكافحة الآفات محفوظة ومحدثة', category: 'Records', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'PC-04', desc_en: 'No visible signs of pest infestation', desc_ar: 'لا توجد علامات واضحة للإصابة بالآفات', category: 'Inspection', evidenceType: 'Photo', aiFeasibility: 'High' },
  ],

  handwashing_waste: [
    { code: 'HW-01', desc_en: 'Adequate handwashing basins with warm/hot water', desc_ar: 'أحواض غسل اليدين كافية بمياه دافئة/ساخنة', category: 'Handwashing', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'HW-02', desc_en: 'Soap dispensers available at all handwash stations', desc_ar: 'موزعات الصابون متوفرة عند جميع أحواض الغسل', category: 'Soap', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'HW-03', desc_en: 'Paper towel dispensers functional and stocked', desc_ar: 'موزعات المناشف الورقية تعمل ومجهزة', category: 'Towels', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'HW-04', desc_en: 'Lidded waste bins provided in all areas', desc_ar: 'صناديق النفايات المغطاة متوفرة في جميع المناطق', category: 'Waste Bins', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'HW-05', desc_en: 'Waste bags used in all bins', desc_ar: 'أكياس النفايات مستخدمة في جميع الصناديق', category: 'Bags', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'HW-06', desc_en: 'Regular waste disposal schedule maintained', desc_ar: 'جدول التخلص من النفايات منتظم ومحفوظ', category: 'Disposal', evidenceType: 'Document', aiFeasibility: 'Low' },
  ],

  worker_requirements: [
    { code: 'WR-01', desc_en: 'Complete staff register with names and roles', desc_ar: 'سجل الموظفين الكامل بالأسماء والأدوار', category: 'Register', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'WR-02', desc_en: 'Medical fitness certificates for all workers', desc_ar: 'شهادات اللياقة الطبية لجميع العمال', category: 'Medical', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'WR-03', desc_en: 'Medical certificates renewed periodically', desc_ar: 'الشهادات الطبية مجددة دوريًا', category: 'Renewal', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'WR-04', desc_en: 'Staff maintain proper hand hygiene practices', desc_ar: 'الموظفون يحافظون على ممارسات نظافة اليدين', category: 'Hygiene', evidenceType: 'Photo', aiFeasibility: 'Medium' },
    { code: 'WR-05', desc_en: 'No smoking in closed work areas', desc_ar: 'لا يُسمح بالتدخين في مناطق العمل المغلقة', category: 'No Smoking', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'WR-06', desc_en: 'Staff files maintained with complete documentation', desc_ar: 'ملفات الموظفين محفوظة بالوثائق الكاملة', category: 'Files', evidenceType: 'Document', aiFeasibility: 'Low' },
  ],

  labeling_licensing: [
    { code: 'LL-01', desc_en: 'Trade name displayed on front facade', desc_ar: 'الاسم التجاري معروض على الواجهة الأمامية', category: 'Signage', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'LL-02', desc_en: 'Registration number visible on facade', desc_ar: 'رقم التسجيل مرئي على الواجهة', category: 'Registration', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'LL-03', desc_en: 'Health registration certificate displayed prominently', desc_ar: 'شهادة التسجيل الصحي معروضة بشكل بارز', category: 'Certificate', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'LL-04', desc_en: 'All licenses current and valid', desc_ar: 'جميع التراخيص حالية وصالحة', category: 'Validity', evidenceType: 'Document', aiFeasibility: 'Medium' },
  ],

  storage_temperature: [
    { code: 'ST-01', desc_en: 'Dry storage areas equipped with thermometers', desc_ar: 'مناطق التخزين الجاف مزودة بثرمومترات', category: 'Dry Storage', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'ST-02', desc_en: 'Chilled storage maintains proper temperature', desc_ar: 'التخزين المبرد يحافظ على درجة الحرارة المناسبة', category: 'Chilled', evidenceType: 'Photo', aiFeasibility: 'Medium' },
    { code: 'ST-03', desc_en: 'Frozen storage with functional thermometers', desc_ar: 'التخزين المجمد مع ثرمومترات فعالة', category: 'Frozen', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'ST-04', desc_en: 'Transport vehicles equipped with thermometers', desc_ar: 'مركبات النقل مزودة بثرمومترات', category: 'Transport', evidenceType: 'Photo', aiFeasibility: 'Medium' },
    { code: 'ST-05', desc_en: 'Cold-chain temperature ranges documented', desc_ar: 'نطاقات درجات حرارة سلسلة التبريد موثقة', category: 'Documentation', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'ST-06', desc_en: 'Temperature monitoring logs maintained', desc_ar: 'سجلات مراقبة الحرارة محفوظة', category: 'Logs', evidenceType: 'Document', aiFeasibility: 'Low' },
  ],

  commercial_registration: [
    { code: 'CR-01', desc_en: 'Valid Commercial Registration (CR) certificate', desc_ar: 'شهادة السجل التجاري (CR) صالحة', category: 'CR Certificate', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'CR-02', desc_en: 'CR details match business activity', desc_ar: 'تفاصيل السجل التجاري تطابق نشاط العمل', category: 'Activity Match', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'CR-03', desc_en: 'MOH approval attached to CR', desc_ar: 'موافقة وزارة الصحة مرفقة بالسجل التجاري', category: 'MOH Approval', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'CR-04', desc_en: 'Municipality approval attached', desc_ar: 'موافقة البلدية مرفقة', category: 'Municipality', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'CR-05', desc_en: 'Civil Defense approval attached', desc_ar: 'موافقة الدفاع المدني مرفقة', category: 'Civil Defense', evidenceType: 'Document', aiFeasibility: 'Low' },
  ],

  municipality_premises: [
    { code: 'MP-01', desc_en: 'Shop license valid and displayed', desc_ar: 'ترخيص المحل صالح ومعروض', category: 'License', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'MP-02', desc_en: 'Adequate toilet facilities for staff', desc_ar: 'مرافق المراحيض كافية للموظفين', category: 'Toilets', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'MP-03', desc_en: 'Proper drainage system in place', desc_ar: 'نظام صرف صحي مناسب موجود', category: 'Drainage', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'MP-04', desc_en: 'Designated waste collection area', desc_ar: 'منطقة جمع النفايات المخصصة', category: 'Waste Area', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'MP-05', desc_en: 'Rental/tenancy documents available', desc_ar: 'مستندات الإيجار/الإيجار متوفرة', category: 'Tenancy', evidenceType: 'Document', aiFeasibility: 'Low' },
  ],

  fire_safety: [
    { code: 'FS-01', desc_en: 'Fire extinguishers properly placed and accessible', desc_ar: 'طفايات الحريق موضوعة بشكل صحيح ويمكن الوصول إليها', category: 'Extinguishers', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'FS-02', desc_en: 'Fire extinguishers inspected and certified', desc_ar: 'طفايات الحريق مفحوصة ومعتمدة', category: 'Certification', evidenceType: 'QR/Barcode', aiFeasibility: 'Medium' },
    { code: 'FS-03', desc_en: 'Emergency exit signage clearly visible', desc_ar: 'لافتات المخارج الطارئة مرئية بوضوح', category: 'Exit Signs', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'FS-04', desc_en: 'Emergency lighting functional', desc_ar: 'الإضاءة الطارئة تعمل', category: 'Emergency Lighting', evidenceType: 'Photo', aiFeasibility: 'Medium' },
    { code: 'FS-05', desc_en: 'Fire alarm panel operational', desc_ar: 'لوحة إنذار الحريق تعمل', category: 'Alarm', evidenceType: 'Photo', aiFeasibility: 'Medium' },
    { code: 'FS-06', desc_en: 'Evacuation routes clearly marked', desc_ar: 'مسارات الإخلاء محددة بوضوح', category: 'Evacuation', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'FS-07', desc_en: 'Civil Defense approval certificate available', desc_ar: 'شهادة موافقة الدفاع المدني متوفرة', category: 'Approval', evidenceType: 'Document', aiFeasibility: 'Low' },
  ],

  healthcare_nhra: [
    { code: 'HC-01', desc_en: 'Valid NHRA healthcare facility license', desc_ar: 'ترخيص منشأة رعاية صحية NHRA صالح', category: 'License', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'HC-02', desc_en: 'Staff credentials and certifications current', desc_ar: 'بيانات اعتماد الموظفين والشهادات حالية', category: 'Credentials', evidenceType: 'Document', aiFeasibility: 'Low' },
    { code: 'HC-03', desc_en: 'Infection control protocols visible', desc_ar: 'بروتوكولات مكافحة العدوى مرئية', category: 'Infection Control', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'HC-04', desc_en: 'Hand hygiene signage posted', desc_ar: 'لافتات نظافة اليدين معلقة', category: 'Signage', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'HC-05', desc_en: 'Proper storage of medical supplies', desc_ar: 'التخزين المناسب للإمدادات الطبية', category: 'Storage', evidenceType: 'Photo', aiFeasibility: 'High' },
    { code: 'HC-06', desc_en: 'Facility meets NHRA design standards', desc_ar: 'المنشأة تلبي معايير تصميم NHRA', category: 'Standards', evidenceType: 'Document', aiFeasibility: 'Low' },
  ],
};

const IconComponent = ({ type, className, style }: any) => {
  const icons: any = { 
    clipboard: ClipboardList, 
    shield: ClipboardList,
    building: Building, 
    droplets: Droplets, 
    wrench: Wrench, 
    utensils: Utensils, 
    users: Users, 
    flame: Flame,
    home: Home,
    filetext: FileText,
  };
  const Icon = icons[type] || ClipboardList;
  return <Icon className={className} style={style} />;
};

// Falcon Background Component (Reusable)
const FalconBackground = () => (
  <div 
    className="absolute inset-0 z-0"
    style={{
      backgroundImage: 'url(/falcon-eye.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'right center',
      backgroundRepeat: 'no-repeat',
    }}
  >
    <div 
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.9) 100%)',
      }}
    />
  </div>
);

const CountryLanguageSelection = ({ onSelect }: any) => {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

  const handleContinue = () => {
    if (selectedCountry && selectedLanguage) {
      onSelect({ country: selectedCountry, language: selectedLanguage });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      <FalconBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="border-b border-zinc-800 px-8 py-6 bg-black/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-4">
                <h1 className="text-3xl font-bold tracking-tight">Saqr</h1>
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500/50">
                  <Image src="/falcon-eye-zoom.jpg" alt="Saqr Eye" width={48} height={48} className="object-cover" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">صقر</h1>
              </div>
              <p className="text-sm text-zinc-400 mt-1">GCC Compliance Platform • saqr.ai</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-16">
          <div className="max-w-2xl w-full space-y-12">
            <div className="text-center space-y-6 pb-8 border-b border-zinc-800">
              <div className="space-y-3" dir="rtl">
                <h2 className="text-2xl font-bold text-zinc-100">عمليات تفتيش امتثال تنظيمية مدعومة بالذكاء الاصطناعي</h2>
                <p className="text-sm text-zinc-300 leading-relaxed max-w-xl mx-auto">
                  يستخدم صقر تقنية الرؤية بالذكاء الاصطناعي المتقدمة لأتمتة عمليات تفتيش الامتثال في دول مجلس التعاون الخليجي. التقط الأدلة بكاميرتك، وسيتحقق الذكاء الاصطناعي من المتطلبات بمعالجة فورية مقابل المعايير التنظيمية الرسمية.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-zinc-100">AI-Powered Regulatory Compliance Inspections</h2>
                <p className="text-sm text-zinc-300 leading-relaxed max-w-xl mx-auto">
                  Saqr uses advanced AI vision technology to automate compliance inspections across GCC countries. Capture evidence with your camera, and our AI validates requirements with instant processing against official regulatory standards.
                </p>
              </div>

              <div className="pt-4 space-y-2">
                <p className="text-xs text-zinc-400 italic" dir="rtl">
                  إخلاء المسؤولية: يوفر صقر تحليل الامتثال بمساعدة الذكاء الاصطناعي لأغراض إعلامية. تخضع تحديدات الامتثال النهائية لمراجعة السلطة التنظيمية الرسمية.
                </p>
                <p className="text-xs text-zinc-400 italic">
                  Disclaimer: Saqr provides AI-assisted compliance analysis for informational purposes. Final compliance determinations are subject to official regulatory authority review.
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-6">
                <Globe className="w-6 h-6 text-blue-400" />
                <div>
                  <h2 className="text-2xl font-bold">Select Country</h2>
                  <p className="text-sm text-zinc-400">اختر الدولة</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {COUNTRIES.map(country => (
                  <button
                    key={country.code}
                    onClick={() => setSelectedCountry(country.code)}
                    className={`p-4 border-2 transition-all rounded-lg backdrop-blur-sm ${
                      selectedCountry === country.code
                        ? 'border-blue-500 bg-blue-950/40'
                        : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900/80'
                    }`}
                  >
                    <div className="text-2xl mb-2">{country.flag}</div>
                    <div className="text-sm font-semibold">{country.name_en}</div>
                    <div className="text-xs text-zinc-400" style={{ direction: 'rtl' }}>{country.name_ar}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-6 h-6 text-green-400" />
                <div>
                  <h2 className="text-2xl font-bold">Select Language</h2>
                  <p className="text-sm text-zinc-400">اختر اللغة</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setSelectedLanguage(lang.code)}
                    className={`p-6 border-2 transition-all rounded-lg backdrop-blur-sm ${
                      selectedLanguage === lang.code
                        ? 'border-green-500 bg-green-950/40'
                        : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900/80'
                    }`}
                  >
                    <div className="text-lg font-semibold mb-1">{lang.native}</div>
                    <div className="text-xs text-zinc-400">{lang.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleContinue}
              disabled={!selectedCountry || !selectedLanguage}
              className={`w-full py-4 text-lg font-semibold transition-all rounded-lg flex items-center justify-center gap-3 ${
                selectedCountry && selectedLanguage
                  ? 'bg-white text-black hover:bg-zinc-200'
                  : 'bg-zinc-800/60 text-zinc-500 cursor-not-allowed'
              }`}
            >
              Start Inspection
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="border-t border-zinc-800 px-8 py-6 bg-black/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto text-center space-y-2">
            <div className="text-xs text-zinc-500">
              Saqr v{VERSION} • AI-Powered Compliance • saqr.ai
            </div>
            <div className="text-xs text-zinc-600">
              © 2026 Saqr. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InspectionTypeSelection = ({ country, language, onSelect, onBack }: any) => {
  const inspectionTypes = country === 'SA' ? INSPECTION_TYPES_SA : INSPECTION_TYPES_BH;
  const t = TRANSLATIONS[language as 'en' | 'ar'];
  const isRTL = language === 'ar';

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <FalconBackground />
      
      <div className="relative z-10">
        <div className="border-b border-zinc-800 px-8 py-6 bg-black/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-500/50">
                <Image src="/falcon-eye-zoom.jpg" alt="Saqr" width={32} height={32} className="object-cover" />
              </div>
              <h1 className="text-xl font-bold">Saqr</h1>
            </div>
            <button onClick={onBack} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
              <ChevronRight className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
              {t.back}
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-8 py-16">
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-2">{t.selectCategory}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {inspectionTypes.map((type: any) => (
              <button key={type.id} onClick={() => onSelect(type)} className="border border-zinc-700 hover:border-zinc-600 bg-zinc-900/60 backdrop-blur-sm p-8 text-left group transition-all rounded-lg">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 flex items-center justify-center rounded" style={{ backgroundColor: type.color + '20' }}>
                    <IconComponent type={type.icon} className="w-6 h-6" style={{ color: type.color }} />
                  </div>
                  <ChevronRight className={`w-5 h-5 text-zinc-700 group-hover:text-zinc-400 transition-all ${isRTL ? 'rotate-180' : ''}`} />
                </div>
                <h3 className="text-xl font-semibold mb-3">{language === 'en' ? type.name_en : type.name_ar}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-2">{language === 'en' ? type.description_en : type.description_ar}</p>
                <p className="text-xs text-blue-400">{t.source} {type.source}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-zinc-800 px-8 py-6 bg-black/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto text-center text-xs text-zinc-600">
            Saqr v{VERSION}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChecklistScreen = ({ inspectionType, language, onComplete, onBack }: any) => {
  const checklist = CHECKLISTS[inspectionType.id] || [];
  const [items, setItems] = useState(checklist.map((item: any) => ({ ...item, status: null, notes: '', aiAnalysis: null, photo: null, document: null })));
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiGuidance, setAiGuidance] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const t = TRANSLATIONS[language as 'en' | 'ar'];
  const isRTL = language === 'ar';

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>, itemIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const item = items[itemIndex];
    setAnalyzing(true);
    const displayText = language === 'en' ? item.desc_en : item.desc_ar;
    setAiGuidance(`🤖 ${t.aiAnalyzing} ${displayText}`);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target?.result as string;
        const base64Data = base64Image.split(',')[1];

        const newItems = [...items];
        newItems[itemIndex] = { ...newItems[itemIndex], photo: base64Image };
        setItems(newItems);

        // Only AI analyze if feasibility is Medium or High
        if (item.aiFeasibility === 'Low') {
          setAiGuidance(`📄 Document uploaded. Manual review required.`);
          setAnalyzing(false);
          return;
        }

        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Data,
            checklistItem: {
              code: item.code,
              description: item.desc_en,
              category: item.category
            },
            language: language
          })
        });

        const result = await response.json();

        if (result.error) {
          setAiGuidance(`❌ ${result.error}`);
          setAnalyzing(false);
          return;
        }

        const updatedItems = [...items];
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          status: result.status,
          notes: result.reasoning,
          aiAnalysis: result,
          photo: base64Image
        };
        setItems(updatedItems);

        if (result.needsBetterView) {
          setAiGuidance(`📸 ${result.guidance || 'Please capture a clearer photo.'}`);
        } else if (result.status === 'pass') {
          setAiGuidance(`✅ ${t.pass}: ${result.reasoning}`);
          setTimeout(() => {
            if (itemIndex < items.length - 1) {
              setCurrentItemIndex(itemIndex + 1);
              const nextText = language === 'en' ? items[itemIndex + 1].desc_en : items[itemIndex + 1].desc_ar;
              setAiGuidance(`📍 ${nextText}`);
            } else {
              setAiGuidance('🎉');
            }
          }, 2000);
        } else {
          setAiGuidance(`❌ ${t.fail}: ${result.reasoning}`);
        }

        setAnalyzing(false);
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      setAiGuidance(`❌ ${error.message}`);
      setAnalyzing(false);
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>, itemIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Doc = event.target?.result as string;
      const newItems = [...items];
      newItems[itemIndex] = { ...newItems[itemIndex], document: base64Doc, status: 'pass', notes: `Document uploaded: ${file.name}` };
      setItems(newItems);
      setAiGuidance(`📄 Document "${file.name}" uploaded successfully.`);
    };
    reader.readAsDataURL(file);
  };

  const triggerPhotoCapture = (index: number) => {
    setCurrentItemIndex(index);
    fileInputRef.current?.click();
  };

  const triggerDocumentUpload = (index: number) => {
    setCurrentItemIndex(index);
    documentInputRef.current?.click();
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const completedCount = items.filter((item: any) => item.status !== null).length;
  const totalCount = items.length;
  const isComplete = completedCount === totalCount;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <FalconBackground />
      
      <div className="relative z-10">
        <div className="border-b border-zinc-800 px-8 py-6 sticky top-0 bg-black/50 backdrop-blur-sm z-10">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button onClick={onBack} className="text-zinc-400 hover:text-white transition-colors">
                  <ChevronRight className={`w-5 h-5 ${isRTL ? '' : 'rotate-180'}`} />
                </button>
                <IconComponent type={inspectionType.icon} className="w-6 h-6" style={{ color: inspectionType.color }} />
                <div>
                  <h1 className="text-xl font-bold">{language === 'en' ? inspectionType.name_en : inspectionType.name_ar}</h1>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{completedCount}/{totalCount}</div>
                <div className="text-xs text-zinc-500">{t.completed}</div>
              </div>
            </div>
            <div className="w-full bg-zinc-900 h-1">
              <div className="h-1 transition-all duration-300" style={{ width: `${(completedCount / totalCount) * 100}%`, backgroundColor: inspectionType.color }} />
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-8 py-8 pb-32">
          <div className="mb-8 bg-blue-950/20 border border-blue-900/30 p-6 rounded backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <Camera className="w-10 h-10 text-blue-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-300 mb-2">{t.aiAnalysis}</h3>
                <p className="text-sm text-zinc-400 mb-2">{t.capturePhotos} {t.source} {inspectionType.source}</p>
                {aiGuidance && (
                  <div className="mt-4 p-3 bg-black/50 border border-blue-500/30 rounded text-sm">
                    <div className="font-semibold mb-1">{t.aiGuidance}</div>
                    <div>{aiGuidance}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handlePhotoCapture(e, currentItemIndex)}
            style={{ display: 'none' }}
          />

          <input
            ref={documentInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={(e) => handleDocumentUpload(e, currentItemIndex)}
            style={{ display: 'none' }}
          />

          <div className="space-y-6">
            {items.map((item: any, index: number) => (
              <div 
                key={item.code} 
                className={`border p-6 transition-all rounded backdrop-blur-sm ${
                  index === currentItemIndex && analyzing
                    ? 'border-blue-500 bg-blue-950/20' 
                    : 'border-zinc-700 bg-zinc-900/60'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded">{item.code}</span>
                      <span className="text-xs text-zinc-600">{item.category}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        item.evidenceType === 'Photo' ? 'bg-blue-900/30 text-blue-400' :
                        item.evidenceType === 'Document' ? 'bg-purple-900/30 text-purple-400' :
                        item.evidenceType === 'QR/Barcode' ? 'bg-green-900/30 text-green-400' :
                        'bg-zinc-900/30 text-zinc-400'
                      }`}>
                        {item.evidenceType}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        item.aiFeasibility === 'High' ? 'bg-green-900/30 text-green-400' :
                        item.aiFeasibility === 'Medium' ? 'bg-yellow-900/30 text-yellow-400' :
                        'bg-red-900/30 text-red-400'
                      }`}>
                        AI: {item.aiFeasibility}
                      </span>
                      {item.aiAnalysis && (
                        <span className="text-xs text-blue-400">{t.aiVerified}</span>
                      )}
                    </div>
                    <p className="text-base mb-2 leading-relaxed">{language === 'en' ? item.desc_en : item.desc_ar}</p>
                  </div>
                </div>

                {item.photo && (
                  <div className="mb-4">
                    <img src={item.photo} alt="Evidence" className="w-full h-48 object-cover rounded border border-zinc-700" />
                  </div>
                )}

                {item.document && (
                  <div className="mb-4 p-3 bg-zinc-900 border border-zinc-700 rounded flex items-center gap-3">
                    <FileText className="w-5 h-5 text-purple-400" />
                    <span className="text-sm text-zinc-300">Document uploaded</span>
                  </div>
                )}

                <div className="flex gap-3 mb-4">
                  {item.evidenceType === 'Photo' || item.evidenceType === 'QR/Barcode' ? (
                    <button
                      onClick={() => triggerPhotoCapture(index)}
                      disabled={analyzing}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-6 py-3 font-semibold transition-colors flex items-center justify-center gap-2 rounded"
                    >
                      {analyzing && index === currentItemIndex ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          {t.aiAnalyzing}
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5" />
                          {item.photo ? t.retakePhoto : t.captureEvidence}
                        </>
                      )}
                    </button>
                  ) : null}

                  {item.evidenceType === 'Document' ? (
                    <button
                      onClick={() => triggerDocumentUpload(index)}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 font-semibold transition-colors flex items-center justify-center gap-2 rounded"
                    >
                      <Upload className="w-5 h-5" />
                      {t.uploadDocument}
                    </button>
                  ) : null}
                </div>

                <div className="flex gap-3 mb-4">
                  <button onClick={() => updateItem(index, 'status', 'pass')} className={`flex-1 py-3 px-4 font-semibold transition-all flex items-center justify-center gap-2 rounded ${item.status === 'pass' ? 'bg-green-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
                    <Check className="w-4 h-4" />
                    {t.pass}
                  </button>
                  <button onClick={() => updateItem(index, 'status', 'fail')} className={`flex-1 py-3 px-4 font-semibold transition-all flex items-center justify-center gap-2 rounded ${item.status === 'fail' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}>
                    <X className="w-4 h-4" />
                    {t.fail}
                  </button>
                </div>

                <textarea 
                  value={item.notes} 
                  onChange={(e) => updateItem(index, 'notes', e.target.value)} 
                  placeholder={t.notesPlaceholder}
                  className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700 rounded" 
                  rows={3} 
                />
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm border-t border-zinc-800 px-8 py-6 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="text-sm text-zinc-400">
              {isComplete ? (
                <span className="text-green-500 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {t.allCompleted}
                </span>
              ) : (
                <span>{totalCount - completedCount} {t.remaining}</span>
              )}
            </div>
            <button onClick={() => isComplete && onComplete(items)} disabled={!isComplete} className={`px-8 py-3 font-semibold transition-all rounded ${isComplete ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}>
              {t.generateReport}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryScreen = ({ inspectionType, items, language, onRestart }: any) => {
  const totalItems = items.length;
  const passedItems = items.filter((item: any) => item.status === 'pass').length;
  const failedItems = items.filter((item: any) => item.status === 'fail').length;
  const passRate = ((passedItems / totalItems) * 100).toFixed(0);
  const t = TRANSLATIONS[language as 'en' | 'ar'];
  const isRTL = language === 'ar';

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <FalconBackground />
      
      <div className="relative z-10">
        <div className="border-b border-zinc-800 px-8 py-6 bg-black/50 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-500/50">
              <Image src="/falcon-eye-zoom.jpg" alt="Saqr" width={32} height={32} className="object-cover" />
            </div>
            <h1 className="text-xl font-bold">Saqr</h1>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-8 py-16">
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-2">{t.complianceReport}</h2>
            <p className="text-sm text-zinc-400 mt-2">{language === 'en' ? inspectionType.name_en : inspectionType.name_ar}</p>
            <p className="text-xs text-blue-400 mt-1">{t.source} {inspectionType.source}</p>
          </div>
          <div className="grid grid-cols-4 gap-6 mb-12">
            <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-700 p-6 rounded">
              <div className="text-3xl font-bold mb-1">{totalItems}</div>
              <div className="text-xs text-zinc-500">{t.total}</div>
            </div>
            <div className="bg-zinc-900/60 backdrop-blur-sm border border-green-900/30 p-6 rounded">
              <div className="text-3xl font-bold mb-1 text-green-500">{passedItems}</div>
              <div className="text-xs text-zinc-500">{t.passed}</div>
            </div>
            <div className="bg-zinc-900/60 backdrop-blur-sm border border-red-900/30 p-6 rounded">
              <div className="text-3xl font-bold mb-1 text-red-500">{failedItems}</div>
              <div className="text-xs text-zinc-500">{t.failed}</div>
            </div>
            <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-700 p-6 rounded">
              <div className="text-3xl font-bold mb-1">{passRate}%</div>
              <div className="text-xs text-zinc-500">{t.passRate}</div>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {items.filter((item: any) => item.photo || item.document).map((item: any) => (
              <div key={item.code} className="border border-zinc-700 bg-zinc-900/60 backdrop-blur-sm p-4 rounded">
                <div className="flex gap-4">
                  {item.photo && <img src={item.photo} alt={item.code} className="w-32 h-32 object-cover rounded" />}
                  {item.document && (
                    <div className="w-32 h-32 flex items-center justify-center bg-zinc-800 rounded border border-zinc-700">
                      <FileText className="w-12 h-12 text-purple-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-mono bg-zinc-900 px-2 py-1 rounded">{item.code}</span>
                      <span className={`text-xs px-2 py-1 rounded ${item.status === 'pass' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {item.status === 'pass' ? `✓ ${t.pass}` : `✗ ${t.fail}`}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 mb-2">{language === 'en' ? item.desc_en : item.desc_ar}</p>
                    <p className="text-xs text-zinc-400">{item.notes}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={onRestart} className="w-full bg-white text-black px-8 py-4 font-semibold hover:bg-zinc-200 transition-colors rounded">
            {t.startNew}
          </button>
        </div>
        <div className="border-t border-zinc-800 px-8 py-6 bg-black/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto text-center text-xs text-zinc-600">
            Saqr v{VERSION}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function SaggerApp() {
  const [screen, setScreen] = useState('country');
  const [country, setCountry] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);

  const handleCountryLanguageSelect = ({ country: c, language: l }: any) => {
    setCountry(c);
    setLanguage(l);
    setScreen('select');
  };

  return (
    <div>
      {screen === 'country' && <CountryLanguageSelection onSelect={handleCountryLanguageSelect} />}
      {screen === 'select' && country && language && <InspectionTypeSelection country={country} language={language} onSelect={(type: any) => { setSelectedType(type); setScreen('checklist'); }} onBack={() => setScreen('country')} />}
      {screen === 'checklist' && selectedType && language && <ChecklistScreen inspectionType={selectedType} language={language} onComplete={(items: any) => { setChecklistItems(items); setScreen('summary'); }} onBack={() => setScreen('select')} />}
      {screen === 'summary' && selectedType && language && <SummaryScreen inspectionType={selectedType} items={checklistItems} language={language} onRestart={() => { setSelectedType(null); setChecklistItems([]); setScreen('country'); }} />}
    </div>
  );
}