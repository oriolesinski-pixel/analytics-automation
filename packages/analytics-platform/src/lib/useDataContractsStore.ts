import { create } from 'zustand';

interface Field {
  id: string;
  name: string;
  extraction: {
    source: string;
  };
  sampleValues: string[];
}

interface Event {
  id: string;
  name: string;
  trigger: {
    description: string;
    selector: string;
    type: string;
  };
  frequency: string;
  fields: Field[];
  sampleEvents: any[];
  components: string[];
}

interface Page {
  id: string;
  path: string;
  components: string[];
  eventCount: number;
}

interface PullRequest {
  id: string;
  number: number;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  branch: string;
  githubUrl: string;
  filesChanged: {
    path: string;
    additions: number;
    deletions: number;
    diff: string;
  }[];
  checks: {
    name: string;
    status: 'passed' | 'running' | 'failed';
    duration: string;
  }[];
  canMerge: boolean;
  blockingReason?: string;
}

interface Deployment {
  id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  steps: {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    duration?: number;
  }[];
  oldVersion: string;
  newVersion: string;
  oldEventCount: number;
  newEventCount: number;
  firstEventTime?: string;
}

interface DataContractsState {
  // Navigation state
  selectedPageId: string | null;
  setSelectedPageId: (id: string | null) => void;

  // Events state
  editingEvent: Event | null;
  setEditingEvent: (event: Event | null) => void;

  // Preview state
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  previewData: {
    addedFields: string[];
    modifiedFields: string[];
    affectedDashboards: string[];
    eventFrequency: string;
    schemaDiff: any;
  } | null;
  setPreviewData: (data: any) => void;

  // PR state
  showCreatePR: boolean;
  setShowCreatePR: (show: boolean) => void;
  prTitle: string;
  setPRTitle: (title: string) => void;
  prDescription: string;
  setPRDescription: (description: string) => void;
  currentPR: PullRequest | null;
  setCurrentPR: (pr: PullRequest | null) => void;

  // Merge state
  showMergeConfirm: boolean;
  setShowMergeConfirm: (show: boolean) => void;
  mergeStrategy: 'squash' | 'merge';
  setMergeStrategy: (strategy: 'squash' | 'merge') => void;
  commitMessage: string;
  setCommitMessage: (message: string) => void;

  // Deployment state
  deploymentInProgress: boolean;
  setDeploymentInProgress: (inProgress: boolean) => void;
  currentDeployment: Deployment | null;
  setCurrentDeployment: (deployment: Deployment | null) => void;

  // Schema info
  schemaVersion: string;
  setSchemaVersion: (version: string) => void;
  lastUpdated: string;
  setLastUpdated: (date: string) => void;

  // Test state
  testHTML: string;
  setTestHTML: (html: string) => void;
  testResult: any;
  setTestResult: (result: any) => void;
}

export const useDataContractsStore = create<DataContractsState>((set) => ({
  // Navigation state
  selectedPageId: null,
  setSelectedPageId: (id) => set({ selectedPageId: id }),

  // Events state
  editingEvent: null,
  setEditingEvent: (event) => set({ editingEvent: event }),

  // Preview state
  showPreview: false,
  setShowPreview: (show) => set({ showPreview: show }),
  previewData: null,
  setPreviewData: (data) => set({ previewData: data }),

  // PR state
  showCreatePR: false,
  setShowCreatePR: (show) => set({ showCreatePR: show }),
  prTitle: '',
  setPRTitle: (title) => set({ prTitle: title }),
  prDescription: '',
  setPRDescription: (description) => set({ prDescription: description }),
  currentPR: null,
  setCurrentPR: (pr) => set({ currentPR: pr }),

  // Merge state
  showMergeConfirm: false,
  setShowMergeConfirm: (show) => set({ showMergeConfirm: show }),
  mergeStrategy: 'squash',
  setMergeStrategy: (strategy) => set({ mergeStrategy: strategy }),
  commitMessage: '',
  setCommitMessage: (message) => set({ commitMessage: message }),

  // Deployment state
  deploymentInProgress: false,
  setDeploymentInProgress: (inProgress) => set({ deploymentInProgress: inProgress }),
  currentDeployment: null,
  setCurrentDeployment: (deployment) => set({ currentDeployment: deployment }),

  // Schema info
  schemaVersion: '1.0.0',
  setSchemaVersion: (version) => set({ schemaVersion: version }),
  lastUpdated: new Date().toISOString(),
  setLastUpdated: (date) => set({ lastUpdated: date }),

  // Test state
  testHTML: '',
  setTestHTML: (html) => set({ testHTML: html }),
  testResult: null,
  setTestResult: (result) => set({ testResult: result }),
}));

