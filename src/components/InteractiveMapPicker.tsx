import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Linking } from 'react-native';
import {
  getCityCoordinates,
  calculateMidpointCoords,
  reverseGeocode,
  placeNameFromReverse,
} from '../utils/geo';
import { isMapPointMessage } from '../utils/mapMessages';

// react-native-webview richiede codice nativo: se la build non lo include, usiamo il fallback.
let NativeWebView: React.ComponentType<any> | null = null;
if (Platform.OS !== 'web') {
  try {
    NativeWebView = require('react-native-webview').WebView;
  } catch (e) {
    NativeWebView = null;
  }
}

class MapBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface Props {
  myCity: string;
  partnerCity: string;
  currentMeetingPoint?: string;
  onSelectLocation: (locationName: string, lat: number, lon: number) => void;
  onClose: () => void;
}

type Coord = { lat: number; lon: number };

const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

export const InteractiveMapPicker: React.FC<Props> = ({
  myCity,
  partnerCity,
  currentMeetingPoint,
  onSelectLocation,
  onClose,
}) => {
  const [ready, setReady] = useState(false);
  const [myCoords, setMyCoords] = useState<Coord | null>(null);
  const [partnerCoords, setPartnerCoords] = useState<Coord | null>(null);
  const [startCoords, setStartCoords] = useState<Coord | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string>(currentMeetingPoint || 'Caricamento mappa...');
  const [selectedCoords, setSelectedCoords] = useState<Coord | null>(null);
  const pointRequest = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapFrame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const points = pointRequest;
    (async () => {
      const [myC, partnerC] = await Promise.all([getCityCoordinates(myCity, controller.signal), getCityCoordinates(partnerCity, controller.signal)]);
      let start: Coord | null = null;
      if (myC && partnerC) start = calculateMidpointCoords(myC.lat, myC.lon, partnerC.lat, partnerC.lon);
      else start = myC || partnerC;
      if (!alive) return;
      setMyCoords(myC);
      setPartnerCoords(partnerC);
      setStartCoords(start);
      if (start) {
        setSelectedCoords(start);
        if (!currentMeetingPoint) {
          const data = await reverseGeocode(start.lat, start.lon, controller.signal);
          if (alive) setSelectedPlace(placeNameFromReverse(data, start.lat, start.lon));
        }
      } else if (!currentMeetingPoint) {
        setSelectedPlace('Nessun punto selezionato');
      }
      setReady(true);
    })().catch(() => { if (alive) setReady(true); });
    return () => {
      alive = false; controller.abort(); points.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [myCity, partnerCity, currentMeetingPoint]);

  // Reverse geocoding con debounce (Nominatim: max 1 richiesta/s, le chiamate passano comunque da una coda)
  const onPointSelected = (lat: number, lon: number) => {
    setSelectedCoords({ lat, lon });
    setSelectedPlace("Cerca un luogo…");
    pointRequest.current?.abort();
    const controller = new AbortController(); pointRequest.current = controller;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await reverseGeocode(lat, lon, controller.signal);
        if (!controller.signal.aborted && pointRequest.current === controller) setSelectedPlace(placeNameFromReverse(data, lat, lon));
      } catch { /* Superseded point or closed map. */ }
    }, 700);
  };

  // Web: messaggi dall'iframe
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => {
      if (!mapFrame.current || event.source !== mapFrame.current.contentWindow) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (isMapPointMessage(data)) {
          onPointSelected(data.lat, data.lon);
        }
      } catch (err) {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Native: messaggi dalla WebView
  const handleNativeMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (isMapPointMessage(data)) onPointSelected(data.lat, data.lon);
    } catch (err) {}
  };

  const confirmSelection = () => {
    if (selectedCoords && selectedPlace && !selectedPlace.startsWith('Ricerca')) {
      onSelectLocation(selectedPlace, selectedCoords.lat, selectedCoords.lon);
    }
  };

  const openExternal = () => {
    if (!selectedCoords) return;
    const { lat, lon } = selectedCoords;
    const url = Platform.select({
      ios: `maps://?ll=${lat},${lon}&q=${encodeURIComponent("Punto d'incontro")}`,
      android: `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent("Punto d'incontro")})`,
      default: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=10/${lat}/${lon}`,
    });
    if (url) {
      Linking.openURL(url).catch(() =>
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`)
      );
    }
  };

  const cfg = {
    center: startCoords ? [startCoords.lat, startCoords.lon] : [41.9028, 12.4964],
    zoom: startCoords ? 8 : 6,
    hasStart: !!startCoords,
    my: myCoords ? { lat: myCoords.lat, lon: myCoords.lon, label: myCity } : null,
    partner: partnerCoords ? { lat: partnerCoords.lat, lon: partnerCoords.lon, label: partnerCity } : null,
  };

  const mapHtml = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #0F0F12; }
    .leaflet-popup-content-wrapper { background: #1E1B26; color: #FFF; border-radius: 8px; border: 1px solid #FF2366; }
    .leaflet-popup-tip { background: #1E1B26; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var cfg = ${safeJson(cfg)};
    var map = L.map('map').setView(cfg.center, cfg.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);

    function popup(title, sub) {
      var d = document.createElement('div');
      var b = document.createElement('b'); b.textContent = title;
      d.appendChild(b);
      if (sub) { d.appendChild(document.createElement('br')); d.appendChild(document.createTextNode(sub)); }
      return d;
    }
    var bounds = [];
    if (cfg.my) {
      L.circleMarker([cfg.my.lat, cfg.my.lon], { color: '#4CAF50', radius: 9, fillColor: '#4CAF50', fillOpacity: 0.8 }).addTo(map).bindPopup(popup('Casa Tua', cfg.my.label));
      bounds.push([cfg.my.lat, cfg.my.lon]);
    }
    if (cfg.partner) {
      L.circleMarker([cfg.partner.lat, cfg.partner.lon], { color: '#9C27B0', radius: 9, fillColor: '#9C27B0', fillOpacity: 0.8 }).addTo(map).bindPopup(popup('Partner', cfg.partner.label));
      bounds.push([cfg.partner.lat, cfg.partner.lon]);
    }
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });

    var meetMarker = L.marker(cfg.center, { draggable: true }).addTo(map);
    meetMarker.bindPopup(popup("Punto d'Incontro", 'Trascina o clicca sulla mappa'));
    if (cfg.hasStart) meetMarker.openPopup();

    function notify(lat, lon) {
      var payload = JSON.stringify({ type: 'POINT_SELECTED', lat: lat, lon: lon });
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
      else if (window.parent) window.parent.postMessage(payload, '*');
    }
    meetMarker.on('dragend', function (e) { var c = e.target.getLatLng(); notify(c.lat, c.lng); });
    map.on('click', function (e) { meetMarker.setLatLng(e.latlng); notify(e.latlng.lat, e.latlng.lng); });
  </script>
