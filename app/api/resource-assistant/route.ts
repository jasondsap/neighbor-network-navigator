import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
        const body = await request.json();
        const {
            userNeed,
            location = 'Louisville, KY',
            participantContext = '',
            category = '',
            matchedResources = []
        } = body;

        if (!userNeed) {
            return NextResponse.json(
                { error: 'User need/question is required' },
                { status: 400 }
            );
        }

        // Format matched resources for the prompt
        const formattedResources: MatchedResource[] = matchedResources.map((r: any) => ({
            id: r.id,
            name: r.organization_name || r.name1 || r.name,
            type: r.category || r.type_facility || 'Resource',
            address: r.address || r.street1,
            phone: r.phone,
            website: r.website,
            email: r.email,
            notes: r.notes || r.tips_tricks,
            eligibility: [r.qualifier_income, r.qualifier_age, r.qualifier_cohort, r.qualifier_misc]
                .filter(Boolean).join('; ') || r.qualifier_geography,
            hours: r.hours,
            services: r.service_description || r.subcategory
        }));

        const prompt = `You are the Resource Navigator Assistant for Louisville Neighbor Network, a community organization in Louisville, Kentucky that helps neighbors connect to resources they need.

Your job is to:
- Help community members and navigators quickly understand and use available resources.
- Explain resources in simple, friendly, neighbor-to-neighbor language.
- Suggest realistic next steps and simple scripts they can use when reaching out.
- Stay strength-based, compassionate, and non-judgmental.
- Embody the Neighbor Network values: reconnect, rethink, rebuild.

CONTEXT:
- LOCATION: ${location}
- NEIGHBOR CONTEXT: ${participantContext || 'Not provided'}
- USER QUESTION OR NEED: "${userNeed}"
- RESOURCE CATEGORY (if specified): ${category || 'Not specified'}
- AVAILABLE RESOURCES (matched from the database):
${formattedResources.length > 0 
    ? JSON.stringify(formattedResources, null, 2) 
    : '[] (No specific resources were passed in. You may only speak in general terms and suggest common TYPES of resources, not specific organizations by name.)'}

IMPORTANT RULES:
1. You **do not have live internet access**. You **must not invent** specific real-world organization names, phone numbers, or addresses if they are not included in AVAILABLE RESOURCES.
2. When AVAILABLE RESOURCES is an empty list:
   - Speak in general terms about *types* of resources (e.g., "local housing authority", "community food pantry", "legal aid office").
   - Give practical guidance and steps for how to search locally (e.g., using 211, visiting the Neighbor Network website).
3. When AVAILABLE RESOURCES is a non-empty list:
   - Use those as the options they can realistically explore.
   - Help prioritize which to try first based on their situation.
   - Do NOT hallucinate extra details not provided.
4. Write in warm, neighborly language. You are a helpful neighbor, not a bureaucrat.
5. Avoid giving medical, legal, or financial advice. Help connect to appropriate resources instead.

TONE GUIDELINES:
- Warm and welcoming ("Welcome, neighbor!")
- Strength-based ("You're taking a great step by...")
- Non-judgmental and compassionate
- Clear and practical
- Hopeful but realistic

YOUR TASK:
Produce a **JSON** response that:
- Summarizes the situation and need
- Highlights 3–5 recommended resources or resource TYPES
- Offers concrete next steps
- Provides at least one simple script for reaching out
- Identifies potential barriers and ideas to work around them
- Ends with encouragement

RETURN FORMAT (valid JSON only, no markdown or extra text):

{
  "summary": "2–4 sentence, plain-language summary of what kind of help is needed.",
  "recommendedResources": [
    {
      "name": "If from AVAILABLE RESOURCES: use exact name. Otherwise: use a TYPE like 'Local Food Pantry' or 'Housing Assistance Office'.",
      "type": "Short label like 'Housing', 'Food', 'Legal', etc.",
      "whyHelpful": "1–2 sentences explaining why this resource fits this situation.",
      "howToContact": "If contact info available, summarize it. Otherwise, give guidance like 'Call 211 and ask for...'",
      "eligibilityNotes": "If known, mention key eligibility points. Otherwise, say 'Ask about eligibility requirements when you call.'"
    }
  ],
  "nextSteps": [
    "Concrete next step 1",
    "Concrete next step 2",
    "Concrete next step 3"
  ],
  "selfAdvocacyScript": "A short, friendly script to use when calling or visiting. Use first person (e.g., 'Hi, my name is ____. I'm looking for help with...').",
  "barriersAndIdeas": [
    {
      "barrier": "Likely barrier (e.g., 'Transportation', 'Waitlists', 'Documentation required').",
      "ideaToWorkAround": "1–2 sentence idea to work around the barrier."
    }
  ],
  "encouragement": "1–2 sentences of warm, neighborly encouragement. Remind them the Neighbor Network is here to help."
}

Generate the JSON now. Do NOT include backticks, markdown, or any text outside of the JSON object.`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are the Louisville Neighbor Network Resource Navigator assistant. You always respond with valid JSON only, no markdown or additional text. You embody neighborly warmth and practical helpfulness.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 2500,
            temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content || '';
        
        // Clean and parse JSON
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
            cleanContent = cleanContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        try {
            const parsedResponse = JSON.parse(cleanContent);
            return NextResponse.json({
                success: true,
                response: parsedResponse,
                resourcesProvided: formattedResources.length
            });
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            // Return the raw content if parsing fails
            return NextResponse.json({
                success: true,
                response: {
                    summary: cleanContent,
                    recommendedResources: [],
                    nextSteps: ['Please try asking your question again.'],
                    selfAdvocacyScript: '',
                    barriersAndIdeas: [],
                    encouragement: 'The Neighbor Network is here to help. Don\'t give up!'
                },
                rawContent: cleanContent,
                parseError: true
            });
        }

    } catch (error) {
        console.error('Resource Assistant error:', error);
        return NextResponse.json(
            { error: 'Failed to get resource assistance' },
            { status: 500 }
        );
    }
}
