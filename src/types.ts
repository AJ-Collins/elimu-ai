export interface SavedResponse {
  id: string;
  question: string;
  response: string;
  subject: string;
  level: string;
  languageMode: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  subject?: string;
  level?: string;
  languageMode?: string;
  timestamp: number;
}

export type Subject = 'Mathematics' | 'Physics' | 'Chemistry' | 'Biology' | 'Computer Science';
export type Level = 'Class 7-8' | 'Form 1-2' | 'Form 3-4' | 'University';
export type Language = 'English' | 'Swahili' | 'Sheng';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type QuestionType = 'Multiple Choice' | 'Short Answer' | 'True or False' | 'Fill in the Blank' | 'Long Answer / Essay';

export interface PracticeSet {
  id: string;
  subject: Subject;
  topic: string;
  level: Level;
  difficulty: Difficulty;
  numQuestions: number;
  questionTypes: QuestionType[];
  includeAnswers: boolean;
  content: string;
  timestamp: number;
}

export interface TopicStatus {
  status: 'Not Started' | 'In Progress' | 'Mastered';
  isBookmarked: boolean;
  difficulty?: 'Easy' | 'Moderate' | 'Hard';
}

export interface CurriculumState {
  [topicId: string]: TopicStatus;
}

export interface MiniTestResult {
  topicId: string;
  topicName: string;
  score: number;
  total: number;
  timestamp: number;
}
