/**
 * Здесь располагаются функции для работы с геометрией.
 * Импортировано из другого проекта и адаптировано с typescript.
 */
import _ from 'lodash'
import simplify from 'simplify-js'

import { Orientation, SearchLine, SearchDirection, Attractor, Axis } from './enums'

/**
 * Возвращает квадрат минимального расстояния между точкой и отрезком через вектора.
 * Возвращает квадрат потому, что функция может вызываться очень много раз, а корень вычислять накладно.
 * Лучше вычислить корень в самом конце.
 * Далее отрезок — это вектор AB, а точка — P
 * Вдохновлено https://www.geeksforgeeks.org/minimum-distance-from-a-point-to-the-line-segment-using-vectors/
 *
 * @param point - координаты точки (P)
 * @param segmentStart - координаты начала отрезка (начало и конец условны) (A)
 * @param segmentEnd - координаты конца отрезка (B)
 * @returns квадрат минимального расстояния
 */
export function getSquaredDistanceBetweenPointAndSegment(point, segmentStart, segmentEnd) {
  // Вектор AB: [B[0]-A[0], B[1]-A[1]]
  const ab = [segmentEnd[0] - segmentStart[0], segmentEnd[1] - segmentStart[1]]
  // Вектор BP: [P[0]-B[0], P[1]-B[1]]
  const bp = [point[0] - segmentEnd[0], point[1] - segmentEnd[1]]
  // Вектор AP: [P[0]-A[0], P[1]-A[1]]
  const ap = [point[0] - segmentStart[0], point[1] - segmentStart[1]]

  // Скалярные произведения векторов
  const ab_bp = ab[0] * bp[0] + ab[1] * bp[1]
  const ab_ap = ab[0] * ap[0] + ab[1] * ap[1]

  if (ab_bp > 0) {
    // Вариант, когда точка, а точнее её проекция на прямую, содержащую отрезок, располагается справа от отрезка
    const x = point[0] - segmentEnd[0]
    const y = point[1] - segmentEnd[1]
    return x * x + y * y
  } else if (ab_ap < 0) {
    // Вариант, когда точка располагается слева от отрезка
    const x = point[0] - segmentStart[0]
    const y = point[1] - segmentStart[1]
    return x * x + y * y
  } else {
    // Вариант, когда проекция точки располагается внутри отрезка.
    // Вычисляем размер перпендикуляра.
    const x1 = ab[0]
    const y1 = ab[1]
    const x2 = ap[0]
    const y2 = ap[1]
    const sqrMod = x1 * x1 + y1 * y1
    const dividend = Math.abs(x1 * y2 - y1 * x2)
    const sqrDividend = dividend * dividend
    return sqrDividend / sqrMod
  }
}

/**
 * Вычисляет квадрат расстояния между двумя точками.
 * Квадрат потому, что функция может вызываться очень много раз, а корень вычислять накладно и в
 * большинстве случаев без надобности.
 *
 * @param p1 - координаты первой точки
 * @param p2 - координаты второй точки
 * @returns квадрат расстояния между точками
 */
function getSquaredDistanceBetweenPoints(p1, p2) {
  const x = p2[0] - p1[0]
  const y = p2[1] - p1[1]
  return x * x + y * y
}

/**
 * Возвращает минимальное расстояние между точкой и ломаной линией (LineString в терминах GeoJSON).
 *
 * @param point - координаты точки
 * @param polyline - координаты ломаной линии (массив координат вершин)
 * @returns минимальное расстояние или null, если не удалось вычислить
 */
export function getDistanceBetweenPointAndPolyline(point, polyline) {
  if (polyline.length < 2) {
    console.error('Ошибка: ломаная линия должна содержать не менее 2 вершин.')
    return null
  }

  let sqrMinDistance = Infinity

  // Измеряем квадраты расстояния до каждого сегмента ломаной и сохраняет минимальный.
  for (let i = 0, l = polyline.length; i < l - 1; i++) {
    const d2 = getSquaredDistanceBetweenPointAndSegment(point, polyline[i], polyline[i + 1])
    if (d2 < sqrMinDistance) {
      sqrMinDistance = d2
    }
  }

  return Math.sqrt(sqrMinDistance)
}

/**
 * Вычисляет коэффициент λₛ (см. https://diego.assencio.com/?index=ec3d5dfdfc0b6a0d147a656f0af332bd)
 *      (P - A) ⋅ (B - A)
 * λₛ = —————————————————
 *      (B - A) ⋅ (B - A)
 *
 * @param p - точка (вектор P), от которой ищется ближайшая точка на отрезке
 * @param a - первая точка отрезка (вектор A)
 * @param b - вторая точка отрезка (вектор B)
 * @returns коэффициент λₛ
 */
export function lambdaS(p, a, b) {
  // Вектор P - A
  const u = [p[0] - a[0], p[1] - a[1]]
  // Вектор B - A
  const v = [b[0] - a[0], b[1] - a[1]]
  // Скалярное произведение векторов U * V
  const uv = u[0] * v[0] + u[1] * v[1]
  // Скалярное произведение V на самого себя
  const vv = v[0] ** 2 + v[1] ** 2
  const l = uv / vv
  return l
}

/**
 * Вычисляет координаты точки (вектор S) на отрезке AB, которая ближайшая к точке P.
 * см. https://diego.assencio.com/?index=ec3d5dfdfc0b6a0d147a656f0af332bd
 * если λₛ <= 0, тогда S = A
 * если λₛ >= 1, тогда S = B
 * если 0 < λₛ < 1, тогда S = A + λₛ(B - A)
 *
 * @param p - точка (вектор P), от которой ищется ближайшая точка на отрезке
 * @param a - первая точка отрезка (вектор A)
 * @param b - вторая точка отрезка (вектор B)
 * @returns координаты найденной точки (вектор S)
 */
export function closestPointOnSegmentToPoint(p, a, b) {
  const l = lambdaS(p, a, b)
  if (l <= 0) {
    return a
  } else if (l >= 1) {
    return b
  } else {
    const v = [b[0] - a[0], b[1] - a[1]]
    const lv = [l * v[0], l * v[1]]
    const s = [a[0] + lv[0], a[1] + lv[1]]
    return s
  }
}

/**
 * Вычисляет координаты точки на полилинии, ближайшей к заданной.
 *
 * @param point - точка, от которой ищется ближайшая точка на полилинии
 * @param polyline - массив координат вершин полилинии
 * @returns координаты найденной точки или null, если переданы некорректные координаты
 */
export function closestPointOnPolylineToPoint(point, polyline) {
  if (polyline.length < 2) {
    console.error('Ошибка: ломаная линия должна содержать не менее 2 вершин.')
    if (polyline[0]) {
      return polyline[0]
    } else {
      return point
    }
  }

  let sqrMinDistance = Infinity
  let closestPoint

  for (let i = 0, l = polyline.length; i < l - 1; i++) {
    const d2 = getSquaredDistanceBetweenPointAndSegment(point, polyline[i], polyline[i + 1])
    if (d2 < sqrMinDistance) {
      sqrMinDistance = d2
      closestPoint = closestPointOnSegmentToPoint(point, polyline[i], polyline[i + 1])
    }
  }

  return closestPoint
}

/**
 * Возвращает минимальные и максимальные координаты ограничивающего прямоугольника ломаной линии.
 * Для пикселей это координаты верхнего левого и нижнего правого угла.
 *
 * @param polyline - координаты ломаной линии, массив координат вершин
 * @returns [[minX, minY], [maxX, maxY]] ограничивающего прямоугольника или null, если не удалось
 */
