'use client'

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, Heart, Trash2, MessageSquare, RotateCcw, BarChart3, AlertCircle, CheckCircle } from 'lucide-react';

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
  notes?: string;
  reviewed_at?: string;
}

export default function LoanDataCurator() {
  const [currentDataPoint, setCurrentDataPoint] = useState<DataPoint | null>(null);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState({ total: 0, reviewed: 0, keep: 0, delete: 0, favorite: 0 });
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
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
  }, [selectedCategory]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch all data points using pagination
      let allData: DataPoint[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      console.log('Loading all records...');

      while (hasMore) {
        let query = supabase
          .from('DataPts')
          .select('*');

        if (selectedCategory !== 'all') {
          query = query.eq('Category', selectedCategory);
        }

        const { data, error } = await query
          .order('status', { ascending: true }) // pending comes before others
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
      
      console.log(`Loaded ${allData.length} data points`);
      
      // Separate pending and reviewed records
      const pendingRecords = allData.filter(item => !item.status || item.status === 'pending');
      const reviewedRecords = allData.filter(item => item.status && item.status !== 'pending');
      
      // Put pending records first so user continues from unprocessed items
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
      // Get the total count first for accuracy
      const { count, error: countError } = await supabase
        .from('DataPts')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        throw countError;
      }

      // Fetch all status data using pagination for accurate stats
      let allStatusData: { status: string }[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while(hasMore) {
        const { data, error } = await supabase
          .from('DataPts')
          .select('status')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          allStatusData = [...allStatusData, ...data];
          page++;
        } else {
          hasMore = false;
        }
      }
      
      const total = count || 0;
      const reviewed = allStatusData.filter(item => item.status && item.status !== 'pending').length;
      const keep = allStatusData.filter(item => item.status === 'keep').length;
      const deleteCount = allStatusData.filter(item => item.status === 'delete').length;
      const favorite = allStatusData.filter(item => item.status === 'favorite').length;
      
      setStats({ total, reviewed, keep, delete: deleteCount, favorite });
      console.log(`Stats updated: ${total} total, ${reviewed} reviewed`);
      
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadCategories = async () => {
    try {
      // Fetch all categories using pagination
      let allCategoryData: { Category: string }[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while(hasMore) {
        const { data, error } = await supabase
          .from('DataPts')
          .select('Category')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          allCategoryData = [...allCategoryData, ...data];
          page++;
        } else {
          hasMore = false;
        }
      }
      
      const uniqueCategories = Array.from(new Set(allCategoryData.map(item => item.Category))).sort();
      setCategories(uniqueCategories);
      
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const updateDataPoint = async (status: string, noteText = '') => {
    if (!currentDataPoint) return;
    
    setUpdateStatus('saving');
    
    try {
      const updateData = {
        status,
        reviewed_at: new Date().toISOString(),
        ...(noteText && { notes: noteText })
      };
      
      console.log(`Updating ${currentDataPoint.Key} to status: ${status}`);
      
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
          previousStatus: currentDataPoint.status, 
          newStatus: status,
          index: currentIndex 
        }
      ]);
      
      // Update the current dataPoint's status in state
      setCurrentDataPoint(prev => prev ? { ...prev, status } : null);
      
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
      // All items reviewed in current view
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
    if (updateStatus === 'saving') return; // Prevent multiple saves
    
    switch (action) {
      case 'keep':
        updateDataPoint('keep');
        break;
      case 'delete':
        updateDataPoint('delete');
        break;
      case 'favorite':
        updateDataPoint('favorite');
        break;
      case 'notes':
        setShowNotes(true);
        break;
    }
  };

  const handleNotesSubmit = () => {
    updateDataPoint('keep', notes);
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
          status: lastAction.previousStatus || 'pending',
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
          handleAction('keep'); // Swipe right = keep
        } else {
          handleAction('delete'); // Swipe left = delete
        }
      } else {
        // Vertical swipe
        if (y < 0) {
          handleAction('favorite'); // Swipe up = favorite
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
        case 'k':
          handleAction('keep');
          break;
        case 'd':
          handleAction('delete');
          break;
        case 'f':
          handleAction('favorite');
          break;
        case 'n':
          handleAction('notes');
          break;
        case 'u':
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading all {stats.total || '1721'} data points...</p>
        </div>
      </div>
    );
  }

  const progressPercentage = stats.total > 0 ? ((stats.reviewed / stats.total) * 100) : 0;
  const currentProgressPercentage = dataPoints.length > 0 ? ((currentIndex / dataPoints.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 p-4">
      {/* Header */}
      <div className="max-w-md mx-auto mb-6">
        <div className="bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-gray-100">Loan Data Curator</h1>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowStats(!showStats)}
                className="p-2 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <BarChart3 size={20} />
              </button>
              <button
                onClick={undoLastAction}
                disabled={actionHistory.length === 0 || updateStatus === 'saving'}
                className="p-2 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
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
          
          {/* Overall Progress Bar */}
          <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Overall Progress</span>
              <span>{stats.reviewed} of {stats.total} reviewed</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Current Session Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Current View</span>
              <span>{currentIndex + 1} of {dataPoints.length}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${currentProgressPercentage}%` }}
              ></div>
            </div>
          </div>
          
          <div className="flex justify-between text-sm text-gray-400">
            <span>{Math.round(progressPercentage)}% complete overall</span>
            <span>{stats.total - stats.reviewed} remaining</span>
          </div>
          
          {/* Category Filter */}
          <div className="mt-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-200"
              disabled={updateStatus === 'saving'}
            >
              <option value="all">All Categories ({stats.total} total)</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          {/* Stats */}
          {showStats && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="text-center">
                <div className="font-semibold text-green-400">{stats.keep}</div>
                <div className="text-gray-400">Keep</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-red-400">{stats.delete}</div>
                <div className="text-gray-400">Delete</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-purple-400">{stats.favorite}</div>
                <div className="text-gray-400">Favorites</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-400">{stats.total - stats.reviewed}</div>
                <div className="text-gray-400">Pending</div>
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
            className={`bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700 transform transition-transform duration-200 ${
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
              <div className="inline-block px-3 py-1 bg-indigo-900/80 text-indigo-300 rounded-full text-sm font-medium mb-4">
                {currentDataPoint.Category}
              </div>
              
              <h2 className="text-xl font-bold text-gray-100 mb-2">
                {currentDataPoint["Data Point"]}
              </h2>
              
              <p className="text-gray-400 mb-2 text-sm">
                Key: {currentDataPoint.Key}
              </p>
              
              {currentDataPoint.status && currentDataPoint.status !== 'pending' && (
                <p className="text-sm mb-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    currentDataPoint.status === 'keep' ? 'bg-green-900/80 text-green-300' :
                    currentDataPoint.status === 'delete' ? 'bg-red-900/80 text-red-300' :
                    currentDataPoint.status === 'favorite' ? 'bg-purple-900/80 text-purple-300' :
                    'bg-gray-700 text-gray-300'
                  }`}>
                    Already: {currentDataPoint.status}
                  </span>
                </p>
              )}
              
              {/* Swipe Hints */}
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-6">
                <div className="text-left">← Delete</div>
                <div className="text-right">Keep →</div>
                <div className="text-left">↓ Notes</div>
                <div className="text-right">↑ Favorite</div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="grid grid-cols-4 gap-3 mt-6">
            <button
              onClick={() => handleAction('delete')}
              disabled={updateStatus === 'saving'}
              className="p-3 rounded-xl border-2 text-red-400 bg-red-900/50 border-red-700 hover:bg-red-900 transition-colors disabled:opacity-50"
            >
              <Trash2 size={24} className="mx-auto" />
            </button>
            <button
              onClick={() => handleAction('notes')}
              disabled={updateStatus === 'saving'}
              className="p-3 rounded-xl border-2 text-blue-400 bg-blue-900/50 border-blue-700 hover:bg-blue-900 transition-colors disabled:opacity-50"
            >
              <MessageSquare size={24} className="mx-auto" />
            </button>
            <button
              onClick={() => handleAction('favorite')}
              disabled={updateStatus === 'saving'}
              className="p-3 rounded-xl border-2 text-purple-400 bg-purple-900/50 border-purple-700 hover:bg-purple-900 transition-colors disabled:opacity-50"
            >
              <Heart size={24} className="mx-auto" />
            </button>
            <button
              onClick={() => handleAction('keep')}
              disabled={updateStatus === 'saving'}
              className="p-3 rounded-xl border-2 text-green-400 bg-green-900/50 border-green-700 hover:bg-green-900 transition-colors disabled:opacity-50"
            >
              <ChevronRight size={24} className="mx-auto" />
            </button>
          </div>
          
          {/* Navigation */}
          <div className="flex justify-center space-x-4 mt-4">
            <button
              onClick={previousDataPoint}
              disabled={currentIndex === 0 || updateStatus === 'saving'}
              className="p-2 text-gray-400 hover:bg-gray-700 hover:shadow-lg rounded-lg transition-all disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextDataPoint}
              disabled={currentIndex >= dataPoints.length - 1 || updateStatus === 'saving'}
              className="p-2 text-gray-400 hover:bg-gray-700 hover:shadow-lg rounded-lg transition-all disabled:opacity-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          
          {/* Keyboard Shortcuts */}
          <div className="text-center mt-4 text-xs text-gray-500">
            Shortcuts: K=Keep, D=Delete, F=Favorite, N=Notes, U=Undo
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto text-center">
          <div className="bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-700">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-100 mb-2">Section Complete!</h2>
            <p className="text-gray-400 mb-6">
              You've finished this view. {stats.total - stats.reviewed} records remaining overall.
            </p>
            <div className="grid grid-cols-3 gap-4 text-sm mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{stats.keep}</div>
                <div className="text-gray-400">Kept</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{stats.favorite}</div>
                <div className="text-gray-400">Favorites</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{stats.delete}</div>
                <div className="text-gray-400">Deleted</div>
              </div>
            </div>
            {stats.total - stats.reviewed > 0 && (
              <button
                onClick={() => window.location.reload()}
                className="bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 transition-colors"
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
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm border border-gray-700">
            <h3 className="text-lg font-bold text-gray-100 mb-4">Add Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter your notes about this data point..."
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg resize-none text-gray-200"
              rows={4}
              autoFocus
            />
            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => setShowNotes(false)}
                className="flex-1 py-2 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNotesSubmit}
                disabled={updateStatus === 'saving'}
                className="flex-1 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                Save & Keep
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
