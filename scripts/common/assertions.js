export function isPolygonCoordinates(coordinates) {
  return (
    Array.isArray(coordinates) &&
    Array.isArray(coordinates[0]) &&
    Array.isArray(coordinates[0][0]) &&
    Number.isFinite(coordinates[0][0][0])
  )
}

export function isMultiPolygonCoordinates(coordinates) {
  return Array.isArray(coordinates) && isPolygonCoordinates(coordinates[0])
}
