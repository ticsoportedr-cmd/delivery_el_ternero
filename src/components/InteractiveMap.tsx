import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Pedido, Repartidor } from '../types';
import { Navigation, MapPin, Eye, Compass, Radio, ShieldCheck, Locate, X, Maximize2, Minimize2 } from 'lucide-react';
import { fetchStreetRoute } from '../utils/routing';
import logoImg from '../assets/images/el_ternero_logo.svg';

interface InteractiveMapProps {
  pedidos: Pedido[];
  repartidores: Repartidor[];
  selectedPedidoId?: string;
  onMapClickCoordinates?: (lat: number, lon: number) => void;
  interactiveDriverId?: string;
  assignedDriverIdOnly?: string;
  customStorePin?: { lat: number; lon: number; nombre?: string; direccion?: string };
  customClientPin?: { lat: number; lon: number; nombre?: string };
  customBannerText?: string;
  hideHeaderBanner?: boolean;
  mapHeightClassName?: string;
  isAdmin?: boolean;
  logoUrl?: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  pedidos,
  repartidores,
  selectedPedidoId,
  onMapClickCoordinates,
  interactiveDriverId,
  assignedDriverIdOnly,
  customStorePin,
  customClientPin,
  customBannerText,
  hideHeaderBanner,
  mapHeightClassName,
  isAdmin = false,
  logoUrl,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const clickedPinMarkerRef = useRef<L.Marker | null>(null);

