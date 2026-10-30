import { useEffect, useRef, useState } from "react";
import { useCamera } from "../hooks/useCamera";
import { cropDoctorApi } from "../lib/api";
import type { DiagnosisResponse } from "../lib/types";
import { Alert, PageHeader, Spinner } from "../components/ui";

type Phase = "live" | "preview" | "analyzing" | "result";

export default function Scanner() {
  const camera = useCamera();
  const [phase, setPhase] = useState<Phase>("live");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResponse | null>(null);
  const [analyzeError, setAnalyzeError] = useState("");
  const [context, setContext] = useState({
    crop: "",
    variety: "",
    growth_stage: "",
    symptoms: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URLs to avoid memory leaks.
  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [capturedUrl]);

  const handleCapture = async () => {
    const blob = await camera.capture();
    if (!blob) return;
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(blob);
    setCapturedUrl(URL.createObjectURL(blob));
    setPhase("preview");
  };

  const handleRetake = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
    setResult(null);
    setAnalyzeError("");
    setPhase("live");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(file);
    setCapturedUrl(URL.createObjectURL(file));
    setResult(null);
    setAnalyzeError("");
    setPhase("preview");
  };

  const handleAnalyze = async () => {
    if (!capturedBlob) return;
    setPhase("analyzing");
    setAnalyzeError("");
    setResult(null);
    try {
      const res = await cropDoctorApi.analyze(capturedBlob, context);
      setResult(res);
      setPhase("result");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Could not reach the analysis service. Try again later.";
      setAnalyzeError(msg);
      setPhase("preview");
    }
  };

  const cameraActive = camera.status === "live" || camera.status === "starting";

  return (
    <div>
      <PageHeader
        title="AI Crop Doctor — Leaf Scanner"
        subtitle="Capture or upload a leaf photo for AI-assisted disease diagnosis."
      />

      {/* Guidance tips */}
      <div className="card mb-6 p-4">
        <h2 className="text-sm font-semibold text-brand-800">Tips for a good scan</h2>
        <ul className="mt-2 grid gap-1 text-sm text-brand-700 sm:grid-cols-2">
          <li>• Move close to the affected leaf.</li>
          <li>• Use good, even lighting.</li>
          <li>• Keep the leaf in focus.</li>
          <li>• Avoid shaking the camera.</li>
          <li>• Include the visible symptoms (spots, yellowing, etc.).</li>
          <li>• Don't cover the affected area with your hand.</li>
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- Camera / preview column ---- */}
        <div className="card p-4">
          {phase === "live" || phase === "analyzing" ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
              <video
                ref={camera.videoRef}
                className="h-full w-full object-contain"
                playsInline
                muted
              />
              {camera.status === "live" && (
                <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-semibold text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  Camera live
                </span>
              )}
              {camera.status === "starting" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner label="Starting camera…" />
                </div>
              )}
            </div>
          ) : (
            capturedUrl && (
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                <img src={capturedUrl} alt="Captured leaf" className="h-full w-full object-contain" />
              </div>
            )
          )}

          {/* Camera controls */}
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="camera-select" className="sr-only">
                Select camera
              </label>
              <select
                id="camera-select"
                className="input flex-1"
                value={camera.selectedDeviceId ?? ""}
                disabled={!camera.devices.length || !cameraActive}
                onChange={(e) => camera.switchCamera(e.target.value)}
              >
                {camera.devices.length === 0 && (
                  <option value="">No camera selected</option>
                )}
                {camera.devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              {phase === "live" && (
                <>
                  <button
                    className="btn-primary"
                    onClick={handleCapture}
                    disabled={camera.status !== "live"}
                  >
                    📸 Capture Leaf
                  </button>
                  <button className="btn-secondary" onClick={camera.stop} disabled={camera.status !== "live"}>
                    ⏹ Stop Camera
                  </button>
                </>
              )}

              {phase === "preview" && (
                <>
                  <button className="btn-secondary" onClick={handleRetake}>
                    ↩ Retake Image
                  </button>
                  <button className="btn-primary" onClick={handleAnalyze}>
                    🔬 Analyze Image
                  </button>
                </>
              )}

              {(phase === "live" || phase === "preview") && (
                <>
                  {!cameraActive && phase === "live" && (
                    <button className="btn-primary" onClick={() => camera.start()}>
                      ▶ Start Camera
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Upload alternative */}
            {phase !== "analyzing" && phase !== "result" && (
              <div className="border-t border-brand-100 pt-3">
                <p className="mb-2 text-xs text-brand-600">
                  Or upload a photo from your device:
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="block w-full text-sm text-brand-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-4 file:py-2 file:font-semibold file:text-brand-700 hover:file:bg-brand-200"
                  onChange={handleFileUpload}
                />
              </div>
            )}
          </div>

          {/* Camera errors */}
          {camera.error && (
            <div className="mt-3">
              <Alert variant="error">{camera.error.message}</Alert>
            </div>
          )}
        </div>

        {/* ---- Context + results column ---- */}
        <div className="space-y-6">
          {/* Optional context */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-brand-800">
              Optional crop details (improves accuracy)
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="Crop (e.g. Tomato)"
                value={context.crop}
                onChange={(e) => setContext((c) => ({ ...c, crop: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Variety"
                value={context.variety}
                onChange={(e) => setContext((c) => ({ ...c, variety: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Growth stage"
                value={context.growth_stage}
                onChange={(e) => setContext((c) => ({ ...c, growth_stage: e.target.value }))}
              />
              <input
                className="input col-span-2"
                placeholder="Describe symptoms (e.g. brown spots on leaves)"
                value={context.symptoms}
                onChange={(e) => setContext((c) => ({ ...c, symptoms: e.target.value }))}
              />
            </div>
          </div>

          {/* Analyzing indicator */}
          {phase === "analyzing" && (
            <div className="card p-6">
              <Spinner label="Analyzing your leaf image…" />
              <p className="text-center text-sm text-brand-600">
                Sending the image to the AI Crop Doctor. This can take a few seconds.
              </p>
            </div>
          )}

          {/* Analyze error */}
          {analyzeError && phase === "preview" && (
            <Alert variant="error">{analyzeError}</Alert>
          )}

          {/* Results */}
          {phase === "result" && result && <DiagnosisResultCard result={result} />}
        </div>
      </div>

      {/* Consent / privacy note */}
      <p className="mt-6 text-center text-xs text-brand-500">
        🔒 Your camera is only active while you are on this page. Images are sent
        for analysis only after you click “Analyze Image”.
      </p>
    </div>
  );
}

function DiagnosisResultCard({ result }: { result: DiagnosisResponse }) {
  const o = result.outcome;

  if (result.status === "unavailable" || result.status === "error") {
    return (
      <div className="card border-amber-200 bg-amber-50 p-6">
        <h2 className="text-lg font-bold text-amber-800">
          {result.status === "unavailable" ? "AI diagnosis unavailable" : "Analysis error"}
        </h2>
        <p className="mt-2 text-sm text-amber-800">{result.message}</p>
        <div className="mt-4 rounded-lg bg-white p-3 text-xs text-amber-800">
          <p>
            <strong>Provider:</strong> {result.provider} ·{" "}
            <strong>Model:</strong> {result.model_version}
          </p>
          <p className="mt-1">
            AgroDoc never fabricates a diagnosis. To enable real analysis,
            configure an AI provider in the backend <code>.env</code> file (see
            the setup guide).
          </p>
        </div>
      </div>
    );
  }

  if (!o) return null;

  const pct = Math.round(o.confidence * 100);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-brand-800">Diagnosis result</h2>
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
          {result.provider} · {result.model_version}
        </span>
      </div>

      {o.crop_identification && (
        <p className="mt-2 text-sm text-brand-600">Crop: {o.crop_identification}</p>
      )}

      <h3 className="mt-3 text-xl font-bold text-brand-900">{o.suspected_condition}</h3>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-100">
          <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-semibold text-brand-700">{pct}% confidence</span>
      </div>
      {o.uncertainty_label && (
        <p className="mt-1 text-xs text-brand-500">{o.uncertainty_label}</p>
      )}

      {o.supporting_symptoms.length > 0 && (
        <Section title="Supporting symptoms" items={o.supporting_symptoms} />
      )}
      {o.suggested_next_steps.length > 0 && (
        <Section title="Suggested next steps" items={o.suggested_next_steps} />
      )}
      {o.prevention_advice.length > 0 && (
        <Section title="Prevention advice" items={o.prevention_advice} />
      )}

      {o.alternative_possibilities.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-brand-800">Alternative possibilities</h4>
          <ul className="mt-1 space-y-1 text-sm text-brand-700">
            {o.alternative_possibilities.map((a, i) => (
              <li key={i}>
                {a.name} — {Math.round(a.confidence * 100)}%
                {a.notes ? ` (${a.notes})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {o.follow_up_monitoring && (
        <p className="mt-4 text-sm text-brand-700">
          <strong>Follow-up:</strong> {o.follow_up_monitoring}
        </p>
      )}
      {o.agricultural_references.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-brand-800">References</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-brand-700">
            {o.agricultural_references.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 rounded-lg bg-brand-50 p-3 text-xs text-brand-600">
        {o.disclaimer}
      </p>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-brand-800">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-brand-700">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
