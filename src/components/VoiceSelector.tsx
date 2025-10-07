// VoiceSelector.tsx

import { UnifiedVoice } from './useAvailableVoices';

interface VoiceSelectorProps {
  voices: UnifiedVoice[];
  selected: UnifiedVoice | null;
  onChange: (voice: UnifiedVoice) => void;
}

const VoiceSelector = ({ voices, selected, onChange }: VoiceSelectorProps) => {
  return (
    <select
      value={selected?.id || ''}
      onChange={(e) => {
        const voice = voices.find((v) => v.id === e.target.value);
        if (voice) onChange(voice);
      }}
    >
      <option value="" disabled>
        Select a voice
      </option>
      {voices.map((voice) => (
        <option key={voice.id} value={voice.id}>
          {voice.label}
        </option>
      ))}
    </select>
  );
};

export default VoiceSelector;