export function getPolylineBbox(polyline) {
  if (polyline.length < 2) {
    console.debug(polyline)
    console.error('Ошибка: линия должна содержать не менее 2 вершин.')
    return null
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  for (const point of polyline) {
    const [x, y] = point
    if (x < minX) {
      minX = x
    }
    if (x > maxX) {
      maxX = x
    }
    if (y < minY) {
      minY = y
    }
    if (y > maxY) {
      maxY = y
    }
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    console.debug('minX:', minX, 'minY:', minY, 'maxX:', maxX, 'maxY:', maxY)
    console.error('Ошибка: какая-то из координат не является конечным числом')
    return null
  }

  return [
    [minX, minY],
    [maxX, maxY],
  ]
}

/**
 * Возвращает минимальные и максимальные координаты ограничивающего прямоугольника мультиполигона.
 * Для пикселей это координаты верхнего левого и нижнего правого угла.
 *
 * @param multipolygon - координаты мультиполигона
 * @returns [[minX, minY], [maxX, maxY]] ограничивающего прямоугольника или null, если не удалось
 */
export function getMultiPolygonBbox(multiPolygon) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

  for (const polygon of multiPolygon) {
    const exteriorRing = polygon[0]
    const bbox = getPolylineBbox(exteriorRing)
    if (!bbox) {
      continue
    }
    const [[innerMinX, innerMinY], [innerMaxX, innerMaxY]] = bbox
    if (innerMinX < minX) {
      minX = innerMinX
    }
    if (innerMaxX > maxX) {
      maxX = innerMaxX
    }
    if (innerMinY < minY) {
      minY = innerMinY
    }
    if (innerMaxY > maxY) {
      maxY = innerMaxY
    }
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    console.debug('minX:', minX, 'minY:', minY, 'maxX:', maxX, 'maxY:', maxY)
    console.error('Ошибка: какая-то из координат не является конечным числом')
    return null
  }

  return [
    [minX, minY],
    [maxX, maxY],
  ]
}

/**
 * При условии, что точки p1, p2, p3 находятся на одной прямой, проверяет что p2 располагается
 * на отрезке p1_p3.
 *
 * @param p1 - первая точка
 * @param p2 - вторая точка
 * @param p3 - третья точка
 * @returns результат проверки
 */
function onSegment(p1, p2, p3) {
  if (
    p2[0] <= Math.max(p1[0], p3[0]) &&
    p2[0] >= Math.min(p1[0], p3[0]) &&
    p2[1] <= Math.max(p1[1], p3[1]) &&
    p2[1] >= Math.min(p1[1], p3[1])
  ) {
    return true
  }
  return false
}

/**
 * Вычисляет ориентацию трёх упорядоченных точек.
 * Подробности: https://www.geeksforgeeks.org/orientation-3-ordered-points/
 *
 * @param p1 - первая точка
 * @param p2 - вторая точка
 * @param p3 - третья точка
 * @returns: Orientation.Collinear, если через все точки можно провести прямую
 *           Orientation.Clockwise, если ориентация по часовой стрелке
 *           Orientation.Counterclockwise, если ориентация против часовой стрелки
 */
function getOrientation(p1, p2, p3) {
  const val = (p2[1] - p1[1]) * (p3[0] - p2[0]) - (p2[0] - p1[0]) * (p3[1] - p2[1])

  if (val === 0) {
    return Orientation.Collinear
  }
  return val > 0 ? Orientation.Clockwise : Orientation.Counterclockwise
}

/**
 * Проверяет, пересекаются ли отрезки.
 * Если одна или обе вершины одного отрезка располагаются на другом, то это тоже означает пересечение.
 *
 * @param segment1 - первый отрезок
 * @param segment2 - второй отрезок
 * @returns результат проверки
 */
function intersect(segment1, segment2) {
  const [p1, q1] = segment1
  const [p2, q2] = segment2

  // 4 ориентации для проверки общего и частных случаев.
  const o1 = getOrientation(p1, q1, p2)
  const o2 = getOrientation(p1, q1, q2)
  const o3 = getOrientation(p2, q2, p1)
  const o4 = getOrientation(p2, q2, q1)

  // Общий случай
  if (o1 !== o2 && o3 !== o4) {
    return true
  }

  // Частные случаи
  // p1, q1 и p2 коллинеарны, и p2 располагается на отрезке p1_q1
  if (o1 === 0 && onSegment(p1, p2, q1)) {
    return true
  }

  // p1, q1 и q2 коллинеарны, и q2 располагается на отрезке p1_q1
  if (o2 === 0 && onSegment(p1, q2, q1)) {
    return true
  }

  // p2, q2 и p1 коллинеарны, и p1 располагается на отрезке p2_q2
  if (o3 === 0 && onSegment(p2, p1, q2)) {
    return true
  }

  // p2, q2 и q1 коллинеарны, и q1 располагается на отрезке p2_q2
  if (o4 === 0 && onSegment(p2, q1, q2)) {
    return true
  }

  // Не выполнился ни один из случаев выше, значит не пересекаются.
  return false
}

/**
 * Определяет, находится ли точка внутри полигона, методом трассировки луча (ray casting algorithm).
 * Если точка находится на ребре или на вершине, то это тоже считается внутри.
 * Вдохновлено // https://www.geeksforgeeks.org/how-to-check-if-a-given-point-lies-inside-a-polygon/
 * Алгоритм, представленный там, возвращает ложные результаты в некоторых вырожденных случаях.
 * Здесь найденные ошибки исправлены.
 *
 * @param point - координаты точки
 * @param polygon - координаты полигона, в терминах GeoJSON его внешнего кольца
 * @returns true, если точка внутри полигона или на периметре, иначе false.
 *          Если полигон некорректный, то тоже возвращает false
 */
export function pointInPolygon(point, polygon) {
  if (!polygon.length) {
    console.error('Передан пустой полигон.')
    return false
  }

  // Здесь раньше было клонирование полигона и отбрасывание последней вершины, если она совпадает
  // с первой. Выяснилось, что это очень тяжёлая операция (~90%), поэтому убрал.

  if (polygon.length < 3) {
    console.error('Полигон должен состоять не менее, чем из 3 вершин.')
    return false
  }

  // Смещение ординаты вершины, если она совпадает с ординатой точки
  const e = 1e-10
  // Крайняя правая абсцисса. Нужна для постройки "луча".
  let maxX = -Infinity

  // Сначала выясняем максимальную абсциссу и проверяем вырожденные случаи:
  // - точка совпадает с вершиной полигона;
  // - ордината точки совпадает с ординатой 1 или нескольких вершин. В таких случае алгоритм сбоит,
  //   поэтому сдвигаем ординату вершины на "бесконечно" малую величину.
  for (const vertex of polygon) {
    if (vertex[0] > maxX) {
      maxX = vertex[0]
    }
    if (vertex[1] === point[1]) {
      if (vertex[0] === point[0]) {
        return true // точка совпадает с вершиной, сразу возвращаем
      } else {
        vertex[1] += e // смещаем
      }
    }
  }

  // Создаём луч, исходящий из точки направо. На самом деле, это отрезок, вторая крайняя точка
  // которого находится за пределами ограничивающего прямоугольника полигона.
  const ray = [point, [maxX + 1, point[1]]]
  let count = 0 // счётчик пересечений луча с границами полигона
  let i = 0

  // Проходим по всем рёбрам полигона и проверяем, пересекается ли с ним луч.
  const l = polygon.length
  do {
    const edge = [polygon[i], polygon[(i + 1) % l]]

    if (intersect(ray, edge)) {
      if (getOrientation(edge[0], point, edge[1]) === Orientation.Collinear) {
        return onSegment(edge[0], point, edge[1])
      }
      count++
    }

    i = (i + 1) % l
  } while (i !== 0)

  // Если количество пересечений нечётное, значит точка внутри полигона.
  return (count & 1) === 1
}

/**
 * Производит поиск подходящей точки построчно вдоль вертикальной линии.
 * Правила поиска описаны в функции findPointInPolygon.
 *
 * @param polygon - координаты полигона (внешнего кольца в терминах GeoJSON), массив координат
 *                  вершин, где координаты последней вершины совпадают с координатами первой
 * @param attractor - координаты точки притяжения
 * @param bufferSize - размер буфера
 * @param maxSteps - максимальное количество шагов. Так как округление производится в меньшую
 *                   сторону, реальное количество шагов может быть больше.
 * @returns координаты найденной точки или null, если не удалось найти точку, удовлетворяющую условиям
 */