</body>
</html>`;

  const fallback = (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>Mappa interattiva non disponibile</Text>
      <Text style={styles.fallbackText}>
        La mappa interattiva non è disponibile in questa versione. Puoi usare il punto intermedio suggerito oppure aprire l’app Mappe.
      </Text>
      <TouchableOpacity style={styles.externalBtn} onPress={openExternal}>
        <Text style={styles.externalBtnText}>🗺️ Apri nell&apos;app Mappe</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMap = () => {
    if (!ready) return <View style={styles.fallback}><Text style={styles.fallbackText}>Caricamento mappa...</Text></View>;
    if (Platform.OS === 'web') {
      return (
        <iframe ref={mapFrame} sandbox="allow-scripts" srcDoc={mapHtml} style={{ width: '100%', height: '100%', border: 'none' }} title="Mappa interattiva" />
      );
    }
    if (!NativeWebView) return fallback;
    const WV = NativeWebView;
    return (
      <MapBoundary fallback={fallback}>
        <WV
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          onMessage={handleNativeMessage}
          style={{ flex: 1, backgroundColor: '#0F0F12' }}
          javaScriptEnabled
          domStorageEnabled
        />
      </MapBoundary>
    );
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.mapCardContainer}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>📍 Scegli Punto d&apos;Incontro sulla Mappa</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapWrapper}>{renderMap()}</View>

        <View style={styles.selectionFooter}>
          <Text style={styles.selectedLocationText}>
            Punto selezionato: <Text style={styles.boldText}>{selectedPlace}</Text>
          </Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={confirmSelection}>
            <Text style={styles.confirmBtnText}>Conferma questo punto</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 10,
  },
  mapCardContainer: {
    width: '100%',
    maxWidth: 600,
    height: 520,
    backgroundColor: '#18181C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF2366',
    overflow: 'hidden',
    flexDirection: 'column',
  },
  mapHeader: {
    padding: 12,
    backgroundColor: '#1E1B26',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2535',
  },
  mapTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#FF5252', fontSize: 16, fontWeight: 'bold' },
  mapWrapper: { flex: 1, backgroundColor: '#000' },
  fallback: { flex: 1, padding: 20, justifyContent: 'center', gap: 12 },
  fallbackTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  fallbackText: { color: '#BBB', fontSize: 14, lineHeight: 20 },
  externalBtn: { borderWidth: 1, borderColor: '#FF4D85', borderRadius: 8, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  externalBtnText: { color: '#FF4D85', fontWeight: 'bold', fontSize: 14 },
  selectionFooter: {
    padding: 12,
    backgroundColor: '#121016',
    borderTopWidth: 1,
    borderTopColor: '#2A2535',
    gap: 8,
  },
  selectedLocationText: { color: '#CCC', fontSize: 14 },
  boldText: { color: '#FF2366', fontWeight: 'bold' },
  confirmBtn: { backgroundColor: '#FF4D85', minHeight: 44, justifyContent: 'center', borderRadius: 22, alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
});
