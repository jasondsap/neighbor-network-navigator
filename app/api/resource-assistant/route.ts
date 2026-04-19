/**
 * app/api/resource-assistant/route.ts
 *
 * AI-powered resource guidance for navigators. Calls OpenAI with the user's
 * question + matched resources and returns a structured JSON response the
 * frontend can render (summary, recommended resources, next steps, script,
 * barriers, encouragement).
 *
 * Gated behind NextAuth.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/auth';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface MatchedResource {
    id: string;
    name: string;
    type: string;
    address?: string;
    phone?: string;
    website?: string;
    email?: string;
    notes?: string;
    eligibility?: string;
    hours?: string;
    services?: string;
}

export async function POST(request: NextRequest) {
    try {
        await requireAuth();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const {
            userNeed,
            location = 'Louisville, KY',
            participantContext = '',
            goalContext = '',
            category = '',
            matchedResources = [],
        } = body;

        if (!userNeed) {
            return NextResponse.json(
                { error: 'User need/question is required' },
                { status: 400 }
            );
        }

        // Format matched resources for the model prompt
        const formattedResources: MatchedResource[] = matchedResources.map((r: any) => ({
            id: r.id,
            name: r.organization_name || r.name1 || r.name,
            type: r.category || r.type_facility || 'Resource',
            address: r.address || r.street1,
            phone: r.phone,
            website: r.website,
            email: r.email,
            notes: r.notes || r.tips_tricks,
            eligibility:
                [r.qualifier_income, r.qualifier_age, r.qualifier_cohort, r.qualifier_misc]
                    .filter(Boolean)
                    .join('; ') || r.qualifier_geography,
            hours: r.hours,
            services: r.service_description || r.subcategory,
        }));

        const prompt = `You are the Resource Assistant inside the SLCM Neighbor Network Navigator, a digital workspace that supports community navigators working with neighbors in need.

Your job is to:
- Help navigators quickly understand and use community resources.
- Explain resources in simple, friendly, non-clinical language.
- Suggest realistic next steps and self-advocacy scripts they can use with neighbors.
- Stay strength-based, trauma-informed, and non-judgmental.

CONTEXT YOU RECEIVE:
- LOCATION: ${location}
- NEIGHBOR CONTEXT: ${participantContext || 'Not provided'}
- GOAL CONTEXT: ${goalContext || 'Not provided'}
- NAVIGATOR'S QUESTION: "${userNeed}"
- RESOURCE CATEGORY (if specified): ${category || 'Not specified'}
- AVAILABLE RESOURCES (if any were matched from the database):
${formattedResources.length > 0
    ? JSON.stringify(formattedResources, null, 2)
    : '[] (No specific resources were passed in. You may only speak in general terms and suggest common TYPES of resources, not specific organizations by name.)'}

VERY IMPORTANT RULES:
1. You **do not have live internet access**. You **must not invent** specific real-world organization names, phone numbers, or addresses if they are not included in AVAILABLE RESOURCES.
2. When AVAILABLE RESOURCES is an empty list:
   - Speak in general terms about *types* of resources (e.g., "local housing authority", "legal aid office", "community mental health center").
   - Give practical guidance, steps, and scripts for how the navigator can search locally (e.g., using 211, county websites, state resource lines).
3. When AVAILABLE RESOURCES is a non-empty list:
   - Assume those are the options they can realistically use.
   - Help the user compare them, prioritize them, and decide which to try first.
   - Do NOT hallucinate extra details that weren't provided (like hours, eligibility) unless the information is explicitly included.
4. Always write in warm, compassionate, non-clinical language.
5. Avoid giving medical, legal, or financial advice. You can help them connect to appropriate resources instead.

TONE GUIDELINES:
- Strength-based
- Non-judgmental
- Clear and concrete
- Practical, not vague
- Trauma-informed

YOUR TASK:
Produce a JSON response that:
- Summarizes the situation and need.
- Highlights 3-5 recommended resources or resource TYPES.
- Offers concrete next steps.
- Provides at least one simple self-advocacy script.
- Identifies potential barriers and simple ideas to work around them.

RETURN FORMAT:
Return ONLY valid JSON with this exact structure and NO extra commentary or markdown:

{
  "summary": "2-4 sentence, plain-language summary.",
  "recommendedResources": [
    {
      "name": "Real name from AVAILABLE RESOURCES, or a TYPE like 'Local Housing Authority'.",
      "type": "Short label like 'Housing', 'Food', etc.",
      "whyHelpful": "1-2 sentences.",
      "howToContact": "Brief contact guidance.",
      "eligibilityNotes": "Key eligibility points if known."
    }
  ],
  "nextSteps": [
    "Concrete next step 1.",
    "Concrete next step 2.",
    "Concrete next step 3."
  ],
  "selfAdvocacyScript": "Short friendly script starting with 'Hi, my name is ____...'",
  "barriersAndIdeas": [
    { "barrier": "Likely barrier.", "ideaToWorkAround": "Idea." }
  ],
  "encouragement": "1-2 sentences of strength-based encouragement."
}

Generate the JSON now. No backticks, no markdown, no text outside of the JSON object.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content:
                        'You are an expert Resource Navigator assistant. You always respond with valid JSON only, no markdown or additional text.',
                },
                { role: 'user', content: prompt },
            ],
            max_tokens: 2500,
            temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content || '';

        // Strip markdown fences if the model returned them despite instructions
        let clean = content.trim();
        if (clean.startsWith('```json')) clean = clean.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        else if (clean.startsWith('```')) clean = clean.replace(/^```\n?/, '').replace(/\n?```$/, '');

        try {
            const parsed = JSON.parse(clean);
            return NextResponse.json({
                success: true,
                response: parsed,
                resourcesProvided: formattedResources.length,
            });
        } catch (parseError) {
            console.error('Resource Assistant JSON parse error:', parseError);
            return NextResponse.json({
                success: true,
                response: {
                    summary: clean,
                    recommendedResources: [],
                    nextSteps: ['Please try asking your question again.'],
                    selfAdvocacyScript: '',
                    barriersAndIdeas: [],
                    encouragement: 'Thank you for supporting your neighbors!',
                },
                rawContent: clean,
                parseError: true,
            });
        }
    } catch (err) {
        console.error('Resource Assistant error:', err);
        return NextResponse.json(
            { error: 'Failed to get resource assistance' },
            { status: 500 }
        );
    }
}
