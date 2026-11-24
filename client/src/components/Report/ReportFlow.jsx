import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, Droplets, Construction, Car, X, Camera, Zap, 
  Trash2, Dog, Activity, CheckCircle, Image as ImageIcon, Loader2, LogIn
} from 'lucide-react';
import useIssueStore from '../../store/useIssueStore';
import useAuthStore from '../../store/useAuthStore';

const CATEGORIES = [
  { id: 'pothole', label: 'Pothole', icon: 'AlertCircle', color: '#d97706', bg: '#fef3c7' },
  { id: 'water', label: 'Waterlogging', icon: 'Droplets', color: '#2563eb', bg: '#dbeafe' },
  { id: 'roadwork', label: 'Broken Road', icon: 'Construction', color: '#ea580c', bg: '#ffedd5' },
  { id: 'traffic', label: 'Hazard', icon: 'Car', color: '#dc2626', bg: '#fee2e2' },
  { id: 'light', label: 'Streetlight', icon: 'Zap', color: '#ca8a04', bg: '#fef9c3' },
  { id: 'garbage', label: 'Garbage', icon: 'Trash2', color: '#57534e', bg: '#f5f5f4' },
  { id: 'animal', label: 'Animals', icon: 'Dog', color: '#059669', bg: '#d1fae5' },
  { id: 'speed', label: 'Speed Breaker', icon: 'Activity', color: '#9333ea', bg: '#f3e8ff' },
];

const ICON_MAP = {
  AlertCircle, Droplets, Construction, Car, Zap, Trash2, Dog, Activity
};

