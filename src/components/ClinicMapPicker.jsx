import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const markerIcon = L.divIcon({
    html: `<div style="width:22px;height:22px;background:#134e3a;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    className: '',
});

function ClickHandler({ onPick }) {
    useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
    return null;
}

function FlyController({ target }) {
    const map  = useMap();
    const prev = useRef(null);
    useEffect(() => {
        if (target && target !== prev.current) {
            prev.current = target;
            map.flyTo([target.lat, target.lon], 17, { duration: 1 });
        }
    }, [target, map]);
    return null;
}

export default function ClinicMapPicker({ position, flyTarget, onPick, interactive = true, height = 300 }) {
    const EGYPT  = [26.8206, 30.8025];
    const center = position ? [position.lat, position.lon] : EGYPT;
    const zoom   = position ? 15 : 6;

    return (
        <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: `${height}px`, width: '100%', borderRadius: '12px' }}
            scrollWheelZoom
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {interactive && <ClickHandler onPick={onPick} />}
            <FlyController target={flyTarget} />
            {position && <Marker position={[position.lat, position.lon]} icon={markerIcon} />}
        </MapContainer>
    );
}
