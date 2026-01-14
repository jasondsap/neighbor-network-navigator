'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, ChevronRight, HelpCircle, Search,
    Sparkles, BookOpen, ChevronDown, ChevronUp, Mail, Heart, Users, Shield,
    Star, Filter, MapPin, Phone, Globe, Home, Utensils, Briefcase,
    Target, MessageCircle, LogOut
} from 'lucide-react';

interface FAQItem {
    question: string;
    answer: string;
}

interface ToolGuide {
    id: string;
    name: string;
    icon: React.ReactNode;
    color: string;
    description: string;
    quickStart: string[];
    tips: string[];
    faqs: FAQItem[];
}

export default function HelpCenter() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

    const tools: ToolGuide[] = [
        {
            id: 'resource-search',
            name: 'Resource Search',
            icon: <Search className="w-6 h-6" />,
            color: '#2E4A8E',
            description: 'Search through 300+ local Louisville resources and SAMHSA treatment facilities nationwide. Find housing, food, employment, healthcare, and more.',
            quickStart: [
                'Enter keywords in the search bar (e.g., "food pantry", "housing assistance")',
                'Click "Search" or press Enter to find resources',
                'Browse by category using the filter buttons',
                'Click on any resource card to see full details',
                'Use the Filter button to narrow by ZIP code or source'
            ],
            tips: [
                'Be specific with your search - "emergency shelter" works better than just "housing"',
                'Use categories to browse when you\'re not sure what you\'re looking for',
                'Local resources show Louisville-area services, SAMHSA shows verified treatment facilities',
                'Click on phone numbers to call directly from your phone',
                'Click on addresses to open directions in Google Maps'
            ],
            faqs: [
                { question: 'What\'s the difference between Local and SAMHSA resources?', answer: 'Local resources are Louisville-area services we\'ve curated. SAMHSA resources are from the federal Substance Abuse and Mental Health Services Administration\'s verified treatment locator database.' },
                { question: 'How current is this information?', answer: 'Local resources are updated regularly by our team. SAMHSA data is pulled live from their national database. Always call ahead to verify hours and availability.' },
                { question: 'Can I search for resources outside Louisville?', answer: 'The local database focuses on Louisville/Jefferson County. SAMHSA results can be found nationwide when searching for treatment facilities.' }
            ]
        },
        {
            id: 'favorites',
            name: 'Favorites',
            icon: <Star className="w-6 h-6" />,
            color: '#E8B84A',
            description: 'Save resources you use frequently to your personal favorites list for quick access. Build your own collection of go-to resources.',
            quickStart: [
                'Click the star icon on any resource card to add it to favorites',
                'Click "My Favorites" in the category bar to view saved resources',
                'Click the star again to remove a resource from favorites',
                'Your favorites are saved to your account and persist across sessions'
            ],
            tips: [
                'Save resources you refer people to frequently',
                'Build a personal toolkit of trusted organizations',
                'Favorites are unique to your account - each navigator has their own list',
                'Use favorites as a quick reference during intake or navigation sessions'
            ],
            faqs: [
                { question: 'Are my favorites shared with others?', answer: 'No, favorites are private to your account. Only you can see your saved favorites.' },
                { question: 'Is there a limit to how many favorites I can save?', answer: 'No limit! Save as many resources as you find useful.' },
                { question: 'Can I organize favorites into folders?', answer: 'Not currently, but you can use the category filters when viewing favorites to find what you need.' }
            ]
        },
        {
            id: 'ai-assistant',
            name: 'AI Navigator Assistant',
            icon: <Sparkles className="w-6 h-6" />,
            color: '#2A8B8B',
            description: 'Get personalized guidance and recommendations from our AI assistant. Describe a situation and get resource suggestions, next steps, scripts, and barrier solutions.',
            quickStart: [
                'Click "AI Navigator Assistant" button to open the sidebar',
                'Optionally add context about the neighbor\'s situation',
                'Describe what you need help with in the text box',
                'Press Enter or click Send to get recommendations',
                'Review the suggested resources, next steps, and scripts',
                'Click "Ask Another Question" to start a new query'
            ],
            tips: [
                'The more context you provide, the better the recommendations',
                'Use the "Script to Use" section for calling or visiting agencies',
                'Review the "Potential Barriers" section to prepare for common challenges',
                'The AI uses the actual resources in our database - it won\'t make up organizations',
                'Try the quick questions if you\'re not sure what to ask'
            ],
            faqs: [
                { question: 'Does the AI have access to real resources?', answer: 'Yes! The AI references actual resources from our database. It will only recommend real organizations and will speak in general terms if no specific resources match.' },
                { question: 'Is my conversation with the AI saved?', answer: 'Conversations are not permanently saved. Each new query starts fresh.' },
                { question: 'Can the AI replace professional advice?', answer: 'No. The AI is a tool to help navigate resources, not a replacement for professional legal, medical, or financial advice. Always refer neighbors to appropriate professionals.' }
            ]
        },
        {
            id: 'categories',
            name: 'Categories',
            icon: <Filter className="w-6 h-6" />,
            color: '#9B59B6',
            description: 'Browse resources organized by category including Housing, Food, Employment, Health, Legal, Transportation, and many more.',
            quickStart: [
                'Click any category button to filter resources',
                'Click "All Resources" to clear the category filter',
                'Combine category filters with search keywords',
                'Categories are color-coded for quick recognition'
            ],
            tips: [
                'Start with a category if you\'re not sure what to search for',
                'Housing (blue) includes shelters, rent assistance, and permanent housing',
                'Food (green) includes pantries, meal programs, and SNAP help',
                'Crisis Support (red) includes hotlines and emergency services',
                'Substance Use Treatment (maroon) connects to SAMHSA verified facilities'
            ],
            faqs: [
                { question: 'What categories are available?', answer: 'Housing, Food, Employment, Health, Mental Health, Substance Use Treatment, Transportation, Legal, Financial, Utilities, Child Care, Basic Needs, Crisis Support, Education, Veterans, Reentry, Immigration, Disability, Seniors, and LGBTQ+.' },
                { question: 'Can a resource be in multiple categories?', answer: 'Resources are assigned to their primary category. Some organizations offer multiple services - check the full details for all services offered.' }
            ]
        }
    ];

    const generalFAQs: FAQItem[] = [
        { question: 'What is the Louisville Neighbor Network?', answer: 'The Louisville Neighbor Network is a community resource navigation initiative by South Louisville Community Ministries. We help neighbors connect with local services and support.' },
        { question: 'Who can use this Resource Navigator?', answer: 'The Resource Navigator is available to community navigators, case managers, social workers, and anyone helping Louisville residents find resources.' },
        { question: 'How do I create an account?', answer: 'Click "Sign up" on the login page and enter your email and password. Your account will be activated and you can start using the Navigator immediately.' },
        { question: 'Is this service free?', answer: 'Yes! The Resource Navigator is free to use for all registered users.' },
        { question: 'How can I suggest a resource to add?', answer: 'Email us at jason@made180.com with the organization name, contact info, and services offered. We review all suggestions and add verified resources.' },
        { question: 'What if resource information is incorrect?', answer: 'Please report outdated or incorrect information to jason@made180.com. Include the resource name and what needs to be corrected.' },
        { question: 'Can I use this on my phone?', answer: 'Yes! The Resource Navigator is fully mobile-friendly. Access it from any smartphone browser.' }
    ];

    const filteredTools = tools.filter(tool =>
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.faqs.some(faq => 
            faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
        )
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-[#2E4A8E] sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-white" />
                            </button>
                            <nav className="flex items-center gap-2 text-sm">
                                <button 
                                    onClick={() => router.push('/')}
                                    className="text-[#E8B84A] hover:underline"
                                >
                                    Resource Navigator
                                </button>
                                <ChevronRight className="w-4 h-4 text-white/50" />
                                <span className="text-white font-medium">Help Center</span>
                            </nav>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <div className="bg-gradient-to-br from-[#2E4A8E] to-[#1E3A6E] text-white py-12">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                        <HelpCircle className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Help Center</h1>
                    <p className="text-blue-100 max-w-xl mx-auto">
                        Learn how to make the most of the Resource Navigator
                    </p>

                    {/* Search */}
                    <div className="mt-6 max-w-md mx-auto">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for help..."
                                className="w-full pl-12 pr-4 py-3 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#E8B84A] focus:outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* Tab Navigation */}
                <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                            activeTab === 'overview'
                                ? 'bg-[#2E4A8E] text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        Overview
                    </button>
                    {tools.map(tool => (
                        <button
                            key={tool.id}
                            onClick={() => setActiveTab(tool.id)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                                activeTab === tool.id
                                    ? 'text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                            style={activeTab === tool.id ? { backgroundColor: tool.color } : {}}
                        >
                            {tool.name}
                        </button>
                    ))}
                    <button
                        onClick={() => setActiveTab('faq')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                            activeTab === 'faq'
                                ? 'bg-gray-800 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        General FAQ
                    </button>
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-8">
                        {/* Welcome */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                                Welcome to the Resource Navigator
                            </h2>
                            <p className="text-gray-600 mb-6">
                                The Louisville Neighbor Network Resource Navigator helps you find and connect neighbors 
                                with local resources. Search over 300 Louisville-area services plus nationwide SAMHSA 
                                treatment facilities, get AI-powered recommendations, and save your frequently-used 
                                resources for quick access.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
                                    <Search className="w-6 h-6 text-[#2E4A8E] flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-gray-900">300+ Local Resources</h3>
                                        <p className="text-sm text-gray-600">Louisville-area services across 20 categories</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl">
                                    <Globe className="w-6 h-6 text-purple-600 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-gray-900">SAMHSA Integration</h3>
                                        <p className="text-sm text-gray-600">Nationwide verified treatment facilities</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-teal-50 rounded-xl">
                                    <Sparkles className="w-6 h-6 text-[#2A8B8B] flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-gray-900">AI Assistant</h3>
                                        <p className="text-sm text-gray-600">Get personalized recommendations and scripts</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-xl">
                                    <Star className="w-6 h-6 text-[#E8B84A] flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Save Favorites</h3>
                                        <p className="text-sm text-gray-600">Build your personal resource toolkit</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Start */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-[#2E4A8E]" />
                                Quick Start Guide
                            </h2>
                            <div className="space-y-4">
                                <div className="flex gap-4 items-start">
                                    <div className="w-8 h-8 rounded-full bg-[#2E4A8E] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Search or Browse</h3>
                                        <p className="text-gray-600 text-sm">Enter keywords in the search bar or click a category to find resources.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                    <div className="w-8 h-8 rounded-full bg-[#2E4A8E] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">View Details</h3>
                                        <p className="text-gray-600 text-sm">Click any resource card to see full contact info, hours, eligibility, and tips.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                    <div className="w-8 h-8 rounded-full bg-[#2E4A8E] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Save Favorites</h3>
                                        <p className="text-gray-600 text-sm">Click the star icon to save resources you use frequently.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                    <div className="w-8 h-8 rounded-full bg-[#2E4A8E] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">4</div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Get AI Help</h3>
                                        <p className="text-gray-600 text-sm">Click "AI Navigator Assistant" for personalized recommendations and scripts.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tool Cards */}
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Features</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {tools.map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => setActiveTab(tool.id)}
                                        className="bg-white rounded-xl p-5 shadow-sm text-left hover:shadow-md transition-all group"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div
                                                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ backgroundColor: `${tool.color}15` }}
                                            >
                                                <div style={{ color: tool.color }}>{tool.icon}</div>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-900 group-hover:text-[#2E4A8E] transition-colors">
                                                    {tool.name}
                                                </h3>
                                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                    {tool.description}
                                                </p>
                                                <span className="text-sm text-[#2E4A8E] mt-2 inline-flex items-center gap-1">
                                                    Learn more <ChevronRight className="w-4 h-4" />
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Tool-Specific Tabs */}
                {tools.map(tool => (
                    activeTab === tool.id && (
                        <div key={tool.id} className="space-y-6">
                            {/* Tool Header */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm">
                                <div className="flex items-start gap-4 mb-4">
                                    <div
                                        className="w-14 h-14 rounded-xl flex items-center justify-center"
                                        style={{ backgroundColor: `${tool.color}15` }}
                                    >
                                        <div style={{ color: tool.color }}>{tool.icon}</div>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">{tool.name}</h2>
                                        <p className="text-gray-600 mt-1">{tool.description}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Start */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-[#2E4A8E]" />
                                    How to Use
                                </h3>
                                <ol className="space-y-3">
                                    {tool.quickStart.map((step, index) => (
                                        <li key={index} className="flex gap-3 items-start">
                                            <span
                                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                                                style={{ backgroundColor: tool.color }}
                                            >
                                                {index + 1}
                                            </span>
                                            <span className="text-gray-700">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            {/* Tips */}
                            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-6 border border-yellow-200">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Star className="w-5 h-5 text-[#E8B84A]" />
                                    Tips for Success
                                </h3>
                                <ul className="space-y-2">
                                    {tool.tips.map((tip, index) => (
                                        <li key={index} className="flex gap-2 items-start">
                                            <span className="text-[#E8B84A] mt-1">•</span>
                                            <span className="text-gray-700">{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* FAQs */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5 text-blue-500" />
                                    Frequently Asked Questions
                                </h3>
                                <div className="space-y-2">
                                    {tool.faqs.map((faq, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => setExpandedFAQ(expandedFAQ === `${tool.id}-${index}` ? null : `${tool.id}-${index}`)}
                                                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                                            >
                                                <span className="font-medium text-gray-900">{faq.question}</span>
                                                {expandedFAQ === `${tool.id}-${index}` ? (
                                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                                )}
                                            </button>
                                            {expandedFAQ === `${tool.id}-${index}` && (
                                                <div className="px-4 pb-4 text-gray-600">
                                                    {faq.answer}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                ))}

                {/* General FAQ Tab */}
                {activeTab === 'faq' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">General Questions</h2>
                            <div className="space-y-2">
                                {generalFAQs.map((faq, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                                        <button
                                            onClick={() => setExpandedFAQ(expandedFAQ === `general-${index}` ? null : `general-${index}`)}
                                            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                                        >
                                            <span className="font-medium text-gray-900">{faq.question}</span>
                                            {expandedFAQ === `general-${index}` ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </button>
                                        {expandedFAQ === `general-${index}` && (
                                            <div className="px-4 pb-4 text-gray-600">
                                                {faq.answer}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Contact Section */}
                <div className="mt-8 bg-gradient-to-br from-[#2E4A8E] to-[#1E3A6E] rounded-2xl p-8 text-white text-center">
                    <Mail className="w-12 h-12 mx-auto mb-4 opacity-80" />
                    <h2 className="text-2xl font-bold mb-2">Still Need Help?</h2>
                    <p className="text-blue-100 mb-6 max-w-md mx-auto">
                        Can't find what you're looking for? We're here to help!
                    </p>
                    <a
                        href="mailto:jason@made180.com"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#2E4A8E] rounded-xl font-semibold hover:bg-blue-50 transition-colors"
                    >
                        <Mail className="w-5 h-5" />
                        Contact Support
                    </a>
                    <p className="text-sm text-blue-200 mt-4">
                        jason@made180.com • We typically respond within 24 hours
                    </p>
                </div>
            </main>

            {/* Footer */}
            <footer className="max-w-6xl mx-auto px-6 py-8 text-center">
                <p className="text-gray-500 text-sm mb-2">Louisville Neighbor Network • South Louisville Community Ministries</p>
                <p className="text-[#E8B84A] font-medium text-sm">Reconnect • Rethink • Rebuild</p>
            </footer>
        </div>
    );
}
