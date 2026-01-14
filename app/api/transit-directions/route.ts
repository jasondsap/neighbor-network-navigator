import { NextRequest, NextResponse } from 'next/server';

interface TransitStep {
    type: 'WALKING' | 'TRANSIT';
    instruction: string;
    distance: string;
    duration: string;
    // Walking specific
    walkingSteps?: string[];
    // Transit specific
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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { origin, destination, departureTime } = body;

        if (!origin || !destination) {
            return NextResponse.json(
                { error: 'Origin and destination are required' },
                { status: 400 }
            );
        }

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Google Maps API key not configured' },
                { status: 500 }
            );
        }

        // Build Google Directions API URL
        const params = new URLSearchParams({
            origin,
            destination,
            mode: 'transit',
            alternatives: 'true',
            key: apiKey,
        });

        // Add departure time if provided (Unix timestamp)
        if (departureTime) {
            params.append('departure_time', departureTime);
        } else {
            // Default to now
            params.append('departure_time', Math.floor(Date.now() / 1000).toString());
        }

        // Add region bias for Louisville
        params.append('region', 'us');

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/directions/json?${params}`
        );

        if (!response.ok) {
            throw new Error(`Google API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'OK') {
            // Handle specific error statuses
            if (data.status === 'ZERO_RESULTS') {
                return NextResponse.json({
                    success: false,
                    error: 'No transit routes found',
                    message: 'There are no bus routes available between these locations. Try a different time or check if locations are within TARC service area.',
                    routes: []
                });
            }
            return NextResponse.json(
                { error: `Directions API error: ${data.status}`, details: data.error_message },
                { status: 400 }
            );
        }

        // Parse and format routes
        const routes: TransitRoute[] = data.routes.map((route: any) => {
            const leg = route.legs[0]; // We only have one leg for single origin-destination

            const steps: TransitStep[] = leg.steps.map((step: any) => {
                const baseStep: TransitStep = {
                    type: step.travel_mode === 'WALKING' ? 'WALKING' : 'TRANSIT',
                    instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || '',
                    distance: step.distance?.text || '',
                    duration: step.duration?.text || '',
                };

                if (step.travel_mode === 'WALKING') {
                    // Extract detailed walking steps
                    baseStep.walkingSteps = step.steps?.map((s: any) => 
                        s.html_instructions?.replace(/<[^>]*>/g, '') || ''
                    ) || [];
                } else if (step.travel_mode === 'TRANSIT' && step.transit_details) {
                    const transit = step.transit_details;
                    baseStep.busNumber = transit.line?.short_name || transit.line?.name || '';
                    baseStep.busName = transit.line?.name || '';
                    baseStep.departureStop = transit.departure_stop?.name || '';
                    baseStep.arrivalStop = transit.arrival_stop?.name || '';
                    baseStep.departureTime = transit.departure_time?.text || '';
                    baseStep.arrivalTime = transit.arrival_time?.text || '';
                    baseStep.numStops = transit.num_stops || 0;
                    baseStep.headsign = transit.headsign || '';
                    baseStep.busColor = transit.line?.color || '#2E4A8E';
                }

                return baseStep;
            });

            return {
                summary: route.summary || 'Transit Route',
                departureTime: leg.departure_time?.text || '',
                arrivalTime: leg.arrival_time?.text || '',
                totalDuration: leg.duration?.text || '',
                totalDistance: leg.distance?.text || '',
                fare: leg.fare?.text || null,
                steps,
                warnings: route.warnings || [],
                copyrights: route.copyrights || '',
                hasTransit: steps.some(s => s.type === 'TRANSIT'), // Flag to identify if route has actual transit
            };
        });

        // Filter to only routes that have actual transit (bus/rail), not just walking
        const transitRoutes = routes.filter(r => r.hasTransit);
        
        // If no transit routes found, return helpful message
        if (transitRoutes.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No bus routes available',
                message: 'No TARC bus routes are available for this trip at the selected time. This could be because: (1) It\'s outside TARC operating hours (most routes run 5am-11pm weekdays, limited weekends), (2) The locations are not served by TARC, or (3) Try searching for a different departure time.',
                routes: [],
                walkingOnly: routes.length > 0, // Indicates walking routes exist but no transit
            });
        }

        return NextResponse.json({
            success: true,
            routes: transitRoutes,
            origin: data.routes[0]?.legs[0]?.start_address || origin,
            destination: data.routes[0]?.legs[0]?.end_address || destination,
        });

    } catch (error) {
        console.error('Transit directions error:', error);
        return NextResponse.json(
            { error: 'Failed to get transit directions' },
            { status: 500 }
        );
    }
}
