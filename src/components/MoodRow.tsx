import type { Mood } from '../types';
import { MoodButton } from './MoodButton';

const MOODS: Mood[] = ['calm', 'loud', 'warm', 'lonely', 'bright'];

type Props = {
  selected: Mood | null;
  onSelect: (mood: Mood) => void;
};

export function MoodRow({ selected, onSelect }: Props) {
  return (
    <div role="group" aria-label="Mood selection" className="flex flex-wrap justify-center gap-2">
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
