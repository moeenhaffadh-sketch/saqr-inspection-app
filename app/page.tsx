// LOCKED v0.1.0 - Do not modify without approval
// Landing page with country selection
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Camera,
  Video,
  Settings,
  FileCheck,
  ChevronRight,
  Globe,
  Loader2,
  Building2,
  Play,
  ClipboardCheck
} from "lucide-react";

const VERSION = '0.1.0';

const GCC_COUNTRIES = [
  { code: "BH", name: "Bahrain", nameAr: "البحرين", flag: "🇧🇭" },
  { code: "SA", name: "Saudi Arabia", nameAr: "السعودية", flag: "🇸🇦" },
  { code: "AE", name: "UAE", nameAr: "الإمارات", flag: "🇦🇪" },
  { code: "QA", name: "Qatar", nameAr: "قطر", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", nameAr: "الكويت", flag: "🇰🇼" },
  { code: "OM", name: "Oman", nameAr: "عمان", flag: "🇴🇲" },
];

export default function LandingPage() {
  const [selectedCountry, setSelectedCountry] = useState("BH");
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("saqr_selected_country");
    if (saved && GCC_COUNTRIES.some(c => c.code === saved)) {
      setSelectedCountry(saved);
    }
  }, []);

  const handleCountrySelect = (code: string) => {
    setSelectedCountry(code);
    localStorage.setItem("saqr_selected_country", code);
  };

  const handleLaunch = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (isLaunching) return; // Prevent double-click

    const href = e.currentTarget.href;
    setIsLaunching(true);

    // Play launch sound
    const audio = new Audio('/saqr-launch.mp3');
    audio.volume = 0.7;

    // Navigate when sound ends
    audio.onended = () => {
      window.location.href = href;
    };

    // Fallback: navigate after 2.5 seconds if sound doesn't end
    const fallbackTimeout = setTimeout(() => {
      window.location.href = href;
    }, 2500);

    audio.play().catch(() => {
      // Audio play failed (autoplay policy), navigate immediately
      clearTimeout(fallbackTimeout);
      window.location.href = href;
    });
  };

  const selectedCountryData = GCC_COUNTRIES.find(c => c.code === selectedCountry);

  return (
    <div className="min-h-screen text-white relative">
      {/* Hero Background Image */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: 'url(/hero-falcon.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/75" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 bg-black/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">Saqr</span>
              <Image
                src="/landing-falcon.png"
                alt="Saqr"
                width={36}
                height={36}
                priority
                unoptimized
              />
              <span className="text-xl font-bold text-white">صقر</span>
            </div>
            <p className="text-xs text-zinc-500">GCC Compliance Platform</p>
          </div>
          <Link
            href={`/inspect?country=${selectedCountry}`}
            onClick={handleLaunch}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1 text-sm ${
              isLaunching
                ? "bg-amber-500 text-black cursor-wait"
                : "bg-white text-black hover:bg-zinc-200"
            }`}
          >
            {isLaunching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Launching...</span>
              </>
            ) : (
              <>
                <span>Launch</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Link>
        </div>
      </header>

      {/* Main Content - Single Column Layout */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* 1. Hero Section */}
        <section className="space-y-6">
          {/* English */}
          <div className="space-y-4">
            <h2 className="text-4xl md:text-6xl font-bold text-zinc-100 leading-tight">
              Smart AI Inspection Platform
            </h2>
            <div className="text-lg md:text-xl text-zinc-400 space-y-4 leading-relaxed">
              <p>
                Saqr (صقر), meaning "Falcon" in Arabic, represents precision, sharp vision, and authority — the core principles behind this platform.
              </p>
              <p>
                The Smart AI Inspection Platform is a next-generation digital solution designed to modernise regulatory inspection and oversight across all sectors governed by national laws and regulations. Powered by an advanced Artificial Intelligence agent, the platform delivers a single, unified inspection framework applicable to all businesses and entities that require regulatory inspection and compliance.
              </p>
              <p>
                The platform is designed for use across multiple regulatory domains, including government authorities such as the Ministry of Health, Municipalities and local regulatory bodies, Civil Defense, and other public sector regulators, as well as private sector entities operating under national laws and regulatory requirements. The platform is built to support any business or organisation subject to inspection, regardless of sector.
              </p>
              <p>
                By leveraging AI-driven inspections, the platform significantly increases inspection coverage and frequency while ensuring consistency, accuracy, and objectivity. Potential risks and compliance gaps are detected early, enabling timely intervention and proactive risk management.
              </p>
              <p>
                Beyond inspection execution, the platform generates high-quality, structured data that can be analysed in real time. This enables decision-makers to base actions on evidence rather than assumptions, transforming inspections into a data-driven process. With data as the core driver of decisions, institutions can prioritise effectively, optimise resource allocation, overcome time and manpower constraints, eliminate duplicate work, and achieve faster, higher-impact regulatory outcomes.
              </p>
              <p>
                Saqr is built with Machine Learning at its core. Every inspection conducted trains and improves the platform's AI models, enabling continuous learning, smarter detection, and increasingly accurate compliance assessments. Over time, Saqr develops authority-specific and sector-specific intelligence, evolving from a tool into an expert system that gets sharper with every use — just like the falcon it is named after.
              </p>
              <p className="text-amber-400 font-medium">
                The Smart AI Inspection Platform turns inspection into intelligence — delivering efficiency, insight, and confidence through one integrated, AI-powered ecosystem.
              </p>
            </div>
          </div>

          {/* Arabic */}
          <div className="space-y-4 border-t border-zinc-800 pt-6" dir="rtl">
            <h2 className="text-4xl md:text-6xl font-bold text-zinc-100 leading-tight">
              منصة التفتيش الذكي
            </h2>
            <div className="text-lg md:text-xl text-zinc-400 space-y-4 leading-relaxed">
              <p>
                ان الصقر رمز الدقة والرؤية الحادة والسلطة — وهي المبادئ الأساسية التي بُنيت عليها هذه المنصة
              </p>
              <p>
                منصة التفتيش الذكي هي حل رقمي من الجيل الجديد، مصمم لتحديث عمليات التفتيش والرقابة التنظيمية في جميع القطاعات الخاضعة للقوانين واللوائح الوطنية. تعمل المنصة بتقنية الذكاء الاصطناعي المتقدم، وتوفر إطار تفتيش موحد ومتكامل ينطبق على جميع المنشآت والجهات التي تتطلب التفتيش التنظيمي والامتثال.
              </p>
              <p>
                صُممت المنصة للاستخدام في مجالات رقابية متعددة، بما في ذلك الجهات الحكومية مثل وزارة الصحة، والبلديات والهيئات الرقابية المحلية، والدفاع المدني، وغيرها من الجهات الرقابية في القطاع العام، بالإضافة إلى منشآت القطاع الخاص العاملة وفق القوانين والمتطلبات التنظيمية الوطنية. المنصة مصممة لدعم أي منشأة أو جهة خاضعة للتفتيش، بغض النظر عن القطاع.
              </p>
              <p>
                من خلال الاستفادة من التفتيش المدعوم بالذكاء الاصطناعي، تزيد المنصة بشكل كبير من نطاق التفتيش وتكراره، مع ضمان الاتساق والدقة والموضوعية. يتم اكتشاف المخاطر المحتملة وثغرات الامتثال مبكراً، مما يتيح التدخل في الوقت المناسب وإدارة المخاطر بشكل استباقي.
              </p>
              <p>
                إلى جانب تنفيذ التفتيش، تُنتج المنصة بيانات عالية الجودة ومنظمة يمكن تحليلها في الوقت الفعلي. يمكّن ذلك صناع القرار من اتخاذ إجراءات مبنية على الأدلة بدلاً من الافتراضات، محولاً عمليات التفتيش إلى عملية قائمة على البيانات. مع البيانات كمحرك أساسي للقرارات، يمكن للمؤسسات تحديد الأولويات بفعالية، وتحسين تخصيص الموارد، والتغلب على قيود الوقت والقوى العاملة، والقضاء على العمل المكرر، وتحقيق نتائج تنظيمية أسرع وأعلى تأثيراً.
              </p>
              <p>
                بُنيت منصة صقر بتقنية التعلم الآلي في صميمها. كل عملية تفتيش تُجرى تُدرّب وتُحسّن نماذج الذكاء الاصطناعي في المنصة، مما يتيح التعلم المستمر والكشف الأذكى وتقييمات امتثال أكثر دقة. مع مرور الوقت، تطور منصة صقر ذكاءً متخصصاً حسب الجهة الرقابية والقطاع، متحولة من أداة إلى نظام خبير يزداد حدة مع كل استخدام — تماماً كالصقر الذي سُميت باسمه.
              </p>
              <p className="text-amber-400 font-medium">
                منصة التفتيش الذكي تحوّل التفتيش إلى ذكاء — تقدم الكفاءة والرؤية والثقة من خلال منظومة واحدة متكاملة مدعومة بالذكاء الاصطناعي.
              </p>
            </div>
          </div>
        </section>

        {/* 2. How It Works */}
        <section className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4 text-amber-400">How It Works</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold">Select Country</h4>
                <p className="text-sm text-zinc-400">Choose your GCC country</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold">Choose Authority</h4>
                <p className="text-sm text-zinc-400">Select regulatory authority and inspection category</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center">
                <Play className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold">Start AI Inspection</h4>
                <p className="text-sm text-zinc-400">Capture photos for instant AI-powered analysis</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold">Get Results & Report</h4>
                <p className="text-sm text-zinc-400">Receive professional compliance report with evidence</p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Select Country */}
        <section className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-amber-400 inline-flex items-center gap-1"><span>Select Country</span><span className="font-normal">|</span><span>اختر الدولة</span></h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {GCC_COUNTRIES.map((country) => (
              <button
                key={country.code}
                onClick={() => handleCountrySelect(country.code)}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  selectedCountry === country.code
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-zinc-700 hover:border-zinc-600 bg-zinc-800/50"
                }`}
              >
                <div className="text-2xl mb-1">{country.flag}</div>
                <div className="text-xs font-medium">{country.name}</div>
                <div className="text-xs">{country.nameAr}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 4. Action Buttons */}
        <section className="space-y-3">
          {/* Start Inspection - Primary */}
          <Link
            href={`/inspect?country=${selectedCountry}`}
            onClick={handleLaunch}
            className={`block w-full px-6 py-4 rounded-lg font-bold transition-all shadow-lg text-center ${
              isLaunching
                ? "bg-amber-600 text-black cursor-wait"
                : "bg-gradient-to-r from-amber-500 to-orange-600 text-black hover:from-amber-400 hover:to-orange-500"
            }`}
          >
            {isLaunching ? (
              <>
                <Loader2 className="w-6 h-6 mx-auto mb-1 animate-spin" />
                <div>Launching Saqr...</div>
                <div className="text-xs opacity-75">جاري التشغيل</div>
              </>
            ) : (
              <>
                <Camera className="w-6 h-6 mx-auto mb-1" />
                <div>Start Inspection</div>
                <div className="text-xs opacity-75">
                  {selectedCountryData?.flag} {selectedCountryData?.name}
                </div>
              </>
            )}
          </Link>

          <div className="grid grid-cols-2 gap-3">
            {/* Remote Inspection */}
            <Link
              href="/remote"
              className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-4 py-4 rounded-lg font-bold hover:from-blue-400 hover:to-cyan-500 transition-all shadow-lg text-center"
            >
              <Video className="w-5 h-5 mx-auto mb-1" />
              <div className="text-sm">Remote</div>
              <div className="text-xs opacity-75">تفتيش عن بُعد</div>
            </Link>

            {/* Admin Portal */}
            <Link
              href="/admin"
              className="bg-zinc-800 text-white px-4 py-4 rounded-lg font-bold hover:bg-zinc-700 transition-all border border-zinc-700 text-center"
            >
              <Settings className="w-5 h-5 mx-auto mb-1" />
              <div className="text-sm">Admin</div>
              <div className="text-xs opacity-75">لوحة الإدارة</div>
            </Link>
          </div>
        </section>
      </main>

      {/* 5. Footer */}
      <footer className="border-t border-zinc-800 px-6 py-6 mt-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Disclaimer */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold text-amber-400">Disclaimer</h4>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed" dir="rtl">
              إخلاء المسؤولية: يوفر صقر تحليل الامتثال بمساعدة الذكاء الاصطناعي لأغراض إعلامية.
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Saqr provides AI-assisted compliance analysis for informational purposes. Final compliance determinations are subject to official regulatory authority review.
            </p>
          </div>

          {/* Copyright */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-zinc-600">
            <div>© 2026 Saqr. All rights reserved.</div>
            <div className="flex items-center gap-3">
              <span>Saqr v{VERSION}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-600" />
              <span>saqr.ai</span>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
