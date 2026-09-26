import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../api/client';
import { speak } from '../a11y/speak';
import { ErrorNote, PageHeader } from '../components/ui';

interface SpeechResult {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRec {
  lang: string;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
}

function recognizer(): SpeechRec | null {
  const host = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function VoiceDesk() {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async (spoken: string) => {
    const query = spoken.trim();
    if (query.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/smart/voice', { text: query });
      const data = res.data.data as { answer: string; answerEn: string };
      setAnswer(data.answer);
      const voices = window.speechSynthesis?.getVoices() ?? [];
      const bangla = voices.some((voice) => voice.lang.toLowerCase().startsWith('bn'));
      speak(bangla || i18n.language !== 'bn' ? data.answer : data.answerEn, bangla ? i18n.language : 'en');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    const rec = recognizer();
    if (!rec) {
      setError(t('voiceDesk.noMic'));
      return;
    }
    rec.lang = i18n.language === 'bn' ? 'bn-BD' : 'en-IN';
    rec.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? '';
      setText(heard);
      void ask(heard);
    };
    rec.onerror = () => setError(t('voiceDesk.noMic'));
    rec.start();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(text);
  };

  return (
    <div>
      <PageHeader title={t('voiceDesk.title')} subtitle={t('voiceDesk.subtitle')} />
      <ErrorNote message={error} />
      <form onSubmit={submit} className="card space-y-4 p-5">
        <p className="text-sm text-slate-600">{t('voiceDesk.hint')}</p>
        <textarea className="input min-h-24" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('voiceDesk.placeholder')} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="btn-primary" type="button" onClick={listen}>{t('voiceDesk.listen')}</button>
          <button className="btn-ghost" disabled={busy}>{busy ? t('common.loading') : t('voiceDesk.ask')}</button>
        </div>
        {answer && <p className="rounded-xl bg-slate-50 p-4 text-lg font-semibold text-slate-800">{answer}</p>}
      </form>
    </div>
  );
}
