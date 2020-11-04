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
