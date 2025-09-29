// components/RecursiveDirectoryTree.tsx
'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Loader2, FolderOpen, Package, FileCode2, CheckCircle2 } from 'lucide-react';

// Type definitions
export interface DirectoryItem {
  name: string;
  path: string;
  type: 'dir';
  hasPackageJson?: boolean;
  hasFrontendFiles?: boolean;
  framework?: string;
  description?: string;
  scripts?: Record<string, string>;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  private: boolean;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  default_branch: string;
  permissions?: any;
}

interface SelectedPath {
  repo: Repository;
  item: DirectoryItem;
}

interface RecursiveDirectoryTreeProps {
  repositories: Repository[];
  searchQuery: string;
  selectedPath: SelectedPath | null;
  onSelectPath: (path: SelectedPath | null) => void;
  onAnalyze: () => void;
  onBack: () => void;
  loading?: boolean;
}

export function RecursiveDirectoryTree({
  repositories,
  searchQuery,
  selectedPath,
  onSelectPath,
  onAnalyze,
  onBack,
  loading = false
}: RecursiveDirectoryTreeProps) {
  // State for tree management
  const [directoryTree, setDirectoryTree] = useState<Record<string, DirectoryItem[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Fetch directory contents at any depth
  const fetchDirectoryContents = async (repo: Repository, dirPath: string = '') => {
    const pathKey = `${repo.id}:${dirPath}`;
    