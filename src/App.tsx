import React, { useState, useCallback, useEffect, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { marked } from 'marked';
import { translations } from './translations';
import { 
  Send, 
  BookOpen, 
  Heart, 
  History, 
  RefreshCcw, 
  Search, 
  Settings, 
  ChevronDown, 
  Brain, 
  Clock,
  Trash2,
  Bookmark,
  Sparkles,
  Zap,
  Mic,
  MicOff,
  Volume2,
  Square,
  Plus,
  Minus,
  CheckCircle2,
  Download,
  ClipboardList
} from 'lucide-react';
import { 
  streamTutorResponse, 
  generateDailyChallenge, 
  generatePracticeSet,
  generateLesson,
  generateTopicSummary,
  generateFormulaSheet,
  generatePastPaperPatterns,
  generateMiniTest
} from './services/geminiService';
import { 
  ChatMessage, 
  SavedResponse, 
  Subject, 
  Level, 
  Language, 
  Difficulty, 
  QuestionType, 
  PracticeSet,
  CurriculumState,
  TopicStatus,
  MiniTestResult
} from './types';
import { syllabusData, Topic, Status } from './syllabusData';

// Set marked options for better rendering
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Utility for formatting time
const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function App() {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    return (localStorage.getItem('elimu-lang') as Language) || 'English';
  });
  const t = translations[currentLanguage];

  const [activeTab, setActiveTab] = useState<'chat' | 'saved' | 'practice' | 'curriculum'>('chat');
  const [question, setQuestion] = useState('');
  const [subject, setSubject] = useState<Subject>('Mathematics');
  const [level, setLevel] = useState<Level>('Form 3-4');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [dailyChallenge, setDailyChallenge] = useState<{question: string, answer: string} | null>(null);
  const [showChallengeAnswer, setShowChallengeAnswer] = useState(false);
  const [savedResponses, setSavedResponses] = useState<SavedResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);

  // Practice module state
  const [practiceTopic, setPracticeTopic] = useState('');
  const [practiceDifficulty, setPracticeDifficulty] = useState<Difficulty>('Medium');
  const [numQuestions, setNumQuestions] = useState(10);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<QuestionType[]>(['Multiple Choice', 'Short Answer']);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [currentPracticeSet, setCurrentPracticeSet] = useState<PracticeSet | null>(null);
  const [practiceHistory, setPracticeHistory] = useState<PracticeSet[]>([]);
  const [isGeneratingPractice, setIsGeneratingPractice] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  // Curriculum state
  const [curriculumView, setCurriculumView] = useState<'grid' | 'topics' | 'content' | 'test'>('grid');
  const [selectedCurriculumSubject, setSelectedCurriculumSubject] = useState<Subject | null>(null);
  const [selectedCurriculumForm, setSelectedCurriculumForm] = useState<1 | 2 | 3 | 4>(3);
  const [curriculumState, setCurriculumState] = useState<CurriculumState>({});
  const [curriculumContent, setCurriculumContent] = useState<{title: string, content: string} | null>(null);
  const [isLoadingCurriculum, setIsLoadingCurriculum] = useState(false);
  
  // Test state
  const [activeTest, setActiveTest] = useState<any[] | null>(null);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [testScore, setTestScore] = useState(0);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testTopicId, setTestTopicId] = useState<string | null>(null);
  
  // Weak areas detection
  const [testHistory, setTestHistory] = useState<MiniTestResult[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = currentLanguage === 'English' ? 'en-KE' : 'sw-KE';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuestion(prev => (prev + ' ' + transcript).trim());
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        if (event.error === 'network') {
          setError(t.network_error);
        } else if (event.error === 'not-allowed') {
          setError(t.microphone_blocked);
        } else {
          setError(`Speech recognition issue: ${event.error}`);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [currentLanguage, t]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        setError(t.microphone_not_supported);
        return;
      }
      try {
        setError(null);
        // Adjust language based on mode
        if (currentLanguage === 'English') {
          recognitionRef.current.lang = 'en-KE';
        } else {
          recognitionRef.current.lang = 'sw-KE';
        }
        
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
        setError(t.mic_start_error);
      }
    }
  };

  const speakText = (text: string, id: string) => {
    if (isSpeaking === id) {
      window.speechSynthesis.cancel();
      setIsSpeaking(null);
      return;
    }

    window.speechSynthesis.cancel();
    
    // Clean text for speech
    let cleanText = text
      .replace(/#{1,6}\s+/g, '') // strip headings
      .replace(/\*\*/g, '') // strip bold
      .replace(/\*/g, '') // strip italics/lists
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // strip links
      .replace(/`/g, '') // strip code
      .replace(/\^2/g, ' squared ')
      .replace(/\^3/g, ' cubed ')
      .replace(/sqrt\(([^)]+)\)/g, ' square root of $1 ')
      .replace(/=>/g, ' therefore ')
      .replace(/\+\-/g, ' plus or minus ')
      .replace(/\//g, ' over ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => setIsSpeaking(null);
    utterance.onerror = () => setIsSpeaking(null);
    utterance.rate = 0.92;
    
    const voices = window.speechSynthesis.getVoices();
    if (currentLanguage !== 'English') {
      const swVoice = voices.find(v => v.lang.startsWith('sw'));
      if (swVoice) utterance.voice = swVoice;
    } else {
      const enVoice = voices.find(v => v.lang.startsWith('en'));
      if (enVoice) utterance.voice = enVoice;
    }

    setIsSpeaking(id);
    window.speechSynthesis.speak(utterance);
  };

  // Load saved data
  useEffect(() => {
    const saved = localStorage.getItem('elimu-saved');
    if (saved) setSavedResponses(JSON.parse(saved));
    
    const curr = localStorage.getItem('elimu-curriculum');
    if (curr) setCurriculumState(JSON.parse(curr));
    
    const th = localStorage.getItem('elimu-test-history');
    if (th) setTestHistory(JSON.parse(th));
    
    const challenge = localStorage.getItem('elimu-daily-challenge');
    const challengeDate = localStorage.getItem('elimu-daily-date');
    const today = new Date().toDateString();

    if (challenge && challengeDate === today) {
      setDailyChallenge(JSON.parse(challenge));
    } else {
      loadDailyChallenge();
    }
  }, [currentLanguage]);

  // Persist progress
  useEffect(() => {
    localStorage.setItem('elimu-curriculum', JSON.stringify(curriculumState));
  }, [curriculumState]);

  useEffect(() => {
    localStorage.setItem('elimu-test-history', JSON.stringify(testHistory));
  }, [testHistory]);

  const loadDailyChallenge = async () => {
    const raw = await generateDailyChallenge(currentLanguage);
    const [q, a] = raw.split('|').map(s => s.trim());
    const data = { question: q || "What is photosynthesis?", answer: a || "The process by which green plants and some other organisms use sunlight to synthesize foods from carbon dioxide and water." };
    setDailyChallenge(data);
    localStorage.setItem('elimu-daily-challenge', JSON.stringify(data));
    localStorage.setItem('elimu-daily-date', new Date().toDateString());
  };

  const handleLessonStart = async (topic: Topic) => {
    setIsLoadingCurriculum(true);
    setCurriculumView('content');
    try {
      const content = await generateLesson(selectedCurriculumSubject!, topic.name, currentLanguage);
      setCurriculumContent({ title: topic.name, content });
    } catch (err) {
      setError("Failed to create lesson.");
    } finally {
      setIsLoadingCurriculum(false);
    }
  };

  const handleSummaryStart = async (topic: Topic) => {
    setIsLoadingCurriculum(true);
    setCurriculumView('content');
    try {
      const content = await generateTopicSummary(selectedCurriculumSubject!, topic.name, currentLanguage);
      setCurriculumContent({ title: `${topic.name} Summary`, content });
    } catch (err) {
      setError("Failed to create summary.");
    } finally {
      setIsLoadingCurriculum(false);
    }
  };

  const handleTestStart = async (topic: Topic) => {
    setIsLoadingCurriculum(true);
    setTestTopicId(topic.id);
    try {
      const questions = await generateMiniTest(selectedCurriculumSubject!, topic.name, `Level ${topic.form}`, currentLanguage);
      setActiveTest(questions);
      setCurrentTestIndex(0);
      setTestScore(0);
      setTestResults([]);
      setCurriculumView('test');
    } catch (err) {
      setError("Failed to generate test.");
    } finally {
      setIsLoadingCurriculum(false);
    }
  };

  const handleTopicStatusCycle = (topicId: string) => {
    setCurriculumState(prev => {
      const current = prev[topicId]?.status || 'Not Started';
      let next: Status = 'Not Started';
      if (current === 'Not Started') next = 'In Progress';
      else if (current === 'In Progress') next = 'Mastered';
      
      return {
        ...prev,
        [topicId]: {
          ...(prev[topicId] || { isBookmarked: false }),
          status: next
        }
      };
    });
  };

  const handleBookmarkToggle = (topicId: string) => {
    setCurriculumState(prev => ({
      ...prev,
      [topicId]: {
        ...(prev[topicId] || { status: 'Not Started' }),
        isBookmarked: !(prev[topicId]?.isBookmarked)
      }
    }));
  };

  const getSubjectProgress = (subject: Subject) => {
    const topics = syllabusData[subject];
    const mastered = topics.filter(t => curriculumState[t.id]?.status === 'Mastered').length;
    return Math.round((mastered / topics.length) * 100);
  };

  const getWeakAreas = () => {
    return testHistory.filter(h => (h.score / h.total) < 0.6);
  };

  const handleFormulaeStart = async () => {
    if (!selectedCurriculumSubject) return;
    setIsLoadingCurriculum(true);
    setCurriculumView('content');
    try {
      const content = await generateFormulaSheet(selectedCurriculumSubject, `Form ${selectedCurriculumForm}`, currentLanguage);
      setCurriculumContent({ title: `${selectedCurriculumSubject} Formulae - Form ${selectedCurriculumForm}`, content });
    } catch (err) {
      setError("Failed to generate formula sheet.");
    } finally {
      setIsLoadingCurriculum(false);
    }
  };

  const handleRevisionPlannerStart = async () => {
    if (!selectedCurriculumSubject) return;
    setIsLoadingCurriculum(true);
    setCurriculumView('content');
    
    const weakAreas = getWeakAreas().map(a => a.topicName).join(', ');
    const bookmarks = (Object.entries(curriculumState) as [string, TopicStatus][])
      .filter(([_, s]) => s.isBookmarked)
      .map(([id, _]) => {
        for (const subjTopics of Object.values(syllabusData)) {
          const found = subjTopics.find(t => t.id === id);
          if (found) return found.name;
        }
        return null;
      }).filter(Boolean).join(', ');

    try {
       // We'll reuse generateLesson or similar, but with a custom prompt if needed.
       // For now, let's just use generateTopicSummary with a "Planner" context
       const content = await generateTopicSummary(selectedCurriculumSubject, `Revision Plan including: ${weakAreas} and ${bookmarks}`, currentLanguage);
       setCurriculumContent({ title: `${selectedCurriculumSubject} Revision Planner`, content });
    } catch (err) {
      setError("Failed to generate plan.");
    } finally {
      setIsLoadingCurriculum(false);
    }
  };

  const handlePastPapersStart = async () => {
    if (!selectedCurriculumSubject) return;
    setIsLoadingCurriculum(true);
    setCurriculumView('content');
    try {
      const content = await generatePastPaperPatterns(selectedCurriculumSubject, `Form ${selectedCurriculumForm}`, currentLanguage);
      setCurriculumContent({ title: `${selectedCurriculumSubject} Past Paper Questions - Form ${selectedCurriculumForm}`, content });
    } catch (err) {
      setError("Failed to generate past paper patterns.");
    } finally {
      setIsLoadingCurriculum(false);
    }
  };

  const handleTestComplete = (score: number, total: number) => {
    const result: MiniTestResult = {
      topicId: testTopicId || 'unknown',
      topicName: curriculumContent?.title || 'Unknown Topic',
      score,
      total,
      timestamp: Date.now()
    };
    setTestHistory(prev => [result, ...prev]);
    setCurriculumView('content');
    setCurriculumContent({ 
      title: 'Test Completed!', 
      content: `### Well Done!\nYou scored **${score} out of ${total}**.\n\n${score === total ? 'Perfect score! You have mastered this topic.' : 'Good job! Review the weak areas mentioned in the feedback to reach 100%.'}`
    });
  };

  const handlePracticeGenerate = async (regenerateSet?: PracticeSet) => {
    if (!regenerateSet && !practiceTopic.trim()) return;
    
    setIsGeneratingPractice(true);
    setError(null);
    
    const targetSet = regenerateSet || {
      subject,
      topic: practiceTopic,
      level,
      difficulty: practiceDifficulty,
      numQuestions,
      questionTypes: selectedQuestionTypes,
      includeAnswers
    };

    try {
      const content = await generatePracticeSet(
        targetSet.subject,
        targetSet.topic,
        targetSet.level,
        targetSet.difficulty,
        targetSet.numQuestions,
        targetSet.questionTypes,
        targetSet.includeAnswers,
        currentLanguage
      );

      const newPracticeSet: PracticeSet = {
        id: Date.now().toString(),
        ...targetSet,
        content,
        timestamp: Date.now()
      };

      setCurrentPracticeSet(newPracticeSet);
      setPracticeHistory(prev => [newPracticeSet, ...prev.slice(0, 9)]);
    } catch (err) {
      setError("Failed to generate questions. Please check your connection and try again.");
    } finally {
      setIsGeneratingPractice(false);
    }
  };

  const cleanTextForPDF = (text: string) => {
    if (!text) return "";
    
    let cleaned = text
      // 1. Strip HTML tags
      .replace(/<[^>]*>/g, '')
      // 2. Convert math symbols to plain text
      .replace(/\^2/g, ' squared')
      .replace(/\^3/g, ' cubed')
      .replace(/sqrt\(([^)]+)\)/g, 'square root of $1')
      .replace(/\\sqrt\{([^\}]+)\}/g, 'square root of $1')
      .replace(/\\frac\{([^\}]+)\}\{([^\}]+)\}/g, '$1 over $2')
      .replace(/\\pm/g, 'plus or minus')
      .replace(/\\times/g, ' x ')
      .replace(/\\cdot/g, ' x ')
      .replace(/\\Rightarrow/g, ' therefore ')
      .replace(/=>/g, ' therefore ')
      .replace(/\+\-/g, ' plus or minus ')
      .replace(/(\d)\s*\*\s*(\d)/g, '$1 x $2')
      // 3. Remove LaTeX notation
      .replace(/\$+/g, '') // Strip $ and $$
      .replace(/\\text\{([^\}]+)\}/g, '$1')
      .replace(/\\[a-zA-Z]+/g, '') // Strip any other \commands
      .replace(/[\{\}]/g, '') // Strip remaining braces
      // 4. Strip Markdown
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/__/g, '')
      .replace(/_/g, '')
      .replace(/^>\s*/gm, '') // Blockquote
      .replace(/`[^`]*`/g, (m) => m.replace(/`/g, '')) // Inline code
      .replace(/---/g, '');

    return cleaned
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n') // Collapse multiple blank lines
      .trim();
  };

  const handleDownloadPDF = (practiceSet: PracticeSet) => {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210
    const pageHeight = doc.internal.pageSize.getHeight(); // 297
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Helpers
    const setBlack = () => doc.setTextColor(0, 0, 0);
    const setGray = () => doc.setTextColor(110, 110, 110);
    const setLightGray = () => doc.setTextColor(210, 210, 210);

    const drawHeader = (isFirstPage: boolean) => {
      const currentY = margin;
      if (isFirstPage) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        setBlack();
        doc.text("ELIMU AI", margin, currentY);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        setGray();
        doc.text("elimuaiai.co.ke", pageWidth - margin, currentY, { align: 'right' });
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        setBlack();
        doc.text(`${practiceSet.subject}: ${practiceSet.topic}`, margin, currentY + 8);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        setGray();
        doc.text(new Date().toLocaleDateString('en-GB'), pageWidth - margin, currentY + 8, { align: 'right' });
        
        doc.text(`${practiceSet.level} | ${practiceSet.difficulty} Difficulty`, margin, currentY + 14);
        
        // Full width line
        doc.setLineWidth(0.5);
        doc.setDrawColor(50, 50, 50);
        doc.line(margin, currentY + 18, pageWidth - margin, currentY + 18);
        
        // Student details
        setBlack();
        doc.setFont("helvetica", "bold");
        doc.text("Name:", margin, currentY + 26);
        doc.setLineWidth(0.2);
        doc.line(margin + 15, currentY + 26, pageWidth - margin, currentY + 26);
        
        doc.text("Class:", margin, currentY + 34);
        doc.line(margin + 15, currentY + 34, pageWidth - margin, currentY + 34);
        
        doc.line(margin, currentY + 39, pageWidth - margin, currentY + 39);
        
        return currentY + 48;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        setGray();
        doc.text(`${practiceSet.subject}: ${practiceSet.topic}`, margin, 10);
        doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - margin, 10, { align: 'right' });
        return margin + 5;
      }
    };

    const drawFooter = (currentPage: number, totalPages: number) => {
      const footerY = pageHeight - 15;
      doc.setLineWidth(0.2);
      doc.setDrawColor(150, 150, 150);
      doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Generated by Elimu AI  •  elimuaiai.co.ke  •  Page ${currentPage} of ${totalPages}`,
        pageWidth / 2,
        footerY,
        { align: 'center' }
      );
    };

    // Parsing content
    const cleanedContent = cleanTextForPDF(practiceSet.content);
    
    // Split into Questions and Answers
    const answerKeywords = ["Answers & Marking Scheme", "Answers", "Majibu", "MARKING SCHEME", "ANSWER KEY"];
    let questionsText = cleanedContent;
    let answersText = "";
    
    for (const keyword of answerKeywords) {
      const index = cleanedContent.toUpperCase().lastIndexOf(keyword.toUpperCase());
      if (index !== -1) {
        questionsText = cleanedContent.substring(0, index).trim();
        answersText = cleanedContent.substring(index).trim();
        break;
      }
    }

    // Identify Sections
    const sectionPattern = /SECTION\s+[I|V|X]+\s*:?\s*[^\n]*/gi;
    const sections: { title: string, content: string }[] = [];
    
    let match;
    let lastIndex = 0;
    const qTextSearch = questionsText;
    while ((match = sectionPattern.exec(qTextSearch)) !== null) {
      if (sections.length > 0) {
        sections[sections.length - 1].content = qTextSearch.substring(lastIndex, match.index).trim();
      }
      sections.push({ title: match[0], content: "" });
      lastIndex = match.index + match[0].length;
    }
    if (sections.length > 0) {
      sections[sections.length - 1].content = qTextSearch.substring(lastIndex).trim();
    } else {
      sections.push({ title: "EXAMINATION QUESTIONS", content: questionsText });
    }

    let y = drawHeader(true);

    sections.forEach((section, sIdx) => {
      if (y + 20 > pageHeight - margin) {
        doc.addPage();
        y = drawHeader(false);
      }
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      setBlack();
      doc.text(section.title.toUpperCase(), pageWidth / 2, y, { align: 'center' });
      const titleWidth = doc.getTextWidth(section.title.toUpperCase());
      doc.setLineWidth(0.3);
      doc.line(pageWidth / 2 - titleWidth / 2, y + 1.5, pageWidth / 2 + titleWidth / 2, y + 1.5);
      y += 12;

      if (sIdx === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        const instrText = "Instructions: Answer all questions. Show your working where applicable.";
        const instrLines = doc.splitTextToSize(instrText, contentWidth - 10);
        doc.text(instrLines, margin + 5, y);
        y += (instrLines.length * 5) + 6;
      }

      // Questions in section
      const qList = section.content.split(/\n(?=\d+\.)/);
      qList.forEach(qRaw => {
        const qClean = qRaw.trim();
        if (!qClean) return;

        const lines = qClean.split('\n');
        const qHeader = lines[0];
        const restLines = lines.slice(1);
        
        const isMCQ = restLines.some(l => l.trim().match(/^[A-D][\.\)]/));
        const spaceNeeded = isMCQ ? 0 : (qClean.length > 300 ? 55 : 35);

        doc.setFontSize(11);
        const qMatch = qHeader.match(/^(\d+)\.(.*)/);
        const qNumText = qMatch ? `${qMatch[1]}.` : "";
        const qContentText = qMatch ? qMatch[2].trim() : qHeader;
        
        const wrappedQ = doc.splitTextToSize(qContentText, contentWidth - 12);
        let qHeight = (wrappedQ.length * 5) + 4;
        
        const wrappedRest: string[][] = [];
        restLines.forEach(rl => {
          const wr = doc.splitTextToSize(rl.trim().replace(/^[A-D][\.\)]\s*/, ''), contentWidth - 22);
          wrappedRest.push(wr);
          qHeight += (wr.length * 5) + 1.5;
        });
        
        qHeight += spaceNeeded + 8;

        if (y + qHeight > pageHeight - margin) {
          doc.addPage();
          y = drawHeader(false);
        }

        // Draw Question Number and Text
        doc.setFont("helvetica", "bold");
        if (qNumText) {
          doc.text(qNumText, margin, y);
        }
        doc.setFont("helvetica", "normal");
        doc.text(wrappedQ, margin + 10, y);
        y += (wrappedQ.length * 5) + 3;

        // Draw Options
        restLines.forEach((rl, rlIdx) => {
          const optMatch = rl.trim().match(/^([A-D])[\.\)](.*)/);
          if (optMatch) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text(`${optMatch[1]}.`, margin + 12, y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.text(wrappedRest[rlIdx], margin + 18, y);
          } else {
            doc.text(wrappedRest[rlIdx], margin + 12, y);
          }
          y += (wrappedRest[rlIdx].length * 5) + 1.5;
        });

        // Draw lines
        if (spaceNeeded > 0) {
          y += 4;
          doc.setLineWidth(0.1);
          doc.setDrawColor(200, 200, 200);
          for (let step = 7; step <= spaceNeeded; step += 7) {
            doc.line(margin + 5, y + step, pageWidth - margin, y + step);
          }
          y += spaceNeeded;
        }

        y += 8;
      });
    });

    // Answers Section
    if (practiceSet.includeAnswers && answersText.trim()) {
      doc.addPage();
      y = drawHeader(false);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      setBlack();
      doc.text("ANSWERS AND MARKING SCHEME", pageWidth / 2, y, { align: 'center' });
      doc.setLineWidth(0.5);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 12;

      // Answers Table-like structure
      doc.setFontSize(10);
      doc.text("Q No.", margin + 2, y);
      doc.text("Answer", margin + 17, y);
      doc.text("Working / Explanation", margin + 52, y);
      doc.line(margin, y - 4, pageWidth - margin, y - 4);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 8;

      const aList = answersText.replace(sectionPattern, '').split(/\n(?=\d+\.)/);
      aList.forEach(aRaw => {
        const aClean = aRaw.trim();
        if (!aClean) return;

        const aMatch = aClean.match(/^(\d+)\.\s*(.*)/s);
        if (!aMatch) return;

        const qNum = aMatch[1];
        const aContent = aMatch[2];
        const contentLines = aContent.split('\n');
        const directAns = contentLines[0].trim();
        const working = contentLines.slice(1).join('\n').trim();

        const wrappedDirect = doc.splitTextToSize(directAns, 30);
        const wrappedWork = doc.splitTextToSize(working || '-', contentWidth - 52);
        
        const rowH = Math.max(wrappedDirect.length * 5, wrappedWork.length * 5) + 6;

        if (y + rowH > pageHeight - margin) {
          doc.addPage();
          y = drawHeader(false) + 10;
        }

        doc.setFont("helvetica", "bold");
        doc.text(qNum, margin + 2, y);
        doc.text(wrappedDirect, margin + 17, y);
        doc.setFont("helvetica", "normal");
        doc.text(wrappedWork, margin + 52, y);
        
        doc.setLineWidth(0.1);
        doc.setDrawColor(180, 180, 180);
        doc.line(margin, y + rowH - 4, pageWidth - margin, y + rowH - 4);
        
        y += rowH;
      });
    }

    // Add footers at the end
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(i, totalPages);
    }

    const cleanS = practiceSet.subject.replace(/[^a-zA-Z0-9]/g, '');
    const cleanT = practiceSet.topic.replace(/[^a-zA-Z0-9]/g, '');
    const cleanL = practiceSet.level.replace(/Form\s*(\d+)/i, 'Form$1').replace(/[^a-zA-Z0-9]/g, '');
    const cleanD = practiceSet.difficulty;
    const dateStr = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date()).replace(/\s+/g, '');
    
    const filename = `${cleanS}-${cleanT}-${cleanL}-${cleanD}-${dateStr}.pdf`;
    doc.save(filename);

    setShowToast(t.pdf_success);
    setTimeout(() => setShowToast(null), 3000);
  };

  const renderMath = () => {
    if ((window as any).renderMathInElement) {
      (window as any).renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ],
        throwOnError: false
      });
    }
  };

  useEffect(() => {
    renderMath();
  }, [messages, currentPracticeSet, activeTab]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!question.trim() || isStreaming) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setQuestion('');
    setIsStreaming(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      subject,
      level,
      languageMode: currentLanguage,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, assistantMsg]);

    try {
      let accumulated = '';
      const stream = streamTutorResponse(question, subject, level, currentLanguage);
      for await (const chunk of stream) {
        accumulated += chunk;
        setMessages(prev => prev.map(m => 
          m.id === assistantMsgId ? { ...m, content: accumulated } : m
        ));
      }
    } catch (err) {
      setError(t.thinking_message);
      setMessages(prev => prev.filter(m => m.id !== assistantMsgId));
    } finally {
      setIsStreaming(false);
    }
  };

  const toggleSave = (msg: ChatMessage) => {
    const isSaved = savedResponses.find(s => s.id === msg.id);
    if (isSaved) {
      const updated = savedResponses.filter(s => s.id !== msg.id);
      setSavedResponses(updated);
      localStorage.setItem('elimu-saved', JSON.stringify(updated));
    } else {
      const newSave: SavedResponse = {
        id: msg.id,
        question: messages.find(m => m.timestamp < msg.timestamp && m.role === 'user')?.content || 'Original question unknown',
        response: msg.content,
        subject: msg.subject || 'General',
        level: msg.level || 'General',
        languageMode: msg.languageMode || 'English',
        timestamp: msg.timestamp
      };
      const updated = [newSave, ...savedResponses];
      setSavedResponses(updated);
      localStorage.setItem('elimu-saved', JSON.stringify(updated));
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-poppins selection:bg-gold/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/40 backdrop-blur-xl px-10 py-4 flex justify-between items-center transition-all">
        <div className="font-oswald font-bold text-2xl uppercase tracking-tighter hover:scale-105 transition-transform cursor-pointer">
          {t.title}
        </div>
        <nav className="hidden md:flex gap-8 text-sm font-poppins font-medium">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`transition-all ${activeTab === 'chat' ? 'text-near-black opacity-100 border-b-2 border-forest pb-1' : 'text-secondary-gray opacity-60 hover:opacity-100'}`}
          >
            {t.chat_tab}
          </button>
          <button 
            onClick={() => setActiveTab('practice')}
            className={`transition-all ${activeTab === 'practice' ? 'text-near-black opacity-100 border-b-2 border-forest pb-1' : 'text-secondary-gray opacity-60 hover:opacity-100'}`}
          >
            {t.practice_tab}
          </button>
          <button 
            onClick={() => setActiveTab('curriculum')}
            className={`transition-all ${activeTab === 'curriculum' ? 'text-near-black opacity-100 border-b-2 border-forest pb-1' : 'text-secondary-gray opacity-60 hover:opacity-100'}`}
          >
            {t.curriculum_tab}
          </button>
          <button 
            onClick={() => setActiveTab('saved')}
            className={`transition-all ${activeTab === 'saved' ? 'text-near-black opacity-100 border-b-2 border-forest pb-1' : 'text-secondary-gray opacity-60 hover:opacity-100'}`}
          >
            {t.saved_tab}
          </button>
        </nav>
        <div className="flex items-center gap-2 text-xs font-poppins font-bold">
          <span className="w-2 h-2 bg-gold rounded-full shadow-[0_0_8px_rgba(249,168,37,0.8)] animate-pulse" />
          {t.header_status}
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-10 pb-20 px-4 text-center">
        <h1 className="font-oswald font-bold text-[72px] text-near-black leading-[1] m-0 uppercase animate-in fade-in slide-in-from-bottom-4 duration-700">
          {t.title}
        </h1>
        <p className="text-lg md:text-xl text-secondary-gray mt-2 font-poppins font-medium max-w-2xl mx-auto opacity-80">
          {t.subtitle}
        </p>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-10 -mt-10 pb-20 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 relative z-10">
        
        {/* Left Column: Input & Responses */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' ? (
              <motion.div 
                key="chat-tab"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Input Card */}
                <div className="card shadow-none border-none">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <span className="font-lato font-bold text-sm text-secondary-gray">{t.ask_label}</span>
                    <div className="bg-gray-100 p-1 rounded-full flex gap-1 relative overflow-hidden">
                      {(['English', 'Swahili', 'Sheng'] as Language[]).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            setCurrentLanguage(lang);
                            localStorage.setItem('elimu-lang', lang);
                          }}
                          className={`text-[12px] relative z-10 transition-all px-4 py-1.5 rounded-full font-bold ${currentLanguage === lang ? 'text-white' : 'text-secondary-gray hover:bg-gray-200'}`}
                        >
                          {t[`lang_${lang.toLowerCase() as 'english' | 'swahili' | 'sheng'}`]}
                          {currentLanguage === lang && (
                            <motion.div 
                              layoutId="lang-pill"
                              className="absolute inset-0 bg-forest rounded-full -z-10"
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="relative group">
                      <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder={t.placeholder}
                        className="w-full border border-gold/40 focus:border-gold rounded-xl p-4 h-[80px] transition-all outline-none resize-none text-base font-poppins placeholder:text-secondary-gray/40 bg-white pr-12"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={toggleListening}
                        className={`absolute right-3 top-3 p-2 rounded-lg transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-forest hover:bg-sage/20'}`}
                        title={isListening ? "Stop listening" : "Start voice-to-text"}
                      >
                        {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr] gap-3">
                      {/* Subject Select */}
                      <div className="bg-gray-100 rounded-[12px] p-2 px-3 flex flex-col gap-0.5 group hover:bg-gray-200 transition-colors cursor-pointer relative">
                        <span className="font-lato text-[11px] text-secondary-gray uppercase tracking-wider">{t.subject_label}</span>
                        <div className="relative">
                          <select 
                            value={subject}
                            onChange={(e) => setSubject(e.target.value as Subject)}
                            className="bg-transparent appearance-none w-full font-poppins font-medium text-sm outline-none cursor-pointer"
                          >
                            <option>Mathematics</option>
                            <option>Physics</option>
                            <option>Chemistry</option>
                            <option>Biology</option>
                            <option>Computer Science</option>
                          </select>
                        </div>
                      </div>

                      {/* Level Select */}
                      <div className="bg-gray-100 rounded-[12px] p-2 px-3 flex flex-col gap-0.5 group hover:bg-gray-200 transition-colors cursor-pointer relative">
                        <span className="font-lato text-[11px] text-secondary-gray uppercase tracking-wider">{t.level_label}</span>
                        <div className="relative">
                          <select 
                            value={level}
                            onChange={(e) => setLevel(e.target.value as Level)}
                            className="bg-transparent appearance-none w-full font-poppins font-medium text-sm outline-none cursor-pointer"
                          >
                            <option>Class 7-8</option>
                            <option>Form 1-2</option>
                            <option>Form 3-4</option>
                            <option>University</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isStreaming || !question.trim()}
                        className="bg-forest text-white rounded-[10px] px-6 py-3 font-semibold transition-all hover:bg-forest/90 active:scale-95 raleway text-[15px] flex items-center justify-center gap-2 h-full disabled:opacity-50"
                      >
                        {isStreaming ? (
                          <RefreshCcw size={18} className="animate-spin" />
                        ) : (
                          t.submit_btn
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Response History */}
                <div className="space-y-6">
                  {messages.length === 0 && (
                    <div className="text-center py-24 opacity-30">
                      <Sparkles size={64} className="mx-auto mb-4 text-forest" />
                      <p className="text-2xl font-raleway font-bold italic">{t.empty_chat}</p>
                    </div>
                  )}
                  
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {msg.role === 'user' ? (
                        <div className="flex justify-end mb-4">
                          <div className="bg-near-black text-white px-6 py-3 rounded-2xl max-w-[85%] font-medium text-sm">
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        <ResponseCard 
                          msg={msg} 
                          isSaved={!!savedResponses.find(s => s.id === msg.id)}
                          onSave={() => toggleSave(msg)}
                          isSpeaking={isSpeaking === msg.id}
                          onSpeak={() => speakText(msg.content, msg.id)}
                          isStreaming={isStreaming && messages[messages.length - 1].id === msg.id}
                        />
                      )}
                    </motion.div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </motion.div>
            ) : activeTab === 'practice' ? (
              <motion.div 
                key="practice-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* History horizontal scroll */}
                {practiceHistory.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-secondary-gray uppercase tracking-widest">{t.history_label}</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
                      {practiceHistory.map((set) => (
                        <button 
                          key={set.id}
                          onClick={() => setCurrentPracticeSet(set)}
                          className={`shrink-0 text-left p-3 rounded-xl border transition-all w-48 ${currentPracticeSet?.id === set.id ? 'border-forest bg-forest/5 shadow-sm' : 'border-gray-100 bg-white hover:border-forest/30'}`}
                        >
                          <div className="font-raleway font-bold text-xs truncate mb-1">{set.topic}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-secondary-gray italic">
                            <Clock size={10} /> {new Date(set.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Practice Generator Form */}
                <div className="card shadow-none border-none">
                  <div className="flex items-center gap-2 mb-6">
                    <ClipboardList className="text-forest" size={24} />
                    <h2 className="font-raleway font-bold text-2xl">{t.practice_title}</h2>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Subject */}
                      <div className="bg-gray-100 rounded-xl p-3 px-4 flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-secondary-gray uppercase tracking-wider">{t.subject_label}</label>
                        <select 
                          value={subject}
                          onChange={(e) => setSubject(e.target.value as Subject)}
                          className="bg-transparent font-poppins font-medium text-sm outline-none"
                        >
                          <option>Mathematics</option>
                          <option>Physics</option>
                          <option>Chemistry</option>
                          <option>Biology</option>
                          <option>Computer Science</option>
                        </select>
                      </div>

                      {/* Education Level */}
                      <div className="bg-gray-100 rounded-xl p-3 px-4 flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-secondary-gray uppercase tracking-wider">{t.level_label}</label>
                        <select 
                          value={level}
                          onChange={(e) => setLevel(e.target.value as Level)}
                          className="bg-transparent font-poppins font-medium text-sm outline-none"
                        >
                          <option>Class 7-8</option>
                          <option>Form 1-2</option>
                          <option>Form 3-4</option>
                          <option>University</option>
                        </select>
                      </div>
                    </div>

                    {/* Topic Input */}
                    <div className="bg-gray-100 rounded-xl p-3 px-4 flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-secondary-gray uppercase tracking-wider">{t.topic_label}</label>
                      <input 
                        type="text"
                        value={practiceTopic}
                        onChange={(e) => setPracticeTopic(e.target.value)}
                        placeholder={t.topic_placeholder}
                        className="bg-transparent font-poppins font-medium text-sm outline-none w-full"
                      />
                    </div>

                    {/* Difficulty & Toggle Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-secondary-gray uppercase tracking-wider block px-1">{t.difficulty_label}</label>
                        <div className="flex bg-gray-100 p-1 rounded-full gap-1">
                          {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((diff) => (
                            <button
                              key={diff}
                              onClick={() => setPracticeDifficulty(diff)}
                              className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${practiceDifficulty === diff ? 'bg-forest text-white shadow-sm' : 'text-secondary-gray hover:bg-gray-200'}`}
                            >
                              {t[`difficulty_${diff.toLowerCase() as 'easy' | 'medium' | 'hard'}`]}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-sage/10 p-3 rounded-xl border border-forest/10 mt-auto">
                        <span className="text-xs font-bold text-near-black">{t.include_answers_label}</span>
                        <button 
                          onClick={() => setIncludeAnswers(!includeAnswers)}
                          className={`w-12 h-6 rounded-full p-1 transition-all ${includeAnswers ? 'bg-forest' : 'bg-gray-300'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full transition-all ${includeAnswers ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>

                    {/* Number of Questions Stepper */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-secondary-gray uppercase tracking-wider block px-1">{t.num_questions_label}</label>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-gray-100 rounded-xl overflow-hidden p-1">
                          <button 
                            onClick={() => setNumQuestions(prev => Math.max(5, prev - 5))}
                            className="p-2 hover:bg-gray-200 text-forest transition-colors rounded-lg"
                          >
                            <Minus size={18} />
                          </button>
                          <div className="w-16 text-center font-bold font-oswald text-xl">{numQuestions}</div>
                          <button 
                            onClick={() => setNumQuestions(prev => Math.min(30, prev + 5))}
                            className="p-2 hover:bg-gray-200 text-forest transition-colors rounded-lg"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                        <span className="text-[10px] text-secondary-gray italic">(Range: 5 - 30)</span>
                      </div>
                    </div>

                    {/* Question Types Multi-select */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-secondary-gray uppercase tracking-wider block px-1">{t.question_types_label}</label>
                      <div className="flex flex-wrap gap-2">
                        {(['Multiple Choice', 'Short Answer', 'True or False', 'Fill in the Blank', 'Long Answer / Essay'] as QuestionType[]).map((type) => {
                          const isSelected = selectedQuestionTypes.includes(type);
                          const transKey = `q_type_${type.toLowerCase().includes('multiple') ? 'mcq' : 
                                             type.toLowerCase().includes('short') ? 'short' :
                                             type.toLowerCase().includes('true') ? 'tf' :
                                             type.toLowerCase().includes('fill') ? 'fill' : 'long'}` as any;
                          return (
                            <button
                              key={type}
                              onClick={() => {
                                if (isSelected) {
                                  if (selectedQuestionTypes.length > 1) {
                                    setSelectedQuestionTypes(prev => prev.filter(t => t !== type));
                                  }
                                } else {
                                  setSelectedQuestionTypes(prev => [...prev, type]);
                                }
                              }}
                              className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${isSelected ? 'bg-gold border-gold text-near-black shadow-sm' : 'bg-white border-gray-200 text-secondary-gray hover:border-gold/50'}`}
                            >
                              {t[transKey]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => handlePracticeGenerate()}
                      disabled={isGeneratingPractice || !practiceTopic.trim()}
                      className="w-full bg-forest text-white rounded-xl py-4 font-bold text-lg hover:bg-forest/90 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-forest/10"
                    >
                      {isGeneratingPractice ? (
                        <>
                          <RefreshCcw size={20} className="animate-spin" />
                          {t.generating}
                        </>
                      ) : (
                        <>
                          <Sparkles size={20} />
                          {t.generate_btn}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Generated Results Card */}
                {currentPracticeSet && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card shadow-md border-forest/10 space-y-6"
                  >
                    {/* Results Header */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4">
                      <span className="badge bg-blue-50 text-blue-600 border-blue-100">{currentPracticeSet.subject}</span>
                      <span className="badge bg-teal-50 text-teal-600 border-teal-100">{currentPracticeSet.topic}</span>
                      <span className="badge bg-sage/20 text-forest border-forest/10">{currentPracticeSet.level}</span>
                      <span className={`badge ${currentPracticeSet.difficulty === 'Easy' ? 'bg-green-50 text-green-600 border-green-100' : currentPracticeSet.difficulty === 'Medium' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {t[`difficulty_${currentPracticeSet.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard'}`]}
                      </span>
                      <span className="badge bg-gold/10 text-near-black border-gold/20">{currentPracticeSet.numQuestions} {t.num_questions_label}</span>
                    </div>

                    {/* Markdown Render */}
                    <div className="markdown-body text-sm leading-relaxed prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: marked.parse(currentPracticeSet.content) }} />
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap gap-3 pt-6 border-t border-gray-100">
                      <button 
                        onClick={() => handlePracticeGenerate(currentPracticeSet)}
                        disabled={isGeneratingPractice}
                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 rounded-xl font-bold text-xs text-secondary-gray hover:bg-gray-200 transition-all"
                      >
                        <RefreshCcw size={16} className={isGeneratingPractice ? 'animate-spin' : ''} />
                        {t.regenerate}
                      </button>
                      <button 
                        onClick={() => {
                          const newSave: SavedResponse = {
                            id: Date.now().toString(),
                            question: `Practice: ${currentPracticeSet.subject} - ${currentPracticeSet.topic}`,
                            response: currentPracticeSet.content,
                            subject: currentPracticeSet.subject,
                            level: currentPracticeSet.level,
                            languageMode: currentLanguage,
                            timestamp: Date.now()
                          };
                          setSavedResponses(prev => [newSave, ...prev]);
                          localStorage.setItem('elimu-saved', JSON.stringify([newSave, ...savedResponses]));
                          setShowToast(t.saved_result);
                          setTimeout(() => setShowToast(null), 3000);
                        }}
                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 bg-sage/20 text-forest rounded-xl font-bold text-xs hover:bg-sage/30 transition-all"
                      >
                        <Bookmark size={16} />
                        {t.save_result}
                      </button>
                      <button 
                        onClick={() => handleDownloadPDF(currentPracticeSet)}
                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 bg-forest text-white rounded-xl font-bold text-xs hover:bg-forest/90 transition-all shadow-md shadow-forest/20"
                      >
                        <Download size={16} />
                        {t.download_pdf}
                      </button>
                    </div>
                  </motion.div>
                )}
                
                {!currentPracticeSet && !isGeneratingPractice && (
                  <div className="card py-20 text-center gap-4 border-dashed border-2 border-gray-200 bg-transparent shadow-none">
                    <ClipboardList className="mx-auto text-secondary-gray/30" size={64} />
                    <div className="space-y-1">
                      <h3 className="font-raleway font-bold text-xl text-secondary-gray">{t.practice_empty_title}</h3>
                      <p className="text-secondary-gray/60 text-sm">{t.practice_empty_text}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : activeTab === 'curriculum' ? (
              <motion.div 
                key="curriculum-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {curriculumView === 'grid' && (
                  <div className="space-y-8">
                    {/* Weak Areas Banner */}
                    {getWeakAreas().length > 0 && (
                      <div className="card border-red-200 bg-red-50/30">
                        <div className="flex items-center gap-2 mb-4">
                          <Zap className="text-red-600" size={20} />
                          <h3 className="font-raleway font-bold text-lg text-red-900">{t.weak_areas}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {getWeakAreas().map(area => (
                            <button 
                              key={area.topicId}
                              onClick={() => {
                                setSelectedCurriculumSubject(area.topicName as any); // Simple link
                                setCurriculumView('topics');
                              }}
                              className="bg-white border border-red-100 px-3 py-1.5 rounded-full text-xs font-bold text-red-700 flex items-center gap-2 hover:bg-red-50 transition-all"
                            >
                              {area.topicName} <span className="opacity-60">{area.score}/{area.total}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bookmarked Topics */}
                    {Object.entries(curriculumState).some(([_, s]) => (s as TopicStatus).isBookmarked) && (
                      <div className="card border-gold/20 bg-gold/5">
                        <div className="flex items-center gap-2 mb-4">
                          <Heart className="text-gold" size={20} fill="currentColor" />
                          <h3 className="font-raleway font-bold text-lg">{t.bookmarked_topics || "Bookmarked Topics"}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(Object.entries(curriculumState) as [string, TopicStatus][]).filter(([_, s]) => s.isBookmarked).map(([id, _]) => {
                            // Find topic name from syllabus data
                            let topicName = "Unknown Topic";
                            for (const subjTopics of Object.values(syllabusData)) {
                              const found = subjTopics.find(t => t.id === id);
                              if (found) {
                                topicName = found.name;
                                break;
                              }
                            }
                            return (
                              <button 
                                key={id}
                                className="bg-white border border-gold/10 px-3 py-1.5 rounded-full text-xs font-bold text-near-black flex items-center gap-2 hover:bg-gold/10 transition-all shadow-sm"
                              >
                                {topicName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      {(['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'] as Subject[]).map(subj => {
                        const prog = getSubjectProgress(subj);
                        return (
                          <div key={subj} className="card hover:border-gold transition-all group overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                              <BookOpen size={64} />
                            </div>
                            <h3 className="font-raleway font-bold text-lg mb-2">{subj}</h3>
                            <div className="space-y-3 mt-4">
                              <div className="flex justify-between items-center text-xs font-bold text-secondary-gray uppercase tracking-widest">
                                <span>{t.study_progress}</span>
                                <span>{prog}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${prog}%` }}
                                  className="h-full bg-gradient-to-r from-forest to-gold"
                                />
                              </div>
                              <button 
                                onClick={() => {
                                  setSelectedCurriculumSubject(subj);
                                  setCurriculumView('topics');
                                }}
                                className="w-full bg-forest text-white py-2 rounded-lg font-bold text-sm mt-2 hover:bg-forest/90 shadow-sm"
                              >
                                {t.open_syllabus}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {curriculumView === 'topics' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setCurriculumView('grid')}
                        className="p-2 hover:bg-gray-100 rounded-full text-secondary-gray transition-all"
                      >
                        <RefreshCcw className="rotate-[-45deg]" size={20} />
                      </button>
                      <h2 className="font-oswald font-bold text-3xl uppercase">{selectedCurriculumSubject}</h2>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-full gap-1 overflow-x-auto scrollbar-hide no-scrollbar">
                      {([1, 2, 3, 4] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setSelectedCurriculumForm(f)}
                          className={`flex-1 py-2 px-6 rounded-full text-xs font-bold transition-all whitespace-nowrap ${selectedCurriculumForm === f ? 'bg-forest text-white shadow-sm' : 'text-secondary-gray hover:bg-gray-200'}`}
                        >
                          {t.form_label} {f}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                       <button onClick={handleFormulaeStart} className="bg-sage/10 text-forest p-2 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 hover:bg-sage/20 border border-forest/5">
                         <Zap size={16} /> {t.formulae}
                       </button>
                       <button onClick={handlePastPapersStart} className="bg-sage/10 text-forest p-2 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 hover:bg-sage/20 border border-forest/5">
                         <History size={16} /> {t.past_papers}
                       </button>
                       <button className="bg-sage/10 text-forest p-2 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 hover:bg-sage/20 border border-forest/5 opacity-50 cursor-not-allowed">
                         <Search size={16} /> {t.concept_map}
                       </button>
                       <button onClick={handleRevisionPlannerStart} className="bg-sage/10 text-forest p-2 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 hover:bg-sage/20 border border-forest/5">
                         <Plus size={16} /> {t.revision_planner}
                       </button>
                    </div>

                    <div className="space-y-3">
                      {syllabusData[selectedCurriculumSubject!].filter(t => t.form === selectedCurriculumForm).map(topic => {
                        const status = curriculumState[topic.id]?.status || 'Not Started';
                        const isBookmarked = curriculumState[topic.id]?.isBookmarked;
                        return (
                          <div key={topic.id} className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center justify-between gap-4 mb-4">
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => handleBookmarkToggle(topic.id)}
                                  className={`transition-all ${isBookmarked ? 'text-gold' : 'text-gray-300 hover:text-gold'}`}
                                >
                                  <Bookmark size={20} fill={isBookmarked ? 'currentColor' : 'none'} />
                                </button>
                                <span className="font-poppins font-medium text-sm">{topic.name}</span>
                              </div>
                              <button 
                                onClick={() => handleTopicStatusCycle(topic.id)}
                                className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${
                                  status === 'Mastered' ? 'bg-green-50 text-green-600 border-green-200' :
                                  status === 'In Progress' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                  'bg-gray-50 text-gray-400 border-gray-200'
                                }`}
                              >
                                {status === 'Mastered' ? t.mastered : status === 'In Progress' ? t.in_progress : t.not_started}
                              </button>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-50">
                              <button 
                                onClick={() => handleLessonStart(topic)}
                                className="flex-1 py-2 px-3 bg-sage/10 text-forest rounded-lg font-bold text-xs hover:bg-sage/20 transition-all flex items-center justify-center gap-2"
                              >
                                <BookOpen size={14} /> {t.teach_me}
                              </button>
                              <button 
                                onClick={() => handleTestStart(topic)}
                                className="flex-1 py-2 px-3 bg-gold/10 text-near-black rounded-lg font-bold text-xs hover:bg-gold/20 transition-all flex items-center justify-center gap-2"
                              >
                                <Sparkles size={14} /> {t.mini_test}
                              </button>
                              <button 
                                onClick={() => handleSummaryStart(topic)}
                                className="flex-1 py-2 px-3 bg-gray-50 text-secondary-gray rounded-lg font-bold text-xs hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                              >
                                <ClipboardList size={14} /> {t.summary}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {curriculumView === 'content' && (
                  <div className="space-y-6">
                    <button 
                      onClick={() => setCurriculumView('topics')}
                      className="text-sm font-bold text-forest flex items-center gap-2 hover:underline"
                    >
                      <RefreshCcw className="rotate-[-45deg]" size={16} /> Back to Topics
                    </button>

                    {isLoadingCurriculum ? (
                      <div className="py-20 text-center animate-pulse">
                        <div className="w-16 h-16 border-4 border-forest border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
                        <p className="font-raleway font-bold text-xl">{t.thinking}...</p>
                      </div>
                    ) : curriculumContent && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`card relative overflow-visible ${isSpeaking === curriculumContent.title ? 'border-l-4 border-gold' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                          <h2 className="font-raleway font-bold text-2xl">{curriculumContent.title}</h2>
                          <div className="flex gap-2">
                             <button 
                              onClick={() => speakText(curriculumContent.content, curriculumContent.title)}
                              className={`p-2 rounded-lg transition-all ${isSpeaking === curriculumContent.title ? 'bg-gold text-white' : 'text-forest hover:bg-sage/10'}`}
                              title={t.read_aloud}
                            >
                              {isSpeaking === curriculumContent.title ? <Square size={20} /> : <Volume2 size={20} />}
                            </button>
                            <button 
                              onClick={() => {
                                const dummyPractice: PracticeSet = {
                                  id: Date.now().toString(),
                                  subject: selectedCurriculumSubject || 'General',
                                  topic: curriculumContent.title,
                                  level: `Form ${selectedCurriculumForm}` as Level,
                                  difficulty: 'Medium',
                                  numQuestions: 0,
                                  questionTypes: [],
                                  includeAnswers: false,
                                  content: curriculumContent.content,
                                  timestamp: Date.now()
                                };
                                handleDownloadPDF(dummyPractice);
                              }}
                              className="p-2 text-forest hover:bg-sage/10 rounded-lg transition-all"
                            >
                              <Download size={20} />
                            </button>
                          </div>
                        </div>
                        <div className="markdown-body">
                          <div dangerouslySetInnerHTML={{ __html: marked.parse(curriculumContent.content) }} />
                        </div>
                        
                        <div className="mt-10 pt-6 border-t border-gray-100">
                           <h4 className="font-bold text-sm mb-3 opacity-60 uppercase">{t.related_topics}</h4>
                           <div className="flex flex-wrap gap-2">
                             {['Coming Soon...', 'Next Topic', 'Advanced Concept'].map(chip => (
                               <button key={chip} className="bg-sage/10 text-forest px-4 py-2 rounded-full text-xs font-bold hover:bg-sage/20 transition-all">
                                 {chip}
                               </button>
                             ))}
                           </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {curriculumView === 'test' && activeTest && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-full bg-forest text-white flex items-center justify-center font-bold">
                          {currentTestIndex + 1}/5
                        </span>
                        <h3 className="font-raleway font-bold">Mini Test: {selectedCurriculumSubject}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-red-600 font-bold font-mono">
                        <Clock size={16} /> 04:59
                      </div>
                    </div>

                    <div className="card">
                      <h4 className="text-xl font-poppins mb-8">{activeTest[currentTestIndex].question}</h4>
                      
                      <div className="space-y-3">
                        {activeTest[currentTestIndex].options ? (
                          activeTest[currentTestIndex].options.map((opt: string, i: number) => {
                            const letter = String.fromCharCode(65 + i);
                            return (
                              <button 
                                key={i}
                                onClick={() => {
                                  const isCorrect = letter === activeTest[currentTestIndex].answer;
                                  setTestResults(prev => [...prev, {
                                    question: activeTest[currentTestIndex].question,
                                    selected: letter,
                                    correct: activeTest[currentTestIndex].answer,
                                    isCorrect,
                                    explanation: activeTest[currentTestIndex].explanation
                                  }]);
                                  if (isCorrect) setTestScore(prev => prev + 1);
                                  
                                  if (currentTestIndex < 4) {
                                    setCurrentTestIndex(prev => prev + 1);
                                  } else {
                                    handleTestComplete(testScore + (isCorrect ? 1 : 0), 5);
                                  }
                                }}
                                className="w-full text-left p-4 rounded-xl border border-gray-100 hover:border-gold hover:bg-gold/5 transition-all flex gap-4 items-center group"
                              >
                                <span className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center font-bold group-hover:bg-gold group-hover:text-white">{letter}</span>
                                <span className="font-medium">{opt}</span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="space-y-4">
                            <textarea placeholder="Type your answer here..." className="w-full p-4 border border-gray-200 rounded-xl h-32 outline-none focus:border-forest" />
                            <button 
                              onClick={() => setCurrentTestIndex(prev => prev + 1)}
                              className="w-full bg-forest text-white py-3 rounded-xl font-bold"
                            >
                              Submit Answer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="saved-tab"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                {savedResponses.length === 0 ? (
                  <div className="card py-20 text-center gap-6">
                    <div className="w-20 h-20 bg-sage/20 rounded-full flex items-center justify-center mx-auto text-forest opacity-40">
                      <History size={48} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-raleway font-bold">📚 {t.saved_empty_title}</h3>
                      <p className="text-secondary-gray opacity-70">{t.saved_empty_text}</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('chat')}
                      className="bg-forest text-white rounded-[10px] px-6 py-3 font-semibold transition-all hover:bg-forest/90 active:scale-95 max-w-xs mx-auto"
                    >
                      {t.start_chat_btn}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {savedResponses.map(save => (
                      <ResponseCard 
                        key={save.id}
                        msg={{
                          id: save.id,
                          role: 'assistant',
                          content: save.response,
                          subject: save.subject as any,
                          level: save.level as any,
                          languageMode: save.languageMode as any,
                          timestamp: save.timestamp
                        }}
                        isSaved={true}
                        onSave={() => {
                          const updated = savedResponses.filter(s => s.id !== save.id);
                          setSavedResponses(updated);
                          localStorage.setItem('elimu-saved', JSON.stringify(updated));
                        }}
                        question={save.question}
                        isSpeaking={isSpeaking === save.id}
                        onSpeak={() => speakText(save.response, save.id)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Widgets */}
        <div className="space-y-6 sticky top-24 h-fit">
          
          {/* Daily Challenge Gadget */}
          <div className="card relative overflow-hidden group border border-gold/10 hover:border-gold/30 transition-all">
            <div className="font-lato font-bold text-[13px] text-secondary-gray/70">{t.daily_challenge_label}</div>
            
            {!dailyChallenge ? (
              <div className="space-y-4 py-4">
                <div className="h-4 bg-gray-100 rounded-full w-full animate-pulse" />
                <div className="h-4 bg-gray-100 rounded-full w-2/3 animate-pulse" />
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="font-raleway font-bold text-lg leading-snug">{dailyChallenge.question.includes('?') ? dailyChallenge.question.split('?')[0] + '?' : dailyChallenge.question}</h4>
                {dailyChallenge.question.includes('?') && (
                  <p className="text-sm text-secondary-gray/80 line-clamp-3">
                    {dailyChallenge.question.split('?')[1]}
                  </p>
                )}
                
                <AnimatePresence>
                  {showChallengeAnswer && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="bg-gold/5 p-4 rounded-xl text-sm border-l-4 border-gold italic text-near-black font-medium"
                    >
                      {dailyChallenge.answer}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                  onClick={() => setShowChallengeAnswer(!showChallengeAnswer)}
                  className="w-full py-2 border border-forest text-forest hover:bg-forest/5 font-poppins font-bold rounded-lg text-sm transition-all active:scale-95"
                >
                  {showChallengeAnswer ? t.hide_answer : t.see_answer}
                </button>
              </div>
            )}
          </div>

          {/* Saved Topics Sidebar Widget */}
          <div className="card flex-1 min-h-[400px]">
            <div className="font-lato font-bold text-[13px] text-secondary-gray/70 mb-4 uppercase tracking-wider">{t.saved_topics_label}</div>
            
            <div className="space-y-4">
              {savedResponses.length > 0 ? (
                savedResponses.slice(0, 5).map((save) => (
                  <div key={save.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('saved')}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-all group-hover:scale-110 ${
                      save.subject === 'Mathematics' ? 'bg-blue-50 text-blue-600' :
                      save.subject === 'Physics' ? 'bg-teal-50 text-teal-600' :
                      save.subject === 'Chemistry' ? 'bg-orange-50 text-orange-600' :
                      save.subject === 'Biology' ? 'bg-green-50 text-green-600' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {save.subject && save.subject[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-raleway font-bold text-sm truncate group-hover:text-forest transition-colors">{save.question}</div>
                      <div className="font-poppins text-[10px] text-secondary-gray/60">{new Date(save.timestamp).toLocaleDateString()} • {save.level}</div>
                    </div>
                    <span className="text-gold text-lg group-hover:scale-125 transition-transform">★</span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center opacity-30 select-none">
                  <div className="w-12 h-12 border-2 border-dashed border-near-black/20 rounded-xl mx-auto mb-3" />
                  <p className="text-xs font-bold uppercase tracking-widest">{t.saved_empty_title}</p>
                </div>
              )}
            </div>

            <div className="mt-auto pt-6 text-center">
              <button 
                onClick={() => setActiveTab('saved')}
                className="text-xs font-poppins font-bold text-secondary-gray border-b-2 border-forest/40 pb-0.5 hover:border-forest transition-all"
              >
                {t.view_all_library}
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-10 py-6 text-near-black opacity-60 text-[11px] font-poppins font-medium flex justify-between items-center bg-sage/30">
        <span>&copy; 2024 Elimu AI - {t.footer_tag}</span>
        <span>{t.footer_made_for}</span>
      </footer>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-near-black text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2"
          >
            <CheckCircle2 className="text-forest" size={20} />
            {showToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ResponseCardProps {
  msg: ChatMessage;
  isSaved: boolean;
  onSave: () => void;
  question?: string;
  isSpeaking: boolean;
  onSpeak: () => void;
  isStreaming?: boolean;
}

// Sub-component: ResponseCard
const ResponseCard: React.FC<ResponseCardProps> = ({ msg, isSaved, onSave, question, isSpeaking, onSpeak, isStreaming }) => {
  const sections = parseGeminiResponse(msg.content);

  // Determine current language for translations inside ResponseCard
  const currentLang = (localStorage.getItem('elimu-lang') as Language) || 'English';
  const t = translations[currentLang];
  
  return (
    <div className="card shadow-none">
      {/* Question if it's a saved response/view */}
      {question && (
        <div className="px-4 py-3 bg-sage/10 border-l-4 border-forest mb-4 rounded-r-xl italic text-sm font-medium">
          "{question}"
        </div>
      )}

      {/* Header of the card */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-lato font-bold text-sm tracking-widest text-secondary-gray uppercase">
            04. {msg.subject || 'General'} • {msg.level || 'Form 3-4'}
          </span>
          {msg.languageMode === 'Sheng' && (
            <span className="badge">SHENG MODE ACTIVE</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={onSpeak}
            className={`p-1.5 rounded-lg transition-all ${isSpeaking ? 'bg-gold text-white' : 'text-forest hover:bg-sage/20'}`}
            title={isSpeaking ? "Stop reading" : "Read aloud"}
          >
            {isSpeaking ? <Square size={16} /> : <Volume2 size={16} />}
          </button>
          <span className="text-secondary-gray/50 text-[11px] font-poppins">
            {formatTime(msg.timestamp)}
          </span>
        </div>
      </div>

      {/* Content sections or Raw streaming text */}
      <div className="flex flex-col gap-5 pt-2">
        {isStreaming ? (
          <div className="text-sm leading-relaxed font-mono whitespace-pre-wrap p-4 bg-gray-50 rounded-xl border border-gray-100 italic opacity-80">
            {msg.content}
            <span className="inline-block w-1 h-4 bg-forest ml-1 animate-pulse" />
          </div>
        ) : (
          sections.map((section, idx) => {
            const renderedContent = marked.parse(section.content) as string;
            
            if (section.type === 'definition') {
              return (
                <div key={idx} className="space-y-1">
                  <h4 className="font-raleway font-bold text-base">📖 Simple Definition</h4>
                  <div 
                    className="text-sm leading-relaxed text-near-black markdown-body"
                    dangerouslySetInnerHTML={{ __html: renderedContent }}
                  />
                </div>
              );
            }
            if (section.type === 'analogy') {
              return (
                <div key={idx} className="inset-box !not-italic">
                  <h4 className="font-raleway font-bold text-sm mb-1 text-forest">🇰🇪 Local Analogy</h4>
                  <div 
                    className="text-near-black font-poppins italic text-sm leading-relaxed markdown-body"
                    dangerouslySetInnerHTML={{ __html: renderedContent }}
                  />
                </div>
              );
            }
            if (section.type === 'step-by-step') {
              return (
                <div key={idx} className="space-y-2">
                  <h4 className="font-raleway font-bold text-base">🔢 Step-by-Step</h4>
                  <div 
                    className="markdown-body text-sm"
                    dangerouslySetInnerHTML={{ __html: renderedContent }}
                  />
                </div>
              );
            }
            if (section.type === 'practice') {
              return (
                <div key={idx} className="bg-light-gold rounded-xl p-4 border border-dashed border-gold">
                  <h4 className="font-raleway font-bold text-sm mb-2">✏️ Practice Question</h4>
                  <div 
                    className="text-near-black font-medium text-[13px] markdown-body"
                    dangerouslySetInnerHTML={{ __html: renderedContent }}
                  />
                </div>
              );
            }
            return (
              <div 
                key={idx} 
                className="markdown-body text-sm"
                dangerouslySetInnerHTML={{ __html: renderedContent }}
              />
            );
          })
        )}
      </div>

      {/* Action Footer */}
      <div className="flex gap-4 pt-4">
        <button 
          onClick={onSave}
          className="text-forest font-bold text-[13px] hover:underline flex items-center gap-1.5 transition-all"
        >
          <Heart size={14} fill={isSaved ? "currentColor" : "none"} />
          {isSaved ? t.saved_result : t.save_result}
        </button>
        <button 
          onClick={onSpeak}
          className={`text-forest font-bold text-[13px] hover:underline flex items-center gap-1.5 transition-all ${isSpeaking ? 'animate-pulse text-gold' : ''}`}
        >
          {isSpeaking ? <Square size={14} /> : <Volume2 size={14} />}
          {isSpeaking ? t.stop_reading : t.read_aloud}
        </button>
        <button className="text-forest font-bold text-[13px] hover:underline flex items-center gap-1.5 transition-all">
          <RefreshCcw size={14} /> {t.tell_me_again}
        </button>
        <button className="text-forest font-bold text-[13px] hover:underline flex items-center gap-1.5 transition-all">
          ➡️ {t.try_similar}
        </button>
      </div>
    </div>
  );
}

// Utility to parse Gemini's structured response
function parseGeminiResponse(content: string) {
  const sections: { type: 'definition' | 'analogy' | 'step-by-step' | 'practice' | 'text', content: string }[] = [];
  
  const rawParts = content.split(/\d+\.\s*(?=📖|🇰🇪|🔢|✏️)/);
  
  if (rawParts.length <= 1) {
    // Fallback if formatting is weird
    return [{ type: 'text', content }];
  }

  rawParts.forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;

    if (trimmed.includes('📖')) {
      sections.push({ type: 'definition', content: trimmed.replace('📖', '').replace('Simple Definition', '').trim() });
    } else if (trimmed.includes('🇰🇪')) {
      sections.push({ type: 'analogy', content: trimmed.replace('🇰🇪', '').replace('Local Kenyan Analogy', '').trim() });
    } else if (trimmed.includes('🔢')) {
      sections.push({ type: 'step-by-step', content: trimmed.replace('🔢', '').replace('Step-by-Step Explanation', '').trim() });
    } else if (trimmed.includes('✏️')) {
      sections.push({ type: 'practice', content: trimmed.replace('✏️', '').replace('Quick Practice Question', '').trim() });
    } else {
      sections.push({ type: 'text', content: trimmed });
    }
  });

  return sections;
}
