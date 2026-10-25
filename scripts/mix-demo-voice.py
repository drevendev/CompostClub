"""Place local SAPI narration on the existing video timeline without stretching it."""
import array
import hashlib
import json
import math
import pathlib
import sys
import wave

root = pathlib.Path.cwd()
folder = root / 'release/dev-article/narration'
data = json.loads((folder / 'voice-cues.json').read_text(encoding='utf-8-sig'))
capture = json.loads((root / 'release/dev-article/capture-receipt.json').read_text(encoding='utf-8'))
rate = data['sampleRate']
duration = capture['video']['duration']
mix = array.array('h', [0]) * math.ceil(duration * rate)
peak = 0
for cue in data['cues']:
    file = folder / cue['file']
    with wave.open(str(file), 'rb') as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, rate):
            raise ValueError(f'Unexpected PCM format: {file.name}')
        samples = array.array('h', wav.readframes(wav.getnframes()))
    if sys.byteorder != 'little':
        samples.byteswap()
    clip_duration = len(samples) / rate
    available = cue['end'] - cue['start']
    cue['duration'] = clip_duration
    cue['finish'] = cue['start'] + clip_duration
    if clip_duration > available:
        raise ValueError(f'{file.name} is {clip_duration:.3f}s but has {available:.3f}s; shorten its text, do not cut speech')
    cue['sha256'] = hashlib.sha256(file.read_bytes()).hexdigest()
    start = round(cue['start'] * rate)
    fade = round(0.008 * rate)
    for i, sample in enumerate(samples):
        envelope = min(1.0, i / fade, (len(samples) - 1 - i) / fade)
        value = round(sample * envelope)
        if mix[start + i] != 0:
            raise ValueError('Voice segments overlap')
        mix[start + i] = value
        peak = max(peak, abs(value))
if peak == 0:
    raise ValueError('Narration is silent')
gain = min(1.6, (32767 * 0.84) / peak)
for i, sample in enumerate(mix):
    mix[i] = round(sample * gain)
if sys.byteorder != 'little':
    mix.byteswap()
with wave.open(str(folder / 'voiceover.wav'), 'wb') as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(rate)
    wav.writeframes(mix.tobytes())

def stamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}'

(folder / 'narration.srt').write_text('\n\n'.join(
    f"{i+1}\n{stamp(cue['start'])} --> {stamp(cue['finish'])}\n{cue['text']}"
    for i, cue in enumerate(data['cues'])
) + '\n', encoding='utf-8')
data.update({
    'duration': duration,
    'gain': gain,
    'peakBeforeGain': peak / 32768,
    'mixSha256': hashlib.sha256((folder / 'voiceover.wav').read_bytes()).hexdigest(),
    'pictureSha256': capture['outputs']['compost-club-demo.mp4']['sha256'],
    'speechPolicy': 'Natural rate; no time stretching, truncated words, overlapping segments or invented live inference',
})
(folder / 'narration-timing.json').write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
for cue in data['cues']:
    print(f"{cue['file']}: {cue['start']:.2f}-{cue['finish']:.2f}s, limit {cue['end']:.2f}s")
