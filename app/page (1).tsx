import Link from "next/link";
import Image from "next/image";

const VERSION = '0.0.0';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Falcon Eye Hero Background */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(/hero-falcon.jpg)',
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

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-zinc-800 px-8 py-6 bg-black/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500/50">
                <Image src="/falcon-eye-zoom.jpg" alt="Saqr" width={48} height={48} className="object-cover" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">Saqr</h1>
                  <h1 className="text-2xl font-bold">صقر</h1>
                </div>
                <p className="text-xs text-zinc-500">GCC Compliance Platform • saqr.ai</p>
              </div>
            </div>
            <Link
              href="/app"
              className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-zinc-200 transition-colors flex items-center gap-2"
            >
              <span>Launch App</span>
              <span className="text-sm">→</span>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center">
          <div className="max-w-7xl mx-auto px-8 py-20 grid md:grid-cols-2 gap-16 items-center">
            {/* Left Column - Hero Text */}
            <div className="space-y-8">
              {/* Arabic First */}
              <div className="space-y-4" dir="rtl">
                <h2 className="text-4xl md:text-5xl font-bold text-zinc-100 leading-tight">
                  عمليات تفتيش امتثال تنظيمية مدعومة بالذكاء الاصطناعي
                </h2>
                <p className="text-lg text-zinc-300 leading-relaxed">
                  يستخدم صقر تقنية الرؤية بالذكاء الاصطناعي المتقدمة لأتمتة عمليات تفتيش الامتثال في دول مجلس التعاون الخليجي.
                </p>
              </div>

              {/* English */}
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold text-zinc-100 leading-tight">
                  AI-Powered Regulatory Compliance Inspections
                </h2>
                <p className="text-lg text-zinc-300 leading-relaxed">
                  Saqr uses advanced AI vision technology to automate compliance inspections across GCC countries.
                </p>
              </div>

              {/* CTA */}
              <Link
                href="/app"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-orange-600 text-black px-8 py-4 rounded-lg text-lg font-bold hover:from-amber-400 hover:to-orange-500 transition-all shadow-lg"
              >
                <span>Start Inspection</span>
                <span>→</span>
              </Link>
            </div>

            {/* Right Column - How It Works */}
            <div className="space-y-6">
              <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4 text-amber-400">How It Works</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center font-bold">1</div>
                    <div>
                      <h4 className="font-semibold mb-1">Select Country & Category</h4>
                      <p className="text-sm text-zinc-400">Choose from 6 GCC countries and inspection type</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center font-bold">2</div>
                    <div>
                      <h4 className="font-semibold mb-1">Capture Evidence</h4>
                      <p className="text-sm text-zinc-400">Take photos with your camera for instant AI analysis</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center font-bold">3</div>
                    <div>
                      <h4 className="font-semibold mb-1">AI Validation</h4>
                      <p className="text-sm text-zinc-400">Get instant compliance verification against official standards</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center font-bold">4</div>
                    <div>
                      <h4 className="font-semibold mb-1">Generate Report</h4>
                      <p className="text-sm text-zinc-400">Professional compliance reports with evidence</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coverage */}
              <div className="bg-blue-950/20 backdrop-blur-sm border border-blue-900/30 rounded-lg p-6">
                <h3 className="text-lg font-bold mb-3 text-blue-300">GCC Coverage</h3>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇧🇭</span>
                    <span>Bahrain</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇸🇦</span>
                    <span>Saudi Arabia</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇦🇪</span>
                    <span>UAE</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇶🇦</span>
                    <span>Qatar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇰🇼</span>
                    <span>Kuwait</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🇴🇲</span>
                    <span>Oman</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer with Disclaimer */}
        <footer className="border-t border-zinc-800 px-8 py-8 bg-black/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Disclaimer */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-6 space-y-3">
              <h4 className="text-sm font-bold text-amber-400">Disclaimer</h4>
              <p className="text-xs text-zinc-400 leading-relaxed" dir="rtl">
                إخلاء المسؤولية: يوفر صقر تحليل الامتثال بمساعدة الذكاء الاصطناعي لأغراض إعلامية. تخضع تحديدات الامتثال النهائية لمراجعة السلطة التنظيمية الرسمية.
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Saqr provides AI-assisted compliance analysis for informational purposes. Final compliance determinations are subject to official regulatory authority review.
              </p>
            </div>

            {/* Copyright */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-600">
              <div>
                © 2026 Saqr. All rights reserved.
              </div>
              <div className="flex items-center gap-6">
                <span>Saqr Web v{VERSION}</span>
                <span>•</span>
                <span>AI-Powered Compliance</span>
                <span>•</span>
                <span>saqr.ai</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}