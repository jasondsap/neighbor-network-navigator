'use client';

import { useState, useRef, useEffect } from 'react';
import {
    X, Bus, MapPin, Clock, Navigation, ArrowRight, Loader2,
    PersonStanding, AlertTriangle, Copy, ExternalLink, Send,
    ChevronDown, ChevronUp, Phone, Mail, MessageSquare, Check
} from 'lucide-react';

interface TransitStep {
    type: 'WALKING' | 'TRANSIT';
    instruction: string;
    distance: string;
    duration: string;
    walkingSteps?: string[];
    busNumber?: string;
    busName?: string;
    departureStop?: string;
    arrivalStop?: string;
    departureTime?: string;
    arrivalTime?: string;
    numStops?: number;
    headsign?: string;
    busColor?: string;
}

interface TransitRoute {
    summary: string;
    departureTime: string;
    arrivalTime: string;
    totalDuration: string;
    totalDistance: string;
    fare?: string;
    steps: TransitStep[];
    warnings: string[];
    copyrights: string;
}

interface Resource {
    id: string;
    organization_name: string;
    program_name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    category: string;
}

interface BusDirectionsModalProps {
    resource: Resource;
    onClose: () => void;
    categoryColor: string;
}

export default function BusDirectionsModal({ resource, onClose, categoryColor }: BusDirectionsModalProps) {
    const [originAddress, setOriginAddress] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [routes, setRoutes] = useState<TransitRoute[]>([]);
    const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
    const [copied, setCopied] = useState(false);
    const [originFormatted, setOriginFormatted] = useState('');
    const [destinationFormatted, setDestinationFormatted] = useState('');
    const [departureTime, setDepartureTime] = useState('');
    const [walkingOnly, setWalkingOnly] = useState(false);
    
    const inputRef = useRef<HTMLInputElement>(null);

    // Build destination address
    const destinationAddress = [
        resource.address,
        resource.city || 'Louisville',
        resource.state || 'KY',
        resource.zip
    ].filter(Boolean).join(', ');

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSearch = async () => {
        if (!originAddress.trim()) {
            setError('Please enter a starting address');
            return;
        }

        setIsLoading(true);
        setError(null);
        setHasSearched(true);
        setWalkingOnly(false);

        try {
            // Convert departure time to Unix timestamp if provided
            let departureTimestamp: string | undefined;
            if (departureTime) {
                const dt = new Date(departureTime);
                departureTimestamp = Math.floor(dt.getTime() / 1000).toString();
            }

            const response = await fetch('/api/transit-directions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origin: originAddress,
                    destination: destinationAddress,
                    departureTime: departureTimestamp,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get directions');
            }

            if (data.success && data.routes.length > 0) {
                setRoutes(data.routes);
                setOriginFormatted(data.origin);
                setDestinationFormatted(data.destination);
                setSelectedRouteIndex(0);
            } else {
                setError(data.message || 'No bus routes found between these locations.');
                setWalkingOnly(data.walkingOnly || false);
                setRoutes([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get directions');
            setRoutes([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const toggleStepExpanded = (index: number) => {
        const newExpanded = new Set(expandedSteps);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedSteps(newExpanded);
    };

    const selectedRoute = routes[selectedRouteIndex];

    // Generate text version of directions
    const generateDirectionsText = (): string => {
        if (!selectedRoute) return '';

        let text = `🚌 TARC Bus Directions\n`;
        text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `📍 FROM: ${originFormatted}\n`;
        text += `📍 TO: ${resource.organization_name}\n`;
        text += `     ${destinationFormatted}\n\n`;
        text += `⏱️ Total Time: ${selectedRoute.totalDuration}\n`;
        text += `🕐 Depart: ${selectedRoute.departureTime} → Arrive: ${selectedRoute.arrivalTime}\n`;
        if (selectedRoute.fare) {
            text += `💵 Fare: ${selectedRoute.fare}\n`;
        }
        text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `STEP-BY-STEP DIRECTIONS:\n`;
        text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

        selectedRoute.steps.forEach((step, index) => {
            if (step.type === 'WALKING') {
                text += `${index + 1}. 🚶 WALK (${step.duration}, ${step.distance})\n`;
                text += `   ${step.instruction}\n\n`;
            } else {
                text += `${index + 1}. 🚌 BUS ${step.busNumber}\n`;
                text += `   Board at: ${step.departureStop} (${step.departureTime})\n`;
                text += `   Get off at: ${step.arrivalStop} (${step.arrivalTime})\n`;
                text += `   Direction: ${step.headsign}\n`;
                text += `   Ride ${step.numStops} stops (${step.duration})\n\n`;
            }
        });

        text += `━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `📞 ${resource.organization_name}: ${resource.phone || 'No phone listed'}\n`;
        text += `\n💡 Tip: Arrive 5 min early for the bus!`;

        return text;
    };

    const copyDirections = async () => {
        const text = generateDirectionsText();
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const openInGoogleMaps = () => {
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originAddress)}&destination=${encodeURIComponent(destinationAddress)}&travelmode=transit`;
        window.open(url, '_blank');
    };

    const sendViaSMS = () => {
        const text = generateDirectionsText();
        const smsUrl = `sms:?body=${encodeURIComponent(text)}`;
        window.location.href = smsUrl;
    };

    const sendViaEmail = () => {
        const text = generateDirectionsText();
        const subject = `Bus Directions to ${resource.organization_name}`;
        const mailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
        window.location.href = mailUrl;
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#2E4A8E] to-[#1E3A6E] p-6 text-white">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                <Bus className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">TARC Bus Directions</h2>
                                <p className="text-blue-100 text-sm">Plan your trip using Louisville transit</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Destination Card */}
                    <div className="mt-4 bg-white/10 rounded-xl p-4">
                        <p className="text-blue-200 text-xs uppercase tracking-wide mb-1">Destination</p>
                        <p className="font-semibold">{resource.organization_name}</p>
                        <p className="text-blue-100 text-sm">{destinationAddress}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Origin Input */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <MapPin className="w-4 h-4 inline mr-1" />
                            Neighbor's Starting Address
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={originAddress}
                            onChange={(e) => setOriginAddress(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Enter home address (e.g., 123 Main St, Louisville, KY)"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                        />
                    </div>

                    {/* Departure Time */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Clock className="w-4 h-4 inline mr-1" />
                            Departure Time (optional)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="datetime-local"
                                value={departureTime}
                                onChange={(e) => setDepartureTime(e.target.value)}
                                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                            />
                            <button
                                onClick={handleSearch}
                                disabled={isLoading}
                                className="px-6 py-3 bg-[#2E4A8E] text-white rounded-xl font-medium hover:bg-[#243d73] transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Navigation className="w-5 h-5" />
                                )}
                                <span className="hidden sm:inline">Get Directions</span>
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Leave blank to search for routes leaving now</p>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-red-700 font-medium">
                                        {walkingOnly ? 'No Bus Routes at This Time' : 'No Routes Found'}
                                    </p>
                                    <p className="text-red-600 text-sm mt-1">{error}</p>
                                    {walkingOnly && (
                                        <div className="mt-3 p-3 bg-white rounded-lg border border-red-100">
                                            <p className="text-sm text-gray-700 font-medium mb-2">Try these options:</p>
                                            <ul className="text-sm text-gray-600 space-y-1">
                                                <li>• Search for a weekday morning (6am-9am) or afternoon (3pm-6pm)</li>
                                                <li>• TARC has limited weekend service</li>
                                                <li>• Check if both locations are within Louisville Metro</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {routes.length > 0 && selectedRoute && (
                        <>
                            {/* Route Options */}
                            {routes.length > 1 && (
                                <div className="mb-4">
                                    <p className="text-sm text-gray-600 mb-2">Route Options:</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {routes.map((route, index) => (
                                            <button
                                                key={index}
                                                onClick={() => setSelectedRouteIndex(index)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                    index === selectedRouteIndex
                                                        ? 'bg-[#2E4A8E] text-white'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                            >
                                                Option {index + 1} • {route.totalDuration}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Summary Card */}
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Depart</p>
                                        <p className="font-bold text-gray-900">{selectedRoute.departureTime}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Arrive</p>
                                        <p className="font-bold text-gray-900">{selectedRoute.arrivalTime}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Total Time</p>
                                        <p className="font-bold text-gray-900">{selectedRoute.totalDuration}</p>
                                    </div>
                                    {selectedRoute.fare && (
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase">Fare</p>
                                            <p className="font-bold text-gray-900">{selectedRoute.fare}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Step-by-Step Directions */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Step-by-Step Directions
                                </h3>

                                {selectedRoute.steps.map((step, index) => (
                                    <div
                                        key={index}
                                        className={`rounded-xl border ${
                                            step.type === 'WALKING' 
                                                ? 'bg-gray-50 border-gray-200' 
                                                : 'bg-blue-50 border-blue-200'
                                        }`}
                                    >
                                        <button
                                            onClick={() => toggleStepExpanded(index)}
                                            className="w-full p-4 text-left"
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Step Icon */}
                                                <div
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                        step.type === 'WALKING'
                                                            ? 'bg-gray-200 text-gray-600'
                                                            : 'text-white'
                                                    }`}
                                                    style={step.type === 'TRANSIT' ? { backgroundColor: step.busColor || '#2E4A8E' } : {}}
                                                >
                                                    {step.type === 'WALKING' ? (
                                                        <PersonStanding className="w-5 h-5" />
                                                    ) : (
                                                        <span className="font-bold text-sm">{step.busNumber}</span>
                                                    )}
                                                </div>

                                                {/* Step Content */}
                                                <div className="flex-1 min-w-0">
                                                    {step.type === 'WALKING' ? (
                                                        <>
                                                            <p className="font-medium text-gray-900">
                                                                Walk {step.distance}
                                                            </p>
                                                            <p className="text-sm text-gray-600">{step.instruction}</p>
                                                            <p className="text-xs text-gray-500 mt-1">{step.duration}</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="font-medium text-gray-900">
                                                                Bus {step.busNumber} - {step.busName}
                                                            </p>
                                                            <p className="text-sm text-gray-600">
                                                                To: {step.headsign}
                                                            </p>
                                                            <div className="flex items-center gap-4 mt-2 text-sm">
                                                                <span className="text-green-700">
                                                                    🟢 {step.departureTime} {step.departureStop}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-sm">
                                                                <span className="text-red-700">
                                                                    🔴 {step.arrivalTime} {step.arrivalStop}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {step.numStops} stops • {step.duration}
                                                            </p>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Expand Icon */}
                                                {step.type === 'WALKING' && step.walkingSteps && step.walkingSteps.length > 0 && (
                                                    <div className="text-gray-400">
                                                        {expandedSteps.has(index) ? (
                                                            <ChevronUp className="w-5 h-5" />
                                                        ) : (
                                                            <ChevronDown className="w-5 h-5" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </button>

                                        {/* Expanded Walking Steps */}
                                        {step.type === 'WALKING' && expandedSteps.has(index) && step.walkingSteps && (
                                            <div className="px-4 pb-4 pt-0">
                                                <div className="ml-12 pl-4 border-l-2 border-gray-300 space-y-2">
                                                    {step.walkingSteps.map((walkStep, wIndex) => (
                                                        <p key={wIndex} className="text-sm text-gray-600">
                                                            {walkStep}
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Arrival */}
                                <div className="rounded-xl bg-green-100 border border-green-300 p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center">
                                            <MapPin className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-green-900">Arrive at Destination</p>
                                            <p className="text-sm text-green-700">{resource.organization_name}</p>
                                            {resource.phone && (
                                                <a href={`tel:${resource.phone}`} className="text-sm text-green-600 flex items-center gap-1 mt-1">
                                                    <Phone className="w-3 h-3" />
                                                    {resource.phone}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Warnings */}
                            {selectedRoute.warnings.length > 0 && (
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-sm text-amber-800">
                                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                                        {selectedRoute.warnings.join(' ')}
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <p className="text-sm font-medium text-gray-700 mb-3">Share Directions with Neighbor:</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <button
                                        onClick={copyDirections}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                    <button
                                        onClick={sendViaSMS}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-100 hover:bg-green-200 rounded-xl text-sm font-medium text-green-700 transition-colors"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        Text
                                    </button>
                                    <button
                                        onClick={sendViaEmail}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 hover:bg-blue-200 rounded-xl text-sm font-medium text-blue-700 transition-colors"
                                    >
                                        <Mail className="w-4 h-4" />
                                        Email
                                    </button>
                                    <button
                                        onClick={openInGoogleMaps}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-[#2E4A8E] hover:bg-[#243d73] rounded-xl text-sm font-medium text-white transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Google Maps
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Empty State */}
                    {!isLoading && !hasSearched && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Bus className="w-8 h-8 text-[#2E4A8E]" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Plan a TARC Bus Trip</h3>
                            <p className="text-gray-500 text-sm max-w-sm mx-auto">
                                Enter your neighbor's home address above to get step-by-step bus directions to {resource.organization_name}.
                            </p>
                            <div className="mt-4 p-4 bg-amber-50 rounded-xl text-left max-w-sm mx-auto">
                                <p className="text-sm text-amber-800">
                                    <strong>💡 Tip:</strong> TARC buses run most frequently Mon-Fri 6am-6pm. 
                                    Weekend and evening service is limited.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
                    <p className="text-xs text-gray-500">
                        Transit data provided by TARC via Google Maps • Schedules subject to change
                    </p>
                </div>
            </div>
        </div>
    );
}
