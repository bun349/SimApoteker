import { useCallback, useEffect, useRef, useState } from "react";
import { useMicStore } from "@/store/micStore";

export const BARS = 28;
export type Verdict = "idle" | "quiet" | "optimal" | "clipping";

const flat = () => Array<number>(BARS).fill(0.06);

export function useMicMeter() {
  const [running, setRunning] = useState(false);
  const [bars, setBars] = useState<number[]>(flat);
  const [level, setLevel] = useState(0);
  const [verdict, setVerdict] = useState<Verdict>("idle");
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  const start = useCallback(
    async (ms = 6000) => {
      stop();
      const { selectedId, check } = useMicStore.getState();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedId ? { deviceId: { exact: selectedId } } : true,
        });
      } catch {
        void check(); // perbarui status izin/perangkat di store
        return;
      }

      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const freq = new Uint8Array(analyser.frequencyBinCount);
      const time = new Uint8Array(analyser.fftSize);
      const per = Math.floor(freq.length / 2 / BARS); // fokus ke rentang suara manusia
      const t0 = performance.now();
      let raf = 0;
      let peakMax = 0;

      const finish = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
        setRunning(false);
        setBars(flat());
        setLevel(0);
        setVerdict(peakMax < 0.12 ? "quiet" : peakMax > 0.97 ? "clipping" : "optimal");
      };
      stopRef.current = finish;

      setVerdict("idle");
      setRunning(true);

      const tick = () => {
        analyser.getByteFrequencyData(freq);
        analyser.getByteTimeDomainData(time);
        let p = 0;
        for (const v of time) p = Math.max(p, Math.abs(v - 128) / 128);
        peakMax = Math.max(peakMax, p);

        setBars(
          Array.from({ length: BARS }, (_, i) => {
            let s = 0;
            for (let j = 0; j < per; j++) s += freq[i * per + j];
            return Math.max(0.06, s / per / 255);
          }),
        );
        setLevel(p);

        if (performance.now() - t0 < ms) raf = requestAnimationFrame(tick);
        else finish();
      };
      tick();
    },
    [stop],
  );

  useEffect(() => stop, [stop]); // matikan mic saat komponen dilepas

  return { running, bars, level, verdict, start, stop };
}