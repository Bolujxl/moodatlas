import type { Mood } from '../types';

type Props = {
  mood: Mood;
  selected: boolean;
  onSelect: (mood: Mood) => void;
};

export function MoodButton({ mood, selected, onSelect }: Props) {
  return (
    <button
      className={`relative z-10 w-14 h-8 text-xs font-medium transition-colors duration-200 motion-reduce:transition-none ${
        selected
          ? 'text-surface'
          : 'text-on-surface/70 hover:text-on-surface'
      }`}
      onClick={() => onSelect(mood)}
    >
      {mood}
    </button>
  );
}