function searchVertical(polygon, attractor, bufferSize, maxSteps) {
  const bbox = getPolylineBbox(polygon)
  if (!bbox) {
    console.error('Непредвиденная ошибка: не удалось вычислить bbox')
    return null
  }

  // Далее работаем с целыми числами.
  const minX = Math.floor(bbox[0][0])
  const minY = Math.floor(bbox[0][1])
  const maxX = Math.ceil(bbox[1][0])
  const maxY = Math.ceil(bbox[1][1])
  const startY = Math.round(attractor[1])

  // prettier-ignore
  const searchDirection =
    startY >= maxY - bufferSize
    ? SearchDirection.Minus
    : startY <= minY + bufferSize
    ? SearchDirection.Plus
    : SearchDirection.Both

  let stepX = Math.floor((maxX - minX) / maxSteps)
  if (stepX < 1) {
    stepX = 1
  }
  let stepY = Math.floor((maxY - minY) / maxSteps)
  if (stepY < 1) {
    stepY = 1
  }

  /**
   * Производит поиск подходящей точки в сторону увеличения ординаты.
   * Для пиксельной геометрии это значит вниз.
   * Как только находит подходящую точку, сразу возвращает.
   *
   * @returns координаты найденной точки, если найдена, иначе null
   */
  function searchPlus() {
    // Построчно
    for (let y = startY; y <= maxY; y += stepY) {
      // Квадрат минимального расстояния от точки P до точки притяжения A при условии, что
      // P находится внутри полигона и расстояние от P до периметра полигона больше буфера.
      let sqrMinDistance = Infinity
      // Координаты точки, где зафиксировано минимальное расстояние до точки притяжения в строке
      let minDistanceXY = null

      // Проходим строку от начала до конца полностью.
      for (let x = minX; x <= maxX; x += stepX) {
        const point = [x, y]
        if (pointInPolygon(point, polygon)) {
          const distanceToEdge = getDistanceBetweenPointAndPolyline(point, polygon)
          if (distanceToEdge !== null && distanceToEdge >= bufferSize) {
            const sqrD = getSquaredDistanceBetweenPoints(point, attractor)
            if (sqrD < sqrMinDistance) {
              sqrMinDistance = sqrD
              minDistanceXY = point
            }
          }
        }
      }

      if (minDistanceXY) {
        return minDistanceXY
      }
    }
    return null
  }

  /**
   * Производит поиск подходящей точки в сторону уменьшения ординаты.
   * Для пиксельной геометрии это значит вверх.
   * Как только находит подходящую точку, сразу возвращает.
   *
   * @returns координаты найденной точки, если найдена, иначе null
   */
  function searchMinus() {
    // Построчно
    for (let y = startY; y >= minY; y -= stepY) {
      // Квадрат минимального расстояния от точки P до точки притяжения A при условии, что
      // P находится внутри полигона и расстояние от P до периметра полигона больше буфера.
      let sqrMinDistance = Infinity
      // Координаты точки, где зафиксировано минимальное расстояние до точки притяжения в строке
      let minDistanceXY = null

      // Проходим строку от начала до конца полностью.
      for (let x = minX; x <= maxX; x += stepX) {
        const point = [x, y]
        if (pointInPolygon(point, polygon)) {
          const distanceToEdge = getDistanceBetweenPointAndPolyline(point, polygon)
          if (distanceToEdge !== null && distanceToEdge >= bufferSize) {
            const sqrD = getSquaredDistanceBetweenPoints(point, attractor)
            if (sqrD < sqrMinDistance) {
              sqrMinDistance = sqrD
              minDistanceXY = point
            }
          }
        }
      }

      if (minDistanceXY) {
        return minDistanceXY
      }
    }
    return null
  }

  if (searchDirection === SearchDirection.Plus) {
    return searchPlus()
  } else if (searchDirection === SearchDirection.Minus) {
    return searchMinus()
  } else {
    const p1 = searchPlus()
    const p2 = searchMinus()
    if (p1 && p2) {
      const d1 = getSquaredDistanceBetweenPoints(p1, attractor)
      const d2 = getSquaredDistanceBetweenPoints(p2, attractor)
      return d1 < d2 ? p1 : p2
    } else {
      // Если поиск прошёл неудачно в обоих направлениях, то отсюда вернётся null.
      return p1 ? p1 : p2
    }
  }
}

/**
 * Производит поиск подходящей точки поколоночно вдоль горизонтальной линии.
 * Правила поиска описаны в функции findPointInPolygon.
 *
 * @param polygon - координаты полигона (внешнего кольца в терминах GeoJSON), массив координат
 *                  вершин, где координаты последней вершины совпадают с координатами первой
 * @param attractor - координаты точки притяжения
 * @param bufferSize - размер буфера
 * @param maxSteps - максимальное количество шагов. Так как округление производится в меньшую
 *                   сторону, реальное количество шагов может быть больше.
 * @returns координаты найденной точки или null, если не удалось найти точку, удовлетворяющую условиям
 */
function searchHorizontal(polygon, attractor, bufferSize, maxSteps) {
  const bbox = getPolylineBbox(polygon)
  if (!bbox) {
    console.error('Непредвиденная ошибка: не удалось вычислить bbox')
    return null
  }

  // Далее работаем с целыми числами.
  const minX = Math.floor(bbox[0][0])
  const minY = Math.floor(bbox[0][1])
  const maxX = Math.ceil(bbox[1][0])
  const maxY = Math.ceil(bbox[1][1])
  const startX = Math.round(attractor[0])

  // prettier-ignore
  const searchDirection =
    startX >= maxX - bufferSize
    ? SearchDirection.Minus
    : startX <= minX + bufferSize
    ? SearchDirection.Plus
    : SearchDirection.Both

  let stepX = Math.floor((maxX - minX) / maxSteps)
  if (stepX < 1) {
    stepX = 1
  }
  let stepY = Math.floor((maxY - minY) / maxSteps)
  if (stepY < 1) {
    stepY = 1
  }

  /**
   * Производит поиск подходящей точки в сторону увеличения абсциссы.
   * Для пиксельной геометрии это значит вправо.
   * Как только находит подходящую точку, сразу возвращает.
   *
   * @returns координаты найденной точки, если найдена, иначе null
   */
  function searchPlus() {
    // Поколоночно
    for (let x = startX; x <= maxX; x += stepX) {
      // Квадрат минимального расстояния от точки P до точки притяжения A при условии, что
      // P находится внутри полигона и расстояние от P до периметра полигона больше буфера.
      let sqrMinDistance = Infinity
      // Координаты точки, где зафиксировано минимальное расстояние до точки притяжения в строке
      let minDistanceXY = null

      // Проходим колонку от начала до конца полностью.
      for (let y = minY; y <= maxY; y += stepY) {
        const point = [x, y]
        if (pointInPolygon(point, polygon)) {
          const distanceToEdge = getDistanceBetweenPointAndPolyline(point, polygon)
          if (distanceToEdge !== null && distanceToEdge >= bufferSize) {
            const sqrD = getSquaredDistanceBetweenPoints(point, attractor)
            if (sqrD < sqrMinDistance) {
              sqrMinDistance = sqrD
              minDistanceXY = point
            }
          }
        }
      }

      if (minDistanceXY) {
        return minDistanceXY
      }
    }
    return null
  }

  /**
   * Производит поиск подходящей точки в сторону уменьшения абсциссы.
   * Для пиксельной геометрии это значит влево.
   * Как только находит подходящую точку, сразу возвращает.
   *
   * @returns координаты найденной точки, если найдена, иначе null
   */
  function searchMinus() {
    // Поколоночно
    for (let x = startX; x >= minX; x -= stepX) {
      // Квадрат минимального расстояния от точки P до точки притяжения A при условии, что
      // P находится внутри полигона и расстояние от P до периметра полигона больше буфера.
      let sqrMinDistance = Infinity
      // Координаты точки, где зафиксировано минимальное расстояние до точки притяжения в строке
      let minDistanceXY = null

      // Проходим колонку от начала до конца полностью.
      for (let y = minY; y <= maxY; y += stepY) {
        const point = [x, y]
        if (pointInPolygon(point, polygon)) {
          const distanceToEdge = getDistanceBetweenPointAndPolyline(point, polygon)
          if (distanceToEdge !== null && distanceToEdge >= bufferSize) {
            const sqrD = getSquaredDistanceBetweenPoints(point, attractor)
            if (sqrD < sqrMinDistance) {
              sqrMinDistance = sqrD
              minDistanceXY = point
            }
          }
        }
      }

      if (minDistanceXY) {
        return minDistanceXY
      }
    }
    return null
  }

  if (searchDirection === SearchDirection.Plus) {
    return searchPlus()
  } else if (searchDirection === SearchDirection.Minus) {
    return searchMinus()
  } else {
    const p1 = searchPlus()
    const p2 = searchMinus()
    if (p1 && p2) {
      const d1 = getSquaredDistanceBetweenPoints(p1, attractor)
      const d2 = getSquaredDistanceBetweenPoints(p2, attractor)
      return d1 < d2 ? p1 : p2
    } else {
      // Если поиск прошёл неудачно в обоих направлениях, то отсюда вернётся null.
      return p1 ? p1 : p2
    }
  }
}

