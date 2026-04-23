'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search, Home, Utensils, Briefcase, Heart, Car, Scale, Wallet, Zap,
    Baby, Package, AlertTriangle, Calendar, Users, MapPin, Phone, Globe,
    Mail, Clock, ChevronRight, Filter, X, Loader2,
    MessageCircle, Send, Sparkles, ExternalLink, FileText,
    Info, CheckCircle, AlertCircle, Lightbulb, GraduationCap, Shield,
    DoorOpen, Accessibility, LogOut, Star, Map, List, Bus
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import dynamic from 'next/dynamic';
import BusDirectionsModal from './components/BusDirectionsModal';
import { FlagResourceButton } from './components/FlagResourceModal';
import { UnableToAccessButton } from './components/UnableToAccessModal';
import { AdminHeaderLink } from './components/AdminHeaderLink';

// Dynamically import the map component to avoid SSR issues
const ResourceMap = dynamic(() => import('./components/ResourceMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[500px] md:h-[600px] rounded-xl bg-gray-100 flex items-center justify-center">
            <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#2E4A8E]" />
                <span className="text-gray-600">Loading map...</span>
            </div>
        </div>
    )
});

const categoryIcons: Record<string, any> = {
    // 18 current SLCM categories (match the seeded resource_categories table)
    'Adult Education': GraduationCap,
    'Basic Needs': Package,
    'Childcare & Parenting': Baby,
    'Eviction Prevention': Shield,
    'Financial Stability': Wallet,
    'Food': Utensils,
    'Health': Heart,
    'Homelessness Navigation': Home,
    'Housing Navigation': Home,
    'Human Trafficking': AlertTriangle,
    'IPV/DV Support': Shield,
    'LGBTQ+': Heart,
    'Legal Aid': Scale,
    'Pregnancy & Postpartum': Heart,
    'Relocation & Moving': Briefcase,
    'Transportation': Car,
    'Utilities': Zap,
    'Workforce': Briefcase,
    // SAMHSA categories (returned live by the search API)
    'Mental Health': Heart,
    'Substance Use Treatment': Heart,
    // Legacy / fallback names that may still appear
    'Housing': Home,
    'Employment': Briefcase,
    'Legal': Scale,
    'Financial': Wallet,
    'Child Care': Baby,
    'Crisis Support': AlertTriangle,
    'Seasonal': Calendar,
    'Education': GraduationCap,
    'Veterans': Shield,
    'Reentry': DoorOpen,
    'Disability': Accessibility,
    'Seniors': Users,
    'Immigration': Globe,
};

const categoryColors: Record<string, string> = {
    'Adult Education': '#3498DB',
    'Basic Needs': '#8E44AD',
    'Childcare & Parenting': '#E91E63',
    'Eviction Prevention': '#C0392B',
    'Financial Stability': '#16A085',
    'Food': '#27AE60',
    'Health': '#E74C3C',
    'Homelessness Navigation': '#3498DB',
    'Housing Navigation': '#2980B9',
    'Human Trafficking': '#8B0000',
    'IPV/DV Support': '#C0392B',
    'LGBTQ+': '#9C27B0',
    'Legal Aid': '#607D8B',
    'Pregnancy & Postpartum': '#EC407A',
    'Relocation & Moving': '#795548',
    'Transportation': '#9B59B6',
    'Utilities': '#E67E22',
    'Workforce': '#F39C12',
    'Mental Health': '#9C27B0',
    'Substance Use Treatment': '#8B2332',
    'Housing': '#3498DB',
    'Employment': '#F39C12',
    'Legal': '#607D8B',
    'Financial': '#16A085',
    'Child Care': '#E91E63',
    'Crisis Support': '#C0392B',
    'Seasonal': '#00BCD4',
    'Education': '#3498DB',
    'Veterans': '#2C3E50',
    'Reentry': '#795548',
    'Immigration': '#00BCD4',
    'Disability': '#607D8B',
    'Seniors': '#8D6E63',
};

interface Resource {
    id: string;
    organization_name: string;
    program_name?: string;
    category: string;
    subcategory?: string;
    service_description?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    email?: string;
    website?: string;
    hours?: string;
    qualifier_geography?: string;
    qualifier_age?: string;
    qualifier_income?: string;
    qualifier_cohort?: string;
    qualifier_misc?: string;
    required_documents?: string;
    tips_tricks?: string;
    notes?: string;
    point_of_contact?: string;
    source: string;
    distance_miles?: number;
}

