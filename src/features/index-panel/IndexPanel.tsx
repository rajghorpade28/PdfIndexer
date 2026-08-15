import React, { useState } from 'react';
import type { Topic } from '../../types';
import { ChevronRight, ChevronDown, FileText, Search, Edit2, Trash2, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SearchResult {
  topic: Topic;
  score: number;
}

interface IndexPanelProps {
  topics: Topic[];
  onTopicClick: (pageNumber: number) => void;
  activePage: number;
  onSearch: (query: string) => void;
  searchResults: SearchResult[] | null;
  isSearching: boolean;
  onRenameTopic: (id: string, newTitle: string) => void;
  onDeleteTopic: (id: string) => void;
}

export function IndexPanel({ 
  topics, 
  onTopicClick, 
  activePage, 
  onSearch, 
  searchResults, 
  isSearching,
  onRenameTopic,
  onDeleteTopic
}: IndexPanelProps) {
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  if (!topics || topics.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500 text-sm">
        No topics found in this document.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-slate-200 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Index</h2>
          <button
            onClick={() => setEditMode(!editMode)}
            className={cn(
              "p-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1",
              editMode ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100"
            )}
            title={editMode ? "Done editing" : "Edit Index"}
          >
            {editMode ? <Check className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
            {editMode ? "Done" : "Edit"}
          </button>
        </div>
        
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Semantic search..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-3 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm rounded-lg transition-all outline-none"
          />
          {isSearching && (
            <div className="absolute right-3 top-3">
              <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {searchResults !== null && searchQuery.trim() !== '' ? (
          <div className="space-y-1">
            <div className="px-2 py-1 text-xs font-medium text-slate-500 mb-2">
              Top Matches
            </div>
            {searchResults.length === 0 && !isSearching && (
              <div className="px-2 py-4 text-center text-sm text-slate-500">
                No relevant topics found.
              </div>
            )}
            {searchResults.map((result) => (
              <div
                key={result.topic.id}
                onClick={() => onTopicClick(result.topic.startPage)}
                className="flex flex-col py-2 px-2 rounded-md cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="text-sm text-slate-800 font-medium mb-1 line-clamp-2">
                  {result.topic.title}
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Page {result.topic.startPage} {result.topic.endPage && result.topic.endPage !== result.topic.startPage ? `- ${result.topic.endPage}` : ''}</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px]", 
                    result.score > 0.7 ? "bg-emerald-100 text-emerald-700" :
                    result.score > 0.5 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                  )}>
                    {Math.round(result.score * 100)}% match
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {topics.map(topic => (
              <TopicNode
                key={topic.id}
                topic={topic}
                onTopicClick={onTopicClick}
                activePage={activePage}
                editMode={editMode}
                onRenameTopic={onRenameTopic}
                onDeleteTopic={onDeleteTopic}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TopicNodeProps {
  topic: Topic;
  onTopicClick: (pageNumber: number) => void;
  activePage: number;
  editMode: boolean;
  onRenameTopic: (id: string, title: string) => void;
  onDeleteTopic: (id: string) => void;
}

function TopicNode({ topic, onTopicClick, activePage, editMode, onRenameTopic, onDeleteTopic }: TopicNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(topic.title);
  
  const hasChildren = topic.children && topic.children.length > 0;
  const isActive = activePage >= topic.startPage && (!topic.endPage || activePage <= topic.endPage);

  const handleSave = () => {
    if (editTitle.trim() && editTitle.trim() !== topic.title) {
      onRenameTopic(topic.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="select-none">
      <div 
        className={cn(
          "flex items-center py-1.5 px-2 rounded-md group text-sm transition-colors",
          isActive && !editMode ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-100",
          !editMode && "cursor-pointer"
        )}
        style={{ paddingLeft: `${topic.level * 12 + 8}px` }}
        onClick={(e) => {
          if (!editMode && !isEditing) {
            e.stopPropagation();
            onTopicClick(topic.startPage);
          }
        }}
      >
        <div 
          className="mr-1.5 mt-0.5 shrink-0 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }
          }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <FileText className="w-4 h-4 opacity-40" />
          )}
        </div>
        
        {isEditing ? (
          <div className="flex-1 flex items-center gap-1 mr-2" onClick={e => e.stopPropagation()}>
            <input
              type="text"
              autoFocus
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') {
                  setEditTitle(topic.title);
                  setIsEditing(false);
                }
              }}
              onBlur={handleSave}
              className="w-full px-1.5 py-0.5 text-sm border-blue-500 outline-none ring-1 ring-blue-500 rounded"
            />
          </div>
        ) : (
          <span className="flex-1 truncate pr-2">{topic.title}</span>
        )}
        
        {editMode && !isEditing ? (
          <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              className="p-1 hover:bg-slate-200 hover:text-blue-600 rounded"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDeleteTopic(topic.id); }}
              className="p-1 hover:bg-red-100 hover:text-red-600 rounded text-slate-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          !isEditing && <span className="text-xs text-slate-400 tabular-nums shrink-0">{topic.startPage}</span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-0.5">
          {topic.children.map(child => (
            <TopicNode
              key={child.id}
              topic={child}
              onTopicClick={onTopicClick}
              activePage={activePage}
              editMode={editMode}
              onRenameTopic={onRenameTopic}
              onDeleteTopic={onDeleteTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
}
