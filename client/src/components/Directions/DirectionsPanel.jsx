import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Navigation, ArrowUpDown, MapPin, Search,
  Clock, Route, AlertCircle, Droplets, Construction,
  Car, Zap, Trash2, Dog, Activity, CheckCircle2,
  ShieldAlert, ChevronRight, Sliders, Sparkles, Compass
} from 'lucide-react';
import useRouteStore from '../../store/useRouteStore';
import useIssueStore from '../../store/useIssueStore';
import routingService, { POPULAR_DESTINATIONS } from '../../services/routing';

const ICON_MAP = {
  AlertCircle, Droplets, Construction, Car, Zap, Trash2, Dog, Activity
};

export default function DirectionsPanel({ userLocation, onFocusIssue, onFitRouteBounds }) {
  const {
    isDirectionsOpen,
    closeDirections,
    origin,
    destination,
    setOrigin,
    setDestination,
    swapOriginDestination,
    corridorRadiusMeters,
    setCorridorRadius,
    routeAlternatives,
    selectedRouteId,
    selectRoute,
    calculateRoutes,
    isLoadingRoutes,
    error,
    clearRoutes,
  } = useRouteStore();

  const { issues } = useIssueStore();

  const [originQuery, setOriginQuery] = useState(origin?.name || '');
  const [destQuery, setDestQuery] = useState(destination?.name || '');
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [activeSearchField, setActiveSearchField] = useState(null); // 'origin' | 'dest' | null
  const [showCorridorSettings, setShowCorridorSettings] = useState(false);

  const searchDebounceRef = useRef(null);
  const destInputRef = useRef(null);

  // Automatically retrieve actual GPS location for From field & focus destination (To) input
  useEffect(() => {
    if (isDirectionsOpen) {
      // 1. Auto-populate From with actual user GPS coordinates (no hardcoding)
      if (userLocation) {
        const gpsPoint = {
          name: 'My Current Location',
          lat: userLocation.latitude,
          lng: userLocation.longitude,
          isCurrentLocation: true,
        };
        setOrigin(gpsPoint);
        setOriginQuery('My Current Location');
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const gpsPoint = {
              name: 'My Current Location',
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              isCurrentLocation: true,
            };
            setOrigin(gpsPoint);
            setOriginQuery('My Current Location');
          },
          (err) => {
            console.warn('Could not auto-retrieve GPS for route origin:', err.message);
          },
          { enableHighAccuracy: true, timeout: 6000 }
        );
      }

      // 2. Automatically focus the destination (To) input field so the cursor blinks immediately
      const timer = setTimeout(() => {
        destInputRef.current?.focus();
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [isDirectionsOpen, userLocation, setOrigin]);

  // Sync originQuery when origin changes
  useEffect(() => {
    if (origin?.name) {
      setOriginQuery(origin.name);
    }
  }, [origin]);

  // Sync destQuery when destination changes
  useEffect(() => {
    if (destination?.name) {
      setDestQuery(destination.name);
    }
  }, [destination]);

  // Handle autocomplete search
  const handleQueryChange = (field, text) => {
    if (field === 'origin') {
      setOriginQuery(text);
      setActiveSearchField('origin');
    } else {
      setDestQuery(text);
      setActiveSearchField('dest');
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      if (text.trim().length >= 2) {
        const results = await routingService.searchPlaces(text);
        setSearchResults(results);
      } else {
        setSearchResults(POPULAR_DESTINATIONS.slice(0, 5));
      }
    }, 250);
  };

  const handleSelectPlace = (place, field) => {
    if (field === 'origin') {
      setOrigin(place);
      setOriginQuery(place.name);
      setActiveSearchField(null);
      if (destination) {
        calculateRoutes(issues).then((routes) => {
          if (routes && routes[0] && onFitRouteBounds) {
            onFitRouteBounds(routes[0].geometry);
          }
        });
      }
    } else {
      setDestination(place);
      setDestQuery(place.name);
      setActiveSearchField(null);
      if (origin) {
        calculateRoutes(issues).then((routes) => {
          if (routes && routes[0] && onFitRouteBounds) {
            onFitRouteBounds(routes[0].geometry);
          }
        });
      }
    }
  };

  const handleUseCurrentLocationForOrigin = () => {
    if (userLocation) {
      const point = {
        name: 'My Current Location',
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        isCurrentLocation: true,
      };
      setOrigin(point);
      setOriginQuery('My Current Location');
      setActiveSearchField(null);
      if (destination) {
        calculateRoutes(issues).then((routes) => {
          if (routes && routes[0] && onFitRouteBounds) {
            onFitRouteBounds(routes[0].geometry);
          }
        });
      }
    }
  };

  // Re-run route calculation if corridor radius changes
  const handleCorridorRadiusChange = (newRadius) => {
    setCorridorRadius(newRadius);
    if (origin && destination) {
      calculateRoutes(issues);
    }
  };

  const selectedRoute = routeAlternatives.find((r) => r.id === selectedRouteId) || routeAlternatives[0];

  if (!isDirectionsOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 280 }}
        className="fixed top-[130px] left-3 z-[99990] w-[calc(100vw-1.5rem)] sm:w-[410px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[calc(100vh-1.5rem)] overflow-hidden font-sans pointer-events-auto"
      >
        {/* Panel Header */}
        <div className="p-4 bg-gray-950 text-white relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-blue-600 text-white shadow-xs">
                <Navigation size={16} />
              </div>
              <h2 className="text-base font-heading font-bold text-white tracking-tight">
                Route & Civic Corridor
              </h2>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowCorridorSettings(!showCorridorSettings)}
                className={`p-1.5 rounded-lg text-white/70 hover:text-white transition-colors cursor-pointer ${showCorridorSettings ? 'bg-white/20 text-white' : 'hover:bg-white/10'
                  }`}
                title="Corridor settings"
              >
                <Sliders size={16} />
              </button>
              <button
                onClick={closeDirections}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Corridor Settings Collapsible */}
          {showCorridorSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 p-3 bg-white/10 rounded-2xl border border-white/10 text-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/80 font-medium">Corridor Detection Vicinity</span>
                <span className="text-white font-mono font-bold">{corridorRadiusMeters} meters</span>
              </div>
              <div className="flex gap-2">
                {[150, 250, 400, 600].map((r) => (
                  <button
                    key={r}
                    onClick={() => handleCorridorRadiusChange(r)}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${corridorRadiusMeters === r
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                  >
                    {r}m
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/60 mt-2">
                Civic issues within this corridor buffer will be associated with each route.
              </p>
            </motion.div>
          )}

          {/* Search Inputs: Origin & Destination */}
          <div className="relative flex flex-col gap-2">
            {/* Origin Input */}
            <div className="relative flex items-center bg-white/10 rounded-2xl border border-white/15 px-3 py-2 text-white">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-400 mr-2.5 shrink-0 ring-4 ring-blue-500/20" />
              <input
                type="text"
                value={originQuery}
                onFocus={() => {
                  setActiveSearchField('origin');
                  setSearchResults(POPULAR_DESTINATIONS.slice(0, 5));
                }}
                onChange={(e) => handleQueryChange('origin', e.target.value)}
                placeholder="Starting location"
                className="w-full bg-transparent text-xs text-white placeholder-white/50 outline-none font-medium"
              />
              {originQuery && (
                <button
                  onClick={() => {
                    setOriginQuery('');
                    setActiveSearchField('origin');
                  }}
                  className="text-white/50 hover:text-white p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Destination Input */}
            <div className="relative flex items-center bg-white/10 rounded-2xl border border-white/15 px-3 py-2 text-white">
              <MapPin size={14} className="text-red-400 mr-2 shrink-0" />
              <input
                ref={destInputRef}
                type="text"
                value={destQuery}
                onFocus={() => {
                  setActiveSearchField('dest');
                  setSearchResults(POPULAR_DESTINATIONS.slice(0, 5));
                }}
                onChange={(e) => handleQueryChange('dest', e.target.value)}
                placeholder="Enter destination (e.g. Connaught Place)"
                className="w-full bg-transparent text-xs text-white placeholder-white/50 outline-none font-medium"
              />
              {destQuery && (
                <button
                  onClick={() => {
                    setDestQuery('');
                    setActiveSearchField('dest');
                  }}
                  className="text-white/50 hover:text-white p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Swap Origin / Destination Button */}
            <button
              onClick={() => {
                swapOriginDestination();
                if (origin && destination) {
                  calculateRoutes(issues).then((routes) => {
                    if (routes && routes[0] && onFitRouteBounds) {
                      onFitRouteBounds(routes[0].geometry);
                    }
                  });
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer shadow-sm border border-white/10"
              title="Reverse origin and destination"
            >
              <ArrowUpDown size={10} />
            </button>
          </div>

          {/* Quick Destination Chips */}
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5 scrollbar-none">
            {POPULAR_DESTINATIONS.slice(0, 4).map((p) => (
              <button
                key={p.name}
                onClick={() => handleSelectPlace(p, 'dest')}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-xl text-[11px] text-white/80 whitespace-nowrap transition-colors cursor-pointer border border-white/10"
              >
                📍 {p.name.split(',')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Autocomplete Search Dropdown */}
        {activeSearchField && (
          <div className="p-3 bg-white border-b border-gray-100 max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 text-[11px] text-gray-400 font-semibold uppercase">
              <span>Suggested Locations</span>
              {activeSearchField === 'origin' && (
                <button
                  onClick={handleUseCurrentLocationForOrigin}
                  className="text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Use My Current GPS
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1">
              {searchResults.map((place, idx) => (
                <button
                  key={`${place.name}-${idx}`}
                  onClick={() => handleSelectPlace(place, activeSearchField)}
                  className="p-2 text-left hover:bg-gray-50 rounded-xl transition-colors cursor-pointer flex items-center gap-2 group"
                >
                  <MapPin size={14} className="text-gray-400 group-hover:text-blue-600 shrink-0" />
                  <span className="text-xs text-ink font-medium truncate">{place.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Route Alternatives & Issues List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {isLoadingRoutes ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <h4 className="text-sm font-semibold text-ink">Analyzing Route Alternatives...</h4>
              <p className="text-xs text-gray-500 mt-1">
                Scanning route geometry and evaluating {corridorRadiusMeters}m civic corridors
              </p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs text-center font-medium">
              {error}
            </div>
          ) : routeAlternatives.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-2">
                <Route size={24} />
              </div>
              <h4 className="text-sm font-heading font-bold text-ink">Plan Route with Issue Overlay</h4>
              <p className="text-xs text-gray-500 max-w-xs mt-1">
                Enter a destination above to calculate alternative paths and detect potholes, waterlogging, and road hazards along the way.
              </p>
            </div>
          ) : (
            <>
              {/* Route Comparison Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Route Alternatives ({routeAlternatives.length})
                  </h3>
                  <span className="text-[11px] text-gray-500">Compare time vs issues</span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {routeAlternatives.map((route) => {
                    const isSelected = route.id === selectedRouteId;
                    const stats = route.summaryStats;

                    return (
                      <div
                        key={route.id}
                        onClick={() => {
                          selectRoute(route.id);
                          if (onFitRouteBounds) {
                            onFitRouteBounds(route.geometry);
                          }
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 group ${isSelected
                          ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-600/20'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                      >
                        {/* Header: Name, Distance, Duration */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-bold ${isSelected ? 'text-blue-900' : 'text-ink'
                                }`}
                            >
                              {route.name}
                            </span>
                            {route.isRecommended && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                                Fastest
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black font-heading text-ink">
                              {route.durationMin} min
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                              ({route.distanceKm} km)
                            </span>
                          </div>
                        </div>

                        {/* Issue Corridor Summary Banner */}
                        <div
                          className={`p-2 rounded-xl text-xs flex items-center justify-between ${stats.total === 0
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                            : stats.criticalCount > 0
                              ? 'bg-red-50 text-red-800 border border-red-100'
                              : 'bg-amber-50 text-amber-800 border border-amber-100'
                            }`}
                        >
                          <div className="flex items-center gap-1.5 font-medium">
                            {stats.total === 0 ? (
                              <>
                                <CheckCircle2 size={14} className="text-emerald-600" />
                                <span>Clean Route • 0 issues in corridor</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle size={14} className={stats.criticalCount > 0 ? 'text-red-600' : 'text-amber-600'} />
                                <span>
                                  <strong>{stats.total}</strong> {stats.total === 1 ? 'reported issue' : 'reported issues'} nearby
                                </span>
                              </>
                            )}
                          </div>

                          {stats.total > 0 && (
                            <div className="text-[10px] font-semibold flex items-center gap-1">
                              {stats.directlyOnRouteCount > 0 && (
                                <span className="bg-red-200/60 px-1.5 py-0.5 rounded">
                                  {stats.directlyOnRouteCount} on road
                                </span>
                              )}
                              <span>{stats.safetyGrade}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Corridor Issues for Selected Route */}
              {selectedRoute && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert size={14} className="text-ink" />
                      Issues Along {selectedRoute.name}
                    </h3>
                    <span className="text-xs font-mono font-bold text-ink">
                      {selectedRoute.corridorIssues.length} total
                    </span>
                  </div>

                  {selectedRoute.corridorIssues.length === 0 ? (
                    <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl text-center">
                      <CheckCircle2 size={24} className="text-emerald-600 mx-auto mb-1.5" />
                      <h4 className="text-xs font-bold text-emerald-900">Zero Issues Detected</h4>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        No potholes or road hazards found within {corridorRadiusMeters}m of this route corridor.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {selectedRoute.corridorIssues.map((item, idx) => {
                        const iss = item.issue;
                        const IconComp = ICON_MAP[iss.iconName] || AlertCircle;

                        return (
                          <div
                            key={`${iss.id}-${idx}`}
                            onClick={() => onFocusIssue && onFocusIssue(iss)}
                            className="p-3 bg-white rounded-2xl border border-gray-100 hover:border-gray-300 transition-all cursor-pointer flex flex-col gap-2 shadow-xs group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className="p-1.5 rounded-lg flex items-center justify-center shadow-xs"
                                  style={{ backgroundColor: iss.bg, color: iss.color }}
                                >
                                  <IconComp size={15} />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-ink group-hover:text-blue-600 transition-colors">
                                    {iss.label}
                                  </span>
                                  <span className="block text-[10px] text-gray-400">
                                    {(item.progressFraction * 100).toFixed(0)}% along journey
                                  </span>
                                </div>
                              </div>

                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.isDirectlyOnRoute
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : 'bg-gray-100 text-gray-700'
                                  }`}
                              >
                                {item.relativeLocationText}
                              </span>
                            </div>

                            <p className="text-xs text-gray-600 leading-snug line-clamp-1">
                              {iss.title}
                            </p>

                            <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-50">
                              <span>Urgency: {iss.urgency || 'Medium'}</span>
                              <span className="text-blue-600 font-medium group-hover:underline flex items-center gap-0.5">
                                View pin <ChevronRight size={10} />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Panel Footer */}
        {routeAlternatives.length > 0 && (
          <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
            <button
              onClick={clearRoutes}
              className="text-gray-500 hover:text-ink font-medium cursor-pointer"
            >
              Clear Route
            </button>
            <span className="text-gray-400 text-[11px]">
              Corridor buffer: ±{corridorRadiusMeters}m
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