/**
 * Производит поиск подходящей точки вдоль главной диагонали: [minX, minY] -> [maxX, maxY].
 * Для пиксельной геометрии — это с верхнего левого угла в нижний правый.
 * Правила поиска описаны в функции findPointInPolygon.
 *
 * @param polygon - координаты полигона (внешнего кольца в терминах GeoJSON), массив координат
 *                  вершин, где координаты последней вершины совпадают с координатами первой
 * @param attractor - координаты точки притяжения
 * @param bufferSize - размер буфера
 * @param maxSteps - максимальное количество шагов. Так как округление производится в меньшую
 *                   сторону, реальное количество шагов может быть больше.
 * @returns координаты найденной точки или null, если не удалось найти точку, удовлетворяющую условиям
 */
function searchMainDiagonal(polygon, attractor, bufferSize, maxSteps) {
  const bbox = getPolylineBbox(polygon)
  if (!bbox) {
    console.error('Непредвиденная ошибка: не удалось вычислить bbox')
    return null
  }

  // Далее работаем с целыми числами.
  const minX = Math.floor(bbox[0][0])
  const minY = Math.floor(bbox[0][1])
  const maxX = Math.ceil(bbox[1][0])
  const maxY = Math.ceil(bbox[1][1])
  let startX = Math.round(attractor[0])
  let startY = Math.round(attractor[1])

  // Направление поиска
  let searchDirection = SearchDirection.Both
  if (startX <= minX + bufferSize && startY <= minY + bufferSize) {
    searchDirection = SearchDirection.Plus
  } else if (startX >= maxX - bufferSize && startY >= maxY - bufferSize) {
    searchDirection = SearchDirection.Minus
  }

  // Если точка притяжения находится вне полигона, то сдвигаемся по диагонали в сторону полигона
  // на величину расстояния до полигона.
  // При диагональном поиске это более правильно, чем прыжок до ближайшей точки на полигоне.
  if (!pointInPolygon([startX, startY], polygon)) {
    const distanceToEdge = getDistanceBetweenPointAndPolyline([startX, startY], polygon)
    // Для смещения по осям при 45° может применяться как cos, так и sin.
    const delta = Math.floor(distanceToEdge * Math.cos((Math.PI / 180) * 45))
    if (searchDirection === SearchDirection.Plus) {
      startX += delta
      startY += delta
    } else if (searchDirection === SearchDirection.Minus) {
      startX -= delta
      startY -= delta
    } else {
      // SearchDirection.Both -- это редкий случай при стартовой точке вне полигона.
      const closestPoint = closestPointOnPolylineToPoint([startX, startY], polygon)
      if (closestPoint[0] > startX) {
        startX += delta
      } else {
        startX -= delta
      }
      if (closestPoint[1] > startY) {
        startY += delta
      } else {
        startY -= delta
      }
      // При определённых сочетаниях смещений по осям можно сделать поиск однонаправленным
      if (closestPoint[0] > startX && closestPoint[1] > startY) {
        searchDirection = SearchDirection.Plus
      } else if (closestPoint[1] < startX && closestPoint[1] < startY) {
        searchDirection = SearchDirection.Minus
      }
    }
  }

  let stepX = Math.floor((maxX - minX) / maxSteps)
  if (stepX < 1) {
    stepX = 1
  }
  let stepY = Math.floor((maxY - minY) / maxSteps)
  if (stepY < 1) {
    stepY = 1
  }
  // При поиске вдоль диагоналей используем единый шаг
  const step = Math.min(stepX, stepY)

  // Проводим прямую через стартовую точку перпендикулярно линии поиска (главной диагонали) и
  // находим точки её пересечения (2) с ограничивающим прямоугольником. Полагаемся на то, что
  // точка находится в пределах ограничивающего прямоугольника.
  // Линия [[startX1, startY1], [startX2, startY2]] — общая линия старта для searchPlus и searchMinus.
  const delta1 = Math.min(startX - minX, maxY - startY)
  const startX1 = startX - delta1
  const startY1 = startY + delta1
  const delta2 = Math.min(maxX - startX, startY - minY)
  const startX2 = startX + delta2
  const startY2 = startY - delta2

  /**
   * Производит поиск подходящей точки в сторону увеличения абсциссы и ординаты (X+, Y+).
   * Для пиксельной геометрии это значит вниз вправо.
   * Как только находит подходящую точку, сразу возвращает.
   *
   * @returns координаты найденной точки, если найдена, иначе null
   */
  function searchPlus() {
    // Точки, лежащие на ограничивающем прямоугольнике, которые будут смещаться к ++углу.
    let x1 = startX1,
      y1 = startY1,
      x2 = startX2,
      y2 = startY2

    // Квадрат минимального расстояния от точки P до точки притяжения A при условии, что
    // P находится внутри полигона и расстояние от P до периметра полигона больше буфера.
    let sqrMinDistance = Infinity
    // Координаты точки, где зафиксировано минимальное расстояние до точки притяжения в строке
    let minDistanceXY = null

    /** Внутренний цикл перпендикулярно линии поиска. */
    function innerLoop() {
      for (let x = x1, y = y1; x <= x2 || y >= y2; x += step, y -= step) {
        const point = [x, y]

        if (pointInPolygon(point, polygon)) {
          const distanceToEdge = getDistanceBetweenPointAndPolyline(point, polygon)
          if (distanceToEdge !== null && distanceToEdge >= bufferSize) {
            const sqrD = getSquaredDistanceBetweenPoints(point, attractor)
            if (sqrD < sqrMinDistance) {
              sqrMinDistance = sqrD
              minDistanceXY = point
            }
          }
        }
      }
    }

    // Внешний цикл вдоль линии поиска (главной диагонали)
    while (x1 < maxX || y1 < maxY || x2 < maxX || y2 < maxY) {
      // Сбрасываем значения
      sqrMinDistance = Infinity
      minDistanceXY = null

      innerLoop()

      if (minDistanceXY) {
        return minDistanceXY
      }

      // Расти может только один из x1, y1. Сначала растёт y1, потом x1.
      if (y1 < maxY) {
        y1 += step
      } else {
        x1 += step
      }
      // Также расти может только один из x2, y2. Сначала растёт x2, потом y2.
      if (x2 < maxX) {
        x2 += step
      } else {
        y2 += step
      }
    }

    // Для полного обхода надо внутренний цикл прогнать ещё раз, когда x1, y1, x2, y2 сошлись в одном углу.
    innerLoop()

    if (minDistanceXY) {
      return minDistanceXY
    }

    return null
  }

  /**
   * Производит поиск подходящей точки в сторону уменьшения абсциссы и ординаты (X-, Y-).
   * Для пиксельной геометрии это значит вверх влево.
   * Как только находит подходящую точку, сразу возвращает.
   *
   * @returns координаты найденной точки, если найдена, иначе null
   */
  function searchMinus() {
    // Точки, лежащие на ограничивающем прямоугольнике, которые будут смещаться к --углу.
    let x1 = startX1,
      y1 = startY1,
      x2 = startX2,
      y2 = startY2

    // Квадрат минимального расстояния от точки P до точки притяжения A при условии, что
    // P находится внутри полигона и расстояние от P до периметра полигона больше буфера.
    let sqrMinDistance = Infinity
    // Координаты точки, где зафиксировано минимальное расстояние до точки притяжения в строке
    let minDistanceXY = null

    /** Внутренний цикл перпендикулярно линии поиска. */
    function innerLoop() {
      for (let x = x1, y = y1; x <= x2 || y >= y2; x += step, y -= step) {
        const point = [x, y]

        if (pointInPolygon(point, polygon)) {
          const distanceToEdge = getDistanceBetweenPointAndPolyline(point, polygon)
          if (distanceToEdge !== null && distanceToEdge >= bufferSize) {
            const sqrD = getSquaredDistanceBetweenPoints(point, attractor)
            if (sqrD < sqrMinDistance) {
              sqrMinDistance = sqrD
              minDistanceXY = point
            }
          }
        }
      }
    }

    // Внешний цикл вдоль линии поиска (главной диагонали)
    while (x1 > minX || y1 > minY || x2 > minX || y2 > minY) {
      // Сбрасываем значения
      sqrMinDistance = Infinity
      minDistanceXY = null

      innerLoop()

      if (minDistanceXY) {
        return minDistanceXY
      }

      // Уменьшаться может только один из x1, y1. Сначала уменьшается x1, потом y1.
      if (x1 > minX) {
        x1 -= step
      } else {
        y1 -= step
      }
      // Также уменьшаться может только один из x2, y2. Сначала уменьшается y2, потом x2.
      if (y2 > minY) {
        y2 -= step
      } else {
        x2 -= step
      }
    }

    // Внутренний цикл надо прогнать ещё раз, когда x1, y1, x2, y2 сошлись в одном углу.
    innerLoop()

    if (minDistanceXY) {
      return minDistanceXY
    }

    return null
  }

  if (searchDirection === SearchDirection.Plus) {
    return searchPlus()
  } else if (searchDirection === SearchDirection.Minus) {
    return searchMinus()
  } else {
    const p1 = searchPlus()
    const p2 = searchMinus()
    if (p1 && p2) {
      const d1 = getSquaredDistanceBetweenPoints(p1, attractor)
      const d2 = getSquaredDistanceBetweenPoints(p2, attractor)
      return d1 < d2 ? p1 : p2
    } else {
      // Если поиск прошёл неудачно в обоих направлениях, то отсюда вернётся null.
      return p1 ? p1 : p2
    }
  }
}

