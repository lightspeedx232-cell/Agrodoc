// Helpers to mock the browser MediaDevices API for automated tests.
// Real hardware is covered by the manual checklist in WEBCAM_SETUP.md.

export interface MockTrackOptions {
  deviceId?: string;
}

export function makeMockTrack(opts: MockTrackOptions = {}) {
  let stopped = false;
  const settings = { deviceId: opts.deviceId ?? "dev-1" };
  return {
    kind: "video",
    label: opts.deviceId ? `Camera ${opts.deviceId}` : "Mock Camera",
    getSettings: () => settings,
    stop: () => {
      stopped = true;
    },
    get _stopped() {
      return stopped;
    },
    onended: null as (() => void) | null,
  };
}

export type GetUserMediaImpl = () => Promise<MediaStream>;

interface InstallOptions {
  devices?: { deviceId: string; label: string }[];
  behavior?: "grant" | "deny" | "no-devices" | "unreadable";
  selectedDeviceId?: string;
}

export function installMediaDevices(opts: InstallOptions = {}) {
  const tracks: ReturnType<typeof makeMockTrack>[] = [];

  const devices =
    opts.devices ?? [{ deviceId: "dev-1", label: "Mock Front Camera" }];

  const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
    if (opts.behavior === "deny") {
      const err = new Error("Permission denied");
      err.name = "NotAllowedError";
      throw err;
    }
    if (opts.behavior === "no-devices") {
      const err = new Error("No camera");
      err.name = "NotFoundError";
      throw err;
    }
    if (opts.behavior === "unreadable") {
      const err = new Error("In use");
      err.name = "NotReadableError";
      throw err;
    }
    const requestedDeviceId =
      (constraints.video as MediaTrackConstraints)?.deviceId &&
      (constraints.video as MediaTrackConstraints).deviceId;
    const id =
      (requestedDeviceId as { exact?: string })?.exact ||
      opts.selectedDeviceId ||
      devices[0]?.deviceId ||
      "dev-1";
    const track = makeMockTrack({ deviceId: id });
    tracks.push(track);
    const stream = {
      getVideoTracks: () => tracks.slice(-1),
      getTracks: () => tracks.slice(-1),
    } as unknown as MediaStream;
    return stream;
  });

  const enumerateDevices = vi.fn(async () =>
    devices.map((d) => ({
      kind: "videoinput" as MediaDeviceKind,
      deviceId: d.deviceId,
      label: d.label,
      groupId: "group",
    })) as MediaDeviceInfo[],
  );

  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia, enumerateDevices, addEventListener, removeEventListener },
  });

  return {
    getUserMedia,
    enumerateDevices,
    lastTrack: () => tracks[tracks.length - 1],
    allTracks: () => tracks,
  };
}
