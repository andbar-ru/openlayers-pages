import GeoJSON from 'ol/format/GeoJSON'
import Map from 'ol/Map'
import View from 'ol/View'
import Overlay from 'ol/Overlay'
import { OSM, Vector as VectorSource } from 'ol/source'
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer'
import { fromLonLat } from 'ol/proj'
import { Style, Stroke } from 'ol/style'

const source = new VectorSource()

const format = new GeoJSON()

const list = document.getElementById('list')

const featureByCode = new Map()

const codes = []

function styleFunction(feature) {
  return new Style({
    stroke: new Stroke({
      color: 'black',
      width: 1,
    }),
  })
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

const map = new Map({
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
