const WIRE_VARINT = 0;
const WIRE_LENGTH = 2;
const FLOAT = 1;
const INTS_ATTRIBUTE = 7;
const OPSET = 13;
const IR_VERSION = 8;

function varint(value: number): number[] {
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0x7f) {
    bytes.push((rest & 0x7f) | 0x80);
    rest = Math.floor(rest / 128);
  }
  bytes.push(rest);
  return bytes;
}

const tag = (field: number, wire: number) => varint((field << 3) | wire);
const number = (field: number, value: number) => [...tag(field, WIRE_VARINT), ...varint(value)];
const bytes = (field: number, payload: number[]) => [
  ...tag(field, WIRE_LENGTH),
  ...varint(payload.length),
  ...payload,
];
const text = (field: number, value: string) => bytes(field, [...Buffer.from(value, 'utf8')]);

function valueInfo(name: string, dims: (number | string)[]): number[] {
  const shape = dims.flatMap((dim) =>
    bytes(1, typeof dim === 'number' ? number(1, dim) : text(2, dim))
  );
  const tensorType = [...number(1, FLOAT), ...bytes(2, shape)];
  return [...text(1, name), ...bytes(2, bytes(1, tensorType))];
}

function node(op: string, input: string, output: string, attributes: number[][]): number[] {
  return [
    ...text(1, input),
    ...text(2, output),
    ...text(4, op),
    ...attributes.flatMap((attribute) => bytes(5, attribute)),
  ];
}

const ints = (name: string, values: number[]) => [
  ...text(1, name),
  ...values.flatMap((value) => number(8, value)),
  ...number(20, INTS_ATTRIBUTE),
];
const int = (name: string, value: number) => [
  ...text(1, name),
  ...number(3, value),
  ...number(20, 2),
];

/**
 * A model of two operators that scores a frame by its mean pixel value: `ReduceMean` over the three
 * planes of a `[frames, 3, size, size]` input and a `Flatten` to `[frames, 1]`. Valid ONNX that
 * `onnxruntime-node` runs, small enough to build in a spec instead of committing a binary.
 */
export function tinyBrightnessModel(): Buffer {
  const graph = [
    ...bytes(
      1,
      node('ReduceMean', 'pixels', 'mean', [ints('axes', [1, 2, 3]), int('keepdims', 1)])
    ),
    ...bytes(1, node('Flatten', 'mean', 'scores', [int('axis', 1)])),
    ...text(2, 'brightness'),
    ...bytes(11, valueInfo('pixels', ['frames', 3, 'height', 'width'])),
    ...bytes(12, valueInfo('scores', ['frames', 1])),
  ];
  const model = [...number(1, IR_VERSION), ...bytes(8, number(2, OPSET)), ...bytes(7, graph)];
  return Buffer.from(model);
}
