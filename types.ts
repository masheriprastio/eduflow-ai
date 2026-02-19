
export type Role = 'ADMIN' | 'STUDENT' | 'GUEST';

export interface ClassGroup {
  id: string;
  name: string; // e.g., "10-A", "12-IPA-1"
  description?: string;
}

export interface Student {
  nis: string;
  name: string;
  classes: string[]; // Changed: Array of class names. Empty array = "Unassigned"
  password: string;
  needsPasswordChange?: boolean; // Force password change on first login
  lastLogin?: string; // ISO Date string
  ipAddress?: string; // Simulated IP
  deviceInfo?: string; // Browser/OS info
}

export interface Question {
  id: string;
  type: 'MULTIPLE_CHOICE' | 'ESSAY';
  question: string;
  options?: string[]; // Only for Multiple Choice
  correctAnswer?: string; // For auto-grading or reference
  imageUrl?: string; // URL for image-based questions
}

export interface Quiz {
  title: string;
  duration?: number; // Duration in minutes (Optional, if 0/undefined = no limit)
  quizType?: 'PRACTICE' | 'EXAM'; // New: Practice shows results, Exam hides them
  startDate?: string; // ISO Date String (When exam opens)
  endDate?: string;   // ISO Date String (Deadline)
  questions: Question[];
}

export interface StudentAnswer {
  questionId: string;
  questionText: string;
  type: 'MULTIPLE_CHOICE' | 'ESSAY';
  studentAnswer: string;
  correctAnswer?: string;
  score: number;    // Score given for this specific question
  maxScore: number; // Max possible score for this question (e.g., 10 or 20)
}

export interface QuizResult {
  id: string;
  studentName: string;
  studentNis: string;
  moduleTitle: string;
  quizTitle: string;
  score: number; // Final calculated score (0-100)
  submittedAt: string;
  answers: StudentAnswer[]; // Detailed breakdown
  violations?: number; // Track cheating attempts
  isDisqualified?: boolean;
  isHidden?: boolean; // If true, student cannot see details yet
}

// New Interface for Manual Daily Grades (Tugas, PR, Keaktifan)
export interface ManualGrade {
  id: string;
  studentNis: string;
  moduleId: string; // Linked to Module ID
  title: string; // Automatically populated from Module Title
  score: number;
  date: string;
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl?: string; 
  fileName?: string;
  uploadDate: string;
  aiSummary?: string;
  tags: string[];
  targetClasses?: string[]; // List of classes that can access this module (e.g. ['10-A', '11-B'])
  quiz?: Quiz; // Optional quiz attached to module
}

export enum ModuleCategory {
  MATHEMATICS = 'Matematika',
  SCIENCE = 'Sains',
  HISTORY = 'Sejarah',
  LITERATURE = 'Bahasa & Sastra',
  TECHNOLOGY = 'Teknologi',
  ART = 'Seni & Budaya'
}