/**
 * Производит поиск подходящей точки вдоль побочной диагонали: [minX, maxY] -> [maxX, minY].
 * Для пиксельной геометрии — это с нижнего левого угла в верхний правый.
 * Правила поиска описаны в функции findPointInPolygon.
 *
 * @param polygon - координаты полигона (внешнего кольца в терминах GeoJSON), массив координат
 *                  вершин, где координаты последней вершины совпадают с координатами первой
 * @param attractor - координаты точки притяжения
 * @param bufferSize - размер буфера
 * @param maxSteps - максимальное количество шагов. Так как округление производится в меньшую
 *                   сторону, реальное количество шагов может быть больше.
 * @returns координаты найденной точки или null, если не удалось найти точку, удовлетворяющую условиям
 */
function searchAntiDiagonal(polygon, attractor, bufferSize, maxSteps) {
  const bbox = getPolylineBbox(polygon)
  if (!bbox) {
    console.error('Непредвиденная ошибка: не удалось вычислить bbox')
    return null
  }

  // Далее работаем с целыми числами.
  const minX = Math.floor(bbox[0][0])
  const minY = Math.floor(bbox[0][1])
  const maxX = Math.ceil(bbox[1][0])
  const maxY = Math.ceil(bbox[1][1])
  let startX = Math.round(attractor[0])
  let startY = Math.round(attractor[1])

  // Направление поиска
  let searchDirection = SearchDirection.Both
  if (startX <= minX + bufferSize && startY >= maxY - bufferSize) {
    searchDirection = SearchDirection.Plus
  } else if (startX >= maxX - bufferSize && startY <= minY + bufferSize) {
    searchDirection = SearchDirection.Minus
  }

  // Если точка притяжения находится вне полигона, то сдвигаемся по диагонали в сторону полигона
  // на величину расстояния до полигона.
  // При диагональном поиске это более правильно, чем прыжок до ближайшей точки на полигоне.
  if (!pointInPolygon([startX, startY], polygon)) {
    const distanceToEdge = getDistanceBetweenPointAndPolyline([startX, startY], polygon)
    // Для смещения по осям при 45° может применяться как cos, так и sin.
    const delta = Math.floor(distanceToEdge * Math.cos((Math.PI / 180) * 45))
    if (searchDirection === SearchDirection.Plus) {
      startX += delta
      startY -= delta
    } else if (searchDirection === SearchDirection.Minus) {
      startX -= delta
      startY += delta
    } else {
      // SearchDirection.Both -- это редкий случай при стартовой точке вне полигона.
      const closestPoint = closestPointOnPolylineToPoint([startX, startY], polygon)
      if (closestPoint[0] > startX) {
        startX += delta
      } else {
        startX -= delta
      }
      if (closestPoint[1] > startY) {
        startY += delta
      } else {
        startY -= delta
      }
      // При определённых сочетаниях смещений по осям можно сделать поиск однонаправленным
      if (closestPoint[0] > startX && closestPoint[1] < startY) {
        searchDirection = SearchDirection.Plus
      } else if (closestPoint[1] < startX && closestPoint[1] > startY) {
        searchDirection = SearchDirection.Minus
      }
    }
  }

  let stepX = Math.floor((maxX - minX) / maxSteps)
  if (stepX < 1) {
    stepX = 1
  }
  let stepY = Math.floor((maxY - minY) / maxSteps)
  if (stepY < 1) {
    stepY = 1
  }
  // При поиске вдоль диагоналей используем единый шаг
  const step = Math.min(stepX, stepY)

  // Проводим прямую через стартовую точку перпендикулярно линии поиска (побочной диагонали) и
  // находим точки её пересечения (2) с ограничивающим прямоугольником. Полагаемся на то, что
  // точка находится в пределах ограничивающего прямоугольника.
  // Линия [[startX1, startY1], [startX2, startY2]] — общая линия старта для searchPlus и searchMinus.
  const delta1 = Math.min(startX - minX, startY - minY)
  const startX1 = startX - delta1
  const startY1 = startY - delta1
  const delta2 = Math.min(maxX - startX, maxY - startY)
  const startX2 = startX + delta2
  const startY2 = startY + delta2

  /**
   * Производит поиск подходящей точки в сторону увеличения абсциссы и уменьшения ординаты (X+, Y-).
   * Для пиксельной геометрии это значит вверх вправо.
   * Как только находит подходящую точку, сразу возвращает.
   *
   * @returns координаты найденной точки, если найдена, иначе null
   */
  function searchPlus() {
    // Точки, лежащие на ограничивающем прямоугольнике, которые будут смещаться к +-углу.
    let x1 = startX1,
      y1 = startY1,
      x2 = startX2,
      y2 = startY2

    // Квадрат минимального расстояния от точки P до точки притяжения A при условии, что
    // P находится внутри полигона и расстояние от P до периметра полигона больше буфера.
    let sqrMinDistance = Infinity
    // Координаты точки, где зафиксировано минимальное расстояние до точки притяжения в строке
    let minDistanceXY = null

    /** Внутренний цикл перпендикулярно линии поиска. */
    function innerLoop() {
      for (let x = x1, y = y1; x <= x2 || y <= y2; x += step, y += step) {
        const point = [x, y]

        if (pointInPolygon(point, polygon)) {
          const distanceToEdge = getDistanceBetweenPointAndPolyline(point, polygon)
          if (distanceToEdge !== null && distanceToEdge >= bufferSize) {
            const sqrD = getSquaredDistanceBetweenPoints(point, attractor)
            if (sqrD < sqrMinDistance) {
              sqrMinDistance = sqrD
              minDistanceXY = point
            }
          }
        }
      }
    }

    // Внешний цикл вдоль линии поиска (побочной диагонали)
    while (x1 < maxX || y1 > minY || x2 < maxX || y2 > minY) {
      // Сбрасываем значения
      sqrMinDistance = Infinity
      minDistanceXY = null

      innerLoop()

      if (minDistanceXY) {
        return minDistanceXY
      }

      // Меняться может только один из x1, y1. Сначала уменьшается y1, потом увеличивается x1.
      if (y1 > minY) {
        y1 -= step
      } else {
        x1 += step
      }
      // Также меняться может только один из x2, y2. Сначала растёт x2, потом уменьшается y2.
      if (x2 < maxX) {
        x2 += step
      } else {
        y2 -= step
      }
    }

    // Для полного обхода надо внутренний цикл прогнать ещё раз, когда x1, y1, x2, y2 сошлись в одном углу.
    innerLoop()

    if (minDistanceXY) {
      return minDistanceXY
    }

    return null
  }

  /**
   * Производит поиск подходящей точки в сторону уменьшения абсциссы и увеличения ординаты (X-, Y+).
   * Для пиксельной геометрии это значит вниз влево.
   * Как только находит подходящую точку, сразу возвращает.
   *
   * @returns координаты найденной точки, если найдена, иначе null
   */
  function searchMinus() {
    // Точки, лежащие на ограничивающем прямоугольнике, которые будут смещаться к -+углу.
    let x1 = startX1,
      y1 = startY1,
      x2 = startX2,
      y2 = startY2

    // Квадрат минимального расстояния от точки P до точки притяжения A при условии, что
    // P находится внутри полигона и расстояние от P до периметра полигона больше буфера.
    let sqrMinDistance = Infinity
    // Координаты точки, где зафиксировано минимальное расстояние до точки притяжения в строке
    let minDistanceXY = null

    /** Внутренний цикл перпендикулярно линии поиска. */
    function innerLoop() {
      for (let x = x1, y = y1; x <= x2 || y <= y2; x += step, y += step) {
        const point = [x, y]

        if (pointInPolygon(point, polygon)) {
          const distanceToEdge = getDistanceBetweenPointAndPolyline(point, polygon)
          if (distanceToEdge !== null && distanceToEdge >= bufferSize) {
            const sqrD = getSquaredDistanceBetweenPoints(point, attractor)
            if (sqrD < sqrMinDistance) {
              sqrMinDistance = sqrD
              minDistanceXY = point
            }
          }
        }
      }
    }

    // Внешний цикл вдоль линии поиска (побочной диагонали)
    while (x1 > minX || y1 < maxY || x2 > minX || y2 < maxY) {
      // Сбрасываем значения
      sqrMinDistance = Infinity
      minDistanceXY = null

      innerLoop()

      if (minDistanceXY) {
        return minDistanceXY
      }

      // Меняться может только один из x1, y1. Сначала уменьшается x1, потом увеличивается y1.
      if (x1 > minX) {
        x1 -= step
      } else {
        y1 += step
      }
      // Также меняться может только один из x2, y2. Сначала растёт y2, потом уменьшается x2.
      if (y2 < maxY) {
        y2 += step
      } else {
        x2 -= step
      }
    }

    // Внутренний цикл надо прогнать ещё раз, когда x1, y1, x2, y2 сошлись в одном углу.
    innerLoop()

    if (minDistanceXY) {
      return minDistanceXY
    }

    return null
  }

  if (searchDirection === SearchDirection.Plus) {
    return searchPlus()
  } else if (searchDirection === SearchDirection.Minus) {
    return searchMinus()
  } else {
    const p1 = searchPlus()
    const p2 = searchMinus()
    if (p1 && p2) {
      const d1 = getSquaredDistanceBetweenPoints(p1, attractor)
      const d2 = getSquaredDistanceBetweenPoints(p2, attractor)
      return d1 < d2 ? p1 : p2
    } else {
      // Если поиск прошёл неудачно в обоих направлениях, то отсюда вернётся null.
      return p1 ? p1 : p2
    }
  }
}

