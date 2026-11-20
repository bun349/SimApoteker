import { create } from "zustand";

type MicStatus = "idle" | "checking" | "ready" | "denied" | "not_found";
interface Device { id: string; label: string }

interface MicState {
  status: MicStatus;
  deviceLabel: string | null;
  devices: Device[];
  selectedId: string | null;
  level: number;
  check: () => Promise<void>;
  select: (id: string) => void;
  test: () => Promise<void>;
}

const constraints = (id: string | null): MediaStreamConstraints => ({
  audio: id ? { deviceId: { exact: id } } : true,
});

export const useMicStore = create<MicState>((set, get) => ({
  status: "idle",
  deviceLabel: null,
  devices: [],
  selectedId: null,
  level: 0,

  check: async () => {
    set({ status: "checking" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints(get().selectedId));
      const track = stream.getAudioTracks()[0];
      const all = await navigator.mediaDevices.enumerateDevices();
      const devices = all
        .filter((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications")
        .map((d) => ({ id: d.deviceId, label: d.label || "Mikrofon" }));
      set({
        status: "ready",
        deviceLabel: track?.label ?? "Mikrofon",
        devices,
        selectedId: track?.getSettings().deviceId ?? get().selectedId,
      });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      const name = (e as DOMException).name;
      set({ status: name === "NotFoundError" ? "not_found" : "denied", deviceLabel: null });
    }
  },

  select: (id) => {
    set({ selectedId: id });
    void get().check();
  },

  test: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints(get().selectedId));
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const start = performance.now();
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        set({ level: Math.max(...buf.map((v) => Math.abs(v - 128))) / 128 });
        if (performance.now() - start < 3000) requestAnimationFrame(tick);
        else {
          stream.getTracks().forEach((t) => t.stop());
          void ctx.close();
          set({ level: 0 });
        }
      };
      tick();
    } catch {
      set({ status: "denied" });
    }
  },
}));