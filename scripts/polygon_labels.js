import GeoJSON from 'ol/format/GeoJSON'
import OlMap from 'ol/Map'
import View from 'ol/View'
import Overlay from 'ol/Overlay'
import { OSM, Vector as VectorSource } from 'ol/source'
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer'
import { fromLonLat } from 'ol/proj'
import { Style, Stroke } from 'ol/style'
import objectHash from 'object-hash'

import { fixPolygonRings } from './common/geoUtils'
import { isPolygonCoordinates, isMultiPolygonCoordinates } from './common/assertions'
import { Attractor, Axis, SearchLine } from './common/enums'
import { findPointInPolygon, findPointInMultiPolygon, getPolylineBbox } from './common/geomUtils'

const source = new VectorSource()
const format = new GeoJSON()
const list = document.getElementById('list')
const featureByCode = new Map()
const codes = []
const radius = 30
const pixelCoordinates2PixelCache = new Map()

function getAttractorCoordinates(attractor, bbox) {
  const [[minX, minY], [maxX, maxY]] = bbox

  switch (attractor) {
    case Attractor.Top:
      return [(minX + maxX) / 2, minY]
    case Attractor.TopRight:
      return [maxX, minY]
    case Attractor.Right:
      return [maxX, (minY + maxY) / 2]
    case Attractor.BottomRight:
      return [maxX, maxY]
    case Attractor.Bottom:
      return [(minX + maxX) / 2, maxY]
    case Attractor.BottomLeft:
      return [minX, maxY]
    case Attractor.Left:
      return [minX, (minY + maxY) / 2]
    case Attractor.TopLeft:
      return [minX, minY]
    default:
      throw new Error(`Unexpected attractor: ${attractor}`)
  }
}

function drawLabel(ctx, pixel) {
  ctx.strokeStyle = 'red'
  ctx.fillStyle = 'red'
  ctx.beginPath()
  ctx.arc(pixel[0], pixel[1], radius, 0, Math.PI * 2, true)
  ctx.stroke()
  ctx.font = '12pt sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Label', pixel[0], pixel[1])
}

function styleFunction(feature) {
  return [
    new Style({
      stroke: new Stroke({
        color: 'black',
        width: 1,
      }),
    }),
    new Style({
      renderer: function (pixelCoordinates, state) {
        const ctx = state.context

        const key = objectHash(pixelCoordinates, { algorithm: 'md5' })

        if (pixelCoordinates2PixelCache.has(key)) {
          const pixel = pixelCoordinates2PixelCache.get(key)
          if (pixel) {
            drawLabel(ctx, pixel)
          }
          return
        }

        console.time('renderer')

        fixPolygonRings(pixelCoordinates)
        const preferredCoordinates = null
        const attractor = Attractor.TopRight
        const bufferSize = radius + 2
        const axis = Axis.X
        const searchLine = SearchLine.AntiDiagonal
        let pixel

        if (isMultiPolygonCoordinates(pixelCoordinates)) {
          pixel = findPointInMultiPolygon(pixelCoordinates, preferredCoordinates, attractor, bufferSize, axis)
        } else if (isPolygonCoordinates(pixelCoordinates)) {
          const exteriorRingCoordinates = pixelCoordinates[0]
          const bbox = getPolylineBbox(exteriorRingCoordinates)
          const attractorCoordinates = getAttractorCoordinates(attractor, bbox)

          pixel = findPointInPolygon({
            polygon: exteriorRingCoordinates,
            attractor: attractorCoordinates,
            bufferSize: bufferSize,
            searchLine: searchLine,
          })
        } else {
          throw new Error('pixelCoordinates is neither polygon nor multipolygon coordinates')
        }

        if (pixel) {
          drawLabel(ctx, pixel)
        }

        console.timeEnd('renderer')

        pixelCoordinates2PixelCache.set(key, pixel)
      },
    }),
  ]
}

const rasterLayer = new TileLayer({
  source: new OSM(),
})

const vectorLayer = new VectorLayer({
  source: source,
  style: styleFunction,
})

const view = new View({
  center: fromLonLat([0, 0]),
  zoom: 3,
})

const map = new OlMap({
  layers: [rasterLayer, vectorLayer],
  target: document.getElementById('map'),
  view: view,
})

map.on('singleclick', function (evt) {
  list.classList.toggle('hidden')
})

function onLiClick(evt) {
  const code = evt.target.id
  source.clear()
  const feature = featureByCode.get(code)
  const olFeature = format.readFeature(feature)
  olFeature.getGeometry().transform('EPSG:4326', 'EPSG:3857')
  source.addFeature(olFeature)
  list.classList.add('hidden')
  view.fit(olFeature.getGeometry(), { padding: [10, 10, 10, 10] })
}

fetch('data/countries-coastline-1km.geo.json')
  .then(function (response) {
    return response.json()
  })
  .then(function (featureCollection) {
    for (const feature of featureCollection.features) {
      const code = feature.properties.A3
      codes.push(code)
      featureByCode.set(code, feature)
    }
    codes.sort()
    for (const code of codes) {
      const li = document.createElement('li')
      li.textContent = code
      li.setAttribute('id', code)
      li.addEventListener('click', onLiClick)
      list.appendChild(li)
    }
  })
