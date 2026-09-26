import { Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { speak } from '../a11y/speak';

export function AudioAssistTrigger({
  textKey,
  voiceText,
  className = '',
  compact = false,
}: {
  textKey: string;
  voiceText?: string;
  className?: string;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const text = voiceText ?? t(textKey);

  return (
    <button
      type="button"
      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200 ${className}`}
      aria-label={t('common.hear')}
      title={t('common.hear')}
      data-speak={text}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        speak(text, i18n.language);
      }}
    >
      <Volume2 className={compact ? 'h-3.5 w-3.5' : 'h-5 w-5'} aria-hidden />
    </button>
  );
}
