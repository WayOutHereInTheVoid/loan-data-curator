'use client'

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, Heart, Trash2, MessageSquare, RotateCcw, BarChart3, AlertCircle, CheckCircle, Search, CheckSquare, X } from 'lucide-react';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ueedkletrkemdrxbixpu.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZWRrbGV0cmtlbWRyeGJpeHB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4NTczMjYsImV4cCI6MjA1MTQzMzMyNn0.Js8dQBEPxNuFxv7vxRBcOLEz-GVfXMKJHO3sEMTFGUk';
const supabase = createClient(supabaseUrl, supabaseKey);

// Utility function to safely extract error messages
const getErrorMessage = (error: unknown): string => {
if (error instanceof Error) {
return error.message;
}
if (typeof error === 'string') {
return error;
}
if (error && typeof error === 'object' && 'message' in error) {
return String(error.message);
}
return 'An unexpected error occurred';
};

interface DataPoint {
Key: string;
Category: string;
'Data Point': string;
status?: string;
review_status?: string;
notes?: string;
reviewed_at?: string;
}

export default function EnhancedLoanDataCurator() {
const [currentDataPoint, setCurrentDataPoint] = useState<DataPoint | null>(null);
const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
const [currentIndex, setCurrentIndex] = useState(0);
const [stats, setStats] = useState({
total: 0,
reviewed: 0,
research_further: 0,
doesnt_work: 0,
use: 0,
pending: 0
});
const [showNotes, setShowNotes] = useState(false);
const [notes, setNotes] = useState('');
const [loading, setLoading] = useState(true);
const [showStats, setShowStats] = useState(false);
const [selectedCategory, setSelectedCategory] = useState('all');
const [statusFilter, setStatusFilter] = useState('all'); // keep, favorite, all
const [categories, setCategories] = useState<string[]>([]);
const [actionHistory, setActionHistory] = useState<any[]>([]);
const [updateStatus, setUpdateStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
const [errorMessage, setErrorMessage] = useState('');
const cardRef = useRef<HTMLDivElement>(null);
const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
const [isDragging, setIsDragging] = useState(false);

// Load data and stats
useEffect(() => {
loadData();
loadStats();
loadCategories();
}, [selectedCategory, statusFilter]);

const loadData = async () => {
setLoading(true);
try {
// Fetch only keep and favorite data points
let allData: DataPoint[] = [];
let page = 0;
const pageSize = 1000;
let hasMore = true;

  console.log('Loading keep and favorite records...');

  while (hasMore) {
    let query = supabase
      .from('DataPts')
      .select('*')
      .in('status', ['keep', 'favorite']); // Only show keep and favorite

    if (selectedCategory !== 'all') {
      query = query.eq('Category', selectedCategory);
    }

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query
      .order('review_status', { ascending: true }) // pending first
      .order('Key', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      page++;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`Loaded ${allData.length} valuable data points`);
  
  // Separate pending and reviewed records for review_status
  const pendingRecords = allData.filter(item => !item.review_status || item.review_status === 'pending');
  const reviewedRecords = allData.filter(item => item.review_status && item.review_status !== 'pending');
  
  // Put pending records first
  const sortedData = [...pendingRecords, ...reviewedRecords];
  
  setDataPoints(sortedData);
  setCurrentIndex(0);
  
  if (sortedData.length > 0) {
    setCurrentDataPoint(sortedData[0]);
  }
  
  console.log(`Prioritized ${pendingRecords.length} pending records first`);
  
} catch (error) {
  console.error('Error loading data:', error);
  setErrorMessage('Failed to load data points. Please refresh the page.');
} finally {
  setLoading(false);
}
};

const loadStats = async () => {
try {
// Get stats for keep and favorite items only
const { data: allData, error } = await supabase
.from('DataPts')
.select('review_status')
.in('status', ['keep', 'favorite']);

  if (error) {
    throw error;
  }
  
  const total = allData?.length || 0;
  const reviewed = allData?.filter(item => item.review_status && item.review_status !== 'pending').length || 0;
  const research_further = allData?.filter(item => item.review_status === 'research_further').length || 0;
  const doesnt_work = allData?.filter(item => item.review_status === 'doesnt_work').length || 0;
  const use = allData?.filter(item => item.review_status === 'use').length || 0;
  const pending = total - reviewed;
  
  setStats({ total, reviewed, research_further, doesnt_work, use, pending });
  console.log(`Stats updated: ${total} total valuable items, ${reviewed} reviewed in phase 2`);
  
} catch (error) {
  console.error('Error loading stats:', error);
}
};

const loadCategories = async () => {
try {
const { data, error } = await supabase
.from('DataPts')
.select('Category')
.in('status', ['keep', 'favorite']);

  if (error) {
    throw error;
  }
  
  const uniqueCategories = Array.from(new Set(data?.map(item => item.Category) || [])).sort();
  setCategories(uniqueCategories);
  
} catch (error) {
  console.error('Error loading categories:', error);
}
};

const updateDataPoint = async (reviewStatus: string, noteText = '') => {
if (!currentDataPoint) return;

setUpdateStatus('saving');

try {
  const updateData = {
    review_status: reviewStatus,
    reviewed_at: new Date().toISOString(),
    ...(noteText && { notes: noteText })
  };
  
  console.log(`Updating ${currentDataPoint.Key} to review_status: ${reviewStatus}`);
  
  const { error } = await supabase
    .from('DataPts')
    .update(updateData)
    .eq('Key', currentDataPoint.Key);
  
  if (error) {
    throw error;
  }
  
  setUpdateStatus('success');
  
  // Add to action history for undo functionality
  setActionHistory(prev => [
    ...prev.slice(-4), // Keep last 4 actions
    { 
      dataPoint: currentDataPoint, 
      previousReviewStatus: currentDataPoint.review_status, 
      newReviewStatus: reviewStatus,
      index: currentIndex 
    }
  ]);
  
  // Update the current dataPoint's review_status in state
  setCurrentDataPoint(prev => prev ? { ...prev, review_status: reviewStatus } : null);
  
  // Move to next item
  nextDataPoint();
  
  // Refresh stats after successful update
  loadStats();
  
  // Clear success message after 2 seconds
  setTimeout(() => {
    setUpdateStatus('idle');
  }, 2000);
  
} catch (error) {
  console.error('Error updating data point:', error);
  setUpdateStatus('error');
  setErrorMessage(`Failed to save: ${getErrorMessage(error)}`);
  
  // Clear error after 5 seconds
  setTimeout(() => {
    setUpdateStatus('idle');
    setErrorMessage('');
  }, 5000);
}
};

const nextDataPoint = () => {
if (currentIndex < dataPoints.length - 1) {
const nextIndex = currentIndex + 1;
setCurrentIndex(nextIndex);
setCurrentDataPoint(dataPoints[nextIndex]);
} else {
setCurrentDataPoint(null);
}
};

const previousDataPoint = () => {
if (currentIndex > 0) {
const prevIndex = currentIndex - 1;
setCurrentIndex(prevIndex);
setCurrentDataPoint(dataPoints[prevIndex]);
}
};

const handleAction = (action: string) => {
if (updateStatus === 'saving') return;

switch (action) {
  case 'use':
    updateDataPoint('use');
    break;
  case 'doesnt_work':
    updateDataPoint('doesnt_work');
    break;
  case 'research_further':
    updateDataPoint('research_further');
    break;
  case 'notes':
    setShowNotes(true);
    break;
}
};

const handleNotesSubmit = () => {
updateDataPoint('research_further', notes);
setShowNotes(false);
setNotes('');
};

const undoLastAction = async () => {
if (actionHistory.length === 0 || updateStatus === 'saving') return;

const lastAction = actionHistory[actionHistory.length - 1];

setUpdateStatus('saving');

try {
  const { error } = await supabase
    .from('DataPts')
    .update({ 
      review_status: lastAction.previousReviewStatus || 'pending',
      reviewed_at: null,
      notes: null 
    })
    .eq('Key', lastAction.dataPoint.Key);
  
  if (error) {
    throw error;
  }
  
  setUpdateStatus('success');
  
  // Remove from history
  setActionHistory(prev => prev.slice(0, -1));
  
  // Go back to that item
  setCurrentIndex(lastAction.index);
  setCurrentDataPoint(lastAction.dataPoint);
  
  // Refresh stats
  loadStats();
  
  setTimeout(() => setUpdateStatus('idle'), 1000);
  
} catch (error) {
  console.error('Error undoing action:', error);
  setUpdateStatus('error');
  setErrorMessage(`Failed to undo: ${getErrorMessage(error)}`);
  setTimeout(() => {
    setUpdateStatus('idle');
    setErrorMessage('');
  }, 5000);
}
};

// Touch/Mouse handlers for swipe functionality
const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
if (updateStatus === 'saving') return;
const point = 'touches' in e ? e.touches[0] : e;
setDragStart({ x: point.clientX, y: point.clientY });
setIsDragging(true);
};

const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
if (!isDragging || updateStatus === 'saving') return;
e.preventDefault();

const point = 'touches' in e ? e.touches[0] : e;
const deltaX = point.clientX - dragStart.x;
const deltaY = point.clientY - dragStart.y;

setDragOffset({ x: deltaX, y: deltaY });
};

const handleEnd = () => {
if (!isDragging) return;
setIsDragging(false);

const threshold = 100;
const { x, y } = dragOffset;

if (Math.abs(x) > threshold || Math.abs(y) > threshold) {
  if (Math.abs(x) > Math.abs(y)) {
    // Horizontal swipe
    if (x > 0) {
      handleAction('use'); // Swipe right = use
    } else {
      handleAction('doesnt_work'); // Swipe left = doesn't work
    }
  } else {
    // Vertical swipe
    if (y < 0) {
      handleAction('research_further'); // Swipe up = research further
    } else {
      handleAction('notes'); // Swipe down = notes
    }
  }
}

setDragOffset({ x: 0, y: 0 });
};

// Keyboard shortcuts
useEffect(() => {
const handleKeyPress = (e: KeyboardEvent) => {
if (showNotes || updateStatus === 'saving') return;

  switch (e.key.toLowerCase()) {
    case 'u':
      if (e.ctrlKey || e.metaKey) return; // Don't interfere with browser undo
      handleAction('use');
      break;
    case 'd':
      handleAction('doesnt_work');
      break;
    case 'r':
      handleAction('research_further');
      break;
    case 'n':
      handleAction('notes');
      break;
    case 'z':
      if (e.ctrlKey || e.metaKey) return; // Don't interfere with browser undo
      undoLastAction();
      break;
    case 'arrowleft':
      previousDataPoint();
      break;
    case 'arrowright':
      nextDataPoint();
      break;
  }
};

window.addEventListener('keydown', handleKeyPress);
return () => window.removeEventListener('keydown', handleKeyPress);
}, [showNotes, currentDataPoint, updateStatus]);

if (loading) {
return (
<div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-950 flex items-center justify-center">
<div className="text-center">
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
<p className="text-blue-200">Loading valuable data points…</p>
</div>
</div>
);
}

const progressPercentage = stats.total > 0 ? ((stats.reviewed / stats.total) * 100) : 0;
const currentProgressPercentage = dataPoints.length > 0 ? ((currentIndex / dataPoints.length) * 100) : 0;

return (
<div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-950 p-4">
{/* Header */}
<div className="max-w-md mx-auto mb-6">
<div className="bg-blue-800 rounded-xl shadow-lg p-4 border border-blue-700">
<div className="flex justify-between items-center mb-4">
<div>
<h1 className="text-xl font-bold text-blue-100">Phase 2: Data Review</h1>
<p className="text-sm text-blue-200">Curating valuable data points</p>
</div>
<div className="flex space-x-2">
<button
onClick={() => setShowStats(!showStats)}
className="p-2 text-blue-300 hover:bg-blue-700 rounded-lg transition-colors"
>
<BarChart3 size={20} />
</button>
<button
onClick={undoLastAction}
disabled={actionHistory.length === 0 || updateStatus === 'saving'}
className="p-2 text-blue-300 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
>
<RotateCcw size={20} />
</button>
</div>
</div>

      {/* Update Status */}
      {updateStatus !== 'idle' && (
        <div className={`mb-4 p-2 rounded-lg flex items-center gap-2 text-sm ${
          updateStatus === 'saving' ? 'bg-blue-900/80 text-blue-300' :
          updateStatus === 'success' ? 'bg-green-900/80 text-green-300' :
          'bg-red-900/80 text-red-300'
        }`}>
          {updateStatus === 'saving' && <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />}
          {updateStatus === 'success' && <CheckCircle size={16} />}
          {updateStatus === 'error' && <AlertCircle size={16} />}
          {updateStatus === 'saving' && 'Saving...'}
          {updateStatus === 'success' && 'Saved successfully!'}
          {updateStatus === 'error' && (errorMessage || 'Save failed')}
        </div>
      )}
      
      {/* Progress Bars */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-blue-300 mb-1">
          <span>Phase 2 Progress</span>
          <span>{stats.reviewed} of {stats.total} reviewed</span>
        </div>
        <div className="w-full bg-blue-700 rounded-full h-2 mb-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-blue-300 mb-1">
          <span>Current View</span>
          <span>{currentIndex + 1} of {dataPoints.length}</span>
        </div>
        <div className="w-full bg-blue-700 rounded-full h-2">
          <div
            className="bg-blue-400 h-2 rounded-full transition-all duration-300"
            style={{ width: `${currentProgressPercentage}%` }}
          ></div>
        </div>
      </div>
      
      <div className="flex justify-between text-sm text-blue-300">
        <span>{Math.round(progressPercentage)}% complete</span>
        <span>{stats.pending} remaining</span>
      </div>
      
      {/* Filters */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="p-2 bg-blue-700 border border-blue-600 rounded-lg text-sm text-blue-100"
          disabled={updateStatus === 'saving'}
        >
          <option value="all">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2 bg-blue-700 border border-blue-600 rounded-lg text-sm text-blue-100"
          disabled={updateStatus === 'saving'}
        >
          <option value="all">Keep + Favorite</option>
          <option value="keep">Keep Only</option>
          <option value="favorite">Favorite Only</option>
        </select>
      </div>
      
      {/* Stats */}
      {showStats && (
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="text-center">
            <div className="font-semibold text-green-400">{stats.use}</div>
            <div className="text-blue-300">Use</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-red-400">{stats.doesnt_work}</div>
            <div className="text-blue-300">Doesn't Work</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-yellow-400">{stats.research_further}</div>
            <div className="text-blue-300">Research</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-blue-400">{stats.pending}</div>
            <div className="text-blue-300">Pending</div>
          </div>
        </div>
      )}
    </div>
  </div>

  {/* Main Card */}
  {currentDataPoint ? (
    <div className="max-w-md mx-auto">
      <div
        ref={cardRef}
        className={`bg-blue-800 rounded-xl shadow-xl p-6 border border-blue-700 transform transition-transform duration-200 ${
          updateStatus === 'saving' ? 'opacity-50 cursor-wait' : 'cursor-grab active:cursor-grabbing'
        }`}
        style={{
          transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.1}deg)`,
          opacity: isDragging ? 0.9 : (updateStatus === 'saving' ? 0.7 : 1)
        }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        <div className="text-center">
          <div className="flex justify-center items-center gap-2 mb-4">
            <div className="inline-block px-3 py-1 bg-blue-900/80 text-blue-300 rounded-full text-sm font-medium">
              {currentDataPoint.Category}
            </div>
            <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
              currentDataPoint.status === 'favorite' ? 'bg-purple-900/80 text-purple-300' :
              'bg-green-900/80 text-green-300'
            }`}>
              {currentDataPoint.status}
            </div>
          </div>
          
          <h2 className="text-xl font-bold text-blue-100 mb-2">
            {currentDataPoint["Data Point"]}
          </h2>
          
          <p className="text-blue-300 mb-2 text-sm">
            Key: {currentDataPoint.Key}
          </p>
          
          {currentDataPoint.review_status && currentDataPoint.review_status !== 'pending' && (
            <p className="text-sm mb-4">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                currentDataPoint.review_status === 'use' ? 'bg-green-900/80 text-green-300' :
                currentDataPoint.review_status === 'doesnt_work' ? 'bg-red-900/80 text-red-300' :
                currentDataPoint.review_status === 'research_further' ? 'bg-yellow-900/80 text-yellow-300' :
                'bg-blue-700 text-blue-300'
              }`}>
                Reviewed: {currentDataPoint.review_status?.replace('_', ' ')}
              </span>
            </p>
          )}
          
          {/* Swipe Hints */}
          <div className="grid grid-cols-2 gap-2 text-xs text-blue-400 mb-6">
            <div className="text-left">← Doesn't Work</div>
            <div className="text-right">Use →</div>
            <div className="text-left">↓ Notes</div>
            <div className="text-right">↑ Research</div>
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="grid grid-cols-4 gap-3 mt-6">
        <button
          onClick={() => handleAction('doesnt_work')}
          disabled={updateStatus === 'saving'}
          className="p-3 rounded-xl border-2 text-red-400 bg-red-900/50 border-red-700 hover:bg-red-900 transition-colors disabled:opacity-50"
        >
          <X size={24} className="mx-auto" />
          <div className="text-xs mt-1">Doesn't Work</div>
        </button>
        <button
          onClick={() => handleAction('notes')}
          disabled={updateStatus === 'saving'}
          className="p-3 rounded-xl border-2 text-yellow-400 bg-yellow-900/50 border-yellow-700 hover:bg-yellow-900 transition-colors disabled:opacity-50"
        >
          <MessageSquare size={24} className="mx-auto" />
          <div className="text-xs mt-1">Notes</div>
        </button>
        <button
          onClick={() => handleAction('research_further')}
          disabled={updateStatus === 'saving'}
          className="p-3 rounded-xl border-2 text-orange-400 bg-orange-900/50 border-orange-700 hover:bg-orange-900 transition-colors disabled:opacity-50"
        >
          <Search size={24} className="mx-auto" />
          <div className="text-xs mt-1">Research</div>
        </button>
        <button
          onClick={() => handleAction('use')}
          disabled={updateStatus === 'saving'}
          className="p-3 rounded-xl border-2 text-green-400 bg-green-900/50 border-green-700 hover:bg-green-900 transition-colors disabled:opacity-50"
        >
          <CheckSquare size={24} className="mx-auto" />
          <div className="text-xs mt-1">Use</div>
        </button>
      </div>
      
      {/* Navigation */}
      <div className="flex justify-center space-x-4 mt-4">
        <button
          onClick={previousDataPoint}
          disabled={currentIndex === 0 || updateStatus === 'saving'}
          className="p-2 text-blue-300 hover:bg-blue-700 hover:shadow-lg rounded-lg transition-all disabled:opacity-50"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={nextDataPoint}
          disabled={currentIndex >= dataPoints.length - 1 || updateStatus === 'saving'}
          className="p-2 text-blue-300 hover:bg-blue-700 hover:shadow-lg rounded-lg transition-all disabled:opacity-50"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      
      {/* Keyboard Shortcuts */}
      <div className="text-center mt-4 text-xs text-blue-400">
        Shortcuts: U=Use, D=Doesn't Work, R=Research, N=Notes, Z=Undo
      </div>
    </div>
  ) : (
    <div className="max-w-md mx-auto text-center">
      <div className="bg-blue-800 rounded-xl shadow-lg p-8 border border-blue-700">
        <div className="text-6xl mb-4">🎯</div>
        <h2 className="text-2xl font-bold text-blue-100 mb-2">Phase 2 Complete!</h2>
        <p className="text-blue-300 mb-6">
          You've reviewed all items in this view. {stats.pending} records remaining overall.
        </p>
        <div className="grid grid-cols-3 gap-4 text-sm mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{stats.use}</div>
            <div className="text-blue-300">Ready to Use</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.research_further}</div>
            <div className="text-blue-300">Need Research</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{stats.doesnt_work}</div>
            <div className="text-blue-300">Won't Work</div>
          </div>
        </div>
        {stats.pending > 0 && (
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Continue with Remaining Records
          </button>
        )}
      </div>
    </div>
  )}

  {/* Notes Modal */}
  {showNotes && (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-blue-800 rounded-xl p-6 w-full max-w-sm border border-blue-700">
        <h3 className="text-lg font-bold text-blue-100 mb-4">Research Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What needs to be researched about this data point?"
          className="w-full p-3 bg-blue-700 border border-blue-600 rounded-lg resize-none text-blue-100"
          rows={4}
          autoFocus
        />
        <div className="flex space-x-3 mt-4">
          <button
            onClick={() => setShowNotes(false)}
            className="flex-1 py-2 text-blue-300 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleNotesSubmit}
            disabled={updateStatus === 'saving'}
            className="flex-1 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            Save & Research
          </button>
        </div>
      </div>
    </div>
  )}
</div>
);
}
