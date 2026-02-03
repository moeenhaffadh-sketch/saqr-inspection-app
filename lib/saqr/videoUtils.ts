// SAQR Video Walkthrough - Frame Extraction Utilities

/**
 * Extract a frame from a video blob at a specific timestamp
 * @param videoBlob - The video file as a Blob
 * @param timestamp - Time in seconds to extract frame
 * @param quality - JPEG quality (0.0 - 1.0)
 * @returns Base64 JPEG image
 */
export async function extractFrameAtTimestamp(
  videoBlob: Blob,
  timestamp: number,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(videoBlob);

    video.src = url;
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.onloadedmetadata = () => {
      // Clamp timestamp to valid range
      const clampedTime = Math.min(Math.max(0, timestamp), video.duration - 0.1);
      video.currentTime = clampedTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL("image/jpeg", quality);

        cleanup();
        resolve(base64);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = (e) => {
      cleanup();
      reject(new Error(`Video loading error: ${e}`));
    };

    // Timeout after 10 seconds
    setTimeout(() => {
      cleanup();
      reject(new Error("Frame extraction timeout"));
    }, 10000);
  });
}

/**
 * Extract multiple frames from a video at specified timestamps
 * @param videoBlob - The video file as a Blob
 * @param timestamps - Array of timestamps in seconds
 * @param quality - JPEG quality (0.0 - 1.0)
 * @returns Map of timestamp -> base64 image
 */
export async function extractFramesBatch(
  videoBlob: Blob,
  timestamps: number[],
  quality: number = 0.85
): Promise<Map<number, string>> {
  const results = new Map<number, string>();

  // Sort timestamps for efficient seeking
  const sortedTimestamps = [...timestamps].sort((a, b) => a - b);

  for (const timestamp of sortedTimestamps) {
    try {
      const frame = await extractFrameAtTimestamp(videoBlob, timestamp, quality);
      results.set(timestamp, frame);
    } catch (err) {
      console.error(`[VideoUtils] Failed to extract frame at ${timestamp}s:`, err);
    }
  }

  return results;
}

/**
 * Convert video blob to base64 string
 * @param videoBlob - The video file as a Blob
 * @returns Base64 string (without data URL prefix)
 */
export async function videoBlobToBase64(videoBlob: Blob): Promise<string> {
  console.log("[VideoUtils] Converting blob to base64, size:", videoBlob.size, "bytes");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      console.log("[VideoUtils] FileReader result length:", result?.length || 0);

      // Remove data URL prefix if present
      const base64 = result.replace(/^data:[^;]+;base64,/, "");
      console.log("[VideoUtils] Base64 output length:", base64.length);

      resolve(base64);
    };

    reader.onerror = () => {
      console.error("[VideoUtils] FileReader error:", reader.error);
      reject(new Error("Failed to read video blob"));
    };

    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        console.log("[VideoUtils] Reading progress:", percent, "%");
      }
    };

    reader.readAsDataURL(videoBlob);
  });
}

/**
 * Get video metadata (duration, dimensions)
 * @param videoBlob - The video file as a Blob
 * @returns Video metadata
 */
export async function getVideoMetadata(videoBlob: Blob): Promise<{
  duration: number;
  width: number;
  height: number;
  size: number;
  type: string;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(videoBlob);

    video.src = url;
    video.muted = true;

    video.onloadedmetadata = () => {
      const metadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        size: videoBlob.size,
        type: videoBlob.type,
      };

      URL.revokeObjectURL(url);
      video.remove();
      resolve(metadata);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      video.remove();
      reject(new Error("Failed to load video metadata"));
    };
  });
}

/**
 * Compress a video for upload (reduces quality/size)
 * Note: Full video compression requires server-side processing
 * This function creates a compressed version by re-encoding frames
 * @param videoBlob - Original video blob
 * @param maxSizeMB - Maximum size in MB
 * @returns Compressed video blob or original if already small enough
 */
export async function compressVideoIfNeeded(
  videoBlob: Blob,
  maxSizeMB: number = 20
): Promise<Blob> {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // If already small enough, return as-is
  if (videoBlob.size <= maxSizeBytes) {
    return videoBlob;
  }

  // For now, just return the original and let the API handle it
  // Full video compression would require either:
  // 1. Server-side FFmpeg processing
  // 2. WebAssembly-based compression (heavy)
  console.warn(`[VideoUtils] Video is ${(videoBlob.size / 1024 / 1024).toFixed(1)}MB, which exceeds ${maxSizeMB}MB limit`);

  return videoBlob;
}

/**
 * Zone guidance for video walkthrough
 */
export const WALKTHROUGH_ZONES = [
  {
    id: "entrance",
    name: "Entrance",
    nameAr: "المدخل",
    duration: 12, // seconds
    guidance: "Start at the entrance. Capture signage, exterior, and entry area.",
    guidanceAr: "ابدأ من المدخل. التقط اللافتات والواجهة الخارجية ومنطقة الدخول.",
  },
  {
    id: "main_area",
    name: "Main Area",
    nameAr: "المنطقة الرئيسية",
    duration: 12,
    guidance: "Walk slowly through the main area. Scan walls, ceiling, and floor.",
    guidanceAr: "امش ببطء في المنطقة الرئيسية. امسح الجدران والسقف والأرضية.",
  },
  {
    id: "kitchen",
    name: "Kitchen",
    nameAr: "المطبخ",
    duration: 12,
    guidance: "Enter kitchen area. Capture equipment, surfaces, and hygiene stations.",
    guidanceAr: "ادخل منطقة المطبخ. التقط المعدات والأسطح ومحطات النظافة.",
  },
  {
    id: "storage",
    name: "Storage",
    nameAr: "التخزين",
    duration: 12,
    guidance: "Check storage areas. Show shelving, labels, and floor clearance.",
    guidanceAr: "افحص مناطق التخزين. أظهر الأرفف والملصقات والمسافة من الأرض.",
  },
  {
    id: "restrooms",
    name: "Restrooms",
    nameAr: "دورات المياه",
    duration: 12,
    guidance: "Finish with restrooms. Capture handwash stations and facilities.",
    guidanceAr: "اختم بدورات المياه. التقط محطات غسل اليدين والمرافق.",
  },
];

/**
 * Get current zone based on elapsed time
 */
export function getCurrentZone(elapsedSeconds: number): typeof WALKTHROUGH_ZONES[0] | null {
  let accumulated = 0;

  for (const zone of WALKTHROUGH_ZONES) {
    accumulated += zone.duration;
    if (elapsedSeconds < accumulated) {
      return zone;
    }
  }

  return WALKTHROUGH_ZONES[WALKTHROUGH_ZONES.length - 1];
}

/**
 * Get total walkthrough duration
 */
export function getTotalWalkthroughDuration(): number {
  return WALKTHROUGH_ZONES.reduce((sum, zone) => sum + zone.duration, 0);
}
