import type { Character } from '../types';

interface CharacterSelectProps {
  characters: Character[];
  current: Character | null;
  onChange: (character: Character) => void;
  disabled: boolean;
}

export function CharacterSelect({ characters, current, onChange, disabled }: CharacterSelectProps) {
  return (
    <select
      value={current?.id ?? ''}
      onChange={(e) => {
        const char = characters.find((c) => c.id === e.target.value);
        if (char) onChange(char);
      }}
      disabled={disabled}
      className="bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
    >
      {characters
        .filter((c) => c.id !== '_example')
        .map((char) => (
          <option key={char.id} value={char.id}>
            {char.name} ({char.lang})
          </option>
        ))}
    </select>
  );
}
