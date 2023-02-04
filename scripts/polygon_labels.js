import GeoJSON from 'ol/format/GeoJSON'
import Map from 'ol/Map'
import View from 'ol/View'
import { OSM, Vector as VectorSource } from 'ol/source'
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer'
import { fromLonLat } from 'ol/proj'
import { Style, Stroke } from 'ol/style'

function styleFunction(feature) {
  return new Style({
    stroke: new Stroke({
      color: 'black',
      width: 1,
    }),
  })
}

const source = new VectorSource()

const vectorLayer = new VectorLayer({
  source: source,
  style: styleFunction,
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

fetch('data/countries-coastline-1km.geo.json')
  .then(function (response) {
    return response.json()
  })
  .then(function (data) {
    const format = new GeoJSON()
    const features = format.readFeatures(data)

    for (const feature of features) {
      feature.getGeometry().transform('EPSG:4326', 'EPSG:3857')
      source.addFeature(feature)
    }
  })
