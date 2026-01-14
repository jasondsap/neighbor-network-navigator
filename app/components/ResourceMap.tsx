'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';

interface Resource {
    id: string;
    organization_name: string;
    program_name?: string;
    category: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
    source: string;
    distance_miles?: number;
}

interface ResourceMapProps {
    resources: Resource[];
    onResourceClick: (resource: Resource) => void;
    categoryColors: Record<string, string>;
}

interface GeocodedResource extends Resource {
    coords: { lat: number; lng: number } | null;
}

// Louisville center
const LOUISVILLE_CENTER = { lat: 38.2527, lng: -85.7585 };

// Map container style
const containerStyle = {
    width: '100%',
    height: '100%'
};

// Map options
const mapOptions: google.maps.MapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: true,
    mapTypeControl: false,
    fullscreenControl: true,
    styles: [
        {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
        }
    ]
};

// Persistent geocode cache
const geocodeCache: Record<string, { lat: number; lng: number } | null> = {};

export default function ResourceMap({ resources, onResourceClick, categoryColors }: ResourceMapProps) {
    const [geocodedResources, setGeocodedResources] = useState<GeocodedResource[]>([]);
    const [selectedResource, setSelectedResource] = useState<GeocodedResource | null>(null);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [geocodedCount, setGeocodedCount] = useState(0);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const geocoderRef = useRef<google.maps.Geocoder | null>(null);

    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries: ['places']
    });

    // Geocode a single address
    const geocodeAddress = useCallback(async (address: string): Promise<{ lat: number; lng: number } | null> => {
        // Check cache first
        if (geocodeCache[address] !== undefined) {
            return geocodeCache[address];
        }

        if (!geocoderRef.current) {
            geocoderRef.current = new google.maps.Geocoder();
        }

        return new Promise((resolve) => {
            geocoderRef.current!.geocode({ address }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const location = results[0].geometry.location;
                    const coords = { lat: location.lat(), lng: location.lng() };
                    geocodeCache[address] = coords;
                    resolve(coords);
                } else {
                    console.warn(`Geocoding failed for: ${address}, status: ${status}`);
                    geocodeCache[address] = null;
                    resolve(null);
                }
            });
        });
    }, []);

    // Geocode all resources
    useEffect(() => {
        if (!isLoaded) return;

        const geocodeAllResources = async () => {
            setIsGeocoding(true);
            setGeocodedCount(0);

            const results: GeocodedResource[] = [];

            for (let i = 0; i < resources.length; i++) {
                const resource = resources[i];
                let coords: { lat: number; lng: number } | null = null;

                // Use existing lat/lng if available (SAMHSA resources)
                if (resource.latitude && resource.longitude) {
                    coords = { lat: resource.latitude, lng: resource.longitude };
                }
                // Otherwise geocode the address
                else if (resource.address) {
                    const fullAddress = [
                        resource.address,
                        resource.city || 'Louisville',
                        resource.state || 'KY',
                        resource.zip
                    ].filter(Boolean).join(', ');
                    
                    coords = await geocodeAddress(fullAddress);
                }

                results.push({ ...resource, coords });
                setGeocodedCount(i + 1);
            }

            setGeocodedResources(results);
            setIsGeocoding(false);
        };

        geocodeAllResources();
    }, [resources, isLoaded, geocodeAddress]);

    // Fit bounds when resources change
    useEffect(() => {
        if (!map || geocodedResources.length === 0) return;

        const resourcesWithCoords = geocodedResources.filter(r => r.coords);
        if (resourcesWithCoords.length === 0) return;

        const bounds = new google.maps.LatLngBounds();
        resourcesWithCoords.forEach(resource => {
            if (resource.coords) {
                bounds.extend(resource.coords);
            }
        });

        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

        // Don't zoom in too far for single markers
        const listener = google.maps.event.addListener(map, 'idle', () => {
            const zoom = map.getZoom();
            if (zoom && zoom > 15) {
                map.setZoom(15);
            }
            google.maps.event.removeListener(listener);
        });
    }, [map, geocodedResources]);

    const onLoad = useCallback((map: google.maps.Map) => {
        setMap(map);
    }, []);

    const onUnmount = useCallback(() => {
        setMap(null);
    }, []);

    // Create custom marker icon SVG
    const getMarkerIcon = (color: string): google.maps.Symbol => ({
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: 1.5,
        anchor: new google.maps.Point(12, 22),
    });

    if (loadError) {
        return (
            <div className="w-full h-[500px] md:h-[600px] rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <div className="text-center p-4">
                    <p className="text-red-600 font-medium">Failed to load Google Maps</p>
                    <p className="text-red-500 text-sm mt-1">Please check your API key configuration</p>
                </div>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="w-full h-[500px] md:h-[600px] rounded-xl bg-gray-100 flex items-center justify-center">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-[#2E4A8E] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-600">Loading Google Maps...</span>
                </div>
            </div>
        );
    }

    const mappedCount = geocodedResources.filter(r => r.coords).length;

    return (
        <div className="relative w-full h-[500px] md:h-[600px] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {/* Loading overlay */}
            {isGeocoding && (
                <div className="absolute top-4 left-4 z-10 bg-white px-4 py-2 rounded-lg shadow-md">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-[#2E4A8E] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-gray-600">
                            Mapping locations... {geocodedCount}/{resources.length}
                        </span>
                    </div>
                </div>
            )}

            {/* Map */}
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={LOUISVILLE_CENTER}
                zoom={11}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={mapOptions}
            >
                {/* Markers */}
                {geocodedResources.map((resource) => {
                    if (!resource.coords) return null;
                    const color = categoryColors[resource.category] || '#607D8B';

                    return (
                        <MarkerF
                            key={resource.id}
                            position={resource.coords}
                            icon={getMarkerIcon(color)}
                            onClick={() => setSelectedResource(resource)}
                        />
                    );
                })}

                {/* Info Window */}
                {selectedResource && selectedResource.coords && (
                    <InfoWindowF
                        position={selectedResource.coords}
                        onCloseClick={() => setSelectedResource(null)}
                    >
                        <div className="min-w-[200px] max-w-[280px] p-1">
                            <h3 className="font-semibold text-gray-900 text-sm mb-1">
                                {selectedResource.organization_name}
                            </h3>
                            {selectedResource.program_name && (
                                <p className="text-xs text-gray-500 mb-2">{selectedResource.program_name}</p>
                            )}
                            <span 
                                className="inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2"
                                style={{ 
                                    backgroundColor: `${categoryColors[selectedResource.category] || '#607D8B'}20`,
                                    color: categoryColors[selectedResource.category] || '#607D8B'
                                }}
                            >
                                {selectedResource.category}
                            </span>
                            {selectedResource.address && (
                                <p className="text-xs text-gray-600 mb-1">📍 {selectedResource.address}</p>
                            )}
                            {selectedResource.phone && (
                                <p className="text-xs text-gray-600 mb-2">📞 {selectedResource.phone}</p>
                            )}
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => {
                                        onResourceClick(selectedResource);
                                        setSelectedResource(null);
                                    }}
                                    className="flex-1 px-3 py-1.5 bg-[#2E4A8E] text-white rounded text-xs font-medium hover:bg-[#243d73] transition-colors"
                                >
                                    View Details
                                </button>
                                {selectedResource.coords && (
                                    <a
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedResource.coords.lat},${selectedResource.coords.lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                                    >
                                        Directions
                                    </a>
                                )}
                            </div>
                        </div>
                    </InfoWindowF>
                )}
            </GoogleMap>

            {/* Status badge */}
            {!isGeocoding && mappedCount > 0 && (
                <div className="absolute bottom-4 left-4 z-10 bg-white/90 px-3 py-1.5 rounded-lg text-xs text-gray-600 shadow-sm">
                    {mappedCount} locations mapped
                </div>
            )}
        </div>
    );
}
