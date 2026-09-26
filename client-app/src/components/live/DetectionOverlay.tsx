import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, BellOff, Volume2, VolumeX } from 'lucide-react';
import type { DetectionHit } from '../../hooks/useObjectDetection';

function coverMap(
  videoW: number,
  videoH: number,
  elW: number,
  elH: number,
  box: DetectionHit['box'],
) {
  if (videoW <= 0 || videoH <= 0 || elW <= 0 || elH <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const videoAspect = videoW / videoH;
  const elAspect = elW / elH;
  let renderW: number;
  let renderH: number;
  let offsetX: number;
  let offsetY: number;
  if (videoAspect > elAspect) {
    renderH = elH;
    renderW = elH * videoAspect;
    offsetX = (elW - renderW) / 2;
    offsetY = 0;
  } else {
    renderW = elW;
    renderH = elW / videoAspect;
    offsetX = 0;
    offsetY = (elH - renderH) / 2;
  }
  const scaleX = renderW / videoW;
  const scaleY = renderH / videoH;
  return {
    left: offsetX + box.x * scaleX,
    top: offsetY + box.y * scaleY,
    width: box.width * scaleX,
    height: box.height * scaleY,
  };
}

export function DetectionOverlay({
  hits,
  loading,
  failed,
  alerting,
  muted,
  onToggleMute,
  onStopAlert,
  videoWidth,
  videoHeight,
}: {
  hits: DetectionHit[];
  loading: boolean;
  failed: boolean;
  alerting: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onStopAlert: () => void;
  videoWidth: number;
  videoHeight: number;
}) {
  const { t } = useTranslation();
  const shell = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const top = hits[0] ?? null;

  useEffect(() => {
    const node = shell.current;
    if (!node) return undefined;
    const measure = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={shell} className="pointer-events-none absolute inset-0 z-10">
      {hits.map((hit, index) => {
        const box = coverMap(videoWidth, videoHeight, size.w, size.h, hit.box);
        if (box.width < 4 || box.height < 4) return null;
        return (
          <div
            key={`${hit.class}-${index}`}
            className="absolute rounded-md border-2 border-amber-300/90 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          />
        );
      })}
      <div className="pointer-events-auto absolute left-2.5 top-10 flex max-w-[calc(100%-5rem)] flex-col gap-1.5">
        {alerting && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow animate-pulse ring-2 ring-white/40"
            onClick={onStopAlert}
            aria-label={t('live.detectStopAlert')}
            title={t('live.detectStopAlert')}
          >
            <BellOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('live.detectStopAlert')}
          </button>
        )}
        {top && !alerting && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-slate-950 shadow">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('live.detectHit', { kind: t(`live.detectKinds.${top.class}`), score: Math.round(top.score * 100) })}
          </span>
        )}
        {loading && !top && !alerting && (
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white/80">
            {t('live.detectLoading')}
          </span>
        )}
        {failed && (
          <span className="rounded-full bg-rose-600/90 px-2.5 py-1 text-[11px] font-medium text-white">
            {t('live.detectFailed')}
          </span>
        )}
      </div>
      <button
        type="button"
        className="pointer-events-auto absolute bottom-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/20 transition hover:bg-black/70"
        onClick={onToggleMute}
        aria-label={muted ? t('live.detectUnmute') : t('live.detectMute')}
        title={muted ? t('live.detectUnmute') : t('live.detectMute')}
      >
        {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
