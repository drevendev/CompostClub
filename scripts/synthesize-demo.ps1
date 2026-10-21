param([string]$OutputDirectory = 'release/dev-article/narration')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$projectRoot = (Get-Location).Path
$outputPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
if (-not $outputPath.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Narration output must stay in this project.' }
[IO.Directory]::CreateDirectory($outputPath) | Out-Null
$cues = @(
  @{ start = 0.6; end = 7.7; text = 'Some ideas are too odd to schedule, and too interesting to delete. Give them a little garden.' },
  @{ start = 8.3; end = 15.7; text = 'Welcome to Compost Club. The sample uses fictional scraps and unchanged Gemma recordings.' },
  @{ start = 16.1; end = 24.6; text = 'Two scraps grow into one possibility. This is recorded mode, with no live generation.' },
  @{ start = 25.7; end = 34.4; text = 'Here is a real Gemma result for these exact inputs. You decide whether the combination is worth keeping.' },
  @{ start = 35.3; end = 45.1; text = 'Open its roots to read both parents and their exact fragments. The original model text stays attached.' },
  @{ start = 46.3; end = 53.1; text = 'Keep what makes you curious. Your collection is saved locally, in this browser.' },
  @{ start = 54.4; end = 61.3; text = 'Reload: your keeper is still here. Export Markdown with its sources and recorded label.' },
  @{ start = 62.2; end = 70.4; text = 'Earn a slot every fifteen minutes, up to three. The demo clock skips time, without generating.' },
  @{ start = 71.2; end = 79.7; text = 'Four B passed all twenty-four format checks. Browser models failed. You still judge usefulness.' },
  @{ start = 80.4; end = 88.8; text = 'Explore the public code and evidence. Live generation needs local Ollama. Let your wild ideas ferment.' }
)
$synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
  $synth.SelectVoice('Microsoft Zira Desktop')
  $format = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  for ($i = 0; $i -lt $cues.Count; $i++) {
    $file = '{0:D2}.wav' -f ($i + 1)
    $synth.Rate = 0
    $synth.SetOutputToWaveFile((Join-Path $outputPath $file), $format)
    $synth.Speak($cues[$i].text)
    $synth.SetOutputToNull()
    $cues[$i].file = $file
    $cues[$i].rate = 0
  }
  [ordered]@{
    engine = 'Windows System.Speech / SAPI'
    voice = $synth.Voice.Name
    culture = $synth.Voice.Culture.Name
    synthetic = $true
    network = 'none; installed local voice, no download'
    scriptBasis = 'docs/DEMO_SCRIPT.md; shortened phrases preserve each scene meaning and fit its existing duration'
    sampleRate = 48000
    cues = $cues
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputPath 'voice-cues.json') -Encoding utf8
} finally { $synth.Dispose() }
Write-Output 'Generated 10 local English voice segments.'