  const [mapTileStyle, setMapTileStyle] = useState<'street' | 'satellite'>('street');
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [gpsActiveMsg, setGpsActiveMsg] = useState<string>('');
  const [streetRouteInfo, setStreetRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [isBannerClosed, setIsBannerClosed] = useState<boolean>(false);

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // 1. ResizeObserver & InvalidateSize triggers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    
    // Immediate and staged invalidations during transitions
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 350);
    const t3 = setTimeout(() => map.invalidateSize(), 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isExpanded]);

  const repartidoresToRender = assignedDriverIdOnly
    ? repartidores.filter((r) => r.id === assignedDriverIdOnly)
    : repartidores;

  const activePedido = selectedPedidoId
    ? pedidos.find((p) => p.id === selectedPedidoId)
    : pedidos[0];

  // Helper to create Google Maps / Tile Layers
  const createTileLayer = (style: 'street' | 'satellite' | 'terrain') => {
    if (style === 'satellite') {
      // Google Maps Satellite Hybrid (real high-res satellite with roads, labels & places)
      return L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
      });
    } else if (style === 'terrain') {
      // Google Maps Terrain
      return L.tileLayer('https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
      });
    } else {
      // Google Maps Standard Street Map (Real Google Maps look & labels)
      return L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
      });
    }
  };

  // 1. Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center default around Limpio, Paraguay (-25.1747, -57.48334)
    const initialLat = customStorePin?.lat || customClientPin?.lat || activePedido?.latitudCliente || -25.1747;
    const initialLon = customStorePin?.lon || customClientPin?.lon || activePedido?.longitudCliente || -57.48334;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 14,
      zoomControl: false,
    });

    // Add Zoom Control at top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial Google Maps tile layer
    const initialTile = createTileLayer(mapTileStyle);
    initialTile.addTo(map);
    tileLayerRef.current = initialTile;

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    // Handle map click
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setIsBannerClosed(true);
      if (onMapClickCoordinates) {
        onMapClickCoordinates(lat, lng);
      }
    });

    // ResizeObserver to automatically handle container resizes without turning black
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    // Force resize calculation after load
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Handle Tile Layer Switcher (Google Maps Street vs Google Satellite)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const newTile = createTileLayer(mapTileStyle);
    newTile.addTo(mapInstanceRef.current);
    tileLayerRef.current = newTile;

    mapInstanceRef.current.invalidateSize();
  }, [mapTileStyle]);

  // 3. Render Markers & Routes whenever state changes
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    // Store Pin for Local / Restaurant (Always rendered)
    const effectiveStorePin = customStorePin || {
      lat: (pedidos.length > 0 && pedidos[0].latitudRestaurante) ? pedidos[0].latitudRestaurante : -25.1747,
      lon: (pedidos.length > 0 && pedidos[0].longitudRestaurante) ? pedidos[0].longitudRestaurante : -57.48334,
      nombre: (pedidos.length > 0 && pedidos[0].restauranteNombre) ? pedidos[0].restauranteNombre : 'EL TERNERO (Local)',
    };

    const isDraggableStore = !!(customStorePin && onMapClickCoordinates);
    const storeLabel = customStorePin?.nombre || effectiveStorePin.nombre || 'EL TERNERO (Local)';
    const effectiveStoreLogo = logoUrl || logoImg;

    const storeIcon = L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; ${isDraggableStore ? 'cursor: move;' : ''}">
          <!-- Header pill badge -->
          <div style="background-color: #022c22; color: #6ee7b7; font-weight: 800; font-size: 11px; padding: 5px 12px; border-radius: 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.7); border: 2px solid #10b981; white-space: nowrap; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px;">🏬</span>
            <span>${storeLabel}</span>
            ${isDraggableStore ? '<span style="font-size: 9px; opacity: 0.8; font-weight: 600; color: #cbd5e1;">(Arrastrar)</span>' : ''}
          </div>
          <!-- Circle with Logo -->
          <div style="position: relative; width: 46px; height: 46px; background: #022c22; border: 3px solid #10b981; border-radius: 50%; box-shadow: 0 0 16px rgba(16,185,129,0.45); display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2px;">
            <img src="${effectiveStoreLogo}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%; background-color: #000000;" alt="EL TERNERO" />
          </div>
          <!-- Pointer Arrow Tip -->
          <div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid #10b981; margin-top: -2px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));"></div>
        </div>
      `,
      iconSize: [220, 84],
      iconAnchor: [110, 84],
    });

    const storeMarker = L.marker([effectiveStorePin.lat, effectiveStorePin.lon], {
      icon: storeIcon,
      draggable: isDraggableStore,
      zIndexOffset: 2500,
    }).addTo(layerGroup);

    storeMarker.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <img src="${effectiveStoreLogo}" style="width: 24px; height: 24px; border-radius: 6px; object-fit: cover;" />
          <strong style="color: #047857; font-size: 13px;">${storeLabel}</strong>
        </div>
        <div style="font-size: 11px; color: #334155; line-height: 1.4;">
          <strong>📍 Dirección del Local:</strong><br/>
          ${customStorePin?.direccion || (pedidos.length > 0 && pedidos[0].direccion ? pedidos[0].direccion : 'RGG9+R7H, Gral. Elizardo Aquino, Limpio 110816, Paraguay')}<br/>
          <span style="font-family: monospace; color: #64748b; font-weight: bold;">(${effectiveStorePin.lat.toFixed(5)}, ${effectiveStorePin.lon.toFixed(5)})</span>
        </div>
      </div>
    `);

    if (isDraggableStore) {
      storeMarker.on('dragend', (e: L.LeafletEvent) => {
        const target = e.target as L.Marker;
        const { lat, lng } = target.getLatLng();
        if (onMapClickCoordinates) {
          onMapClickCoordinates(lat, lng);
        }
      });
    }

    bounds.extend([effectiveStorePin.lat, effectiveStorePin.lon]);

    // Custom Client Pin (if provided in picker mode)
    if (customClientPin) {
      const clientIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: move;">
            <div style="background-color: #ef4444; color: #ffffff; font-weight: 800; font-size: 11px; padding: 4px 10px; border-radius: 12px; box-shadow: 0 4px 14px rgba(239,68,68,0.5); border: 2px solid #ffffff; white-space: nowrap; margin-bottom: 4px;">
              🏠 ${customClientPin.nombre || 'MI UBICACIÓN DE ENTREGA'} (Arrastrar / Clic)
            </div>
            <div style="width: 28px; height: 28px; background-color: #ef4444; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 12px rgba(239,68,68,0.8); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">📍</div>
          </div>
        `,
        iconSize: [190, 56],
        iconAnchor: [95, 56],
      });

      const m = L.marker([customClientPin.lat, customClientPin.lon], { icon: clientIcon, draggable: true }).addTo(layerGroup);
      m.bindPopup(`<b>🏠 Destino de Entrega</b><br/>Arrastra este pin o haz clic en el mapa para ubicar tu casa.`);

      m.on('dragend', (e: L.LeafletEvent) => {
        const target = e.target as L.Marker;
        const { lat, lng } = target.getLatLng();
        if (onMapClickCoordinates) {
          onMapClickCoordinates(lat, lng);
        }
      });

      bounds.extend([customClientPin.lat, customClientPin.lon]);
    }

    // Render Pedidos (Client & Routes)
    pedidos.forEach((pedido) => {
      const isSelected = activePedido?.id === pedido.id;

      // Client destination pin for order
      if (!customClientPin) {
        const clientIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `
            <div style="display: flex; flex-direction: column; align-items: center;">
              <div style="background-color: ${isSelected ? '#ef4444' : '#64748b'}; color: #ffffff; font-weight: 800; font-size: 10px; padding: 3px 8px; border-radius: 10px; border: 2px solid #ffffff; white-space: nowrap; box-shadow: 0 3px 8px rgba(0,0,0,0.3);">
                🏠 ${pedido.cliente} (${pedido.id})
              </div>
              <div style="width: 22px; height: 22px; background-color: ${isSelected ? '#ef4444' : '#64748b'}; border: 2px solid #ffffff; border-radius: 50%; margin-top: 2px;"></div>
            </div>
          `,
          iconSize: [140, 46],
          iconAnchor: [70, 46],
        });
        const m = L.marker([pedido.latitudCliente, pedido.longitudCliente], { icon: clientIcon }).addTo(layerGroup);
        m.bindPopup(`<b>Cliente:</b> ${pedido.cliente}<br/><b>Dirección:</b> ${pedido.direccion}`);
        bounds.extend([pedido.latitudCliente, pedido.longitudCliente]);
      }

      // Draw polyline routes if selected
      const driverLat = pedido.latitudActual ?? pedido.latitudRestaurante;
      const driverLon = pedido.longitudActual ?? pedido.longitudRestaurante;

      if (isSelected) {
        // 1. TRAYECTO SELECCIONADO POR EL CLIENTE (Restaurante -> Cliente)
        const storeToClientFallback = L.polyline(
          [
            [pedido.latitudRestaurante, pedido.longitudRestaurante],
            [pedido.latitudCliente, pedido.longitudCliente],
          ],
          { color: '#38bdf8', weight: 4, dashArray: '8, 8', opacity: 0.85 }
        ).addTo(layerGroup);

        fetchStreetRoute(
          pedido.latitudRestaurante,
          pedido.longitudRestaurante,
          pedido.latitudCliente,
          pedido.longitudCliente
        ).then((route) => {
          if (layerGroupRef.current && route.coordinates.length > 0) {
            layerGroupRef.current.removeLayer(storeToClientFallback);

            // Customer planned route line (Sky blue)
            L.polyline(route.coordinates, {
              color: '#38bdf8',
              weight: 5,
              opacity: 0.9,
              dashArray: '6, 6',
              lineJoin: 'round',
            }).addTo(layerGroupRef.current);
          }
        });

        // 2. TRAYECTO EN TIEMPO REAL DEL REPARTIDOR (GPS Repartidor -> Cliente)
        const driverToClientFallback = L.polyline(
          [
            [driverLat, driverLon],
            [pedido.latitudCliente, pedido.longitudCliente],
          ],
          { color: '#10b981', weight: 6, opacity: 0.9 }
        ).addTo(layerGroup);

        fetchStreetRoute(driverLat, driverLon, pedido.latitudCliente, pedido.longitudCliente).then((route) => {
          if (layerGroupRef.current && route.coordinates.length > 0) {
            layerGroupRef.current.removeLayer(driverToClientFallback);

            // Glowing casing line under live driver route (Neon Green glow)
            L.polyline(route.coordinates, {
              color: '#15803d',
              weight: 10,
              opacity: 0.4,
              lineJoin: 'round',
            }).addTo(layerGroupRef.current);

            // Live driver street route (Bright Neon Green)
            L.polyline(route.coordinates, {
              color: '#10b981',
              weight: 6,
              opacity: 0.95,
              lineJoin: 'round',
            }).addTo(layerGroupRef.current);

            setStreetRouteInfo((prev) => {
              if (prev && prev.distanceKm === route.distanceKm && prev.durationMin === route.durationMin) {
                return prev;
              }
              return { distanceKm: route.distanceKm, durationMin: route.durationMin };
            });
          }
        });
      }
    });

    // Draw route for Custom Picker mode (Store -> Client Pin)
    if (customStorePin && customClientPin) {
      const fallbackLine = L.polyline(
        [
          [customStorePin.lat, customStorePin.lon],
          [customClientPin.lat, customClientPin.lon],
        ],
        { color: '#ef4444', weight: 4, dashArray: '6, 6' }
      ).addTo(layerGroup);

      fetchStreetRoute(customStorePin.lat, customStorePin.lon, customClientPin.lat, customClientPin.lon).then((route) => {
        if (layerGroupRef.current && route.coordinates.length > 0) {
          layerGroupRef.current.removeLayer(fallbackLine);

          L.polyline(route.coordinates, {
            color: '#ef4444',
            weight: 5,
            opacity: 0.9,
            lineJoin: 'round',
          }).addTo(layerGroupRef.current);

          setStreetRouteInfo((prev) => {
            if (prev && prev.distanceKm === route.distanceKm && prev.durationMin === route.durationMin) {
              return prev;
            }
            return { distanceKm: route.distanceKm, durationMin: route.durationMin };
          });
        }
      });
    }

    // Render Repartidores (Live Drivers)
    repartidoresToRender.forEach((rep) => {
      const activeRepPedido = pedidos.find((p) => p.repartidorId === rep.id);
      const lat = activeRepPedido?.latitudActual ?? rep.latitud;
      const lon = activeRepPedido?.longitudActual ?? rep.longitud;
      const isSelected = activePedido?.repartidorId === rep.id || interactiveDriverId === rep.id;

      // Calculate ETA minutes to destination
      let etaMinutesText = '';
      if (activeRepPedido && activeRepPedido.latitudCliente && activeRepPedido.longitudCliente) {
        const destLat = activeRepPedido.latitudCliente;
        const destLon = activeRepPedido.longitudCliente;
        const radlat1 = (Math.PI * lat) / 180;
        const radlat2 = (Math.PI * destLat) / 180;
        const theta = lon - destLon;
        const radtheta = (Math.PI * theta) / 180;
        let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) dist = 1;
        dist = Math.acos(dist);
        dist = (dist * 180) / Math.PI;
        dist = dist * 60 * 1.1515 * 1.609344; // km
        const calculatedMins = Math.max(2, Math.round(dist * 2.5 + 2));
        etaMinutesText = `${calculatedMins} min`;
      }

      const driverIcon = L.divIcon({
        className: 'custom-leaflet-driver-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            <div style="background-color: #022c22; color: #6ee7b7; font-weight: 900; font-size: 11px; padding: 4px 10px; border-radius: 20px; border: 2px solid #10b981; white-space: nowrap; box-shadow: 0 4px 14px rgba(16,185,129,0.35); display: flex; align-items: center; gap: 6px; margin-bottom: 4px; letter-spacing: 0.5px;">
              <span style="font-size: 14px; line-height: 1;">🛵</span>
              <span>${rep.nombre.split(' ')[0]}</span>
              ${etaMinutesText ? `<span style="background: #10b981; color: #ffffff; font-size: 10px; font-weight: 900; padding: 1px 6px; border-radius: 10px; border: 1px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">⏱️ ${etaMinutesText}</span>` : ''}
            </div>
            <div style="position: relative; width: 46px; height: 46px; background: linear-gradient(135deg, #022c22 0%, #0f172a 100%); border: 3px solid #10b981; border-radius: 50%; box-shadow: 0 0 16px rgba(16,185,129,0.5); display: flex; align-items: center; justify-content: center; overflow: visible;">
              <div style="position: absolute; inset: -6px; border-radius: 50%; border: 2px solid #34d399; opacity: 0.75; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <span style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); transform: scaleX(-1);">🛵</span>
            </div>
          </div>
        `,
        iconSize: [180, 72],
        iconAnchor: [90, 72],
      });

      const m = L.marker([lat, lon], { icon: driverIcon }).addTo(layerGroup);
      m.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px;">
          <div style="display: flex; items-center; gap: 8px;">
            <img src="/scooter.svg" style="width: 28px; height: 28px; object-fit: contain;" alt="Moto" />
            <h4 style="margin: 0; font-weight: 800; color: #0f172a;">${rep.nombre}</h4>
          </div>
          <p style="margin: 6px 0 0; font-size: 12px; color: #475569;">
            <b>Vehículo:</b> ${rep.vehiculo.toUpperCase()}<br/>
            <b>Chapa:</b> ${rep.chapa || '123 ABC'}<br/>
            <b>Tel:</b> ${rep.telefono}<br/>
            <span style="color: #16a34a; font-weight: bold;">● GPS Transmitiendo en Tiempo Real</span>
          </p>
        </div>
      `);

      bounds.extend([lat, lon]);
    });

    // Fit bounds smoothly if we have points
    if (bounds.isValid() && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [pedidos, repartidoresToRender, activePedido, customStorePin, customClientPin]);

  // Locate user GPS position
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGpsActiveMsg('Geolocalización no soportada por el navegador.');
      return;
    }
    setGpsActiveMsg('Obteniendo tu ubicación GPS real...');

    const tryGetPosition = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], 16, { animate: true });
          }
          if (onMapClickCoordinates) {
            onMapClickCoordinates(latitude, longitude);
          }
          setGpsActiveMsg(`📍 Ubicación obtenida: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          setTimeout(() => setGpsActiveMsg(''), 4000);
        },
        (err) => {
          if (highAccuracy) {
            // Retry with standard accuracy if high accuracy timed out or failed
            tryGetPosition(false);
          } else {
            console.warn('GPS error:', err);
            let reason = 'Permiso denegado o inaccesible.';
            if (err.code === 1) reason = 'Permiso de ubicación denegado en el navegador.';
            else if (err.code === 2) reason = 'Posición GPS no disponible en este dispositivo.';
            else if (err.code === 3) reason = 'Tiempo de espera de GPS agotado.';
            setGpsActiveMsg(`Ubicación GPS no obtenida (${reason}). Puedes tocar el mapa para marcar tu posición.`);
            setTimeout(() => setGpsActiveMsg(''), 6000);
          }
        },
        { enableHighAccuracy: highAccuracy, timeout: 8000, maximumAge: 10000 }
      );
    };

    tryGetPosition(true);
  };

  return (
    <div className={`relative w-full rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 ${
      isExpanded ? 'fixed inset-2 md:inset-4 z-[400] h-[calc(100vh-1rem)] md:h-[calc(100vh-2rem)] flex flex-col justify-between' : ''
    }`}>
      {/* Map Header Toolbar Overlay */}
      {!hideHeaderBanner && !isBannerClosed && (
        <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 bg-slate-950/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-xs text-slate-200 shadow-xl">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-extrabold tracking-wider text-[11px] sm:text-xs uppercase truncate">
              {customBannerText || 'GPS REPARTIDORES 100% EN VIVO'}
            </span>
            <span className="text-slate-500 hidden md:inline">| Asunción, Paraguay</span>
          </div>

          {/* Style Switches & GPS Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/40 transition-all flex items-center gap-1 cursor-pointer"
                title={isExpanded ? 'Restaurar tamaño' : 'Ver en pantalla completa grande'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isExpanded ? 'Achicar' : 'Pantalla Gigante'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLocateMe}
              className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-sky-500 text-slate-950 hover:bg-sky-400 border border-sky-400 shadow-md shadow-sky-500/30 transition-colors flex items-center gap-1 cursor-pointer"
              title="Obtener y fijar mi ubicación GPS real"
            >
              <Locate className="w-3.5 h-3.5 text-slate-950 shrink-0" />
              <span>Mi GPS Real</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBannerClosed(true)}
              className="p-1 rounded-lg bg-slate-900 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/40 transition-colors cursor-pointer ml-1"
              title="Ocultar aviso del mapa"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Alert toast for GPS message */}
      {gpsActiveMsg && (
        <div className="absolute top-14 left-4 right-4 z-[1000] bg-sky-950/90 backdrop-blur-md border border-sky-500/40 text-sky-200 text-xs px-3.5 py-2 rounded-xl shadow-xl flex items-center justify-between font-mono animate-fade-in">
          <span>{gpsActiveMsg}</span>
          <button onClick={() => setGpsActiveMsg('')} className="text-sky-400 hover:text-white ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Leaflet Map DOM Container */}
      <div
        ref={mapContainerRef}
        className={`w-full z-10 transition-all ${
          isExpanded
            ? 'h-[calc(100vh-110px)]'
            : mapHeightClassName || 'h-[520px] sm:h-[680px] lg:h-[760px]'
        }`}
        style={{ minHeight: '400px' }}
      />

      {/* Footer Legend */}
      <div className="bg-slate-950/90 px-4 py-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block border border-white"></span>
            <span className="font-semibold text-slate-300">Restaurante</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-sky-400 inline-block border border-sky-300"></span>
            <span className="font-semibold text-sky-300">🔵 Ruta Elegida Cliente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block border border-white animate-pulse"></span>
            <span className="font-bold text-emerald-400">🟢 Repartidor GPS (En Vivo)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block border border-white"></span>
            <span className="font-semibold text-slate-300">Cliente Destino</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Canal Socket: <span className="text-emerald-400 font-bold">tracking_pedido_{activePedido?.id || 'PED-1234'}</span>
        </div>
      </div>
    </div>
  );
};
