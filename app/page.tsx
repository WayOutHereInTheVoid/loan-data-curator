'use client'

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, Heart, Trash2, MessageSquare, RotateCcw, BarChart3, AlertCircle, CheckCircle } from 'lucide-react';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ueedkletrkemdrxbixpu.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZWRrbGV0cmtlbWRyeGJpeHB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4NTczMjYsImV4cCI6MjA1MTQzMzMyNn0.Js8dQBEPxNuFxv7vxRBcOLEz-GVfXMKJHO3sEMTFGUk';
const supabase = createClient(supabaseUrl, supabaseKey);

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
      // First get total count for proper pagination
      const { count, error: countError } = await supabase
        .from('DataPts')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        throw countError;
      }

      console.log(`Loading all ${count} records...`);

      // Load ALL records by setting a high limit and proper range
      let query = supabase
        .from('DataPts')
        .select('*')
        .range(0, Math.max(count || 2000, 2000)); // Ensure we get all records
      
      if (selectedCategory !== 'all') {
        query = query.eq('Category', selectedCategory);
      }
      
      // Prioritize pending records first, then reviewed ones
      const { data, error } = await query
        .order('status', { ascending: true }) // pending comes before others alphabetically
        .order('Key', { ascending: true });
      
      if (error) {
        throw error;
      }
      
      console.log(`Loaded ${data?.length || 0} data points`);
      
      // Separate pending and reviewed records
      const pendingRecords = data?.filter(item => !item.status || item.status === 'pending') || [];
      const reviewedRecords = data?.filter(item => item.status && item.status !== 'pending') || [];
      
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
      // Load ALL records for accurate statistics
      const { data, error } = await supabase
        .from('DataPts')
        .select('status')
        .range(0, 5000); // Ensure we get all records for stats
      
      if (error) {
        throw error;
      }
      
      const total = data.length;
      const reviewed = data.filter(item => item.status && item.status !== 'pending').length;
      const keep = data.filter(item => item.status === 'keep').length;
      const deleteCount = data.filter(item => item.status === 'delete').length;
      const favorite = data.filter(item => item.status === 'favorite').length;
      
      setStats({ total, reviewed, keep, delete: deleteCount, favorite });
      console.log(`Stats updated: ${total} total, ${reviewed} reviewed`);
      
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('DataPts')
        .select('Category')
        .range(0, 5000) // Get all categories
        .order('Category');
      
      if (error) {
        throw error;
      }
      
      const uniqueCategories = Array.from(new Set(data.map(item => item.Category)));
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
      setErrorMessage(`Failed to save: ${error.message}`);
      
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
      setErrorMessage(`Failed to undo: ${error.message}`);
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading all {stats.total || '1721'} data points...</p>
        </div>
      </div>
    );
  }

  const progressPercentage = stats.total > 0 ? ((stats.reviewed / stats.total) * 100) : 0;
  const currentProgressPercentage = dataPoints.length > 0 ? ((currentIndex / dataPoints.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Header */}
      <div className="max-w-md mx-auto mb-6">
        <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-gray-800">Loan Data Curator</h1>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowStats(!showStats)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <BarChart3 size={20} />
              </button>
              <button
                onClick={undoLastAction}
                disabled={actionHistory.length === 0 || updateStatus === 'saving'}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <RotateCcw size={20} />
              </button>
            </div>
          </div>
          
          {/* Update Status */}
          {updateStatus !== 'idle' && (
            <div className={`mb-4 p-2 rounded-lg flex items-center gap-2 text-sm ${
              updateStatus === 'saving' ? 'bg-blue-50 text-blue-600' :
              updateStatus === 'success' ? 'bg-green-50 text-green-600' :
              'bg-red-50 text-red-600'
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
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Overall Progress</span>
              <span>{stats.reviewed} of {stats.total} reviewed</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Current Session Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Current View</span>
              <span>{currentIndex + 1} of {dataPoints.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${currentProgressPercentage}%` }}
              ></div>
            </div>
          </div>
          
          <div className="flex justify-between text-sm text-gray-600">
            <span>{Math.round(progressPercentage)}% complete overall</span>
            <span>{stats.total - stats.reviewed} remaining</span>
          </div>
          
          {/* Category Filter */}
          <div className="mt-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
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
                <div className="font-semibold text-green-600">{stats.keep}</div>
                <div className="text-gray-600">Keep</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-red-600">{stats.delete}</div>
                <div className="text-gray-600">Delete</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-purple-600">{stats.favorite}</div>
                <div className="text-gray-600">Favorites</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-600">{stats.total - stats.reviewed}</div>
                <div className="text-gray-600">Pending</div>
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
            className={`bg-white rounded-xl shadow-xl p-6 border border-gray-200 transform transition-transform duration-200 ${
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
              <div className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium mb-4">
                {currentDataPoint.Category}
              </div>
              
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                {currentDataPoint["Data Point"]}
              </h2>
              
              <p className="text-gray-600 mb-2 text-sm">
                Key: {currentDataPoint.Key}
              </p>
              
              {currentDataPoint.status && currentDataPoint.status !== 'pending' && (
                <p className="text-sm mb-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    currentDataPoint.status === 'keep' ? 'bg-green-100 text-green-800' :
                    currentDataPoint.status === 'delete' ? 'bg-red-100 text-red-800' :
                    currentDataPoint.status === 'favorite' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
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
              className="p-3 rounded-xl border-2 text-red-600 bg-red-50 border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <Trash2 size={24} className="mx-auto" />
            </button>
            <button
              onClick={() => handleAction('notes')}
              disabled={updateStatus === 'saving'}
              className="p-3 rounded-xl border-2 text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <MessageSquare size={24} className="mx-auto" />
            </button>
            <button
              onClick={() => handleAction('favorite')}
              disabled={updateStatus === 'saving'}
              className="p-3 rounded-xl border-2 text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              <Heart size={24} className="mx-auto" />
            </button>
            <button
              onClick={() => handleAction('keep')}
              disabled={updateStatus === 'saving'}
              className="p-3 rounded-xl border-2 text-green-600 bg-green-50 border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              <ChevronRight size={24} className="mx-auto" />
            </button>
          </div>
          
          {/* Navigation */}
          <div className="flex justify-center space-x-4 mt-4">
            <button
              onClick={previousDataPoint}
              disabled={currentIndex === 0 || updateStatus === 'saving'}
              className="p-2 text-gray-600 hover:bg-white hover:shadow-md rounded-lg transition-all disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextDataPoint}
              disabled={currentIndex >= dataPoints.length - 1 || updateStatus === 'saving'}
              className="p-2 text-gray-600 hover:bg-white hover:shadow-md rounded-lg transition-all disabled:opacity-50"
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
          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Section Complete!</h2>
            <p className="text-gray-600 mb-6">
              You've finished this view. {stats.total - stats.reviewed} records remaining overall.
            </p>
            <div className="grid grid-cols-3 gap-4 text-sm mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.keep}</div>
                <div className="text-gray-600">Kept</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.favorite}</div>
                <div className="text-gray-600">Favorites</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.delete}</div>
                <div className="text-gray-600">Deleted</div>
              </div>
            </div>
            {stats.total - stats.reviewed > 0 && (
              <button
                onClick={() => window.location.reload()}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Continue with Remaining Records
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Add Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter your notes about this data point..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none"
              rows={4}
              autoFocus
            />
            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => setShowNotes(false)}
                className="flex-1 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNotesSubmit}
                disabled={updateStatus === 'saving'}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
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