import GeoJSON from 'ol/format/GeoJSON'
import Map from 'ol/Map'
import View from 'ol/View'
import { OSM, Vector as VectorSource } from 'ol/source'
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer'
import { fromLonLat } from 'ol/proj'
import { Style, Circle, Stroke } from 'ol/style'

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

fetch('data/centroid.json')
  .then(function (response) {
    return response.json()
  })
  .then(function (data) {
    const format = new GeoJSON()

    const pointCollection = turf.points(data.points)
    const centroid = turf.centroid(pointCollection)

    for (const feature of pointCollection.features) {
      const marker = format.readFeature(feature)
      marker.getGeometry().transform('EPSG:4326', 'EPSG:3857')
      if (pointCollection.features.length > 1) {
        source.addFeature(marker)
      }
    }

    const centroidMarker = format.readFeature(centroid)
    centroidMarker.getGeometry().transform('EPSG:4326', 'EPSG:3857')
    centroidMarker.setStyle(
      new Style({
        image: new Circle({
          radius: 5,
          stroke: new Stroke({
            color: 'rgba(255, 0, 0, 0.7)',
            width: 2,
          }),
        }),
      })
    )
    source.addFeature(centroidMarker)

    console.log('centroid of coordinates:', centroid.geometry.coordinates[1], centroid.geometry.coordinates[0])

    map.getView().fit(source.getExtent(), { padding: [50, 50, 50, 50] })
  })
