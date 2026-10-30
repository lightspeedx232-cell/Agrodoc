// useCamera — encapsulates the browser webcam lifecycle using the
// MediaDevices API (getUserMedia). It deliberately does NOT request the camera
// until start() is called, and it always releases all tracks on stop()/unmount.

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "starting" | "live" | "stopping" | "error";

export interface CameraError {
  type:
    | "permission-denied"
    | "no-devices"
    | "not-supported"
    | "disconnected"
    | "unknown";
  message: string;
}

export interface UseCameraResult {
  status: CameraStatus;
  error: CameraError | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  start: (deviceId?: string) => Promise<void>;
  stop: () => void;
  switchCamera: (deviceId: string) => Promise<void>;
  capture: (maxWidth?: number, quality?: number) => Promise<Blob | null>;
}

function classifyError(err: unknown): CameraError {
  const name = (err as { name?: string })?.name || "";
  const msg =
    (err as { message?: string })?.message || "An unknown camera error occurred.";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      type: "permission-denied",
      message:
        "Camera permission was denied. Allow camera access in your browser to scan leaves.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      type: "no-devices",
      message: "No camera was found. Connect a webcam or use a device with a camera.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      type: "disconnected",
      message:
        "The camera is in use by another app or could not be read. Close other apps using the camera and try again.",
    };
  }
  if (name === "NotSupportedError" || name === "TypeError") {
    return {
      type: "not-supported",
      message: "This browser does not support camera access (MediaDevices API).",
    };
  }
  return { type: "unknown", message: msg };
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<CameraError | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const isSupported =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list.filter((d) => d.kind === "videoinput");
      setDevices(cams);
      return cams;
    } catch {
      return [];
    }
  }, []);

  const stop = useCallback(() => {
    setStatus("stopping");
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
        track.onended = null;
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }, []);

  const start = useCallback(
    async (deviceId?: string) => {
      if (!isSupported) {
        setStatus("error");
        setError({
          type: "not-supported",
          message: "This browser does not support camera access (MediaDevices API).",
        });
        return;
      }
      setStatus("starting");
      setError(null);
      try {
        // Stop any existing stream first (camera switching).
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: "environment" },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Now that permission is granted, labels become available.
        await refreshDevices();

        // Track which device is actually active.
        const trackSettings = stream.getVideoTracks()[0]?.getSettings();
        const activeId = trackSettings?.deviceId || deviceId || null;
        setSelectedDeviceId(activeId);

        // If the device is physically disconnected, release gracefully.
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            setError({
              type: "disconnected",
              message: "The camera was disconnected.",
            });
            stop();
          };
        });

        setStatus("live");
      } catch (err) {
        setStatus("error");
        setError(classifyError(err));
      }
    },
    [isSupported, refreshDevices, stop],
  );

  const switchCamera = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      await start(deviceId);
    },
    [start],
  );

  const capture = useCallback(
    async (maxWidth = 1600, quality = 0.9): Promise<Blob | null> => {
      const video = videoRef.current;
      const stream = streamRef.current;
      if (!video || !stream) return null;

      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      const scale = Math.min(1, maxWidth / Math.max(vw, vh));
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);

      return new Promise<Blob | null>((resolve) =>
        canvas.toBlob(
          (blob) => resolve(blob),
          "image/jpeg",
          quality,
        ),
      );
    },
    [],
  );

  // Clean up tracks when the component unmounts.
  useEffect(() => {
    return () => {
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Refresh device list when cameras are connected/disconnected.
  useEffect(() => {
    const handler = () => refreshDevices();
    if (isSupported) {
      navigator.mediaDevices.addEventListener?.("devicechange", handler);
      return () => navigator.mediaDevices.removeEventListener?.("devicechange", handler);
    }
  }, [isSupported, refreshDevices]);

  return {
    status,
    error,
    devices,
    selectedDeviceId,
    videoRef,
    start,
    stop,
    switchCamera,
    capture,
  };
}