/**
 * Ищет точку внутри полигона как можно ближе к точке притяжения и не ближе, чем размер буфера, к
 * периметру полигона. Поиск ведётся, начиная с точки притяжения, вдоль линии searchLine.
 * Если точка притяжения находится внутри полигона, то поиск ведётся в обе стороны.
 * Если вне полигона или на границе, то в одну сторону.
 * Координаты рекомендуется присылать в пикселях. Координаты границ и шаг поиска будет дискретными
 * и приведены к целым числам.
 *
 * @param params - параметры поиска точки. Описание см. в интерфейсе.
 * @param paramsModifier - мофикатор параметров. Нужен, так как функция может вызываться опосредованно.
 * @returns координаты найденной точки или null, если не удалось найти точку, удовлетворяющую условиям
 */
export function findPointInPolygon(params, paramsModifier) {
  console.time('findPointInPolygon')

  let polygon
  let attractor
  let bufferSize
  let searchLine
  if (paramsModifier) {
    ;({ polygon, attractor, bufferSize, searchLine } = paramsModifier(params))
  } else {
    ;({ polygon, attractor, bufferSize, searchLine } = params)
  }

  console.log('polygon length:', polygon.length)

  // Быстрая проверка: если ограничивающая рамка меньше двух буферов, возвращаем null.
  const bbox = getPolylineBbox(polygon)
  if (!bbox) {
    console.error('Непредвиденная ошибка: не удалось вычислить bbox')
    console.timeEnd('findPointInPolygon')
    return null
  }
  const [[minX, minY], [maxX, maxY]] = bbox
  const minExtend = Math.min(maxX - minX, maxY - minY)
  // "2 *", потому что bufferSize равен примерно радиусу бирки
  if (2 * bufferSize > minExtend) {
    console.timeEnd('findPointInPolygon')
    return null
  }

  // Самый простой случай: если точка притяжения находится внутри полигона и не ближе к периметру
  // полигона, чем размер буфера, возвращаем её.
  if (pointInPolygon(attractor, polygon)) {
    const distance = getDistanceBetweenPointAndPolyline(attractor, polygon)
    if (distance === null) {
      console.error('Не удалось найти расстояние от точки притяжении до периметра полигона')
      console.timeEnd('findPointInPolygon')
      return null
    }
    if (distance > bufferSize) {
      console.timeEnd('findPointInPolygon')
      return attractor
    }
  }

  // Максимальное количество шагов для случая, если координаты пришли не в пикселях, а, например, в метрах.
  const maxSteps = 1000

  let point
  switch (searchLine) {
    case SearchLine.Vertical:
      point = searchVertical(polygon, attractor, bufferSize, maxSteps)
      console.timeEnd('findPointInPolygon')
      return point
    case SearchLine.Horizontal:
      point = searchHorizontal(polygon, attractor, bufferSize, maxSteps)
      console.timeEnd('findPointInPolygon')
      return point
    case SearchLine.MainDiagonal:
      point = searchMainDiagonal(polygon, attractor, bufferSize, maxSteps)
      console.timeEnd('findPointInPolygon')
      return point
    case SearchLine.AntiDiagonal:
      point = searchAntiDiagonal(polygon, attractor, bufferSize, maxSteps)
      console.timeEnd('findPointInPolygon')
      return point
    default:
      console.error('Неизвестная линия поиска')
      console.timeEnd('findPointInPolygon')
      return null
  }
}

