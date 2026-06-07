import type { Mood } from '../types';
import { MoodButton } from './MoodButton';

const MOODS: Mood[] = ['calm', 'loud', 'warm', 'lonely', 'bright'];
const BUTTON_WIDTH = 56;

type Props = {
  selected: Mood | null;
  onSelect: (mood: Mood) => void;
};

export function MoodRow({ selected, onSelect }: Props) {
  const selectedIndex = selected ? MOODS.indexOf(selected) : -1;

  return (
    <div
      role="group"
      aria-label="Mood selection"
      className="
        fixed bottom-6 left-1/2 -translate-x-1/2 z-40
        flex w-fit
        bg-surface/95 backdrop-blur-sm
        rounded-full
        p-1
        shadow-lg
      "
    >
      <div
        className="
          absolute top-1 left-1
          h-[calc(100%-0.5rem)] w-14
          bg-on-surface
          rounded-full
          transition-transform duration-300 ease-out
          motion-reduce:transition-none
        "
        style={{
          transform: `translateX(${selectedIndex * BUTTON_WIDTH}px)`,
          opacity: selectedIndex === -1 ? 0 : 1,
        }}
        aria-hidden="true"
      />

      {MOODS.map((mood) => (
        <MoodButton
          key={mood}
          mood={mood}
          selected={mood === selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
