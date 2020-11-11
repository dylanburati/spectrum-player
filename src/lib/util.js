export function partition(arr, predicate) {
  const matching = [];
  const nonMatching = [];
  arr.forEach((e, i, a) => {
    if (predicate(e, i, a)) {
      matching.push(e);
    } else {
      nonMatching.push(e);
    }
  });
  return [matching, nonMatching];
}

/**
 * @return {any[]} the array
 */
export const buildList = (n, fn) => new Array(n).fill(0).map((_, i) => fn(i));

/**
 * @param {T[]} arr the source array
 * @param {number} i the destination index
 * @param {T => T} replacer function to supply the destination element
 * @return {T[]} the copied array
 */
export const replaceAt = (arr, i, replacer) =>
  arr.map((prev, j) => (i === j ? replacer(prev) : prev));