/**
 * Ищет точку внутри мультиполигона как можно ближе к предпочтительным координатам и не ближе, чем
 * размер буфера, к периметру внутреннего полигона. Обход полигонов производится согласно параметрам
 * preferredCoordinates, attractor и preferredAxis. Те же параметры задают параметры поиска в
 * функции findPointInPolygon, которая вызывается внутри.
 * Координаты рекомендуется присылать в пикселях. Координаты границ и шаг поиска будет дискретными
 * и приведены к целым числам.
 *
 * @param multiPolygon - координаты мультиполигона
 * @param preferredCoordinates - предпочтительные координаты. Если они удовлетворяют условиям, то
 *                               сразу возвращаются в качестве найденной точки.
 * @param attractor - точка притяжения, заданная относительно геометрии
 * @param bufferSize - размер буфера: минимальное расстояние от точки до границы полигона
 * @param preferredAxis - приоритетная ось для случаев, когда точка притяжения присвоена углу
 * @param paramsModifier - модификатор параметров
 * @returns координаты найденной точки или null, если не удалось найти точку, удовлетворяющую условиям
 */
export function findPointInMultiPolygon(
  multiPolygon,
  preferredCoordinates,
  attractor,
  bufferSize,
  preferredAxis,
  paramsModifier
) {
  // Быстрая проверка: если ограничивающая рамка меньше двух буферов, возвращаем null.
  const bbox = getMultiPolygonBbox(multiPolygon)
  if (!bbox) {
    console.error('Непредвиденная ошибка: не удалось вычислить bbox')
    return null
  }
  const [[minX, minY], [maxX, maxY]] = bbox
  const minExtend = Math.min(maxX - minX, maxY - minY)
  // "2 *", потому что bufferSize равен примерно радиусу бирки
  if (2 * bufferSize > minExtend) {
    return null
  }

  const polygons = []

  // Регистрируем полигоны, составлющие мультиполигон.
  // Если есть предпочтительные координаты и они находятся внутри одного из полигонов и не ближе к
  // его границам, чем размер буфера, то сразу их возвращаем.
  for (const polygon of multiPolygon) {
    const exteriorRing = polygon[0]
    let preferred = false
    if (preferredCoordinates && pointInPolygon(preferredCoordinates, exteriorRing)) {
      preferred = true
      const distance = getDistanceBetweenPointAndPolyline(preferredCoordinates, exteriorRing)
      if (distance === null) {
        console.error('Не удалось найти расстояние от точки притяжении до периметра полигона')
        continue
      }
      if (distance > bufferSize) {
        return preferredCoordinates
      }
    }

    /* В полигоны-кандидаты включаем только те, которые больше 2 размеров буфера. <<END */
    const ringBbox = getPolylineBbox(exteriorRing)
    if (!ringBbox) {
      console.error('Непредвиденная ошибка: не удалось вычислить bbox')
      continue
    }
    const [[ringMinX, ringMinY], [ringMaxX, ringMaxY]] = ringBbox
    const ringMinExtend = Math.min(ringMaxX - ringMinX, ringMaxY - ringMinY)
    if (2 * bufferSize <= ringMinExtend) {
      polygons.push({
        coordinates: exteriorRing,
        minX: ringMinX,
        maxX: ringMaxX,
        minY: ringMinY,
        maxY: ringMaxY,
        preferred: preferred,
      })
    }
    /* END */
  }

  // Если не нашлось полигонов больше 2 буферов, то возвращаем null
  if (!polygons.length) {
    return null
  }

  // Сортируем внутренние полигоны, согласно предпочтительным координатам, направлению притяжения и оси.
  if (polygons.length > 1) {
    polygons.sort((p1, p2) => {
      // Предпочтительный полигон, тот который содержит предпочтительные координаты, всегда идёт перед
      if (p1.preferred) {
        return -1
      }
      if (p2.preferred) {
        return 1
      }

      // Дельты с учётом сортировки
      const dMinX = p1.minX - p2.minX // полигон с меньшим минимальным X идёт перед
      const dMaxX = -(p1.maxX - p2.maxX) // полигон с большим максимальным X идёт перед
      const dMinY = p1.minY - p2.minY // полигон с меньшим минимальным Y идёт перед
      const dMaxY = -(p1.maxY - p2.maxY) // полигон с большим максимальным Y идёт перед

      // Горизонтальное направление в приоритете, иначе вертикальное
      const xPreferred = preferredAxis === Axis.X // иначе Axis.Y

      switch (attractor) {
        case Attractor.Top:
          return dMinY
        case Attractor.TopRight:
          return xPreferred ? dMaxX || dMinY : dMinY || dMaxX
        case Attractor.Right:
          return dMaxX
        case Attractor.BottomRight:
          return xPreferred ? dMaxX || dMaxY : dMaxY || dMaxX
        case Attractor.Bottom:
          return dMaxY
        case Attractor.BottomLeft:
          return xPreferred ? dMinX || dMaxY : dMaxY || dMinX
        case Attractor.Left:
          return dMinX
        case Attractor.TopLeft:
          return xPreferred ? dMinX || dMinY : dMinY || dMinX
        default:
          console.error('Неизвестная точка притяжения')
          return 0
      }
    })
  }

  for (const p of polygons) {
    let attractorCoordinates = [p.minX, p.minY]
    let searchLine = SearchLine.Horizontal

    switch (attractor) {
      case Attractor.Top:
        attractorCoordinates = [(p.minX + p.maxX) / 2, p.minY]
        searchLine = SearchLine.Vertical
        break
      case Attractor.TopRight:
        attractorCoordinates = [p.maxX, p.minY]
        searchLine = SearchLine.AntiDiagonal
        break
      case Attractor.Right:
        attractorCoordinates = [p.maxX, (p.minY + p.maxY) / 2]
        searchLine = SearchLine.Horizontal
        break
      case Attractor.BottomRight:
        attractorCoordinates = [p.maxX, p.maxY]
        searchLine = SearchLine.MainDiagonal
        break
      case Attractor.Bottom:
        attractorCoordinates = [(p.minX + p.maxX) / 2, p.maxY]
        searchLine = SearchLine.Vertical
        break
      case Attractor.BottomLeft:
        attractorCoordinates = [p.minX, p.maxY]
        searchLine = SearchLine.AntiDiagonal
        break
      case Attractor.Left:
        attractorCoordinates = [p.minX, (p.minY + p.maxY) / 2]
        searchLine = SearchLine.Horizontal
        break
      case Attractor.TopLeft:
        attractorCoordinates = [p.minX, p.minY]
        searchLine = SearchLine.MainDiagonal
        break
      default:
        console.error('Неизвестная точка притяжения')
    }

    if (p.preferred && preferredCoordinates) {
      attractorCoordinates = preferredCoordinates
    }

    const point = findPointInPolygon(
      {
        polygon: p.coordinates,
        attractor: attractorCoordinates,
        bufferSize: bufferSize,
        searchLine: searchLine,
      },
      paramsModifier
    )

    if (point) {
      return point
    }
  }

  // Ни в одном полигоне не нашлось места для точки.
  return null
}

/**
 * Ищет пересечение двух прямых, заданных отрезками.
 * Пересечение может быть пустым множеством, точкой или прямой.
 * https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection
 *
 * @param segment1 - отрезок, представляющий первую прямую
 * @param segment2 - отрезок, представляющий вторую прямую
 * @returns точку пересечения; null, если прямые параллельны, и undefined, если прямые совпадают
 */
export function lineLineIntersection(segment1, segment2) {
  const [[x1, y1], [x2, y2]] = segment1
  const [[x3, y3], [x4, y4]] = segment2

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)

  // Отрезки параллельны и могут располагаться на одной прямой.
  if (denominator === 0) {
    // Прямые совпадают, если ориентация 3 точек (2 конца одного отрезка + любой конец другого отрезка) коллинеарна.
    if (getOrientation(segment1[0], segment1[1], segment2[0]) === Orientation.Collinear) {
      return undefined
    } else {
      return null
    }
  }

  const x = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denominator
  const y = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denominator

  return [x, y]
}

/**
 * Определяет минимальное расстояние между отрезками по вертикали (вдоль оси Y).
 *
 * @param segment1 - координаты первого отрезка (массив координат начальной и конечной точек)
 * @param segment2 - координаты второго отрезка (массив координат начальной и конечной точек)
 * @returns расстояние или null, если второй отрезок находится вне вертикальной полосы первого отрезка
 */
