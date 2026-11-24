import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import MapGL, { Marker, Popup, NavigationControl, GeolocateControl, Source, Layer } from 'react-map-gl/maplibre';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, Droplets, Construction, Car, Search, Menu,
  Crosshair, Zap, Trash2, Dog, Activity, Compass, FileText,
  User, ThumbsUp, CheckCircle2, MapPin, Sparkles, RefreshCw,
  Layers, Navigation, Route as RouteIcon, LogIn
} from 'lucide-react';
import ReportFlow from '../components/Report/ReportFlow';
import AuthModal from '../components/Auth/AuthModal';
import ViewportDiscoveryDrawer from '../components/Viewport/ViewportDiscoveryDrawer';
import MyReportsModal from '../components/MyReports/MyReportsModal';
import DirectionsPanel from '../components/Directions/DirectionsPanel';
import useIssueStore from '../store/useIssueStore';
import useAuthStore from '../store/useAuthStore';
import useRouteStore from '../store/useRouteStore';
import MAP_STYLE from '../config/mapStyle';
import 'maplibre-gl/dist/maplibre-gl.css';

const ICON_MAP = {
  AlertCircle, Droplets, Construction, Car, Zap, Trash2, Dog, Activity
};

export default function Home() {
  const [viewState, setViewState] = useState({
    longitude: 77.2090,
    latitude: 28.6139,
    zoom: 13,
  });
  const [userLocation, setUserLocation] = useState(null);
  const [showIntro, setShowIntro] = useState(true);
  const [isPinning, setIsPinning] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [viewportBounds, setViewportBoundsLocal] = useState(null);

  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const isProgrammaticMoveRef = useRef(false);

  const {
    issues,
    myReports,
    fetchIssuesInBounds,
    fetchMyReports,
    setViewportBounds,
    openViewportDrawer,
    openMyReportsModal,
    confirmIssue,
    toggleIssueStatus,
    removeIssue,
    isLoading: isIssuesLoading
  } = useIssueStore();

  const { user, isAuthenticated, checkAuth, openAuthModal } = useAuthStore();

  const {
    isDirectionsOpen,
    openDirections,
    closeDirections,
    origin,
    destination,
    routeAlternatives,
    selectedRouteId,
  } = useRouteStore();

  // Active selected route alternative
  const selectedRoute = useMemo(() => {
    return routeAlternatives.find((r) => r.id === selectedRouteId) || routeAlternatives[0] || null;
  }, [routeAlternatives, selectedRouteId]);

  // Set of issue IDs in the active route corridor
  const corridorIssuesMap = useMemo(() => {
    if (!selectedRoute || !selectedRoute.corridorIssues) return new Map();
    const map = new Map();
    for (const item of selectedRoute.corridorIssues) {
      map.set(item.issue.id, item);
    }
    return map;
  }, [selectedRoute]);

  // Get the center of the map as the pinned location
  const pinnedLocation = [viewState.longitude, viewState.latitude];

  // Initial user location, session check and intro animation
  useEffect(() => {
    checkAuth();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { longitude: pos.coords.longitude, latitude: pos.coords.latitude };
          setViewState((prev) => ({ ...prev, ...loc, zoom: 15 }));
          setUserLocation(loc);
        },
        (err) => console.warn('Could not get GPS location:', err.message),
        { timeout: 7000 }
      );
    }

    const timer = setTimeout(() => setShowIntro(false), 1600);
    return () => clearTimeout(timer);
  }, [checkAuth]);

  // Load user's own reports when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchMyReports();
    }
  }, [isAuthenticated, fetchMyReports]);

  // Re-center map to user's location with smooth animated flight
  const handleRecenter = useCallback((targetLoc) => {
    const loc = targetLoc || userLocation;
    if (loc && mapRef.current) {
      mapRef.current.flyTo({
        center: [loc.longitude, loc.latitude],
        zoom: 15,
        essential: true,
        duration: 1200,
      });
      setViewState((prev) => ({
        ...prev,
        longitude: loc.longitude,
        latitude: loc.latitude,
        zoom: 15,
      }));
    }
  }, [userLocation]);

  // Hook directly into the existing Geolocate button in DOM for instant 0ms responsiveness
  useEffect(() => {
    const attachGeolocateListener = () => {
      const btn = document.querySelector('.maplibregl-ctrl-geolocate, .mapboxgl-ctrl-geolocate');
      if (!btn) return null;

      const onClick = () => {
        if (userLocation && mapRef.current) {
          mapRef.current.flyTo({
            center: [userLocation.longitude, userLocation.latitude],
            zoom: 15,
            essential: true,
            duration: 1200,
          });
        }
      };

      btn.addEventListener('click', onClick);
      return () => btn.removeEventListener('click', onClick);
    };

    let cleanup = attachGeolocateListener();
    const timer = setTimeout(() => {
      cleanup = attachGeolocateListener();
    }, 800);

    return () => {
      if (cleanup) cleanup();
      clearTimeout(timer);
    };
  }, [userLocation]);

  // Handle map movement & Viewport Bounding Box discovery
  const handleMapMove = useCallback((evt) => {
    setViewState(evt.viewState);
  }, []);

  const handleMapIdle = useCallback(() => {
    if (mapRef.current) {
      const bounds = mapRef.current.getBounds();
      if (bounds) {
        const b = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
        setViewportBoundsLocal(b);
        setViewportBounds(b);
        // Automatically fetch issues in newly visible bounds from PostgreSQL / PostGIS
        fetchIssuesInBounds(b);
      }
    }
  }, [fetchIssuesInBounds, setViewportBounds]);

  // Fly to an issue from drawer, reports modal, or corridor list
  const handleSelectIssue = useCallback((issue) => {
    isProgrammaticMoveRef.current = true;
    setSelectedIssue(issue);
    if (mapRef.current && issue.lng && issue.lat) {
      mapRef.current.flyTo({
        center: [issue.lng, issue.lat],
        zoom: 16,
        essential: true,
        duration: 1000,
      });
      setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 1100);
    } else {
      isProgrammaticMoveRef.current = false;
    }
  }, []);

  // Dismiss popup on map interaction (pan, drag, zoom)
  const handleInteractionStart = useCallback(() => {
    if (isProgrammaticMoveRef.current) return;
    setSelectedIssue((prev) => (prev ? null : prev));
  }, []);

  // Dismiss popup on clicking outside (empty map or anywhere outside the popup)
  useEffect(() => {
    if (!selectedIssue) return;

    const handlePointerDown = (e) => {
      // Don't dismiss if clicking inside the popup
      if (popupRef.current && popupRef.current.contains(e.target)) {
        return;
      }
      if (e.target.closest('.maplibregl-popup')) {
        return;
      }
      // Don't dismiss here if clicking an issue marker (marker's onClick will handle selecting it)
      if (e.target.closest('.maplibregl-marker')) {
        return;
      }
      setSelectedIssue(null);
    };

    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handlePointerDown);
    }, 80);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [selectedIssue]);

  // Fit bounds to a route geometry
  const handleFitRouteBounds = useCallback((geometry) => {
    if (!geometry || !geometry.coordinates || !mapRef.current) return;
    const coords = geometry.coordinates;
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    coords.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });

    mapRef.current.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: { top: 90, bottom: 90, left: 430, right: 90 }, duration: 1200 }
    );
  }, []);

  const handleConfirmClick = async (issueId) => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    await confirmIssue(issueId);
    // Refresh selected issue state
    setSelectedIssue((prev) => (prev && prev.id === issueId ? { ...prev, hasConfirmed: !prev.hasConfirmed } : prev));
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-paper font-sans select-none">
      {/* Intro Background Fade */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="absolute inset-0 z-[99998] bg-paper"
          />
        )}
      </AnimatePresence>

      {/* Top Floating Controls */}
      <div className="absolute inset-0 z-[99999] pointer-events-none">
        {showIntro ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="bg-transparent flex items-center gap-3.5">
              <img
                src="/localwatch-icon.png"
                alt="LocalWatch Logo"
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl shadow-xl"
              />
              <motion.h1
                layoutId="logo-text"
                className="text-5xl md:text-7xl font-heading font-black tracking-tight m-0 flex items-center"
              >
                <span className="text-slate-950">Local</span>
                <span className="text-[#00b87c]">Watch</span>
              </motion.h1>
            </div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mt-4 text-xl font-medium text-slate-500"
            >
              Know what's wrong nearby.
            </motion.p>
          </div>
        ) : (
          <div className="w-full p-3 md:p-5 flex items-start justify-between gap-3 pointer-events-none">
            {/* Left: Project Brand Card & Search Button directly below */}
            <div className="flex flex-col items-start gap-2.5">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="px-4 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_4px_16px_rgba(15,23,42,0.08)] pointer-events-auto flex items-center gap-3 cursor-pointer hover:bg-white transition-all group"
                onClick={() => setViewState((prev) => ({ ...prev, zoom: 14 }))}
              >
                <img
                  src="/localwatch-icon.png"
                  alt="LocalWatch Logo"
                  className="w-9 h-9 rounded-xl shadow-sm object-cover"
                />
                <div className="flex flex-col">
                  <motion.h1
                    layoutId="logo-text"
                    className="text-xl md:text-2xl font-heading font-black tracking-tight m-0 leading-none flex items-center"
                  >
                    <span className="text-slate-950">Local</span>
                    <span className="text-[#00b87c]">Watch</span>
                  </motion.h1>
                  <span className="text-[10px] text-slate-400 font-medium tracking-tight mt-0.5">
                    Know what's wrong nearby.
                  </span>
                </div>
              </motion.div>

              {/* 1. Search Button (Unified styling) */}
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (isDirectionsOpen) {
                    closeDirections();
                  } else {
                    openDirections();
                  }
                }}
                className={`h-11 px-4 rounded-xl border backdrop-blur-md flex items-center gap-2 text-sm font-semibold transition-all cursor-pointer pointer-events-auto ${
                  isDirectionsOpen
                    ? 'bg-blue-50 text-blue-900 border-blue-400 shadow-sm'
                    : 'bg-white/90 hover:bg-white text-slate-800 hover:text-slate-950 border-slate-300/90 hover:border-slate-400 shadow-[0_2px_8px_rgba(15,23,42,0.06)]'
                }`}
              >
                <Search size={16} className={isDirectionsOpen ? 'text-blue-600' : 'text-slate-600'} />
                <span>Search</span>
              </motion.button>
            </div>

            {/* Center: 2. Viewport Indicator "4 Issues" (Unified styling) */}
            <div className="flex flex-col items-center gap-2 pointer-events-auto">
              <motion.button
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={openViewportDrawer}
                className="h-11 px-4 rounded-xl bg-white/90 hover:bg-white backdrop-blur-md text-slate-800 hover:text-slate-950 border border-slate-300/90 hover:border-slate-400 shadow-[0_2px_8px_rgba(15,23,42,0.06)] flex items-center gap-2 text-sm font-semibold transition-all cursor-pointer group"
              >
                <Compass size={16} className={`text-slate-600 group-hover:rotate-45 transition-transform ${isIssuesLoading ? 'animate-spin' : ''}`} />
                <span>{issues.length} Issues</span>
              </motion.button>
            </div>

            {/* Right: 3. Sign In & 4. My Reports directly below it (Unified styling) */}
            <div className="flex flex-col items-end gap-2.5 pointer-events-auto mr-16 sm:mr-20">
              {/* Sign In Button (no icon, only text, unified styling) */}
              <motion.button
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openAuthModal('login')}
                className="h-11 px-4 rounded-xl bg-white/90 hover:bg-white backdrop-blur-md text-slate-800 hover:text-slate-950 border border-slate-300/90 hover:border-slate-400 shadow-[0_2px_8px_rgba(15,23,42,0.06)] flex items-center justify-center text-sm font-semibold transition-all cursor-pointer"
              >
                {isAuthenticated ? (
                  <span className="truncate max-w-[140px]">{user.name}</span>
                ) : (
                  <span>Sign In</span>
                )}
              </motion.button>

              {/* My Reports Button (directly below Sign In, unified styling) */}
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={openMyReportsModal}
                className="h-11 px-4 rounded-xl bg-white/90 hover:bg-white backdrop-blur-md text-slate-800 hover:text-slate-950 border border-slate-300/90 hover:border-slate-400 shadow-[0_2px_8px_rgba(15,23,42,0.06)] flex items-center gap-2 text-sm font-semibold transition-all cursor-pointer"
              >
                <FileText size={16} className="text-slate-600" />
                <span>My Reports</span>
                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {isAuthenticated ? myReports.length : 0}
                </span>
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {/* MapLibre GL Map */}
      <div className="absolute inset-0 z-0">
        <MapGL
          ref={mapRef}
          {...viewState}
          onMove={handleMapMove}
          onIdle={handleMapIdle}
          onMoveStart={handleInteractionStart}
          onDragStart={handleInteractionStart}
          onZoomStart={handleInteractionStart}
          onClick={() => setSelectedIssue((prev) => (prev ? null : prev))}
          style={{ width: '100%', height: '100%' }}
          mapStyle={MAP_STYLE}
          minZoom={3}
          maxZoom={18}
        >
          <NavigationControl position="top-right" showCompass={false} />
          <GeolocateControl
            position="top-right"
            positionOptions={{ enableHighAccuracy: true, timeout: 8000 }}
            trackUserLocation={false}
            showUserLocation={false}
            onGeolocate={(e) => {
              const coords = e.coords;
              const loc = { longitude: coords.longitude, latitude: coords.latitude };
              setUserLocation(loc);
              handleRecenter(loc);
            }}
            onError={(err) => {
              console.warn('Geolocation error:', err.message);
              if (userLocation) {
                handleRecenter(userLocation);
              }
            }}
          />

          {/* User location marker */}
          {userLocation && (
            <Marker longitude={userLocation.longitude} latitude={userLocation.latitude} anchor="center">
              <div className="relative flex items-center justify-center w-8 h-8">
                <div
                  className="absolute w-full h-full bg-blue-500 rounded-full opacity-30 animate-ping"
                  style={{ animationDuration: '2s' }}
                />
                <div className="relative w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg" />
              </div>
            </Marker>
          )}

          {/* Origin Marker in Directions Mode */}
          {isDirectionsOpen && origin && (
            <Marker longitude={origin.lng} latitude={origin.lat} anchor="bottom">
              <div className="flex flex-col items-center">
                <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap mb-1">
                  Start
                </div>
                <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg" />
              </div>
            </Marker>
          )}

          {/* Destination Marker in Directions Mode */}
          {isDirectionsOpen && destination && (
            <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
              <div className="flex flex-col items-center">
                <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap mb-1">
                  {destination.name?.split(',')[0] || 'Destination'}
                </div>
                <MapPin size={28} className="text-red-600 drop-shadow-md -mt-1" />
              </div>
            </Marker>
          )}

          {/* Active Route Rendering */}
          {isDirectionsOpen && selectedRoute && (
            <Source
              id="source-active-route"
              type="geojson"
              data={{
                type: 'Feature',
                geometry: selectedRoute.geometry,
              }}
            >
              <Layer
                id="layer-active-route-casing"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': '#1e3a8a',
                  'line-width': 9,
                  'line-opacity': 0.9,
                }}
              />
              <Layer
                id="layer-active-route-inner"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': '#2563eb',
                  'line-width': 5,
                  'line-opacity': 1,
                }}
              />
            </Source>
          )}

          {/* Reported issue markers */}
          {issues.map((issue) => {
            const IconComp = ICON_MAP[issue.iconName] || AlertCircle;
            const isSelected = selectedIssue?.id === issue.id;
            const corridorData = corridorIssuesMap.get(issue.id);
            const isInRouteCorridor = Boolean(isDirectionsOpen && corridorData);
            const isOwner = Boolean(issue.isOwner);

            return (
              <Marker
                key={issue.id}
                longitude={issue.lng}
                latitude={issue.lat}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedIssue(issue);
                }}
              >
                <div className="relative group">
                  {/* Glowing ring if issue is user's own report */}
                  {isOwner && (
                    <div className="absolute -inset-1.5 rounded-full bg-amber-400 opacity-60 animate-pulse pointer-events-none" />
                  )}

                  {/* Marker Pin */}
                  <div
                    className={`p-2 rounded-full shadow-lg border-[3px] cursor-pointer transition-all ${
                      isOwner ? 'border-amber-400 ring-2 ring-amber-300' : 'border-white'
                    } ${
                      isSelected
                        ? 'scale-125 ring-4 ring-ink/30 z-20'
                        : 'hover:scale-110 opacity-90'
                    }`}
                    style={{ backgroundColor: issue.bg, color: issue.color }}
                  >
                    <IconComp size={20} />
                  </div>

                  {/* Your Report Tag on hover */}
                  {isOwner && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      Your Report
                    </div>
                  )}
                </div>
              </Marker>
            );
          })}

          {/* Rich Popup for selected issue */}
          {selectedIssue && (
            <Popup
              longitude={selectedIssue.lng}
              latitude={selectedIssue.lat}
              anchor="bottom"
              onClose={() => setSelectedIssue(null)}
              closeButton={false}
              closeOnClick={false}
              className="font-sans"
            >
              <div
                ref={popupRef}
                className="p-2 max-w-xs flex flex-col gap-2 font-sans"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: selectedIssue.color }}
                    />
                    <span className="font-bold text-ink text-sm uppercase tracking-wide">
                      {selectedIssue.label || selectedIssue.category}
                    </span>
                    {selectedIssue.isOwner && (
                      <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1 rounded-sm">
                        Yours
                      </span>
                    )}
                  </div>
                  {selectedIssue.status === 'Resolved' ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <CheckCircle2 size={10} /> Resolved
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>

                {/* Photo preview if available */}
                {selectedIssue.photoUrl && (
                  <div className="mt-1 rounded-xl overflow-hidden border border-gray-100 max-h-32 bg-gray-50 flex items-center justify-center">
                    <img
                      src={selectedIssue.photoUrl}
                      alt={selectedIssue.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Title & Desc */}
                <h4 className="font-semibold text-xs text-ink leading-snug">
                  {selectedIssue.title}
                </h4>
                {selectedIssue.description && (
                  <p className="text-[11px] text-gray-600 line-clamp-3 leading-relaxed">
                    {selectedIssue.description}
                  </p>
                )}

                {/* Reporter & Date */}
                <div className="text-[10px] text-gray-400 pt-1 border-t border-gray-100 flex items-center justify-between">
                  <span>By {selectedIssue.reporterName || 'Neighbor'}</span>
                  <span>{new Date(selectedIssue.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1.5 mt-1">
                  <button
                    onClick={() => handleConfirmClick(selectedIssue.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                      selectedIssue.hasConfirmed
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-800 border-slate-200/90'
                    }`}
                  >
                    <ThumbsUp size={12} className={selectedIssue.hasConfirmed ? 'text-white' : 'text-blue-600'} />
                    <span>{selectedIssue.hasConfirmed ? 'Confirmed' : 'Confirm'} ({selectedIssue.confirmations || 0})</span>
                  </button>

                  {selectedIssue.isOwner && (
                    <button
                      onClick={async () => {
                        await toggleIssueStatus(selectedIssue.id, selectedIssue.status);
                        setSelectedIssue((prev) =>
                          prev ? { ...prev, status: prev.status === 'Resolved' ? 'Active' : 'Resolved' } : prev
                        );
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/90 cursor-pointer transition-colors"
                      title="Toggle resolution"
                    >
                      <RefreshCw size={12} />
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          )}
        </MapGL>
      </div>

      {/* Directions Panel */}
      <DirectionsPanel
        userLocation={userLocation}
        onFocusIssue={handleSelectIssue}
        onFitRouteBounds={handleFitRouteBounds}
      />

      {/* Crosshair for pin mode */}
      <AnimatePresence>
        {isPinning && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none"
          >
            <div className="flex flex-col items-center gap-2">
              <Crosshair size={48} className="text-ink drop-shadow-lg" />
              <span className="bg-ink text-white text-xs px-3 py-1 rounded-full font-medium shadow-lg">
                Move map to pin issue
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Action Area: Report Flow */}
      {!isDirectionsOpen && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full px-4 max-w-lg z-[2000] pointer-events-none flex flex-col items-center gap-4">
          <ReportFlow
            onStartPinning={() => setIsPinning(true)}
            onStopPinning={() => setIsPinning(false)}
            pinnedLocation={pinnedLocation}
            onReportSuccess={(newIssue) => {
              handleSelectIssue(newIssue);
            }}
          />
        </div>
      )}

      {/* Modals & Slide-over Drawers */}
      <AuthModal />
      <ViewportDiscoveryDrawer
        mapCenter={{ lat: viewState.latitude, lng: viewState.longitude }}
        viewportBounds={viewportBounds}
        onSelectIssue={handleSelectIssue}
      />
      <MyReportsModal
        onSelectIssue={handleSelectIssue}
        onStartReport={() => setIsPinning(true)}
      />
    </div>
  );
}
