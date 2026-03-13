export function moveItem(items, fromIndex, toIndex) {
  if (!Array.isArray(items)) return [];
  if (fromIndex === toIndex) return [...items];
  if (
    fromIndex < 0
    || toIndex < 0
    || fromIndex >= items.length
    || toIndex >= items.length
  ) {
    return [...items];
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export function moveIndex(index, fromIndex, toIndex) {
  if (!Number.isInteger(index)) return -1;
  if (index === fromIndex) return toIndex;
  if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return index - 1;
  if (toIndex < fromIndex && index >= toIndex && index < fromIndex) return index + 1;
  return index;
}

export function moveIndexedValues(indexedValues, length, fromIndex, toIndex) {
  const hasOwn = (index) => Object.prototype.hasOwnProperty.call(indexedValues, index);
  const orderedValues = Array.from({ length }, (_, index) => (
    hasOwn(index) ? indexedValues[index] : undefined
  ));
  const reorderedValues = moveItem(orderedValues, fromIndex, toIndex);

  return reorderedValues.reduce((result, value, index) => {
    if (value !== undefined) result[index] = value;
    return result;
  }, {});
}
