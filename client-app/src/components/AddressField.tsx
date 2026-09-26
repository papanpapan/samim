import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { Field } from './ui';

interface Place {
  label: string;
  latitude: number;
  longitude: number;
}

export function AddressField({
  value,
  why,
  example,
  label,
  onChange,
}: {
  value: string;
  why?: string;
  example: string;
  label?: string;
  onChange: (next: { address: string; latitude?: number; longitude?: number }) => void;
}) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .get('/platform/places', { params: { q: query } })
        .then((res) => setSuggestions((res.data.data as Place[]).filter((place) => place.label !== query)))
        .catch(() => setSuggestions([]));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [value]);

  const here = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        api
          .get('/platform/places/here', {
            params: { lat: position.coords.latitude, lon: position.coords.longitude },
          })
          .then((res) => {
            const place = res.data.data as Place | null;
            if (place) {
              onChange({ address: place.label, latitude: place.latitude, longitude: place.longitude });
              setSuggestions([]);
            }
          })
          .finally(() => setLocating(false));
      },
      () => setLocating(false),
    );
  };

  return (
    <Field label={label ?? t('platform.address')} why={why} example={example}>
      <input
        className="input"
        required
        minLength={3}
        placeholder={example}
        value={value}
        onChange={(event) => {
          setOpen(true);
          onChange({ address: event.target.value });
        }}
        onFocus={() => setOpen(true)}
      />
      <button className="btn-ghost mt-2 !min-h-9 !px-3 !text-xs" type="button" onClick={here} disabled={locating}>
        {locating ? t('platform.locating') : t('platform.useLocation')}
      </button>
      {open && suggestions.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {suggestions.map((place) => (
            <li key={`${place.latitude}-${place.longitude}`}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  onChange({ address: place.label, latitude: place.latitude, longitude: place.longitude });
                  setSuggestions([]);
                  setOpen(false);
                }}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
