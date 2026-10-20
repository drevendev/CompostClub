export const MODELS = {
  '270m': {
    id: 'onnx-community/gemma-3-270m-it-ONNX',
    revision: '2dbbfdb1b59bd034eb959428c6a7da9dd7ea27f0',
    bytes: 293284073,
    label: 'Gemma 3 · 270M',
    dtype: 'q4f16',
  },
  '1b': {
    id: 'onnx-community/gemma-3-1b-it-ONNX',
    revision: 'a58439f40017d3b99c7d378ff525e54e0ba08ebf',
    bytes: 783856804,
    label: 'Gemma 3 · 1B',
    dtype: 'q4f16',
  },
} as const;
export type ModelKey = keyof typeof MODELS;
