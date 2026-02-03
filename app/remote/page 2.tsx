"use client";

import { useState } from "react";
import { Video, MapPin, Camera, Shield, Loader2 } from "lucide-react";

export default function RemotePage() {
  const [sessionCode, setSessionCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionCode.trim()) return;

    setIsJoining(true);

    // TODO: Validate session code and join
    // For now, redirect to session page
    window.location.href = `/remote/session/${sessionCode.toUpperCase()}`;
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center">
          <Video className="w-10 h-10 text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold">Join Remote Inspection</h1>
        <p className="text-zinc-400">انضم إلى جلسة التفتيش عن بُعد</p>
      </div>

      {/* Join Form */}
      <form onSubmit={handleJoinSession} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-2">
            Enter Session Code / أدخل رمز الجلسة
          </label>
          <input
            type="text"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            placeholder="XXXXXX"
            maxLength={6}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-4 text-center text-2xl font-mono tracking-widest focus:border-blue-500 focus:outline-none uppercase"
          />
        </div>

        <button
          type="submit"
          disabled={sessionCode.length < 6 || isJoining}
          className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-4 rounded-lg font-bold text-lg hover:from-blue-400 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isJoining ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <Video className="w-5 h-5" />
              <span>Join Session</span>
            </>
          )}
        </button>
      </form>

      {/* Info */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-blue-400">How Remote Inspections Work</h3>
        <ul className="text-sm text-zinc-400 space-y-3">
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-400 text-xs font-bold">1</span>
            </div>
            <span>Get a 6-digit session code from your inspector</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-400 text-xs font-bold">2</span>
            </div>
            <span>Enter the code above to join the live session</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Camera className="w-3 h-3 text-blue-400" />
            </div>
            <span>Share your camera for real-time inspection</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-3 h-3 text-blue-400" />
            </div>
            <span>GPS verification ensures you are on-site</span>
          </li>
        </ul>
      </div>

      {/* Arabic Info */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3" dir="rtl">
        <h3 className="font-semibold text-blue-400">كيف تعمل عمليات التفتيش عن بُعد</h3>
        <ul className="text-sm text-zinc-400 space-y-3">
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-400 text-xs font-bold">١</span>
            </div>
            <span>احصل على رمز الجلسة المكون من 6 أرقام من المفتش</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-400 text-xs font-bold">٢</span>
            </div>
            <span>أدخل الرمز أعلاه للانضمام إلى الجلسة المباشرة</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Camera className="w-3 h-3 text-blue-400" />
            </div>
            <span>شارك كاميرتك للتفتيش في الوقت الفعلي</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-3 h-3 text-blue-400" />
            </div>
            <span>يضمن التحقق من GPS أنك في الموقع</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
