import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, AlertCircle, Droplets, Construction, Car, Zap, 
  Trash2, Dog, Activity, CheckCircle2, MapPin, 
  ThumbsUp, Clock, Plus, ExternalLink, RefreshCw, LogIn
} from 'lucide-react';
import useIssueStore from '../../store/useIssueStore';
import useAuthStore from '../../store/useAuthStore';

const ICON_MAP = {
  AlertCircle, Droplets, Construction, Car, Zap, Trash2, Dog, Activity
};

export default function MyReportsModal({ onSelectIssue, onStartReport }) {
  const { 
    myReports,
    fetchMyReports,
    isMyReportsModalOpen, 
    closeMyReportsModal, 
    toggleIssueStatus, 
    removeIssue 
  } = useIssueStore();
  const { user, isAuthenticated, openAuthModal } = useAuthStore();

  const [filter, setFilter] = useState('all'); // 'all' | 'Active' | 'Resolved'

  useEffect(() => {
    if (isMyReportsModalOpen && isAuthenticated) {
      fetchMyReports();
    }
  }, [isMyReportsModalOpen, isAuthenticated, fetchMyReports]);

  const activeReports = useMemo(
    () => myReports.filter((r) => r.status === 'Active'),
    [myReports]
  );
  const resolvedReports = useMemo(
    () => myReports.filter((r) => r.status === 'Resolved'),
    [myReports]
  );

  const displayedReports = useMemo(() => {
    if (filter === 'Active') return activeReports;
    if (filter === 'Resolved') return resolvedReports;
    return myReports;
  }, [myReports, activeReports, resolvedReports, filter]);

  // Total community confirmations received across user's reports
  const totalConfirmationsReceived = useMemo(() => {
    return myReports.reduce((sum, r) => sum + (r.confirmations || 0), 0);
  }, [myReports]);

  if (!isMyReportsModalOpen) return null;

  const handleLocateOnMap = (issue) => {
    closeMyReportsModal();
    if (onSelectIssue) {
      onSelectIssue(issue);
    }
  };

  const handleCreateNewReport = () => {
    closeMyReportsModal();
    if (onStartReport) {
      onStartReport();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeMyReportsModal}
          className="absolute inset-0 bg-ink/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-10 flex flex-col max-h-[85vh] font-sans"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-950 via-slate-900 to-gray-900 text-white p-6 relative">
            <button
              onClick={closeMyReportsModal}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shadow-inner">
                {user?.avatar || '👤'}
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-white tracking-tight">
                  My Reported Issues
                </h2>
                <p className="text-xs text-white/70 mt-0.5">
                  {isAuthenticated ? (
                    <>Reporter: <span className="font-semibold text-white">{user?.name}</span> ({user?.email})</>
                  ) : (
                    'Sign in to access your permanently saved issue reports'
                  )}
                </p>
              </div>
            </div>

            {/* Quick Stats Grid */}
            {isAuthenticated && (
              <div className="grid grid-cols-4 gap-2.5 mt-5">
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center">
                  <span className="text-2xl font-black font-heading text-white">{myReports.length}</span>
                  <span className="block text-[11px] text-white/70 font-medium mt-0.5">Total Reports</span>
                </div>
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center">
                  <span className="text-2xl font-black font-heading text-amber-300">{activeReports.length}</span>
                  <span className="block text-[11px] text-white/70 font-medium mt-0.5">Active</span>
                </div>
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center">
                  <span className="text-2xl font-black font-heading text-emerald-300">{resolvedReports.length}</span>
                  <span className="block text-[11px] text-white/70 font-medium mt-0.5">Resolved</span>
                </div>
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center">
                  <span className="text-2xl font-black font-heading text-blue-300">{totalConfirmationsReceived}</span>
                  <span className="block text-[11px] text-white/70 font-medium mt-0.5">Confirmations</span>
                </div>
              </div>
            )}
          </div>

          {!isAuthenticated ? (
            // NOT LOGGED IN STATE
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                <LogIn size={28} />
              </div>
              <h3 className="text-base font-heading font-bold text-ink">Sign in to view your reports</h3>
              <p className="text-xs text-gray-500 max-w-sm mt-1 mb-5">
                Your submitted reports are permanently associated with your personal account in PostgreSQL.
              </p>
              <button
                onClick={() => {
                  closeMyReportsModal();
                  openAuthModal('login');
                }}
                className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Sign In to LocalWatch
              </button>
            </div>
          ) : (
            <>
              {/* Filter Tabs & CTA */}
              <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      filter === 'all'
                        ? 'bg-ink text-white shadow-xs'
                        : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    All ({myReports.length})
                  </button>
                  <button
                    onClick={() => setFilter('Active')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      filter === 'Active'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    Active ({activeReports.length})
                  </button>
                  <button
                    onClick={() => setFilter('Resolved')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      filter === 'Resolved'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    Resolved ({resolvedReports.length})
                  </button>
                </div>

                <button
                  onClick={handleCreateNewReport}
                  className="px-3.5 py-1.5 bg-ink text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-ink/90 transition-all shadow-xs cursor-pointer"
                >
                  <Plus size={14} /> Report Issue
                </button>
              </div>

              {/* Reports List */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3.5">
                {displayedReports.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                      <AlertCircle size={32} />
                    </div>
                    <h3 className="text-base font-heading font-bold text-ink">
                      {filter === 'all' ? 'No reports filed yet' : `No ${filter.toLowerCase()} reports`}
                    </h3>
                    <p className="text-xs text-gray-500 max-w-sm mt-1 leading-relaxed">
                      {filter === 'all'
                        ? "You haven't submitted any civic issue reports under this profile. Report an issue on the map to start tracking it."
                        : `You have zero reports currently categorized as ${filter.toLowerCase()}.`}
                    </p>
                    <button
                      onClick={handleCreateNewReport}
                      className="mt-4 px-4 py-2.5 bg-ink text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-ink/90 transition-all cursor-pointer"
                    >
                      Report an Issue Now
                    </button>
                  </div>
                ) : (
                  displayedReports.map((report) => {
                    const IconComp = ICON_MAP[report.iconName] || AlertCircle;
                    const formattedDate = new Date(report.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={report.id}
                        className="p-4 rounded-2xl border border-gray-200 bg-white hover:border-gray-300 transition-all flex flex-col gap-3 shadow-xs"
                      >
                        {/* Top Row: Category, Status, Created Time */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="p-2 rounded-xl flex items-center justify-center shadow-xs"
                              style={{ backgroundColor: report.bg, color: report.color }}
                            >
                              <IconComp size={18} />
                            </div>
                            <div>
                              <span className="text-xs font-bold uppercase tracking-wider text-ink block">
                                {report.label || report.category}
                              </span>
                              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Clock size={10} /> {formattedDate}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {report.status === 'Resolved' ? (
                              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle2 size={13} /> Resolved
                              </span>
                            ) : (
                              <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Active
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h4 className="text-sm font-semibold text-ink leading-snug">
                            {report.title}
                          </h4>
                          {report.description && (
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                              {report.description}
                            </p>
                          )}
                        </div>

                        {/* Address & Confirmations */}
                        <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                          <div className="flex items-center gap-1 truncate max-w-[65%]">
                            <MapPin size={13} className="shrink-0 text-gray-400" />
                            <span className="truncate text-[11px]">{report.address || 'Reported on Map'}</span>
                          </div>

                          <div className="flex items-center gap-1 font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg text-[11px]">
                            <ThumbsUp size={12} />
                            <span>{report.confirmations || 0} confirmations</span>
                          </div>
                        </div>

                        {/* Actions Row */}
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                          <button
                            onClick={() => handleLocateOnMap(report)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-ink rounded-xl text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <ExternalLink size={12} /> View on Map
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleIssueStatus(report.id, report.status)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                                report.status === 'Resolved'
                                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              <RefreshCw size={12} />
                              {report.status === 'Resolved' ? 'Reopen Issue' : 'Mark as Resolved'}
                            </button>

                            <button
                              onClick={async () => {
                                if (window.confirm('Are you sure you want to delete this report permanently from the database?')) {
                                  await removeIssue(report.id);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                              title="Delete report"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* Footer */}
          {isAuthenticated && (
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                Account: <strong className="text-ink">{user?.email}</strong>
              </span>
              <button
                onClick={() => {
                  closeMyReportsModal();
                  openAuthModal();
                }}
                className="text-ink font-semibold hover:underline cursor-pointer"
              >
                Manage Profile
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
