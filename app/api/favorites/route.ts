import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    try {
        const { data, error } = await supabase
            .from('favorites')
            .select('resource_id, resource_source')
            .eq('user_id', userId);

        if (error) throw error;

        return NextResponse.json({ favorites: data || [] });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, resourceId, resourceSource = 'Local' } = body;

        if (!userId || !resourceId) {
            return NextResponse.json({ error: 'User ID and Resource ID required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('favorites')
            .insert({
                user_id: userId,
                resource_id: resourceId,
                resource_source: resourceSource
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation - already favorited
                return NextResponse.json({ message: 'Already favorited' }, { status: 200 });
            }
            throw error;
        }

        return NextResponse.json({ success: true, favorite: data });
    } catch (error) {
        console.error('Error adding favorite:', error);
        return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const resourceId = searchParams.get('resourceId');

    if (!userId || !resourceId) {
        return NextResponse.json({ error: 'User ID and Resource ID required' }, { status: 400 });
    }

    try {
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', userId)
            .eq('resource_id', resourceId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing favorite:', error);
        return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 });
    }
}
