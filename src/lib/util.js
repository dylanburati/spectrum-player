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
 * @template T
 * @param {T[]} arr the source array
 * @param {number} i the destination index
 * @param {(el: T) => T} replacer function to supply the destination element
 * @return {T[]} the copied array
 */
export const replaceAt = (arr, i, replacer) =>
  arr.map((prev, j) => (i === j ? replacer(prev) : prev));

/**
 * @template T,R
 * @param {T[]} arr the mapping source
 * @param {(el: T, index: number) => R[]} fn the mapping function
 * @return {R[]} the concatenated return arrays
 */
export const flatMap = (arr, fn) =>
  arr.reduce((acc, curr, idx) => {
    acc.push(...fn(curr, idx));
    return acc;
  }, []);

/**
 * @template T
 * @param {T[][]} arr a list of arrays
 * @return {T[]} the concatenated elements
 */
export const flatten = (arr) => flatMap(arr, (e) => e);
