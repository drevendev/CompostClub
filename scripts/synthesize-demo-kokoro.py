"""Explicit local Kokoro af_heart synthesis; no automatic download or cloud fallback."""
import hashlib
import importlib.metadata
import json
import pathlib
import os
import time

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

root = pathlib.Path(__file__).resolve().parents[1]
model = root / '.local/kokoro/kokoro-v1.0.onnx'
voices = root / '.local/kokoro/voices-v1.0.bin'
if not model.is_file() or not voices.is_file():
    raise SystemExit('Install the disclosed Kokoro model/voice files under .local/kokoro first; no hidden download is performed.')
media = root / os.environ.get('COMPOST_DEMO_DIR', 'release/dev-article')
out = media / 'narration-heart'
out.mkdir(parents=True, exist_ok=True)
config = json.loads((root / 'docs/demo-narration.json').read_text(encoding='utf-8'))
capture = json.loads((media / 'capture-receipt.json').read_text(encoding='utf-8'))
engine = Kokoro(str(model), str(voices))
records = []
rate = 24000
mix = np.zeros(round(capture['video']['duration'] * rate), dtype=np.float32)
for i, cue in enumerate(config['cues']):
    started = time.perf_counter()
    samples, actual_rate = engine.create(cue['text'], voice=config['voice'], speed=config['speed'], lang=config['language'])
    if actual_rate != rate:
        raise RuntimeError('Unexpected model sample rate')
    duration = len(samples) / rate
    file = f'{i+1:02}.wav'
    sf.write(out / file, samples, rate, subtype='PCM_16')
    if duration > cue['end'] - cue['start'] - 0.1:
        raise RuntimeError(f'Cue {i+1} is {duration:.2f}s; shorten the script, never cut or stretch speech. Raw WAV retained.')
    fade = min(round(rate * .008), len(samples) // 2)
    samples[:fade] *= np.linspace(0, 1, fade)
    samples[-fade:] *= np.linspace(1, 0, fade)
    start = round(cue['start'] * rate)
    mix[start:start+len(samples)] = samples
    records.append({**cue, 'file': file, 'duration': duration, 'finish': cue['start']+duration, 'renderSeconds': time.perf_counter()-started, 'sha256': hashlib.sha256((out/file).read_bytes()).hexdigest()})
    print(f'Kokoro af_heart {i+1}/10: {duration:.2f}s', flush=True)
peak = float(np.max(np.abs(mix)))
if not peak:
    raise RuntimeError('Silent model output')
gain = min(2.0, .84/peak)
mix *= gain
sf.write(out/'voiceover.wav', mix, rate, subtype='PCM_16')
def stamp(t):
    ms = round(t*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
(out/'narration.srt').write_text('\n\n'.join(f"{i+1}\n{stamp(c['start'])} --> {stamp(c['finish'])}\n{c['text']}" for i,c in enumerate(records))+'\n', encoding='utf-8')
report = {'engine':'Kokoro ONNX', 'model':'Kokoro-82M v1.0', 'voice':config['voice'], 'speed':config['speed'], 'culture':config['language'], 'synthetic':True, 'network':'none during synthesis; model installation was explicit', 'modelLicense':'Apache-2.0', 'runtimeLicense':'MIT', 'sampleRate':rate, 'duration':capture['video']['duration'], 'gain':gain, 'modelSha256':hashlib.file_digest(model.open('rb'),'sha256').hexdigest(), 'voicesSha256':hashlib.file_digest(voices.open('rb'),'sha256').hexdigest(), 'mixSha256':hashlib.sha256((out/'voiceover.wav').read_bytes()).hexdigest(), 'pictureSha256':capture['outputs']['compost-club-demo.mp4']['sha256'], 'packages':{name:importlib.metadata.version(name) for name in ['kokoro-onnx','onnxruntime','soundfile','numpy','phonemizer']}, 'cues':records, 'timeStretch':False, 'voiceReference':'Same af_heart / speed 1.0 profile as the previously approved PatchPitch demo; no reference-voice cloning'}
(out/'narration-timing.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('Saved complete local neural narration and timing evidence.',flush=True)
