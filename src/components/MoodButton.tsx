import type { Mood } from '../types';

type Props = {
  mood: Mood;
  selected: boolean;
  onSelect: (mood: Mood) => void;
};

export function MoodButton({ mood, selected, onSelect }: Props) {
  const base = 'px-5 py-2 rounded-md text-sm font-medium transition-colors';

  return (
    <button
      className={
        selected
          ? `${base} bg-primary text-on-primary`
          : `${base} border border-outline text-on-background hover:bg-surface-container`
      }
      onClick={() => onSelect(mood)}
    >
      {mood}
    </button>
  );
}
