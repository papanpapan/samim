import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Maximize2, Minimize2, BellOff, Video, X } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { playIntrusionAlarm, intrusionAlarmBusy, stopIntrusionAlarm, subscribeIntrusionAlarm } from '../a11y/intrusionAlarm';
import { beginAlarmEvidence, finishAlarmEvidence } from './live/alarmEvidence';
import { useAuth } from '../auth/AuthContext';
import { DetectionOverlay } from './live/DetectionOverlay';
import { DetectionHit, useObjectDetection } from '../hooks/useObjectDetection';

interface AlertWindow {
  from: string;
  to: string;
}

interface CameraRow {
  id: string;
  name: string;
  live: boolean;
  alertEnabled: boolean;
  alertAlways: boolean;
  alertConfigured: boolean;
  alertWindows: AlertWindow[];
}

interface FieldRow {
  id: string;
  name: string;
  cameras: CameraRow[];
}

interface SiteRow {
  id: string;
  name: string;
  cctv: boolean;
  fields: FieldRow[];
}

type CameraView = CameraRow & { field: string };

const ease = 'duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]';

function clockMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

function inWindow(from: string, to: string) {
  const start = clockMinutes(from);
  const end = clockMinutes(to);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  const now = hour * 60 + minute;
  if (start === end) return true;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

function armedNow(camera: CameraRow) {
  if (!camera.alertEnabled) return false;
  if (camera.alertAlways) return true;
  return camera.alertWindows.some((row) => inWindow(row.from, row.to));
}

function kolkataDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setWide(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return wide;
}

function MenuPane({
  open,
  wide,
  title,
  wideClass,
  onToggle,
  children,
}: {
  open: boolean;
  wide: boolean;
  title: string;
  wideClass: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className={`flex min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10 transition-[width] ${ease} ${open ? `w-full ${wideClass}` : 'w-full lg:w-16'}`}>
      <button
        type="button"
        className={`flex w-full text-left ${!open && wide ? 'flex-col items-center gap-4 px-1 py-4' : 'items-center gap-2 px-3 py-3'}`}
        aria-expanded={open}
        aria-label={t(open ? 'live.collapseMenu' : 'live.expandMenu', { name: title })}
        onClick={onToggle}
      >
        {wide
          ? (open ? <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />)
          : (open ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />)}
        <span className={!open && wide ? 'text-sm font-semibold uppercase tracking-[0.12em] text-white/80 [writing-mode:vertical-rl]' : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70'}>{title}</span>
      </button>
      <div className={`grid min-h-0 transition-[grid-template-rows,opacity] ${ease} ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="max-h-[42vh] overflow-y-auto px-3 pb-3 lg:max-h-[calc(100dvh-12rem)]">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export function LiveDock() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const wide = useWide();
  const [nurseryOpen, setNurseryOpen] = useState(true);
  const [fieldOpen, setFieldOpen] = useState(true);
  const allowed = !!user?.isPlatformOwner || !!user?.features?.includes('LIVE_CAMERA');
  const canEdit = !!user?.isPlatformOwner || user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [stageIn, setStageIn] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [shots, setShots] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [cameraName, setCameraName] = useState('');
  const [cameraField, setCameraField] = useState('');
  const [pickedField, setPickedField] = useState<string | null>(null);
  const [setup, setSetup] = useState<CameraView | null>(null);
  const [armOn, setArmOn] = useState(false);
  const [armAlways, setArmAlways] = useState(true);
  const [armWindows, setArmWindows] = useState<AlertWindow[]>([{ from: '08:00', to: '18:00' }]);
  const [armBusy, setArmBusy] = useState(false);
  const [alarmOn, setAlarmOn] = useState(() => intrusionAlarmBusy());
  const videoRef = useRef(null as HTMLVideoElement | null);
  const [captureNode, setCaptureNode] = useState<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef(0);
  const stageTimer = useRef(0);
  const secure = window.isSecureContext;

  useEffect(() => subscribeIntrusionAlarm(() => setAlarmOn(intrusionAlarmBusy())), []);

  const site = sites.find((row) => row.id === siteId) ?? null;
  const cameras: CameraView[] = site?.fields.flatMap((field) => field.cameras.map((camera) => ({ ...camera, field: field.name }))) ?? [];
  const focused = cameras.find((camera) => camera.id === focusId) ?? null;
  const publishCamera = cameras.find((camera) => camera.id === publishing) ?? null;
  const voiceEnabled = !!publishCamera && publishCamera.alertEnabled && armedNow(publishCamera);
  const nurseryLabel = site?.name ?? t('live.open');
  const heardRef = useRef(new Set<string>());
  const lastHitRef = useRef({ kind: 'person', score: 0.5 });
  const alarmWasOn = useRef(false);

  const announce = useCallback((hit: DetectionHit) => (
    t('live.detectSpeak', {
      nursery: nurseryLabel,
      kind: t(`live.detectKinds.${hit.class}`),
    })
  ), [t, nurseryLabel]);

  const reportIntrusion = useCallback((hit: DetectionHit) => {
    if (!publishing) return;
    lastHitRef.current = { kind: hit.class, score: hit.score };
    void api
      .post(`/live/cameras/${publishing}/intrusion`, { kind: hit.class, score: hit.score })
      .then((res) => {
        const row = res.data?.data as { id?: string } | undefined;
        if (row?.id) heardRef.current.add(row.id);
      })
      .catch(() => undefined);
  }, [publishing]);

  const detection = useObjectDetection(captureNode, {
    active: !!publishing,
    voiceEnabled,
    language: i18n.language,
    announce,
    onIntrusion: reportIntrusion,
  });

  const bindCapture = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setCaptureNode(node);
  }, []);

  useEffect(() => {
    return subscribeIntrusionAlarm(() => {
      const busy = intrusionAlarmBusy();
      setAlarmOn(busy);
      if (busy && !alarmWasOn.current && publishing && streamRef.current) {
        const camera = cameras.find((row) => row.id === publishing);
        void beginAlarmEvidence(streamRef.current, videoRef.current, {
          cameraId: publishing,
          detectKind: lastHitRef.current.kind,
          score: lastHitRef.current.score,
          cameraName: camera?.name ?? 'Camera',
          nurseryName: nurseryLabel,
        });
      }
      if (!busy && alarmWasOn.current) {
        // Danger Alerts case is created here (Stop alert or 30s end).
        void finishAlarmEvidence()
          .then((saved) => {
            if (saved) setError(null);
            else setError(t('live.caseMissed'));
          })
          .catch((err) => setError(apiErrorMessage(err) || t('live.caseFail')));
      }
      alarmWasOn.current = busy;
    });
  }, [publishing, cameras, nurseryLabel, t]);

  useEffect(() => {
    if (!allowed) return undefined;
    let alive = true;
    const pull = () => {
      api
        .get('/live/intrusions')
        .then((res) => {
          if (!alive) return;
          const rows = res.data.data as {
            id: string;
            nurseryName: string;
            cameraId: string;
            kind: string;
          }[];
          const muted = localStorage.getItem('sn-live-detect-mute') === 'on';
          for (const row of rows) {
            if (heardRef.current.has(row.id)) continue;
            // This phone already spoke + alerted for its own camera.
            if (publishing && row.cameraId === publishing) {
              heardRef.current.add(row.id);
              continue;
            }
            if (intrusionAlarmBusy()) break;
            const line = t('live.detectSpeak', {
              nursery: row.nurseryName,
              kind: t(`live.detectKinds.${row.kind}`),
            });
            if (!playIntrusionAlarm(line, i18n.language, muted)) break;
            heardRef.current.add(row.id);
          }
        })
        .catch(() => undefined);
    };
    pull();
    const timer = window.setInterval(pull, 1500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [allowed, publishing, i18n.language, t]);

  const show = () => {
    setOpen(true);
    window.setTimeout(() => setShown(true), 20);
  };

  const hide = () => {
    setShown(false);
    setStageIn(false);
    window.clearTimeout(stageTimer.current);
    window.setTimeout(() => {
      setOpen(false);
      setFocusId(null);
    }, 300);
  };

  const openCamera = (id: string) => {
    window.clearTimeout(stageTimer.current);
    setFocusId(id);
    window.requestAnimationFrame(() => setStageIn(true));
  };

  const closeStage = () => {
    setStageIn(false);
    window.clearTimeout(stageTimer.current);
    stageTimer.current = window.setTimeout(() => setFocusId(null), 300);
  };

  const load = () => {
    api
      .get('/live/board')
      .then((res) => {
        const rows = res.data.data as SiteRow[];
        setSites(rows);
        setSiteId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
      })
      .catch((err) => setError(apiErrorMessage(err)));
  };

  useEffect(() => {
    if (!open) return undefined;
    load();
    const timer = window.setInterval(load, 2000);
    return () => window.clearInterval(timer);
  }, [open]);

  const stopPhone = () => {
    void finishAlarmEvidence().catch(() => undefined);
    stopIntrusionAlarm();
    alarmWasOn.current = false;
    window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPublishing(null);
  };

  const silenceAlarm = () => {
    stopIntrusionAlarm();
    alarmWasOn.current = false;
    void finishAlarmEvidence().catch(() => undefined);
  };

  useEffect(() => stopPhone, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [publishing, focusId, cameras.map((camera) => camera.id).join('|')]);

  const pushFrame = (cameraId: string) => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const scale = Math.min(1, 960 / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const form = new FormData();
      form.append('file', blob, 'frame.jpg');
      void api.post(`/live/cameras/${cameraId}/frame`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: [(data, headers) => {
          if (headers) delete headers['Content-Type'];
          return data;
        }],
      }).catch(() => undefined);
    }, 'image/jpeg', 0.62);
  };

  const startPhone = async (cameraId: string) => {
    setError(null);
    if (!secure || !navigator.mediaDevices?.getUserMedia) {
      setError(t('live.need', { url: `https://${window.location.host}/` }));
      return;
    }
    stopPhone();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPublishing(cameraId);
      timerRef.current = window.setInterval(() => pushFrame(cameraId), 450);
    } catch {
      stopPhone();
      setError(t('live.denied'));
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const watch = cameras.map((camera) => camera.id).filter((id) => id !== publishing);
    let alive = true;
    const pull = () => {
      watch.forEach((id) => {
        api
          .get(`/live/cameras/${id}/frame`, {
            responseType: 'blob',
            params: { t: Date.now() },
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          })
          .then((res) => {
            if (!alive) return;
            const blob = res.data as Blob;
            if (res.status === 204 || blob.size === 0) return;
            const next = URL.createObjectURL(blob);
            setShots((current) => {
              if (current[id]) URL.revokeObjectURL(current[id]);
              return { ...current, [id]: next };
            });
          })
          .catch(() => undefined);
      });
    };
    pull();
    const timer = window.setInterval(pull, 500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [open, cameras.map((camera) => camera.id).join('|'), publishing]);

  useEffect(() => {
    if (!publishing) return;
    const camera = sites.flatMap((row) => row.fields.flatMap((field) => field.cameras)).find((row) => row.id === publishing);
    if (!camera?.alertEnabled || !armedNow(camera)) return;
    let stopped = false;
    const send = async () => {
      if (stopped || !armedNow(camera)) return;
      const key = `sn-live-alert-${camera.id}-${kolkataDate()}`;
      if (sessionStorage.getItem(key)) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.45));
      if (!blob || stopped) return;
      const body = new FormData();
      body.append('file', blob, 'alert.jpg');
      try {
        const res = await api.post(`/live/cameras/${camera.id}/danger`, body, {
          transformRequest: [(data, headers) => {
            if (headers) delete headers['Content-Type'];
            return data;
          }],
        });
        if (res.status === 201 || res.data?.data?.skipped) sessionStorage.setItem(key, '1');
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    };
    void send();
    const timer = window.setInterval(() => void send(), 20000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [publishing, sites]);

  const openSetup = (camera: CameraView) => {
    const on = camera.alertConfigured ? camera.alertEnabled : !!site?.cctv;
    setSetup(camera);
    setArmOn(on);
    setArmAlways(camera.alertConfigured ? camera.alertAlways : on);
    setArmWindows(camera.alertWindows.length > 0 ? camera.alertWindows : [{ from: '08:00', to: '18:00' }]);
  };

  const changeWindow = (index: number, key: keyof AlertWindow, value: string) => {
    setArmWindows((rows) => rows.map((row, place) => (place === index ? { ...row, [key]: value } : row)));
  };

  const confirmSetup = async (event: FormEvent) => {
    event.preventDefault();
    if (!setup || armBusy) return;
    setArmBusy(true);
    setError(null);
    const id = setup.id;
    const next = { alertEnabled: armOn, alertAlways: armAlways, alertConfigured: true, alertWindows: armWindows };
    try {
      await api.patch(`/live/cameras/${id}/alert`, { enabled: armOn, always: armAlways, windows: armWindows });
      setSites((rows) => rows.map((row) => ({
        ...row,
        fields: row.fields.map((field) => ({
          ...field,
          cameras: field.cameras.map((camera) => (camera.id === id ? { ...camera, ...next } : camera)),
        })),
      })));
      setSetup(null);
      await startPhone(id);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setArmBusy(false);
    }
  };

  const addCamera = async (event: FormEvent) => {
    event.preventDefault();
    if (!cameraField || !cameraName.trim()) return;
    setError(null);
    try {
      await api.post('/live/cameras', { locationId: cameraField, name: cameraName.trim() });
      setCameraName('');
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (!allowed) return null;

  const showStream = (node: HTMLVideoElement | null) => {
    const stream = streamRef.current;
    if (!node || !stream) return;
    if (node.srcObject !== stream) node.srcObject = stream;
    void node.play().catch(() => undefined);
  };

  const mark = (large: boolean) => (
    <div className="grid h-full w-full place-items-center bg-black">
      <Camera className={large ? 'h-20 w-20 text-white' : 'h-10 w-10 text-white'} strokeWidth={1.5} aria-hidden />
    </div>
  );

  const picture = (camera: CameraView, large: boolean) => {
    const local = publishing === camera.id && (large || !focused);
    if (local) {
      return (
        <div className="relative h-full w-full">
          <video ref={showStream} className="h-full w-full object-cover" autoPlay muted playsInline />
          <DetectionOverlay
            hits={detection.hits}
            loading={detection.loading}
            failed={detection.failed}
            alerting={detection.alerting}
            muted={detection.muted}
            onToggleMute={detection.toggleMute}
            onStopAlert={detection.stopAlert}
            videoWidth={captureNode?.videoWidth ?? 0}
            videoHeight={captureNode?.videoHeight ?? 0}
          />
        </div>
      );
    }
    if (shots[camera.id]) return <img src={shots[camera.id]} alt="" className="h-full w-full object-cover" />;
    return mark(large);
  };

  const chooseNursery = (id: string) => {
    setSiteId(id);
    setPickedField(null);
    closeStage();
  };

  const chooseField = (fieldId: string) => {
    setPickedField(fieldId);
    const field = site?.fields.find((row) => row.id === fieldId);
    const first = field?.cameras[0];
    if (focused && first) openCamera(first.id);
  };

  const armText = (camera: CameraRow) => {
    if (!camera.alertEnabled) return '';
    if (camera.alertAlways) return t('live.armedAlways');
    return t('live.armed', { times: camera.alertWindows.map((row) => `${row.from}–${row.to}`).join(', ') });
  };

  const liveDot = (on: boolean) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${on ? 'bg-rose-600 text-white' : 'bg-white/15 text-white/70'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'animate-pulse bg-white' : 'bg-white/50'}`} />
      {on ? t('live.on') : t('live.off')}
    </span>
  );

  return (
    <>
      {publishing && <video ref={bindCapture} className="pointer-events-none fixed h-px w-px opacity-0" autoPlay muted playsInline />}
      {alarmOn && (
        <button
          type="button"
          className="fixed bottom-20 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg animate-pulse hover:bg-rose-700"
          onClick={silenceAlarm}
          aria-label={t('live.detectStopAlert')}
        >
          <BellOff className="h-4 w-4" aria-hidden />
          {t('live.detectStopAlert')}
        </button>
      )}
      <button
        type="button"
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-forest-700 text-white shadow-lg transition duration-300 hover:scale-105 hover:bg-forest-800"
        onClick={show}
        aria-label={t('live.open')}
      >
        <Video className="h-6 w-6" aria-hidden />
      </button>
      {open && (
        <div
          className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-3 ${shown ? 'bg-slate-950/70 backdrop-blur-[2px]' : 'bg-slate-950/0'} transition-all ${ease}`}
          onClick={hide}
        >
          <div
            className={`relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0c1222] text-white shadow-2xl transition sm:h-[calc(100dvh-1.5rem)] sm:max-w-[1480px] sm:rounded-[28px] sm:ring-1 sm:ring-white/10 ${ease} ${shown ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-[0.96] opacity-0'}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('live.open')}
          >
            <div className={`flex items-center justify-between gap-3 px-4 py-3 transition sm:px-5 ${ease} ${focused ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold tracking-tight">{t('live.open')}</h2>
                <p className="truncate text-xs text-white/50">{t('live.desk')}</p>
              </div>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" onClick={hide} aria-label={t('live.close')}>
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {error && <p className="px-5 pb-2 text-sm text-rose-300">{error}</p>}
            <div className={`flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3 lg:flex-row lg:overflow-hidden ${ease} ${focused && stageIn ? 'pointer-events-none scale-[0.97] opacity-80' : 'opacity-100'}`}>
              <MenuPane open={nurseryOpen} wide={wide} title={t('live.nurseries')} wideClass="lg:w-60" onToggle={() => setNurseryOpen((current) => !current)}>
                {sites.length === 0 ? (
                  <p className="mt-3 text-sm text-white/50">{t('live.empty')}</p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {sites.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${ease} ${row.id === siteId ? 'bg-white text-slate-900' : 'bg-white/5 text-white/80 hover:bg-white/10'}`}
                          onClick={() => chooseNursery(row.id)}
                        >
                          {row.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </MenuPane>
              <MenuPane open={fieldOpen} wide={wide} title={t('live.fields')} wideClass="lg:w-72" onToggle={() => setFieldOpen((current) => !current)}>
                {site && site.fields.length === 0 && <p className="mt-3 text-sm text-white/50">{t('live.noField')}</p>}
                <ul className="mt-3 space-y-3">
                  {site?.fields.map((field) => (
                    <li key={field.id}>
                      <button
                        type="button"
                        className={`w-full rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition ${ease} ${pickedField === field.id ? 'bg-white text-slate-900' : 'text-white/90 hover:bg-white/10'}`}
                        onClick={() => chooseField(field.id)}
                      >
                        {field.name}
                      </button>
                      <ul className="mt-1.5 space-y-1">
                        {field.cameras.map((camera) => (
                          <li key={camera.id}>
                            <button
                              type="button"
                              className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${ease} ${camera.id === focusId ? 'bg-white text-slate-900' : 'bg-white/5 text-white/80 hover:bg-white/10'}`}
                              onClick={() => openCamera(camera.id)}
                            >
                              <span className="truncate">{camera.name}</span>
                              <span className={`text-[11px] font-semibold ${camera.id === focusId ? 'text-rose-600' : camera.live ? 'text-rose-300' : 'text-white/35'}`}>{camera.live ? t('live.on') : t('live.off')}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                {canEdit && site && site.fields.length > 0 && (
                  <form onSubmit={addCamera} className="mt-4 space-y-2 border-t border-white/10 pt-3">
                    <select className="input py-1" value={cameraField} onChange={(event) => setCameraField(event.target.value)} aria-label={t('live.fields')}>
                      <option value="">{t('live.fields')}</option>
                      {site.fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
                    </select>
                    <div className="flex gap-1">
                      <input className="input py-1" value={cameraName} onChange={(event) => setCameraName(event.target.value)} placeholder={t('live.cameraName')} aria-label={t('live.cameraName')} />
                      <button className="btn-ghost shrink-0" type="submit">{t('live.addCamera')}</button>
                    </div>
                  </form>
                )}
              </MenuPane>
              <section className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {cameras.map((camera) => {
                    const on = camera.live || publishing === camera.id;
                    return (
                      <article key={camera.id} className={`overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-white/30 ${ease}`}>
                        <div className="relative aspect-video bg-black">
                          {picture(camera, false)}
                          <div className="absolute left-2.5 top-2.5">{liveDot(on)}</div>
                        </div>
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{camera.name}</div>
                            <div className="truncate text-xs text-white/45">{camera.field}</div>
                            {camera.alertEnabled && <div className="truncate text-[11px] text-amber-200">{armText(camera)}</div>}
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" onClick={() => openCamera(camera.id)} aria-label={t('live.large')}>
                              <Maximize2 className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-white/90"
                              onClick={() => (publishing === camera.id ? stopPhone() : openSetup(camera))}
                            >
                              {publishing === camera.id ? t('live.stop') : t('live.start')}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
            {focused && (
              <div className={`absolute inset-0 z-20 flex flex-col bg-[#0c1222] transition ${ease} ${stageIn ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
                <div className={`flex min-h-0 flex-1 flex-col p-3 transition sm:p-5 ${ease} ${stageIn ? 'scale-100' : 'scale-[0.97]'}`}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-white/90" onClick={closeStage}>
                      <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                      {t('live.shrink')}
                    </button>
                    {sites.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${ease} ${row.id === siteId ? 'bg-white text-slate-900' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                        onClick={() => chooseNursery(row.id)}
                      >
                        {row.name}
                      </button>
                    ))}
                    {site?.fields.map((field) => (
                      <button
                        key={field.id}
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-xs transition ${ease} ${pickedField === field.id ? 'bg-white text-slate-900' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                        onClick={() => chooseField(field.id)}
                      >
                        {field.name}
                      </button>
                    ))}
                    <button type="button" className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20" onClick={hide} aria-label={t('live.close')}>
                      <X className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                  <div className="relative min-h-0 flex-1 overflow-hidden rounded-[24px] bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
                    {picture(focused, true)}
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4">
                      <div className="flex min-w-0 items-start gap-2">
                        <button type="button" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-white/90" onClick={closeStage}>
                          <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                          {t('live.shrink')}
                        </button>
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold">{focused.name}</div>
                          <div className="truncate text-xs text-white/70">{focused.field}</div>
                          {focused.alertEnabled && <div className="truncate text-[11px] text-amber-200">{armText(focused)}</div>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {liveDot(focused.live || publishing === focused.id)}
                        <button
                          type="button"
                          className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-white/90"
                          onClick={() => (publishing === focused.id ? stopPhone() : openSetup(focused))}
                        >
                          {publishing === focused.id ? t('live.stop') : t('live.start')}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {cameras.map((camera) => (
                      <button
                        key={camera.id}
                        type="button"
                        className={`flex w-36 shrink-0 items-center gap-2 rounded-2xl bg-white/10 p-1.5 text-left ring-1 transition hover:bg-white/15 ${ease} ${camera.id === focused.id ? 'ring-white' : 'ring-white/10'}`}
                        onClick={() => openCamera(camera.id)}
                      >
                        <span className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-black">
                          {shots[camera.id] ? <img src={shots[camera.id]} alt="" className="h-full w-full object-cover" /> : <Camera className="h-4 w-4 text-white" strokeWidth={1.5} aria-hidden />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">{camera.name}</span>
                          <span className="block truncate text-[10px] text-white/50">{camera.field}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {setup && (
              <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/70 p-4" onClick={() => setSetup(null)}>
                <form className="max-h-[85dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl bg-white p-5 text-slate-900 shadow-2xl" onClick={(event) => event.stopPropagation()} onSubmit={(event) => void confirmSetup(event)}>
                  <div>
                    <h2 className="text-lg font-semibold">{t('live.infoTitle')}</h2>
                    <p className="mt-1 text-sm text-slate-600">{t('live.infoBody')}</p>
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold">{t('live.alertAsk')}</legend>
                    <div className="flex gap-4">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="radio" name="danger-alert" checked={armOn} onChange={() => setArmOn(true)} />
                        {t('live.alertOn')}
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="radio" name="danger-alert" checked={!armOn} onChange={() => setArmOn(false)} />
                        {t('live.alertOff')}
                      </label>
                    </div>
                  </fieldset>
                  {armOn && (
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-semibold">{t('live.alertEvery')}</legend>
                      <div className="flex gap-4">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="radio" name="alert-when" checked={armAlways} onChange={() => setArmAlways(true)} />
                          {t('live.alertAlways')}
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="radio" name="alert-when" checked={!armAlways} onChange={() => setArmAlways(false)} />
                          {t('live.alertTimes')}
                        </label>
                      </div>
                      {!armAlways && (
                        <div className="space-y-2">
                          {armWindows.map((row, index) => (
                            <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                              <label className="block text-sm">
                                <span className="mb-1 block font-medium">{t('live.alertFrom')}</span>
                                <input className="input" type="time" value={row.from} onChange={(event) => changeWindow(index, 'from', event.target.value)} required />
                              </label>
                              <label className="block text-sm">
                                <span className="mb-1 block font-medium">{t('live.alertTo')}</span>
                                <input className="input" type="time" value={row.to} onChange={(event) => changeWindow(index, 'to', event.target.value)} required />
                              </label>
                              {armWindows.length > 1 ? (
                                <button type="button" className="btn-ghost mb-0.5" onClick={() => setArmWindows((rows) => rows.filter((_, place) => place !== index))}>{t('live.removeTime')}</button>
                              ) : <span />}
                            </div>
                          ))}
                          {armWindows.length < 8 && (
                            <button type="button" className="btn-ghost" onClick={() => setArmWindows((rows) => [...rows, { from: '18:00', to: '22:00' }])}>{t('live.addTime')}</button>
                          )}
                        </div>
                      )}
                    </fieldset>
                  )}
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn-ghost" onClick={() => setSetup(null)}>{t('live.alertCancel')}</button>
                    <button type="submit" className="btn-primary" disabled={armBusy}>{t('live.alertGo')}</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
