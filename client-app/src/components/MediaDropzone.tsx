import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ImagePlus, X } from 'lucide-react';

function fileListOf(files: File[]): FileList {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  return transfer.files;
}

async function cameraStream(withAudio: boolean): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: 'environment' } }, audio: withAudio },
    { video: true, audio: withAudio },
  ];
  if (withAudio) {
    attempts.push(
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
      { video: true, audio: false },
    );
  }
  let last: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

function recorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((item) => MediaRecorder.isTypeSupported(item)) ?? '';
}

export function MediaDropzone({
  previews,
  onAdd,
  onRemove,
  hint,
  removeLabel,
  accept,
  multiple = true,
  dense = false,
}: {
  previews: string[];
  onAdd: (list: FileList | null) => void;
  onRemove: (index: number) => void;
  hint: string;
  removeLabel: string;
  accept?: string;
  multiple?: boolean;
  dense?: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const [over, setOver] = useState(false);
  const [camera, setCamera] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoMode = (accept ?? '').includes('video');

  const release = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera(false);
    setRecording(false);
  };

  useEffect(() => () => {
    discardRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    const preview = videoRef.current;
    const stream = streamRef.current;
    if (!camera || !preview || !stream) return;
    preview.srcObject = stream;
    void preview.play().catch(() => undefined);
  }, [camera]);

  const closeCamera = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') {
      discardRef.current = true;
      recorder.stop();
      return;
    }
    release();
  };

  const openCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('media.cameraBlocked'));
      return;
    }
    try {
      const stream = await cameraStream(videoMode);
      streamRef.current = stream;
      setCamera(true);
    } catch {
      setCameraError(t('media.cameraBlocked'));
    }
  };

  const takePhoto = () => {
    const preview = videoRef.current;
    if (!preview || !preview.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = preview.videoWidth;
    canvas.height = preview.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(preview, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onAdd(fileListOf([new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })]));
      release();
    }, 'image/jpeg', 0.92);
  };

  const toggleRecord = () => {
    if (recording && recorderRef.current && recorderRef.current.state === 'recording') {
      discardRef.current = false;
      recorderRef.current.stop();
      return;
    }
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      setCameraError(t('media.cameraBlocked'));
      return;
    }
    const mime = recorderMime();
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const keep = !discardRef.current;
      discardRef.current = false;
      if (keep) {
        const type = (recorder.mimeType || 'video/webm').split(';')[0] || 'video/webm';
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunksRef.current, { type });
        onAdd(fileListOf([new File([blob], `camera-${Date.now()}.${ext}`, { type })]));
      }
      release();
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const dropClass = over ? 'border-forest-600 bg-forest-50' : 'border-slate-300 bg-slate-50';
  const actionClass = 'btn-ghost !min-h-10 w-full !px-2';
  const previewsNode = previews.length > 0 ? (
    <div className="mt-3 flex flex-wrap gap-2">
      {previews.map((url, index) => (
        <div key={url} className="relative">
          <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
          <button
            type="button"
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"
            aria-label={removeLabel}
            onClick={() => onRemove(index)}
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div>
      {dense ? (
        <div
          className={`rounded-xl border border-dashed px-3 py-3 ${dropClass}`}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            onAdd(event.dataTransfer.files);
          }}
        >
          <p className="text-xs text-slate-500">{hint}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className={actionClass} onClick={() => inputRef.current?.click()}>{t('media.chooseFile')}</button>
            <button type="button" className={actionClass} onClick={() => void openCamera()}>
              <Camera className="h-4 w-4 shrink-0" aria-hidden />
              {videoMode ? t('media.record') : t('media.takePhoto')}
            </button>
          </div>
          {previewsNode}
        </div>
      ) : (
      <button
        type="button"
        className={`flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed px-3 py-4 text-center text-sm text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-forest-600 ${dropClass} hover:bg-white`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          onAdd(event.dataTransfer.files);
        }}
      >
        <ImagePlus className="mb-2 h-5 w-5" aria-hidden />
        {hint}
      </button>
      )}
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={accept ?? 'image/*'}
        multiple={multiple}
        onChange={(event) => {
          onAdd(event.target.files);
          event.target.value = '';
        }}
      />
      {!dense && (
        <button type="button" className="btn-ghost mt-2" onClick={() => void openCamera()}>
          <Camera className="h-4 w-4" aria-hidden />
          {videoMode ? t('media.record') : t('media.takePhoto')}
        </button>
      )}
      {cameraError && <p className="mt-2 text-sm text-rose-700" role="alert">{cameraError}</p>}
      {camera && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-950 p-3">
          <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black" autoPlay muted playsInline />
          <div className="mt-3 flex flex-wrap gap-2">
            {videoMode ? (
              <button type="button" className="btn-primary" onClick={toggleRecord}>
                {recording ? t('media.stop') : t('media.record')}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={takePhoto}>{t('media.takePhoto')}</button>
            )}
            <button type="button" className="btn-ghost" onClick={closeCamera}>{t('media.closeCamera')}</button>
          </div>
        </div>
      )}
      {!dense && previewsNode}
    </div>
  );
}
