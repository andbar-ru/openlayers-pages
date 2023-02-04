import GeoJSON from 'ol/format/GeoJSON'
import Map from 'ol/Map'
import View from 'ol/View'
import { OSM, Vector as VectorSource } from 'ol/source'
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer'
import { fromLonLat } from 'ol/proj'
import { Style, Stroke, Fill } from 'ol/style'

const source = new VectorSource()

const vectorLayer = new VectorLayer({
  source: source,
})

const rasterLayer = new TileLayer({
  source: new OSM(),
})

const map = new Map({
  layers: [rasterLayer, vectorLayer],
  target: document.getElementById('map'),
  view: new View({
    center: fromLonLat([0, 0]),
    zoom: 3,
  }),
})

function polar2Cartesian(center, angle, radius) {
  const x = center[0] + radius * Math.cos(angle)
  const y = center[1] + radius * Math.sin(angle)
  return [x, y]
}

function randomPolygon(
  bbox = [-180, -90, 180, 90],
  radiusRange = [1, 10],
  angleDeltaRange = [0, 1],
  radiusDeltaRange = [-1, 1]
) {
  const maxRadius = radiusRange[1]
  const bbox4Center = [bbox[0] + maxRadius, bbox[1] + maxRadius, bbox[2] - maxRadius, bbox[3] - maxRadius]
  const centerX = Math.random() * (bbox4Center[2] - bbox4Center[0]) + bbox4Center[0]
  const centerY = Math.random() * (bbox4Center[3] - bbox4Center[1]) + bbox4Center[1]
  const center = [centerX, centerY]
  const angle0 = Math.random() * 2 * Math.PI
  const maxAngle = Math.PI * 2 + angle0

  let curAngle = angle0
  let curRadius = Math.random() * (radiusRange[1] - radiusRange[0]) + radiusRange[0]
  const vertices = []

  while (curAngle < maxAngle) {
    const vertex = polar2Cartesian(center, curAngle, curRadius)
    vertices.push(vertex)
    curAngle += Math.random() * (angleDeltaRange[1] - angleDeltaRange[0]) + angleDeltaRange[0]
    curRadius += Math.random() * (radiusDeltaRange[1] - radiusDeltaRange[0]) + radiusDeltaRange[0]
    if (curRadius > radiusRange[1]) {
      curRadius = radiusRange[1]
    } else if (curRadius < radiusRange[0]) {
      curRadius = radiusRange[0]
    }
  }

  vertices.push(vertices[0])

  return turf.polygon([vertices])
}

const format = new GeoJSON()
const polygon = randomPolygon([0, 30, 180, 70], [1, 10], [0, 0.001], [-0.01, 0.01])
const olPolygon = format.readFeature(polygon)
olPolygon.getGeometry().transform('EPSG:4326', 'EPSG:3857')
olPolygon.setStyle([
  new Style({
    fill: new Fill({
      color: 'rgba(255, 0, 0, 0.1)',
    }),
    stroke: new Stroke({
      color: 'rgb(255, 0, 0)',
    }),
  }),
  new Style({
    renderer: function (pixelCoordinates, state) {
      const points = pixelCoordinates[0].map((p) => ({ x: p[0], y: p[1] }))
      const simplifiedPoints = simplify(points, 30, true)
      console.log(pixelCoordinates[0].length, '->', simplifiedPoints.length)

      const ctx = state.context
      ctx.strokeStyle = 'blue'
      ctx.lineWidth = 1
      ctx.beginPath()

      ctx.moveTo(simplifiedPoints[0].x, simplifiedPoints[0].y)
      for (let i = 1; i < simplifiedPoints.length; i++) {
        ctx.lineTo(simplifiedPoints[i].x, simplifiedPoints[i].y)
      }

      ctx.stroke()
    },
  }),
])
source.addFeature(olPolygon)

map.getView().fit(source.getExtent(), { padding: [50, 50, 50, 50] })
