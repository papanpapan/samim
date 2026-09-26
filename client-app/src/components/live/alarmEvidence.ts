import { api } from '../../api/client';



export type EvidenceMeta = {

  cameraId: string;

  detectKind: string;

  score: number;

  cameraName: string;

  nurseryName: string;

};



type Session = {

  meta: EvidenceMeta;

  photo: Blob | null;

  chunks: Blob[];

  recorder: MediaRecorder | null;

  mime: string;

  video: HTMLVideoElement | null;

};



let session: Session | null = null;

let beginGate: Promise<void> | null = null;



function pickMime() {

  if (typeof MediaRecorder === 'undefined') return '';

  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) return 'video/webm;codecs=vp8';

  if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm';

  if (MediaRecorder.isTypeSupported('video/mp4')) return 'video/mp4';

  return '';

}



async function snapPhoto(video: HTMLVideoElement | null): Promise<Blob | null> {

  if (!video || video.readyState < 2 || !video.videoWidth) return null;

  const canvas = document.createElement('canvas');

  const scale = Math.min(1, 960 / video.videoWidth);

  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));

  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72));

}



export function evidenceActive() {

  return !!session || !!beginGate;

}



export async function beginAlarmEvidence(

  stream: MediaStream,

  video: HTMLVideoElement | null,

  meta: EvidenceMeta,

) {

  if (session || beginGate) return;



  beginGate = (async () => {

    const mime = pickMime();

    const chunks: Blob[] = [];

    // Reserve the session immediately so a fast Stop still finishes this cycle.

    session = {

      meta,

      photo: null,

      chunks,

      recorder: null,

      mime: mime || 'video/webm',

      video,

    };



    const photo = await snapPhoto(video);

    if (!session || session.meta.cameraId !== meta.cameraId) return;

    session.photo = photo;



    if (mime && stream.getVideoTracks().some((track) => track.readyState === 'live')) {

      try {

        const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 600_000 });

        recorder.ondataavailable = (event) => {

          if (event.data.size > 0) chunks.push(event.data);

        };

        recorder.start(1000);

        if (session && session.meta.cameraId === meta.cameraId) {

          session.recorder = recorder;

        } else {

          try { recorder.stop(); } catch { /* ignore */ }

        }

      } catch {

        /* photo-only case is still valid */

      }

    }

  })();



  try {

    await beginGate;

  } finally {

    beginGate = null;

  }

}



export async function finishAlarmEvidence(): Promise<boolean> {

  if (beginGate) {

    try { await beginGate; } catch { /* continue with whatever session we have */ }

  }



  const current = session;

  session = null;

  if (!current) return false;



  const { recorder, chunks, mime } = current;

  const videoBlob = await new Promise<Blob | null>((resolve) => {

    if (!recorder) {

      resolve(chunks.length > 0 ? new Blob(chunks, { type: mime }) : null);

      return;

    }

    if (recorder.state === 'inactive') {

      resolve(chunks.length > 0 ? new Blob(chunks, { type: mime }) : null);

      return;

    }

    const timer = window.setTimeout(() => {

      resolve(chunks.length > 0 ? new Blob(chunks, { type: mime }) : null);

    }, 2500);

    recorder.onstop = () => {

      window.clearTimeout(timer);

      resolve(chunks.length > 0 ? new Blob(chunks, { type: mime }) : null);

    };

    try {

      recorder.stop();

    } catch {

      window.clearTimeout(timer);

      resolve(chunks.length > 0 ? new Blob(chunks, { type: mime }) : null);

    }

  });



  let photo = current.photo;

  if (!photo) photo = await snapPhoto(current.video);



  if (!photo && !videoBlob) return false;



  const { meta } = current;

  const history = [

    `Nursery: ${meta.nurseryName}`,

    `Camera: ${meta.cameraName}`,

    `Detected: ${meta.detectKind}`,

    `Score: ${Math.round(meta.score * 100)}%`,

    `Raised: ${new Date().toLocaleString()}`,

    'Evidence recorded while the danger alert sounded until Stop alert.',

  ].join('\n');



  const body = new FormData();

  body.append('detectKind', meta.detectKind);

  body.append('score', String(meta.score));

  body.append('message', `Intrusion · ${meta.detectKind} · ${meta.cameraName}`);

  body.append('history', history);

  if (photo) body.append('file', photo, 'alert.jpg');

  if (videoBlob) {

    const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';

    body.append('video', videoBlob, `alert.${ext}`);

  }



  await api.post(`/live/cameras/${meta.cameraId}/case`, body, {

    transformRequest: [(data, headers) => {

      if (headers) delete headers['Content-Type'];

      return data;

    }],

  });

  return true;

}



export function cancelAlarmEvidence() {

  const current = session;

  session = null;

  if (current?.recorder && current.recorder.state !== 'inactive') {

    try {

      current.recorder.stop();

    } catch {

      /* ignore */

    }

  }

}