interface Category {
    id: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    display_order: number;
}

interface AssistantResponse {
    summary: string;
    recommendedResources: Array<{
        name: string;
        type: string;
        whyHelpful: string;
        howToContact: string;
        eligibilityNotes: string;
    }>;
    nextSteps: string[];
    selfAdvocacyScript: string;
    barriersAndIdeas: Array<{ barrier: string; ideaToWorkAround: string; }>;
    encouragement: string;
}

export default function ResourceNavigator() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const authLoading = status === 'loading';
    const user = session?.user;

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [resources, setResources] = useState<Resource[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [zipFilter, setZipFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
    const [showAssistant, setShowAssistant] = useState(false);
    const [assistantQuery, setAssistantQuery] = useState('');
    const [assistantResponse, setAssistantResponse] = useState<AssistantResponse | null>(null);
    const [isAssistantLoading, setIsAssistantLoading] = useState(false);
    const [neighborContext, setNeighborContext] = useState('');
    const [stats, setStats] = useState({ local: 0, samhsa: 0 });
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [busDirectionsResource, setBusDirectionsResource] = useState<Resource | null>(null);
    const [subcategories, setSubcategories] = useState<{ name: string; count: number }[]>([]);
    const [selectedSubcategory, setSelectedSubcategory] = useState('all');

    // ------------------------------------------------------------------------
    // Favorites — NOTE: the /api/favorites endpoint is not yet migrated to Neon.
    // These calls will fail silently until it is. Star UI will simply stay empty.
    // ------------------------------------------------------------------------
    const fetchFavorites = async () => {
        if (!user?.id) return;
        try {
            const response = await fetch(`/api/favorites?userId=${user.id}`);
            if (!response.ok) return;                // 404 is fine — endpoint not built yet
            const data = await response.json();
            if (data.favorites) {
                setFavorites(new Set(data.favorites.map((f: any) => f.resource_id)));
            }
        } catch (error) {
            // Silent — favorites are a future feature
        }
    };

    const toggleFavorite = async (e: React.MouseEvent, resourceId: string, resourceSource: string = 'Local') => {
        e.stopPropagation();
        if (!user?.id) return;

        const isFavorited = favorites.has(resourceId);
        try {
            if (isFavorited) {
                await fetch(`/api/favorites?userId=${user.id}&resourceId=${resourceId}`, { method: 'DELETE' });
                setFavorites(prev => {
                    const next = new Set(prev);
                    next.delete(resourceId);
                    return next;
                });
            } else {
                await fetch('/api/favorites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, resourceId, resourceSource }),
                });
                setFavorites(prev => new Set(prev).add(resourceId));
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    };

    // ------------------------------------------------------------------------
    // Auth gate + initial load
    // ------------------------------------------------------------------------
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/auth/signin');
            return;
        }
        if (user) {
            const loadData = async () => {
                await fetchCategories();
                await fetchFavorites();
                await handleSearch('', 'all');
            };
            loadData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading, router]);

    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/resource-search?action=categories');
            const data = await response.json();
            if (data.categories && data.categories.length > 0) {
                setCategories(data.categories);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const handleSearch = async (
        query: string = searchQuery,
        category: string = selectedCategory,
        subcategory: string = selectedSubcategory
    ) => {
        setIsLoading(true);
        setHasSearched(true);
        try {
            const params = new URLSearchParams({
                q: query,
                category: category,
                source: sourceFilter,
            });
            if (subcategory && subcategory !== 'all') {
                params.append('subcategory', subcategory);
            }
            if (zipFilter) params.append('zip', zipFilter);

            const response = await fetch(`/api/resource-search?${params}`);
            const data = await response.json();
            setResources(data.resources || []);
            setStats({ local: data.localCount || 0, samhsa: data.samhsaCount || 0 });
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCategoryClick = async (categoryName: string) => {
        setSelectedCategory(categoryName);
        setSelectedSubcategory('all');
        setSubcategories([]);

        // Fetch subcategories for the chip row
        if (categoryName !== 'all') {
            try {
                const response = await fetch(
                    `/api/resource-subcategories?category=${encodeURIComponent(categoryName)}`
                );
                const data = await response.json();
                // API returns: { subcategories: [{ category, subcategory, resource_count }] }
                // UI expects:   [{ name, count }]
                if (Array.isArray(data.subcategories)) {
                    setSubcategories(
                        data.subcategories.map((s: any) => ({
                            name: s.subcategory,
                            count: s.resource_count,
                        }))
                    );
                }
            } catch (error) {
                console.error('Error fetching subcategories:', error);
            }
        }

        handleSearch(searchQuery, categoryName, 'all');
    };

    const handleSubcategoryClick = (subcategoryName: string) => {
        setSelectedSubcategory(subcategoryName);
        handleSearch(searchQuery, selectedCategory, subcategoryName);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    const handleAssistantSubmit = async () => {
        if (!assistantQuery.trim()) return;
        setIsAssistantLoading(true);
        try {
            const response = await fetch('/api/resource-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userNeed: assistantQuery,
                    location: 'Louisville, KY',
                    participantContext: neighborContext,
                    category: selectedCategory !== 'all' ? selectedCategory : '',
                    matchedResources: resources.slice(0, 10),
                }),
            });
            const data = await response.json();
            if (data.success) setAssistantResponse(data.response);
        } catch (error) {
            console.error('Assistant error:', error);
        } finally {
            setIsAssistantLoading(false);
        }
    };

    const getCategoryIcon = (name: string) => categoryIcons[name] || Package;
    const getCategoryColor = (name: string) => categoryColors[name] || '#607D8B';
    const formatPhone = (phone: string) => (phone ? phone.replace(/\s+/g, ' ').trim() : null);

    const handleSignOut = async () => {
        await signOut({ callbackUrl: '/auth/signin' });
    };

    // ------------------------------------------------------------------------
    // Auth loading / redirecting splash screens
    // ------------------------------------------------------------------------
    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#2E4A8E] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-[#E8B84A] mx-auto mb-4" />
                    <p className="text-[#F5F0E6]">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-[#2E4A8E] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-[#E8B84A] mx-auto mb-4" />
                    <p className="text-[#F5F0E6]">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------------
    // Main render
    // ------------------------------------------------------------------------
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-[#2E4A8E] sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#E8B84A] flex items-center justify-center">
                                <Users className="w-5 h-5 text-[#1E3A6E]" />
                            </div>
                            <div>
                                <h1 className="text-[#F5F0E6] font-semibold text-lg">Resource Navigator</h1>
                                <p className="text-[#F5F0E6]/70 text-xs">Louisville Neighbor Network</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/help')}
                                className="text-[#F5F0E6]/80 hover:text-[#F5F0E6] text-sm hidden md:block"
                            >
                                Help
                            </button>
                            <AdminHeaderLink />  {/* ← add this line */}
                            {user && (user.name || user.email) && (
                                <span className="text-[#F5F0E6]/80 text-sm hidden md:block">
                                    Welcome, {user.name || user.email}
                                </span>
                            )}
                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 px-3 py-2 text-[#F5F0E6]/80 hover:text-[#F5F0E6] hover:bg-white/10 rounded-lg transition-colors text-sm"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden md:inline">Sign Out</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex">
                <main className={`flex-1 transition-all ${showAssistant ? 'mr-[420px]' : ''}`}>
                    {/* Hero / search */}
                    <div className="bg-[#2E4A8E] pb-8">
                        <div className="max-w-7xl mx-auto px-6">
                            <div className="text-center pt-6 pb-8">
                                <h2 className="text-3xl md:text-4xl font-serif text-[#E8B84A] mb-3">Welcome, Neighbor.</h2>
                                <p className="text-[#F5F0E6]/90 text-lg max-w-2xl mx-auto">
                                    Search our community resource database to find the help you need.
                                </p>
                            </div>
                            <div className="max-w-3xl mx-auto">
                                <div className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                            placeholder="Search for resources... (e.g., 'food pantry', 'housing help')"
                                            className="w-full pl-12 pr-4 py-4 bg-white rounded-xl focus:ring-2 focus:ring-[#E8B84A] focus:outline-none text-lg shadow-lg text-gray-900 placeholder:text-gray-400"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleSearch()}
                                        disabled={isLoading}
                                        className="px-6 py-4 bg-[#8B2332] text-white rounded-xl font-semibold hover:bg-[#A53342] transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg"
                                    >
                                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                        <span className="hidden md:inline">Search</span>
                                    </button>
                                    {(searchQuery || selectedCategory !== 'all' || zipFilter || sourceFilter !== 'all') && (
                                        <button
                                            onClick={() => {
                                                setSearchQuery('');
                                                setSelectedCategory('all');
                                                setZipFilter('');
                                                setSourceFilter('all');
                                                handleSearch('', 'all');
                                            }}
                                            className="px-4 py-4 bg-white text-gray-600 rounded-xl hover:bg-gray-100 transition-colors shadow-lg flex items-center gap-2"
                                            title="Reset search"
                                        >
                                            <X className="w-5 h-5" />
                                            <span className="hidden md:inline">Reset</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className={`px-4 py-4 rounded-xl transition-colors shadow-lg ${showFilters ? 'bg-[#E8B84A] text-[#1E3A6E]' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                                    >
                                        <Filter className="w-5 h-5" />
                                    </button>
                                </div>
                                {showFilters && (
                                    <div className="mt-4 p-4 bg-white rounded-xl shadow-lg flex flex-wrap gap-4 items-center">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">ZIP Code</label>
                                            <input
                                                type="text"
                                                value={zipFilter}
                                                onChange={(e) => setZipFilter(e.target.value)}
                                                placeholder="e.g., 40214"
                                                className="px-3 py-2 border border-gray-200 rounded-lg w-32"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 mb-1 block">Source</label>
                                            <select
                                                value={sourceFilter}
                                                onChange={(e) => setSourceFilter(e.target.value)}
                                                className="px-3 py-2 border border-gray-200 rounded-lg"
                                            >
                                                <option value="all">All Sources</option>
                                                <option value="local">Local Resources Only</option>
                                                <option value="samhsa">SAMHSA Treatment Only</option>
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => handleSearch()}
                                            className="mt-5 px-4 py-2 bg-[#2E4A8E] text-white rounded-lg text-sm font-medium hover:bg-[#4A6AAE] transition-colors"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* AI Assistant toggle */}
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Need personalized help?</span>
                            <button
                                onClick={() => setShowAssistant(!showAssistant)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${showAssistant ? 'bg-[#2A8B8B] text-white' : 'bg-[#2A8B8B]/10 text-[#2A8B8B] hover:bg-[#2A8B8B]/20'}`}
                            >
                                <Sparkles className="w-4 h-4" />AI Navigator Assistant
                            </button>
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="max-w-7xl mx-auto px-6 pb-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Browse by Category</h3>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => { setShowFavoritesOnly(false); handleCategoryClick('all'); }}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === 'all' && !showFavoritesOnly ? 'bg-[#2E4A8E] text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-[#2E4A8E]'}`}
                            >
                                All Resources
                            </button>
                            <button
                                onClick={() => { setShowFavoritesOnly(true); setSelectedCategory('favorites'); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${showFavoritesOnly ? 'bg-[#E8B84A] text-[#1E3A6E]' : 'bg-white border border-gray-200 text-gray-700 hover:border-[#E8B84A]'}`}
                            >
                                <Star className="w-4 h-4" fill={showFavoritesOnly ? 'currentColor' : 'none'} />
                                My Favorites {favorites.size > 0 && `(${favorites.size})`}
                            </button>
                            {categories.map((cat) => {
                                const Icon = getCategoryIcon(cat.name);
                                const color = getCategoryColor(cat.name);
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => { setShowFavoritesOnly(false); handleCategoryClick(cat.name); }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === cat.name && !showFavoritesOnly ? 'text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'}`}
                                        style={selectedCategory === cat.name && !showFavoritesOnly ? { backgroundColor: color } : {}}
                                    >
                                        <Icon className="w-4 h-4" />{cat.name}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Subcategory chips */}
                        {subcategories.length > 0 && selectedCategory !== 'all' && !showFavoritesOnly && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm text-gray-500">Filter by type:</span>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={() => handleSubcategoryClick('all')}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedSubcategory === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        All {selectedCategory}
                                    </button>
                                    {subcategories.map((sub) => (
                                        <button
                                            key={sub.name}
                                            onClick={() => handleSubcategoryClick(sub.name)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedSubcategory === sub.name ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                        >
                                            {sub.name} ({sub.count})
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results */}
                    <div className="max-w-7xl mx-auto px-6 pb-8">
                        {hasSearched && (
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-lg font-semibold text-gray-800">
                                        {showFavoritesOnly
                                            ? `${resources.filter(r => favorites.has(r.id)).length} Favorites`
                                            : `${resources.length} Resources Found`}
                                    </h3>
                                    {!showFavoritesOnly && (
                                        <div className="flex gap-2">
                                            {stats.local > 0 && <span className="px-2 py-1 bg-[#2E4A8E]/10 text-[#2E4A8E] rounded-full text-xs font-medium">{stats.local} Local</span>}
                                            {stats.samhsa > 0 && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{stats.samhsa} SAMHSA</span>}
                                        </div>
                                    )}
                                </div>
                                {/* View toggle */}
                                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-white text-[#2E4A8E] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                    >
                                        <List className="w-4 h-4" />
                                        <span className="hidden sm:inline">List</span>
                                    </button>
                                    <button
                                        onClick={() => setViewMode('map')}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'map' ? 'bg-white text-[#2E4A8E] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                    >
                                        <Map className="w-4 h-4" />
                                        <span className="hidden sm:inline">Map</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {isLoading && (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-[#2E4A8E]" />
                            </div>
                        )}

                        {/* Map view */}
                        {!isLoading && viewMode === 'map' && (
                            <ResourceMap
                                resources={showFavoritesOnly ? resources.filter(r => favorites.has(r.id)) : resources}
                                onResourceClick={setSelectedResource}
                                categoryColors={categoryColors}
                            />
                        )}

                        {/* List view */}
                        {!isLoading && viewMode === 'list' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {(showFavoritesOnly ? resources.filter(r => favorites.has(r.id)) : resources).map((resource, index) => {
                                    const Icon = getCategoryIcon(resource.category);
                                    const color = getCategoryColor(resource.category);
                                    return (
                                        <div
                                            key={`${resource.id}-${index}`}
                                            onClick={() => setSelectedResource(resource)}
                                            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-[#2E4A8E]/30 transition-all cursor-pointer group relative"
                                        >
                                            {/* Favorite star */}
                                            <button
                                                onClick={(e) => toggleFavorite(e, resource.id, resource.source)}
                                                className={`absolute top-3 right-3 p-2 rounded-full transition-all ${favorites.has(resource.id) ? 'bg-[#E8B84A] text-white' : 'bg-gray-100 text-gray-400 hover:bg-[#E8B84A]/20 hover:text-[#E8B84A]'}`}
                                                title={favorites.has(resource.id) ? 'Remove from favorites' : 'Add to favorites'}
                                            >
                                                <Star className="w-4 h-4" fill={favorites.has(resource.id) ? 'currentColor' : 'none'} />
                                            </button>
                                            <div className="flex items-start gap-3 mb-3 pr-10">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
                                                    <Icon className="w-5 h-5" style={{ color }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-gray-900 group-hover:text-[#2E4A8E] transition-colors line-clamp-1">{resource.organization_name}</h4>
                                                    {resource.program_name && <p className="text-sm text-gray-500 line-clamp-1">{resource.program_name}</p>}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${color}15`, color }}>{resource.category}</span>
                                                {resource.subcategory && resource.subcategory !== resource.category && (
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{resource.subcategory}</span>
                                                )}
                                                {resource.source === 'SAMHSA' && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">SAMHSA</span>}
                                                {resource.distance_miles && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{resource.distance_miles.toFixed(1)} mi</span>}
                                            </div>
                                            {resource.service_description && <p className="text-sm text-gray-600 line-clamp-2 mb-3">{resource.service_description}</p>}
                                            <div className="space-y-1 text-sm">
                                                {resource.phone && <div className="flex items-center gap-2 text-gray-500"><Phone className="w-3.5 h-3.5" /><span className="line-clamp-1">{formatPhone(resource.phone)}</span></div>}
                                                {resource.address && <div className="flex items-center gap-2 text-gray-500"><MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span className="line-clamp-1">{resource.address}</span></div>}
                                            </div>
                                            {resource.address && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setBusDirectionsResource(resource);
                                                    }}
                                                    className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#2E4A8E]/10 hover:bg-[#2E4A8E]/20 text-[#2E4A8E] rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <Bus className="w-4 h-4" />
                                                    Bus Directions
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!isLoading && viewMode === 'list' && hasSearched && resources.length === 0 && !showFavoritesOnly && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">No resources found</h3>
                                <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
                                <button
                                    onClick={() => setShowAssistant(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2A8B8B] text-white rounded-lg font-medium"
                                >
                                    <Sparkles className="w-4 h-4" />Ask AI Navigator for Help
                                </button>
                            </div>
                        )}

                        {!isLoading && viewMode === 'list' && showFavoritesOnly && resources.filter(r => favorites.has(r.id)).length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-[#E8B84A]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Star className="w-8 h-8 text-[#E8B84A]" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">No favorites yet</h3>
                                <p className="text-gray-500 mb-4">Click the star icon on any resource to add it to your favorites</p>
                                <button
                                    onClick={() => { setShowFavoritesOnly(false); handleCategoryClick('all'); }}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2E4A8E] text-white rounded-lg font-medium"
                                >
                                    <Search className="w-4 h-4" />Browse All Resources
                                </button>
                            </div>
                        )}
                    </div>

                    <footer className="max-w-7xl mx-auto px-6 py-8 border-t border-gray-200">
                        <div className="text-center">
                            <p className="text-gray-500 text-sm mb-2">Louisville Neighbor Network • South Louisville Community Ministries</p>
                            <p className="text-[#E8B84A] font-medium text-sm">Reconnect • Rethink • Rebuild</p>
                        </div>
                    </footer>
                </main>

                {/* AI Assistant Sidebar */}
                {showAssistant && (
                    <aside className="fixed right-0 top-0 h-screen w-[420px] bg-white border-l border-gray-200 flex flex-col z-50">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-[#2A8B8B]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">Navigator Assistant</h3>
                                    <p className="text-xs text-white/80">AI-powered guidance</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAssistant(false)}
                                className="p-2 hover:bg-white/10 rounded-lg"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="mb-4">
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Neighbor&apos;s Situation (optional)</label>
                                <textarea
                                    value={neighborContext}
                                    onChange={(e) => setNeighborContext(e.target.value)}
                                    placeholder="e.g., Single parent, recently lost job, needs help with rent..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                                    rows={2}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="text-sm font-medium text-gray-700 mb-1 block">What do you need help with?</label>
                                <div className="relative">
                                    <textarea
                                        value={assistantQuery}
                                        onChange={(e) => setAssistantQuery(e.target.value)}
                                        placeholder="e.g., I need help finding affordable housing options for someone with limited income..."
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none pr-12"
                                        rows={3}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleAssistantSubmit();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleAssistantSubmit}
                                        disabled={isAssistantLoading || !assistantQuery.trim()}
                                        className="absolute right-2 bottom-2 p-2 bg-[#2A8B8B] text-white rounded-lg disabled:opacity-50"
                                    >
                                        {isAssistantLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            {!assistantResponse && (
                                <div className="mb-4">
                                    <p className="text-xs text-gray-500 mb-2">Quick questions:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {['Help finding emergency housing', 'Food assistance options', 'How to get an ID replaced', 'Transportation to appointments'].map((prompt) => (
                                            <button
                                                key={prompt}
                                                onClick={() => setAssistantQuery(prompt)}
                                                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-700 transition-colors"
                                            >
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {assistantResponse && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Info className="w-4 h-4 text-blue-600" />
                                            <span className="font-medium text-blue-900 text-sm">Summary</span>
                                        </div>
                                        <p className="text-sm text-blue-800">{assistantResponse.summary}</p>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <CheckCircle className="w-4 h-4 text-[#27AE60]" />
                                            <span className="font-medium text-gray-900 text-sm">Recommended Resources</span>
                                        </div>
                                        <div className="space-y-3">
                                            {assistantResponse.recommendedResources.map((rec, i) => (
                                                <div key={i} className="p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-medium text-sm text-gray-900">{rec.name}</span>
                                                        <span className="px-2 py-0.5 bg-gray-200 rounded-full text-xs text-gray-600">{rec.type}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-600 mb-1">{rec.whyHelpful}</p>
                                                    <p className="text-xs text-gray-500">{rec.howToContact}</p>
                                                    {rec.eligibilityNotes && <p className="text-xs text-gray-500 mt-1 italic">{rec.eligibilityNotes}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <ChevronRight className="w-4 h-4 text-[#2E4A8E]" />
                                            <span className="font-medium text-gray-900 text-sm">Next Steps</span>
                                        </div>
                                        <ol className="space-y-2">
                                            {assistantResponse.nextSteps.map((step, i) => (
                                                <li key={i} className="flex gap-2 text-sm">
                                                    <span className="w-5 h-5 rounded-full bg-[#2E4A8E]/10 text-[#2E4A8E] flex items-center justify-center text-xs font-medium flex-shrink-0">{i + 1}</span>
                                                    <span className="text-gray-700">{step}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MessageCircle className="w-4 h-4 text-amber-600" />
                                            <span className="font-medium text-amber-900 text-sm">Script to Use</span>
                                        </div>
                                        <p className="text-sm text-amber-800 italic">&quot;{assistantResponse.selfAdvocacyScript}&quot;</p>
                                    </div>
                                    {assistantResponse.barriersAndIdeas.length > 0 && (
                                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <AlertCircle className="w-4 h-4 text-orange-500" />
                                                <span className="font-medium text-gray-900 text-sm">Potential Barriers</span>
                                            </div>
                                            <div className="space-y-2">
                                                {assistantResponse.barriersAndIdeas.map((item, i) => (
                                                    <div key={i} className="p-2 bg-gray-50 rounded-lg">
                                                        <p className="text-xs font-medium text-gray-700">{item.barrier}</p>
                                                        <p className="text-xs text-gray-600 mt-1">💡 {item.ideaToWorkAround}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="p-4 bg-[#2A8B8B]/10 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Lightbulb className="w-4 h-4 text-[#2A8B8B]" />
                                            <span className="font-medium text-gray-900 text-sm">Remember</span>
                                        </div>
                                        <p className="text-sm text-gray-700">{assistantResponse.encouragement}</p>
                                    </div>
                                    <button
                                        onClick={() => { setAssistantResponse(null); setAssistantQuery(''); }}
                                        className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                                    >
                                        Ask Another Question
                                    </button>
                                </div>
                            )}
                        </div>
                    </aside>
                )}
            </div>

            {/* Resource detail modal */}
            {selectedResource && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedResource(null)}>
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${getCategoryColor(selectedResource.category)}15` }}>
                                    {(() => {
                                        const Icon = getCategoryIcon(selectedResource.category);
                                        return <Icon className="w-6 h-6" style={{ color: getCategoryColor(selectedResource.category) }} />;
                                    })()}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{selectedResource.organization_name}</h2>
                                    {selectedResource.program_name && <p className="text-gray-500">{selectedResource.program_name}</p>}
                                </div>
                            </div>
                            <button onClick={() => setSelectedResource(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: `${getCategoryColor(selectedResource.category)}15`, color: getCategoryColor(selectedResource.category) }}>{selectedResource.category}</span>
                                {selectedResource.subcategory && <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">{selectedResource.subcategory}</span>}
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedResource.source === 'SAMHSA' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {selectedResource.source === 'SAMHSA' ? 'SAMHSA Verified' : 'Local Resource'}
                                </span>
                            </div>
                            {selectedResource.service_description && (
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-2">Services</h3>
                                    <p className="text-gray-600">{selectedResource.service_description}</p>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedResource.phone && (
                                    <a href={`tel:${selectedResource.phone.replace(/\D/g, '')}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                        <Phone className="w-5 h-5 text-[#2E4A8E]" />
                                        <div>
                                            <p className="text-xs text-gray-500">Phone</p>
                                            <p className="font-medium text-gray-900">{formatPhone(selectedResource.phone)}</p>
                                        </div>
                                    </a>
                                )}
                                {selectedResource.email && (
                                    <a href={`mailto:${selectedResource.email}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                        <Mail className="w-5 h-5 text-[#2E4A8E]" />
                                        <div>
                                            <p className="text-xs text-gray-500">Email</p>
                                            <p className="font-medium text-gray-900 text-sm break-all">{selectedResource.email}</p>
                                        </div>
                                    </a>
                                )}
                                {selectedResource.website && (
                                    <a
                                        href={selectedResource.website.startsWith('http') ? selectedResource.website : `https://${selectedResource.website}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                    >
                                        <Globe className="w-5 h-5 text-[#2E4A8E]" />
                                        <div>
                                            <p className="text-xs text-gray-500">Website</p>
                                            <p className="font-medium text-[#2E4A8E] text-sm flex items-center gap-1">
                                                Visit Website <ExternalLink className="w-3 h-3" />
                                            </p>
                                        </div>
                                    </a>
                                )}
                                {selectedResource.address && (
                                    <a
                                        href={`https://maps.google.com/?q=${encodeURIComponent(selectedResource.address)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                    >
                                        <MapPin className="w-5 h-5 text-[#2E4A8E]" />
                                        <div>
                                            <p className="text-xs text-gray-500">Address</p>
                                            <p className="font-medium text-gray-900 text-sm">{selectedResource.address}</p>
                                        </div>
                                    </a>
                                )}
                            </div>
                            {selectedResource.hours && (
                                <div className="p-4 bg-amber-50 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="w-5 h-5 text-amber-600" />
                                        <h3 className="font-semibold text-amber-900">Hours</h3>
                                    </div>
                                    <p className="text-amber-800">{selectedResource.hours}</p>
                                </div>
                            )}
                            {(selectedResource.qualifier_geography || selectedResource.qualifier_age || selectedResource.qualifier_income || selectedResource.qualifier_cohort) && (
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-3">Eligibility</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {selectedResource.qualifier_geography && (
                                            <div className="p-3 bg-gray-50 rounded-lg">
                                                <p className="text-xs text-gray-500 mb-1">Service Area</p>
                                                <p className="text-sm text-gray-700">{selectedResource.qualifier_geography}</p>
                                            </div>
                                        )}
                                        {selectedResource.qualifier_age && (
                                            <div className="p-3 bg-gray-50 rounded-lg">
                                                <p className="text-xs text-gray-500 mb-1">Age Requirements</p>
                                                <p className="text-sm text-gray-700">{selectedResource.qualifier_age}</p>
                                            </div>
                                        )}
                                        {selectedResource.qualifier_income && (
                                            <div className="p-3 bg-gray-50 rounded-lg">
                                                <p className="text-xs text-gray-500 mb-1">Income Requirements</p>
                                                <p className="text-sm text-gray-700">{selectedResource.qualifier_income}</p>
                                            </div>
                                        )}
                                        {selectedResource.qualifier_cohort && (
                                            <div className="p-3 bg-gray-50 rounded-lg">
                                                <p className="text-xs text-gray-500 mb-1">Who This Serves</p>
                                                <p className="text-sm text-gray-700">{selectedResource.qualifier_cohort}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {selectedResource.required_documents && (
                                <div className="p-4 bg-blue-50 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText className="w-5 h-5 text-blue-600" />
                                        <h3 className="font-semibold text-blue-900">Required Documents</h3>
                                    </div>
                                    <p className="text-blue-800">{selectedResource.required_documents}</p>
                                </div>
                            )}
                            {selectedResource.tips_tricks && (
                                <div className="p-4 bg-[#2A8B8B]/10 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Lightbulb className="w-5 h-5 text-[#2A8B8B]" />
                                        <h3 className="font-semibold text-gray-900">Tips &amp; Tricks</h3>
                                    </div>
                                    <p className="text-gray-700">{selectedResource.tips_tricks}</p>
                                </div>
                            )}
                            {selectedResource.notes && (
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-2">Additional Notes</h3>
                                    <p className="text-gray-600">{selectedResource.notes}</p>
                                </div>
                            )}
                            {selectedResource.point_of_contact && (
                                <div className="p-4 bg-gray-50 rounded-xl">
                                    <h3 className="font-semibold text-gray-900 mb-2">Point of Contact</h3>
                                    <p className="text-gray-600">{selectedResource.point_of_contact}</p>
                                </div>
                            )}

                            {selectedResource.address && (
                                <button
                                    onClick={() => {
                                        setBusDirectionsResource(selectedResource);
                                        setSelectedResource(null);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2E4A8E] hover:bg-[#243d73] text-white rounded-xl font-medium transition-colors"
                                >
                                    <Bus className="w-5 h-5" />
                                    Get TARC Bus Directions
                                </button>
                            )}
                            <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end items-center gap-3">
                                <UnableToAccessButton
                                    resourceId={selectedResource.id}
                                    resourceName={selectedResource.organization_name}
                                />
                                <FlagResourceButton
                                    resourceId={selectedResource.id}
                                    resourceName={selectedResource.organization_name}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bus directions modal */}
            {busDirectionsResource && (
                <BusDirectionsModal
                    resource={busDirectionsResource}
                    onClose={() => setBusDirectionsResource(null)}
                    categoryColor={categoryColors[busDirectionsResource.category] || '#607D8B'}
                />
            )}
        </div>
    );
}
