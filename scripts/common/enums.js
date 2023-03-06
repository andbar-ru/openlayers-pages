/** Точка притяжения относительно геометрии */
export const Attractor = {
  Top: 0,
  TopRight: 1,
  Right: 2,
  BottomRight: 3,
  Bottom: 4,
  BottomLeft: 5,
  Left: 6,
  TopLeft: 7,
}

/** Ось */
export const Axis = {
  X: 0,
  Y: 1,
}

/** Линии, вдоль которых может вестись поиск подходящей точки. */
export const SearchLine = {
  Vertical: 0,
  Horizontal: 1,
  MainDiagonal: 2,
  AntiDiagonal: 3,
}

/** Ориентация 3 упорядоченных точек (https://www.geeksforgeeks.org/orientation-3-ordered-points/) */
export const Orientation = {
  Collinear: 0,
  Clockwise: 1,
  Counterclockwise: 2,
}

/**
 * Направление поиска подходящей точки.
 * Плюс и минус относятся к значению ординаты в случае поиска вдоль вертикальной линии и
 * к значению абсциссы в случае поиска вдоль горизонтальной линии и диагоналей.
 */
export const SearchDirection = {
  Plus: 0,
  Minus: 1,
  Both: 2,
}
