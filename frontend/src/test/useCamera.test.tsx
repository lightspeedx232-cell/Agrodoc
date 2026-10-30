import { act, renderHook } from "@testing-library/react";
import { useCamera } from "../hooks/useCamera";
import { installMediaDevices } from "./mediaMock";

beforeEach(() => {
  // Reset any leftover mediaDevices between tests.
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
});

describe("useCamera lifecycle", () => {
  test("permission granted → status becomes live and devices are listed", async () => {
    const md = installMediaDevices({
      behavior: "grant",
      devices: [{ deviceId: "dev-1", label: "Front Cam" }],
    });
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("live");
    expect(result.current.error).toBeNull();
    expect(md.getUserMedia).toHaveBeenCalled();
    expect(result.current.devices.length).toBe(1);
  });

  test("permission denied → status error with permission-denied type", async () => {
    installMediaDevices({ behavior: "deny" });
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.type).toBe("permission-denied");
    expect(result.current.error?.message).toMatch(/denied/i);
  });

  test("no camera connected → no-devices error", async () => {
    installMediaDevices({ behavior: "no-devices" });
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.type).toBe("no-devices");
  });

  test("unreadable/in-use camera → disconnected error", async () => {
    installMediaDevices({ behavior: "unreadable" });
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error?.type).toBe("disconnected");
  });

  test("multiple cameras available → all listed in devices", async () => {
    installMediaDevices({
      behavior: "grant",
      devices: [
        { deviceId: "cam-a", label: "Camera A" },
        { deviceId: "cam-b", label: "Camera B" },
      ],
    });
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.devices.length).toBe(2);
  });

  test("camera switching → requests the selected deviceId", async () => {
    const md = installMediaDevices({
      behavior: "grant",
      devices: [
        { deviceId: "cam-a", label: "Camera A" },
        { deviceId: "cam-b", label: "Camera B" },
      ],
    });
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.switchCamera("cam-b");
    });

    expect(result.current.selectedDeviceId).toBe("cam-b");
    const lastCall = md.getUserMedia.mock.calls.at(-1)?.[0] as MediaStreamConstraints;
    expect((lastCall.video as MediaTrackConstraints).deviceId).toEqual({ exact: "cam-b" });
  });

  test("stop → releases all tracks and returns to idle", async () => {
    const md = installMediaDevices({ behavior: "grant" });
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });
    const track = md.lastTrack();
    expect(track).toBeTruthy();

    act(() => {
      result.current.stop();
    });

    expect(result.current.status).toBe("idle");
    expect(track._stopped).toBe(true);
  });

  test("capture → returns a JPEG blob from the video frame", async () => {
    installMediaDevices({ behavior: "grant" });
    const { result } = renderHook(() => useCamera());

    // Attach a fake video element with dimensions for the capture canvas.
    const writableRef = result.current.videoRef as React.MutableRefObject<HTMLVideoElement | null>;
    writableRef.current = {
      videoWidth: 640,
      videoHeight: 480,
      play: async () => {},
      srcObject: null,
    } as unknown as HTMLVideoElement;

    // jsdom lacks a real canvas, so stub the 2D context + toBlob.
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: () => {} }) as never;
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => {
      cb(new Blob(["x"], { type: "image/jpeg" }));
    }) as never;

    await act(async () => {
      await result.current.start();
    });

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.capture();
    });

    expect(blob).not.toBeNull();
    expect(blob!.type).toBe("image/jpeg");
  });

  test("unmount → stops active tracks (cleanup)", async () => {
    const md = installMediaDevices({ behavior: "grant" });
    const { result, unmount } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });
    const track = md.lastTrack();
    unmount();

    expect(track._stopped).toBe(true);
  });
});
