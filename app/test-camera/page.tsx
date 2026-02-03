"use client";

import { useEffect, useRef, useState } from "react";

export default function TestCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log("[TestCamera]", msg);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const enumerateDevices = async () => {
    addLog("Enumerating devices...");
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      addLog(`Found ${videoDevices.length} video device(s):`);
      videoDevices.forEach((d, i) => {
        addLog(`  [${i}] ${d.label || '(no label)'} - ${d.deviceId.substring(0, 8)}...`);
      });
      return videoDevices;
    } catch (e: any) {
      addLog(`enumerateDevices error: ${e.message}`);
      return [];
    }
  };

  const startCamera = async () => {
    addLog("=== startCamera called ===");
    addLog(`videoRef.current: ${!!videoRef.current}`);
    addLog(`navigator.mediaDevices: ${!!navigator.mediaDevices}`);
    addLog(`Browser: ${navigator.userAgent.split(' ').slice(-3).join(' ')}`);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Camera API not available. Need localhost or HTTPS.");
      return;
    }

    // Stop any existing stream
    if (streamRef.current) {
      addLog("Stopping previous stream");
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // First enumerate devices
    const videoDevices = await enumerateDevices();

    setStatus("Requesting camera...");
    setError(null);

    // Try multiple approaches
    const attempts: Array<{ label: string; constraints: MediaStreamConstraints }> = [
      { label: "video: true", constraints: { video: true } },
      { label: "video: {}", constraints: { video: {} } },
      { label: "facingMode: user", constraints: { video: { facingMode: "user" } } },
      { label: "facingMode: environment", constraints: { video: { facingMode: "environment" } } },
    ];

    // If we found devices, also try requesting by deviceId
    if (videoDevices.length > 0 && videoDevices[0].deviceId) {
      attempts.push({
        label: `deviceId: ${videoDevices[0].deviceId.substring(0, 8)}...`,
        constraints: { video: { deviceId: { exact: videoDevices[0].deviceId } } }
      });
    }

    for (const attempt of attempts) {
      try {
        addLog(`Trying: ${attempt.label}`);
        const stream = await navigator.mediaDevices.getUserMedia(attempt.constraints);

        addLog(`SUCCESS with "${attempt.label}"! Tracks: ${stream.getTracks().length}`);
        streamRef.current = stream;

        // Attach to video element
        if (videoRef.current) {
          addLog("Attaching stream to video element");
          videoRef.current.srcObject = stream;

          videoRef.current.onloadedmetadata = () => {
            addLog(`Video metadata loaded: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);
            videoRef.current?.play()
              .then(() => {
                addLog("Video playing!");
                setStatus("Camera working!");
              })
              .catch(e => {
                addLog(`Play error: ${e.message}`);
                setError(`Play failed: ${e.message}`);
              });
          };

          videoRef.current.onerror = (e) => {
            addLog(`Video element error: ${e}`);
            setError("Video element error");
          };
        }
        return; // Success!
      } catch (err: any) {
        addLog(`  FAILED: ${err.name} - ${err.message}`);
        continue;
      }
    }

    // All attempts failed
    addLog("All camera attempts failed!");
    setError("Could not access camera with any method. Check System Preferences → Privacy → Camera");
  };

  useEffect(() => {
    addLog("Component mounted");

    // Small delay to ensure video element is in DOM
    const timer = setTimeout(() => {
      startCamera();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", position: "relative" }}>
      {/* Video element - always in DOM */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* Status overlay */}
      <div style={{
        position: "absolute",
        top: 16,
        left: 16,
        right: 16,
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        padding: 16,
        borderRadius: 8,
        maxHeight: "80vh",
        overflow: "auto",
      }}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Camera Test</h1>

        <div style={{ marginBottom: 12 }}>
          <strong>Status:</strong> {status}
        </div>

        {error && (
          <div style={{ color: "#f66", marginBottom: 12 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <button
          onClick={startCamera}
          style={{
            background: "#f59e0b",
            color: "#000",
            border: "none",
            padding: "8px 16px",
            borderRadius: 6,
            fontWeight: "bold",
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          Retry Camera
        </button>

        <div>
          <strong>Debug Logs:</strong>
          <div style={{
            background: "#111",
            padding: 8,
            borderRadius: 4,
            marginTop: 8,
            fontFamily: "monospace",
            fontSize: 11,
            maxHeight: 200,
            overflow: "auto",
          }}>
            {logs.map((log, i) => (
              <div key={i} style={{
                color: log.includes("ERROR") || log.includes("error") ? "#f66" :
                       log.includes("Got stream") || log.includes("playing") ? "#0f0" : "#aaa"
              }}>
                {log}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: "#666" }}>
          <p>URL: {typeof window !== 'undefined' ? window.location.href : ''}</p>
          <p style={{ marginTop: 4 }}>If denied, click lock icon → Camera → Allow</p>
        </div>
      </div>
    </div>
  );
}
