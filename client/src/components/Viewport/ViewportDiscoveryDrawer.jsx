import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Compass, Filter, Search, ThumbsUp, MapPin, 
  ChevronRight, AlertCircle, Droplets, Construction, 
  Car, Zap, Trash2, Dog, Activity, CheckCircle2, RefreshCw
} from 'lucide-react';
import useIssueStore from '../../store/useIssueStore';
import useAuthStore from '../../store/useAuthStore';

const ICON_MAP = {
  AlertCircle, Droplets, Construction, Car, Zap, Trash2, Dog, Activity
};

const CATEGORIES = [
  { id: 'all', label: 'All Issues' },
  { id: 'pothole', label: 'Potholes' },
  { id: 'water', label: 'Waterlogging' },
  { id: 'roadwork', label: 'Broken Roads' },
  { id: 'traffic', label: 'Hazards' },
  { id: 'light', label: 'Lighting' },
  { id: 'garbage', label: 'Garbage' },
  { id: 'animal', label: 'Animals' },
  { id: 'speed', label: 'Speed Breakers' },
];

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function ViewportDiscoveryDrawer({ 
  mapCenter, 
  viewportBounds, 
  onSelectIssue 
}) {
  const { 
    issues, 
    isViewportDrawerOpen, 
    closeViewportDrawer, 
    confirmIssue,
    fetchIssuesInBounds,
    isLoading
  } = useIssueStore();
  const { user, isAuthenticated, openAuthModal } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Active' | 'Resolved'
  const [sortBy, setSortBy] = useState('distance'); // 'distance' | 'confirmations' | 'newest'

  // Issues in viewport
  const filteredIssues = useMemo(() => {
    let result = issues.filter((issue) => {
      if (selectedCategory !== 'all' && issue.category !== selectedCategory) {
        return false;
      }
      if (statusFilter !== 'all' && issue.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = issue.title?.toLowerCase().includes(q);
        const matchesDesc = issue.description?.toLowerCase().includes(q);
        const matchesAddress = issue.address?.toLowerCase().includes(q);
        const matchesCat = issue.label?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAddress && !matchesCat) {
          return false;
        }
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'distance' && mapCenter) {
        const distA = calculateDistance(mapCenter.lat, mapCenter.lng, a.lat, a.lng);
        const distB = calculateDistance(mapCenter.lat, mapCenter.lng, b.lat, b.lng);
        return distA - distB;
      }
      if (sortBy === 'confirmations') {
        return (b.confirmations || 0) - (a.confirmations || 0);
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return 0;
    });

    return result;
  }, [issues, selectedCategory, statusFilter, searchQuery, sortBy, mapCenter]);

  if (!isViewportDrawerOpen) return null;

  const handleConfirm = async (e, issueId) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    await confirmIssue(issueId);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-y-0 right-0 z-[100000] flex pointer-events-auto font-sans">
        {/* Backdrop on mobile */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeViewportDrawer}
          className="fixed inset-0 bg-ink/30 backdrop-blur-xs md:hidden"
        />

        {/* Slide-in Drawer */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="relative w-full max-w-md md:w-[440px] bg-white h-full shadow-2xl flex flex-col border-l border-gray-100 z-10"
        >
          {/* Drawer Header */}
          <div className="p-5 border-b border-gray-100 bg-paper/60 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-ink text-white shadow-xs">
                  <Compass size={20} className="animate-spin-slow" />
                </div>
                <div>
                  <h2 className="text-lg font-heading font-bold text-ink flex items-center gap-2">
                    Viewport Discovery
                    <span className="text-xs bg-ink/10 text-ink px-2 py-0.5 rounded-full font-mono">
                      {issues.length} in view
                    </span>
                  </h2>
                  <p className="text-xs text-gray-500">
                    Live road & civic issues in your visible map area
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchIssuesInBounds(viewportBounds)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-ink transition-colors cursor-pointer"
                  title="Refresh issues in view"
                >
                  <RefreshCw size={17} className={isLoading ? 'animate-spin text-ink' : ''} />
                </button>
                <button
                  onClick={closeViewportDrawer}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-ink transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="mt-4 relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issues, streets, or keywords..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-ink focus:ring-1 focus:ring-ink outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Chips */}
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-ink text-white shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Filter & Sort Controls */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <div className="flex gap-2">
                <button
                  onClick={() => setStatusFilter(statusFilter === 'Active' ? 'all' : 'Active')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    statusFilter === 'Active' ? 'bg-amber-100 text-amber-800' : 'hover:bg-gray-100'
                  }`}
                >
                  Active Only
                </button>
                <button
                  onClick={() => setStatusFilter(statusFilter === 'Resolved' ? 'all' : 'Resolved')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    statusFilter === 'Resolved' ? 'bg-emerald-100 text-emerald-800' : 'hover:bg-gray-100'
                  }`}
                >
                  Resolved
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent font-semibold text-ink outline-none cursor-pointer"
                >
                  <option value="distance">Nearest</option>
                  <option value="confirmations">Most Confirmed</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </div>
          </div>

          {/* Issue Cards List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredIssues.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <AlertCircle size={36} className="mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-ink text-sm">No issues found in this area</p>
                <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                  Pan the map to explore other streets or report an issue here.
                </p>
              </div>
            ) : (
              filteredIssues.map((issue) => {
                const IconComp = ICON_MAP[issue.iconName] || AlertCircle;
                const dist = mapCenter
                  ? calculateDistance(mapCenter.lat, mapCenter.lng, issue.lat, issue.lng).toFixed(1)
                  : null;

                return (
                  <div
                    key={issue.id}
                    onClick={() => {
                      if (onSelectIssue) onSelectIssue(issue);
                      closeViewportDrawer();
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative bg-white hover:border-gray-300 shadow-xs ${
                      issue.isOwner ? 'border-amber-300 bg-amber-50/20' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="p-2 rounded-xl flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: issue.bg, color: issue.color }}
                        >
                          <IconComp size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-ink">
                              {issue.label || issue.category}
                            </span>
                            {issue.isOwner && (
                              <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded-md">
                                Your Report
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400">
                            {dist ? `${dist} km away` : 'In Viewport'}
                          </span>
                        </div>
                      </div>

                      {issue.status === 'Resolved' ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={11} /> Resolved
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>

                    <h4 className="font-semibold text-sm text-ink mt-2.5 leading-snug">
                      {issue.title}
                    </h4>

                    {issue.description && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                        {issue.description}
                      </p>
                    )}

                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                      <div className="flex items-center gap-1 truncate max-w-[65%]">
                        <MapPin size={12} className="shrink-0 text-gray-400" />
                        <span className="truncate text-[11px]">{issue.address || 'Map coordinate'}</span>
                      </div>

                      <button
                        onClick={(e) => handleConfirm(e, issue.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          issue.hasConfirmed
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                        }`}
                      >
                        <ThumbsUp size={12} />
                        <span>{issue.confirmations || 0}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
