import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Camera + microphone for the creator, from the go-live screen through to air.
 *
 * The stream object handed out here is STABLE for the life of the session.
 * Flipping the camera swaps the video track inside it rather than building a
 * new MediaStream, which matters for two reasons:
 *
 *   · the canvas filter pipeline reads from one <video> bound to this stream;
 *     a new stream object would tear that pipeline down and rebuild it
 *   · LiveKit is publishing a track derived from it — replacing the stream
 *     mid-broadcast makes viewers see a reconnect
 *
 * A creator should also never discover a dead mic in front of an audience, so
 * the pre-live screen runs the real capture with a live input level.
 */
export function useMediaPreview({ enabled = true, videoRef }) {
  const [facing, setFacing] = useState('user');
  const [micOn, setMicOn] = useState(true);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [stream, setStream] = useState(null);

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(0);
  const facingRef = useRef('user');
  const micOnRef = useRef(true);
  micOnRef.current = micOn;

  const teardownMeter = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
  }, []);

  /** Full release. Only on unmount or an explicit stop — never on a flip. */
  const stop = useCallback(() => {
    teardownMeter();
    streamRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch { /* */ } });
    streamRef.current = null;
    setStream(null);
    setReady(false);
    setLevel(0);
  }, [teardownMeter]);

  const startMeter = useCallback((src) => {
    teardownMeter();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      ctx.createMediaStreamSource(src).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      let smoothed = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 1) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const scaled = Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
        smoothed = scaled > smoothed ? scaled : smoothed * 0.86 + scaled * 0.14;
        setLevel(micOnRef.current ? smoothed : 0);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* the meter is a nicety, never a blocker */ }
  }, [teardownMeter]);

  const describe = (e) => {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
      return 'Camera and microphone are blocked. Allow access in your browser settings to go live.';
    }
    if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return 'No camera found on this device.';
    return 'Could not start the camera. Close other apps using it and try again.';
  };

  const VIDEO = (mode) => ({ facingMode: mode, width: { ideal: 720 }, height: { ideal: 1280 } });

  /** First acquisition: camera + mic, and the stream identity everything binds to. */
  const open = useCallback(async () => {
    if (streamRef.current) return true;
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({
        video: VIDEO(facingRef.current),
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = fresh;
      setStream(fresh);
      setError('');
      setReady(true);
      if (videoRef?.current) {
        videoRef.current.srcObject = fresh;
        void videoRef.current.play?.().catch(() => {});
      }
      fresh.getAudioTracks().forEach((t) => { t.enabled = micOnRef.current; });
      startMeter(fresh);
      return true;
    } catch (e) {
      setError(describe(e));
      setReady(false);
      return false;
    }
  }, [startMeter, videoRef]);

  /** Swap the video track in place — the stream object survives. */
  const flip = useCallback(async () => {
    const current = streamRef.current;
    if (!current) return open();
    const next = facingRef.current === 'user' ? 'environment' : 'user';
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: VIDEO(next), audio: false });
      const incoming = fresh.getVideoTracks()[0];
      if (!incoming) return false;
      current.getVideoTracks().forEach((t) => {
        current.removeTrack(t);
        try { t.stop(); } catch { /* */ }
      });
      current.addTrack(incoming);
      facingRef.current = next;
      setFacing(next);
      // Some browsers need a nudge to render the replaced track.
      if (videoRef?.current) void videoRef.current.play?.().catch(() => {});
      return true;
    } catch {
      return false;   // keep the camera we have
    }
  }, [open, videoRef]);

  const toggleMic = useCallback(() => {
    setMicOn((on) => {
      const next = !on;
      streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = next; });
      if (!next) setLevel(0);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) { stop(); return undefined; }
    void open();
    return undefined;   // NOT stop() — going live keeps this stream alive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Release for real only when the component using this goes away.
  useEffect(() => stop, [stop]);

  // Phones suspend capture when backgrounded; reacquire on return.
  useEffect(() => {
    if (!enabled) return undefined;
    const onVis = () => { if (!document.hidden && !streamRef.current) void open(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [enabled, open]);

  return { stream, facing, micOn, level, error, ready, flip, toggleMic, retry: open, stop };
}

export default useMediaPreview;