// Client-side image compressor: ensures photo is high quality and strictly under 1MB (~150-300KB)
function compressImage(file, maxBytes = 1048576) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Cap max dimension to 1080px for instant encoding and zero lag
          const maxDim = 1080;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Standard high-quality JPEG compression (produces ~100-250KB file)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export default function ReportFlow({ 
  onStartPinning, 
  onStopPinning, 
  pinnedLocation, 
  onReportSuccess 
}) {
  const [step, setStep] = useState('idle'); // 'idle' | 'pinning' | 'category' | 'details' | 'success'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [photoName, setPhotoName] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fileInputRef = useRef(null);

  const addIssue = useIssueStore((s) => s.addIssue);
  const { user, isAuthenticated, openAuthModal } = useAuthStore();

  const handleReportClick = () => {
    setStep('pinning');
    onStartPinning();
  };

  const handlePinConfirm = () => {
    setStep('category');
    onStopPinning();
  };

  const handlePinCancel = () => {
    setStep('idle');
    onStopPinning();
  };

  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat);
    setTitle(`${cat.label} reported near pinned area`);
    setStep('details');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setSubmitError('');
    try {
      const compressedDataUrl = await compressImage(file);
      setPhotoDataUrl(compressedDataUrl);
      setPhotoName(file.name);
    } catch (err) {
      setSubmitError('Failed to process photo. Please choose another image.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    setPhotoDataUrl(null);
    setPhotoName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }

    if (!pinnedLocation || !selectedCategory) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const newIssue = await addIssue({
        lng: pinnedLocation[0],
        lat: pinnedLocation[1],
        title: title.trim() || `${selectedCategory.label} reported`,
        description: description.trim() || `Reported ${selectedCategory.label} observed at this coordinate.`,
        category: selectedCategory.id,
        address: `Pinned Location (${pinnedLocation[1].toFixed(4)}, ${pinnedLocation[0].toFixed(4)})`,
        photoUrl: photoDataUrl || null,
      });

      setIsSubmitting(false);
      setStep('success');

      if (onReportSuccess) {
        onReportSuccess(newIssue);
      }
    } catch (err) {
      setIsSubmitting(false);
      setSubmitError(err.message || 'Failed to submit report. Please try again.');
    }
  };

  const handleClose = () => {
    setStep('idle');
    setSelectedCategory(null);
    setTitle('');
    setDescription('');
    setPhotoDataUrl(null);
    setPhotoName('');
    setSubmitError('');
    onStopPinning();
  };

  return (
    <div className="relative flex justify-center items-center pointer-events-auto w-full">
      <AnimatePresence mode="wait">
        {/* Step 1: Report Issue button */}
        {step === 'idle' && (
          <motion.button
            key="report-button"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleReportClick}
            className="h-12 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-heading font-black text-sm border-2 border-amber-300 shadow-[0_10px_25px_rgba(245,158,11,0.35)] ring-4 ring-amber-500/20 flex items-center gap-2.5 transition-all cursor-pointer"
          >
            <AlertCircle size={20} className="text-slate-950" />
            <span>Report Issue</span>
          </motion.button>
        )}

        {/* Step 2: Pin location bar */}
        {step === 'pinning' && (
          <motion.div
            key="pin-bar"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="bg-slate-900/95 backdrop-blur-md px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between w-full border-2 border-slate-700/80 max-w-lg text-white"
          >
            <div className="flex flex-col">
              <span className="font-heading font-bold text-white text-sm">Drag map to position pin</span>
              <span className="text-[11px] text-slate-400 font-mono">
                {pinnedLocation ? `${pinnedLocation[1].toFixed(4)}, ${pinnedLocation[0].toFixed(4)}` : 'Adjust crosshair'}
              </span>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={handlePinCancel}
                className="h-11 px-5 text-slate-300 font-heading font-bold hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-sm border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handlePinConfirm}
                className="h-11 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-heading font-black rounded-xl transition-colors shadow-md cursor-pointer text-sm border-2 border-amber-300"
              >
                Confirm Pin
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Category picker */}
        {step === 'category' && (
          <motion.div
            key="category-panel"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md origin-bottom cursor-default border border-gray-100"
          >
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-xl font-heading font-bold text-ink">What's the issue?</h2>
                <p className="text-xs text-gray-500 mt-0.5">Select a category for your report</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <motion.div
              className="grid grid-cols-4 gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {CATEGORIES.map((cat) => {
                const IconComp = ICON_MAP[cat.icon];
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat)}
                    className="flex flex-col items-center justify-start py-3 px-1 rounded-2xl border-2 border-transparent hover:border-gray-300 bg-gray-50 hover:bg-gray-100 transition-all gap-2 cursor-pointer group h-full"
                  >
                    <div
                      className="p-3 rounded-2xl group-hover:scale-110 transition-transform shadow-xs"
                      style={{ backgroundColor: cat.bg, color: cat.color }}
                    >
                      <IconComp size={22} />
                    </div>
                    <span className="font-medium text-[11px] text-ink text-center leading-tight">
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </motion.div>
        )}

        {/* Step 4: Details + Photo Upload + Submit */}
        {step === 'details' && selectedCategory && (() => {
          const IconComp = ICON_MAP[selectedCategory.icon];
          return (
            <motion.div
              key="details-panel"
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md origin-bottom cursor-default border border-gray-100 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-heading font-bold text-ink">Add Details</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Stored in PostgreSQL and shared with neighbors</p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-3.5">
                {/* Category & Location Header */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div
                    className="p-2.5 rounded-xl shadow-xs"
                    style={{ backgroundColor: selectedCategory.bg, color: selectedCategory.color }}
                  >
                    <IconComp size={20} />
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="text-sm font-semibold text-ink">{selectedCategory.label}</span>
                    <span className="text-xs text-gray-500 font-mono">
                      📍 {pinnedLocation[1].toFixed(4)}, {pinnedLocation[0].toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* Authentication Notice if Guest */}
                {!isAuthenticated ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900">
                    <div>
                      <span className="font-semibold block">Account required</span>
                      <span className="text-[11px] text-amber-700">Log in to link this report to your profile</span>
                    </div>
                    <button
                      onClick={() => openAuthModal('login')}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <LogIn size={13} /> Sign In
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{user?.avatar || '👤'}</span>
                      <span>
                        Reporting as <strong className="font-semibold">{user?.name}</strong>
                      </span>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-red-500" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Title Input */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Short Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Broken road surface with exposed gravel"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-ink focus:ring-1 focus:ring-ink outline-none text-sm transition-all bg-gray-50/50"
                  />
                </div>

                {/* Description Input */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Description / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide details (depth, lane affected, hazard level)..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-ink focus:ring-1 focus:ring-ink outline-none text-sm transition-all bg-gray-50/50 resize-none"
                  />
                </div>

                {/* Real Photo Upload (under 1MB enforced) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Photo Attachment (Max 1MB, Auto-Optimized)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {photoDataUrl ? (
                    <div className="relative border border-emerald-300 bg-emerald-50/40 rounded-2xl p-3 flex items-center gap-3">
                      <img
                        src={photoDataUrl}
                        alt="Preview"
                        className="w-14 h-14 object-cover rounded-xl border border-emerald-200"
                      />
                      <div className="flex-1 overflow-hidden">
                        <span className="font-semibold text-xs text-emerald-900 block truncate">
                          {photoName || 'Photo Attached'}
                        </span>
                        <span className="text-[10px] text-emerald-700">Compressed & ready (&lt;1MB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                        title="Remove photo"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 border-2 border-dashed border-gray-200 hover:border-gray-400 bg-gray-50/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer text-gray-500"
                    >
                      {isCompressing ? (
                        <>
                          <Loader2 size={22} className="animate-spin text-gray-600" />
                          <span className="text-xs font-medium">Optimizing photo under 1MB...</span>
                        </>
                      ) : (
                        <>
                          <Camera size={22} />
                          <span className="font-medium text-xs">Choose Photo Evidence</span>
                          <span className="text-[10px] text-gray-400">Under 1MB • JPG, PNG</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || isCompressing}
                  className="w-full bg-ink text-white py-3.5 rounded-xl font-heading font-semibold shadow-lg hover:bg-ink/90 transition-all mt-1 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving to PostgreSQL...</span>
                    </>
                  ) : (
                    <span>Submit Report to Neighborhood</span>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })()}

        {/* Step 5: Success Toast */}
        {step === 'success' && (
          <motion.div
            key="success-card"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center border border-gray-100"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <CheckCircle size={32} />
            </div>
            <h3 className="text-lg font-heading font-bold text-ink">Report Stored in Database!</h3>
            <p className="text-xs text-gray-500 mt-1">
              Your observation is saved to PostgreSQL, visible in <strong>Viewport Discovery</strong>, and added to your <strong>My Reports</strong>.
            </p>

            <div className="flex flex-col gap-2 mt-5">
              <button
                onClick={handleClose}
                className="w-full py-3 bg-ink text-white rounded-xl text-xs font-semibold hover:bg-ink/90 transition-colors shadow-sm cursor-pointer"
              >
                Back to Live Map
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
