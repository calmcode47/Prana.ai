import React from 'react';
import { LatestAlertResponse } from '../../api/client';

interface BulletinBoardProps {
  bulletin: LatestAlertResponse | null;
  selectedLang: 'en' | 'hi' | 'pa';
  onSelectLang: (lang: 'en' | 'hi' | 'pa') => void;
}

export const BulletinBoard: React.FC<BulletinBoardProps> = ({
  bulletin,
  selectedLang,
  onSelectLang,
}) => {
  return (
    <div className="mt-6 p-4 rounded-2xl bg-surface-vanilla-strong border-2 border-ink-black shadow-[3px_3px_0px_#18181B] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="space-y-1 max-w-3xl">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-coral-watermelon-vivid text-on-secondary font-label-md text-label-md font-bold uppercase animate-pulse">
            Official Statutory Bulletin
          </span>
          <span className="font-mono text-xs text-ink-muted">
            ID: {bulletin?.incident_id || 'No current incident'}
          </span>
        </div>
        <h4 className="font-headline-sm text-headline-sm font-bold text-ink-black">
          {bulletin?.title || 'NO CURRENT BACKEND BULLETIN'}
        </h4>
        <p className="font-body-sm text-body-sm text-ink-muted leading-relaxed">
          {bulletin?.body || 'The backend has no current alert bulletin for this language.'}
        </p>
      </div>

      {/* Language Switcher Pill */}
      <div className="flex items-center gap-1.5 p-1 rounded-full bg-canvas-cream border border-ink-black shadow-[2px_2px_0px_#18181B] flex-shrink-0">
        {(['en', 'hi', 'pa'] as const).map((lang) => {
          const label = lang === 'en' ? 'English' : lang === 'hi' ? 'हिंदी' : 'ਪੰਜਾਬੀ';
          const isSelected = selectedLang === lang;
          return (
            <button
              key={lang}
              type="button"
              onClick={() => onSelectLang(lang)}
              className={`px-3 py-1 rounded-full font-label-md text-label-md transition-all cursor-pointer ${
                isSelected
                  ? 'bg-ink-black text-canvas-cream font-bold shadow-[1px_1px_0px_#18181B]'
                  : 'text-ink-muted hover:text-ink-black'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
