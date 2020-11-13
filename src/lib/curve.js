export function cubicBezierCurves(data, getX, getY) {
  const tangentPairs = data.map((_, i) => {
    if (i === 0) return [data[i], data[i + 1]];
    if (i === data.length - 1) return [data[i - 1], data[i]];
    return [data[i - 1], data[i + 1]];
  });
  const tangents = tangentPairs.map(
    ([p0, p1]) => (getY(p1) - getY(p0)) / (getX(p1) - getX(p0))
  );
  const curves = [];
  let start = [getX(data[0]), getY(data[0])];
  curves.push(move(data[0], getX, getY));
  for (let i = 0; i < data.length - 1; i++) {
    const end = [getX(data[i + 1]), getY(data[i + 1])];
    const control1 = [(start[0] * 2 + end[0]) / 3, start[1] + tangents[i] / 3];
    const control2 = [
      (start[0] + end[0] * 2) / 3,
      end[1] - tangents[i + 1] / 3,
    ];
    curves.push({
      kind: "C",
      start,
      control1,
      control2,
      end,
    });
    start = end;
  }
  return curves;
}

export function move(d, getX, getY) {
  const start = [getX(d), getY(d)];
  return {
    kind: "M",
    start,
    end: start,
  };
}

export function line(d1, d2, getX, getY) {
  return {
    kind: "L",
    start: [getX(d1), getY(d1)],
    end: [getX(d2), getY(d2)],
  };
}

export function absLines(data, getX, getY) {
  let start = [getX(data[0]), getY(data[0])];
  const parts = [move(start, getX, getY)];
  for (let i = 1; i < data.length; i++) {
    parts.push(line(start, data[i], getX, getY));
    start = data[i];
  }
  return parts;
}

const xyStr = ([x, y]) => `${x},${y}`;

export function toPath(parts) {
  const strParts = parts.map((p) => {
    switch (p.kind) {
      case "C":
        return `C${xyStr(p.control1)},${xyStr(p.control2)},${xyStr(p.end)}`;
      case "L":
        return `L${xyStr(p.end)}`;
      case "M":
        return `M${xyStr(p.end)}`;
      default:
        throw new Error("Unknown path component type " + p.kind);
    }
  });
  return strParts.join("") + "Z";
}

export function reversePathComponents(parts) {
  const reversed = parts.map((p) => {
    switch (p.kind) {
      case "C":
        return {
          ...p,
          start: p.end,
          control1: p.control2,
          control2: p.control1,
          end: p.start,
        };
      case "L":
        return {
          ...p,
          start: p.end,
          end: p.start,
        };
      case "M":
        return p;
      default:
        throw new Error("Unknown path component type " + p.kind);
    }
  });
  const nTrim = reversed.findIndex((p) => p.kind !== "M");
  return reversed.slice(nTrim).reverse();
}