export function getVerticalDistanceBetweenSegments(segment1, segment2) {
  // Нормализуем отрезки, если не нормализованы
  if (segment1[0][0] > segment1[1][0]) {
    segment1 = [segment1[1], segment1[0]]
  }
  if (segment2[0][0] > segment2[1][0]) {
    segment2 = [segment2[1], segment2[0]]
  }

  //     segment1         segment2
  // x11----------x12 x21----------x22
  const [[x11, y11], [x12, y12]] = segment1
  const [[x21, y21], [x22, y22]] = segment2

  /* Проверяем крайние случаи <<END */
  // Если вертикальные полосы отрезков не перекрываются, то возвращаем null.
  if ((x11 < x21 && x12 < x21) || (x11 > x22 && x12 > x22)) {
    return null
  }

  // Если отрезки пересекаются, то возвращаем 0.
  if (intersect(segment1, segment2)) {
    return 0
  }
  /* END */

  /**
   * Вычисляет вертикальное расстояние между точкой и вертикальным отрезком.
   * Функция вызывается в таких случаях, когда точка и концы отрезка имеют одну абсциссу (X),
   * и точка находится вне отрезка.
   *
   * @param point - координаты точки
   * @param vertSegment - координаты отрезка
   * @returns вертикальное расстояние от точки до отрезка
   */
  function distanceBetweenPointAndVertSegment(point, vertSegment) {
    const d1 = Math.abs(point[1] - vertSegment[0][1])
    const d2 = Math.abs(point[1] - vertSegment[1][1])
    return Math.min(d1, d2)
  }

  /**
   * Вычисляет расстояние между отрезками по вертикальному отрезку.
   * Функция вызывается в таких случаях, когда вертикальный отрезок гарантированно пересекает оба отрезка.
   *
   * @param vertSegment - вертикальный отрезок
   * @returns ресстояние
   * @throws при непредвиденных ошибках. В случае возникновения таких ошибок надо исправлять код
   */
  function distanceAlongVertSegment(vertSegment) {
    let minDistance = Infinity

    const intersection1 = lineLineIntersection(segment1, vertSegment)
    const intersection2 = lineLineIntersection(segment2, vertSegment)
    // Крайние случаи, когда какой-нибудь отрезок совпадает с вертикальной линией. Оба никак не могут,
    // иначе не перекрывались бы вертикальные полосы отрезков и внешняя функция вернула раньше.
    // По этой же причине в таком случае у второго отрезка пересечение будет гарантированно точкой.
    let distance = NaN
    if (intersection1 === undefined) {
      if (!intersection2) {
        throw new Error('Непредвиденная ошибка: парное пересечение не является точкой')
      }
      distance = distanceBetweenPointAndVertSegment(intersection2, segment1)
    } else if (intersection2 === undefined) {
      if (!intersection1) {
        throw new Error('Непредвиденная ошибка: парное пересечение не является точкой')
      }
      distance = distanceBetweenPointAndVertSegment(intersection1, segment2)
    } else if (!intersection1 || !intersection2) {
      // Если не выполнились условия выше, оба пересечения должны быть точками.
      throw new Error('Непредвиденная ошибка: отсутствует пересечение')
    } else {
      distance = Math.abs(intersection1[1] - intersection2[1])
    }
    if (distance < minDistance) {
      minDistance = distance
    }

    return minDistance
  }

  /*
   * Общий случай: проекции отрезков на ось X либо частично перекрываются, либо проекция одного
   * отрезка полностью внутри проекции другого.
   */
  // Края общей вертикальной полосы
  const minX = Math.max(x11, x21)
  const maxX = Math.min(x12, x22)

  // Проводим вертикальные линии по краям общей вертикальной полосы, чтобы они пересекали оба отрезка.
  const minY = Math.min(y11, y12, y21, y22)
  const maxY = Math.max(y11, y12, y21, y22)
  const vertSegment1 = [
    [minX, minY],
    [minX, maxY],
  ]
  const vertSegment2 = [
    [maxX, minY],
    [maxX, maxY],
  ]

  let minDistance = Infinity

  const d1 = distanceAlongVertSegment(vertSegment1)
  if (d1 < minDistance) {
    minDistance = d1
  }
  const d2 = distanceAlongVertSegment(vertSegment2)
  if (d2 < minDistance) {
    minDistance = d2
  }

  if (!isFinite(minDistance)) {
    throw new Error('Непредвиденная ошибка: не удалось вычислить расстояние')
  }

  return minDistance
}

/**
 * Определяет расстояние от отрезка до ломаной линии вдоль вертикальной (Y) оси.
 *
 * @param segment - координаты отрезка (массив координат начальной и конечной точек)
 * @param polyline - координаты ломаной линии (массив координат вершин)
 * @returns расстояние или null, если ломаная линия находится вне вертикальной полосы отрезка
 */
export function getVerticalDistanceBetweenSegmentAndPolyline(segment, polyline) {
  if (segment.length !== 2 || polyline.length < 2) {
    console.debug(segment, polyline)
    console.error('Некорректные координаты отрезка и/или ломаной линии')
    return null
  }

  // Функция выполняется при каждом рендеринге. Нужно сократить время расчёта.
  // Значения `100` и `10` подобраны экспериментальным путём.
  if (polyline.length >= 100) {
    const points = polyline.map((p) => ({ x: p[0], y: p[1] }))
    const simplifiedPoints = simplify(points, 10, true)
    polyline = simplifiedPoints.map((p) => [p.x, p.y])
  }

  let minDistance = Infinity

  for (let i = 0; i < polyline.length - 1; i++) {
    let distance = null
    try {
      distance = getVerticalDistanceBetweenSegments(segment, [polyline[i], polyline[i + 1]])
    } catch (err) {
      console.error(err)
    }
    if (distance !== null) {
      if (distance === 0) {
        return distance
      }
      if (distance < minDistance) {
        minDistance = distance
      }
    }
  }

  return isFinite(minDistance) ? minDistance : null
}

/**
 * Определяет расстояние от отрезка до мультиполигона вдоль вертикальной (Y) оси.
 *
 * @param segment - координаты отрезка (массив координат начальной и конечной точек)
 * @param multiPolygon - координаты мультиполигона
 * @returns расстояние или null, если полигон находится вне вертикальной полосы отрезка
 */
export function getVerticalDistanceBetweenSegmentAndMultiPolygon(segment, multiPolygon) {
  if (segment.length !== 2 || multiPolygon.length < 1) {
    console.error('Некорректные координаты отрезка и/или мультиполигона')
    return null
  }

  let minDistance = Infinity

  for (const polygon of multiPolygon) {
    const distance = getVerticalDistanceBetweenSegmentAndPolyline(segment, polygon[0])
    if (distance !== null) {
      if (distance === 0) {
        return distance
      }
      if (distance < minDistance) {
        minDistance = distance
      }
    }
  }

  return isFinite(minDistance) ? minDistance : null
}

/**
 * Конвертирует градусы в радианы.
 *
 * @param value - значение в градусах
 * @returns радианы
 */
export function deg2rad(value) {
  return value * (Math.PI / 180)
}

/**
 * Вращает переданные точки и возвращает новые координаты этих точек.
 * Точки могут быть просто множеством точек, полилинией или полигоном.
 * Источник алгоритма: https://math.stackexchange.com/questions/270194/how-to-find-the-vertices-angle-after-rotation
 *
 * @param points - координаты точек
 * @param angle - угол поворота в радианах
 * @param pivot - координаты центра вращения
 * @returns координаты точек после вращения или копию точек, если настоящего вращения нет
 */
export function rotatePoints(points, angle, pivot) {
  /* Если угол поворота кратен 360°, то возвращаем координаты точек не меняются. */
  if (angle % (Math.PI * 2) === 0) {
    return _.cloneDeep(points)
  }

  const [x0, y0] = pivot
  return (
    points.map <
    [number, number] >
    ((point) => {
      const [x, y] = point
      const x1 = (x - x0) * Math.cos(angle) - (y - y0) * Math.sin(angle) + x0
      const y1 = (x - x0) * Math.sin(angle) + (y - y0) * Math.cos(angle) + y0
      return [x1, y1]
    })
  )
}
