const ES2025_MEMBERS = [
  'Set.prototype.union',
  'Set.prototype.intersection',
  'Set.prototype.difference',
  'Set.prototype.symmetricDifference',
  'Set.prototype.isSubsetOf',
  'Set.prototype.isSupersetOf',
  'Set.prototype.isDisjointFrom',
  'Iterator.from',
  'Iterator.prototype.map',
  'Iterator.prototype.filter',
  'Iterator.prototype.take',
  'Iterator.prototype.drop',
  'Iterator.prototype.flatMap',
  'Iterator.prototype.reduce',
  'Iterator.prototype.toArray',
  'Iterator.prototype.forEach',
  'Iterator.prototype.some',
  'Iterator.prototype.every',
  'Iterator.prototype.find',
  'Promise.try',
  'RegExp.escape',
  'Float16Array',
  'Math.f16round',
  'Intl.DurationFormat',
];

function member(path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (owner, key) => (owner === undefined ? undefined : Reflect.get(Object(owner), key)),
      globalThis
    );
}

describe('@kit/testing: the ES2025 server baseline', () => {
  it.each(ES2025_MEMBERS)('%s exists on this runtime', (path) => {
    expect(typeof member(path)).toBe('function');
  });
});
