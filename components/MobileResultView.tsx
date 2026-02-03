"use client";
import { useState, useEffect } from "react";
import { X, CheckCircle2, XCircle, RefreshCw, Check, MessageSquare, Loader2, Zap, Wrench } from "lucide-react";

interface MobileResultViewProps {
  spec: {
    id: string;
    code: string;
    requirement: string;
    requirementAr: string;
  };
  capturedImage: string;
  analysisResult: {
    result: "PASS" | "FAIL";
    confidence: number;
    finding: string;
    findingAr: string;
    recommendation?: string;
    recommendationAr?: string;
  } | null;
  isAnalyzing: boolean;
  error: string | null;
  onRetake: () => void;
  onAccept: (note?: string) => void;
  onClose: () => void;
}

// Progress steps for the analyzing animation
const ANALYSIS_STEPS = [
  { en: "Capturing evidence", ar: "التقاط الدليل", delay: 0 },
  { en: "Analyzing image", ar: "تحليل الصورة", delay: 500 },
  { en: "Checking compliance", ar: "التحقق من الامتثال", delay: 1000 },
  { en: "Generating report", ar: "إنشاء التقرير", delay: 1500 },
];

export default function MobileResultView({
  spec,
  capturedImage,
  analysisResult,
  isAnalyzing,
  error,
  onRetake,
  onAccept,
  onClose,
}: MobileResultViewProps) {
  const [showDispute, setShowDispute] = useState(false);
  const [disputeNote, setDisputeNote] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Animate through steps when analyzing
  useEffect(() => {
    if (!isAnalyzing) {
      setActiveStep(0);
      setCompletedSteps([]);
      return;
    }

    // Progress through steps
    const timers: NodeJS.Timeout[] = [];

    ANALYSIS_STEPS.forEach((step, index) => {
      // Show step
      timers.push(setTimeout(() => {
        setActiveStep(index);
      }, step.delay));

      // Complete step (except last one which stays active until done)
      if (index < ANALYSIS_STEPS.length - 1) {
        timers.push(setTimeout(() => {
          setCompletedSteps(prev => [...prev, index]);
        }, step.delay + 400));
      }
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [isAnalyzing]);

  // When analysis completes, mark all steps as done
  useEffect(() => {
    if (analysisResult && !isAnalyzing) {
      setCompletedSteps([0, 1, 2, 3]);
    }
  }, [analysisResult, isAnalyzing]);

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col"
      style={{
        zIndex: 9999,
        height: '100dvh',
      }}
    >
      {/* TOP STRIP */}
      <div
        className="flex items-center justify-between px-4 bg-black/90 backdrop-blur-sm border-b border-zinc-800 shrink-0"
        style={{
          height: '50px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center text-white touch-manipulation"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="bg-amber-500/20 px-4 py-1.5 rounded-full">
          <span className="text-amber-400 font-mono font-bold text-sm">{spec.code}</span>
        </div>

        <div className="w-10" />
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto relative">
        {/* ANALYZING STATE - Full screen overlay */}
        {isAnalyzing && (
          <>
            {/* Background: Blurred captured image */}
            <div className="absolute inset-0">
              <img
                src={capturedImage}
                alt="Analyzing"
                className="w-full h-full object-cover blur-sm scale-105"
              />
              <div className="absolute inset-0 bg-black/70" />
            </div>

            {/* Analyzing Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
              {/* Center Animation */}
              <div className="relative mb-8">
                {/* Pulsing glow */}
                <div className="absolute inset-0 -m-4 rounded-full bg-amber-500/20 animate-pulse" />
                <div className="absolute inset-0 -m-8 rounded-full bg-amber-500/10 animate-pulse" style={{ animationDelay: '0.5s' }} />

                {/* Rotating ring */}
                <div
                  className="absolute inset-0 -m-3 rounded-full border-2 border-transparent border-t-amber-500 border-r-amber-500/50"
                  style={{
                    animation: 'spin 1.5s linear infinite',
                  }}
                />
                <div
                  className="absolute inset-0 -m-5 rounded-full border-2 border-transparent border-b-amber-400/30 border-l-amber-400/60"
                  style={{
                    animation: 'spin 2s linear infinite reverse',
                  }}
                />

                {/* Center icon */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Zap className="w-8 h-8 text-black" />
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-black text-white mb-1 tracking-wide">SAQR ANALYZING</h2>
              <p className="text-amber-400 text-lg mb-8" dir="rtl">صقر يحلل...</p>

              {/* Progress Steps */}
              <div className="w-full max-w-xs space-y-3">
                {ANALYSIS_STEPS.map((step, index) => {
                  const isCompleted = completedSteps.includes(index);
                  const isActive = activeStep === index && !isCompleted;
                  const isVisible = activeStep >= index;

                  if (!isVisible) return null;

                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 animate-fadeIn"
                      style={{
                        animationDelay: `${index * 100}ms`,
                      }}
                    >
                      {/* Status icon */}
                      <div className="w-6 h-6 flex items-center justify-center shrink-0">
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : isActive ? (
                          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-zinc-600" />
                        )}
                      </div>

                      {/* Step text */}
                      <div className="flex-1 flex items-center justify-between">
                        <span className={`text-sm ${
                          isCompleted ? 'text-green-400' :
                          isActive ? 'text-amber-400' :
                          'text-zinc-500'
                        }`}>
                          {step.en}
                        </span>
                        <span className={`text-sm ${
                          isCompleted ? 'text-green-400/80' :
                          isActive ? 'text-amber-400/80' :
                          'text-zinc-600'
                        }`} dir="rtl">
                          {step.ar}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tech decoration */}
              <div className="mt-8 flex items-center gap-2 text-zinc-600 text-xs">
                <div className="w-8 h-px bg-zinc-700" />
                <span>AI-POWERED</span>
                <div className="w-8 h-px bg-zinc-700" />
              </div>
            </div>
          </>
        )}

        {/* NON-ANALYZING STATES */}
        {!isAnalyzing && (
          <>
            {/* Captured Image Preview */}
            <div className="relative h-48">
              <img
                src={capturedImage}
                alt="Captured evidence"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
            </div>

            {/* Analysis State */}
            <div className="p-4">
              {/* Error */}
              {error && (
                <div className="text-center py-6">
                  <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h3 className="text-red-400 text-xl font-bold mb-2">Analysis Failed</h3>
                  <p className="text-zinc-400 text-sm mb-4">{error}</p>
                  <button
                    onClick={onRetake}
                    className="bg-amber-500 text-black px-6 py-3 rounded-xl font-bold touch-manipulation"
                  >
                    Try Again | حاول مرة أخرى
                  </button>
                </div>
              )}

              {/* Result */}
              {analysisResult && (
                <div className="space-y-4">
                  {/* Status Badge */}
                  <div
                    className={`rounded-2xl p-5 ${
                      analysisResult.result === "PASS"
                        ? "bg-green-950/80 border border-green-500"
                        : "bg-red-950/80 border border-red-500"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-3 mb-3">
                      {analysisResult.result === "PASS" ? (
                        <CheckCircle2 className="w-10 h-10 text-green-400" />
                      ) : (
                        <XCircle className="w-10 h-10 text-red-400" />
                      )}
                      <div className="text-center">
                        <h2 className={`text-2xl font-black ${
                          analysisResult.result === "PASS" ? "text-green-400" : "text-red-400"
                        }`}>
                          {analysisResult.result === "PASS" ? "COMPLIANT" : "NON-COMPLIANT"}
                        </h2>
                        <p className={`text-lg ${
                          analysisResult.result === "PASS" ? "text-green-300" : "text-red-300"
                        }`} dir="rtl">
                          {analysisResult.result === "PASS" ? "مطابق" : "غير مطابق"}
                        </p>
                      </div>
                    </div>

                    {/* Confidence */}
                    <div className="text-center">
                      <span className="text-zinc-400 text-sm">Confidence </span>
                      <span className={`font-bold ${
                        analysisResult.result === "PASS" ? "text-green-400" : "text-red-400"
                      }`}>
                        {Math.round(analysisResult.confidence * 100)}%
                      </span>
                      <span className="text-zinc-400 text-sm"> نسبة الثقة</span>
                    </div>
                  </div>

                  {/* SAQR Finding */}
                  <div className="bg-zinc-800/80 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-400 font-semibold text-sm">SAQR Finding | نتائج صقر</span>
                    </div>
                    <p className="text-white text-sm leading-relaxed">{analysisResult.finding}</p>
                    <p className="text-zinc-300 text-sm mt-2 leading-relaxed" dir="rtl">{analysisResult.findingAr}</p>
                  </div>

                  {/* Recommendation (if fail) */}
                  {analysisResult.result === "FAIL" && analysisResult.recommendation && (
                    <div className="bg-red-900/30 rounded-xl p-4 border border-red-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 font-semibold text-sm">What to Fix | ما يجب إصلاحه</span>
                      </div>
                      <p className="text-red-200 text-sm">{analysisResult.recommendation}</p>
                      {analysisResult.recommendationAr && (
                        <p className="text-red-300/80 text-sm mt-2" dir="rtl">{analysisResult.recommendationAr}</p>
                      )}
                    </div>
                  )}

                  {/* Dispute Section */}
                  {showDispute && (
                    <div className="bg-zinc-800/50 rounded-xl p-4">
                      <label className="text-zinc-400 text-sm mb-2 block">Inspector Note | ملاحظة المفتش</label>
                      <textarea
                        value={disputeNote}
                        onChange={(e) => setDisputeNote(e.target.value)}
                        placeholder="Add your note here..."
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white text-sm resize-none h-24 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* BOTTOM ACTIONS - Fixed */}
      {analysisResult && !isAnalyzing && (
        <div
          className="bg-zinc-900 border-t border-zinc-800 p-4 shrink-0"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-3">
            <button
              onClick={onRetake}
              className="flex-1 bg-orange-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform touch-manipulation"
            >
              <RefreshCw className="w-5 h-5" />
              Retake | إعادة
            </button>
            <button
              onClick={() => onAccept(disputeNote || undefined)}
              className="flex-1 bg-green-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform touch-manipulation"
            >
              <Check className="w-5 h-5" />
              Accept | قبول
            </button>
          </div>

          {!showDispute && (
            <button
              onClick={() => setShowDispute(true)}
              className="w-full mt-3 bg-zinc-800 text-zinc-300 py-3 rounded-xl font-medium flex items-center justify-center gap-2 touch-manipulation"
            >
              <MessageSquare className="w-4 h-4" />
              Add Note | إضافة ملاحظة
            </button>
          )}
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
