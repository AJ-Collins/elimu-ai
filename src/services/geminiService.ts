import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export async function* streamTutorResponse(prompt: string, subject: string, level: string, language: string) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  let languageInstruction = "";
  if (language === 'English') {
    languageInstruction = "Respond entirely in clear, simple English.";
  } else if (language === 'Swahili') {
    languageInstruction = "Respond entirely in clean Kiswahili. Use scientific terms only where there is no good Swahili equivalent.";
  } else if (language === 'Sheng') {
    languageInstruction = "Respond in authentic Nairobi Sheng. Naturally code-switch between Swahili and English mid-sentence the way Kenyan youth actually talk. Use real Sheng expressions while keeping the explanation educational.";
  }

  const systemInstruction = `You are Elimu AI, a friendly STEM tutor for Kenyan students.
The student is studying ${subject} at ${level} level.
Language: ${languageInstruction}
Use local Kenyan analogies (matatus, ugali, shamba, M-Pesa, Nairobi traffic, sukuma wiki, boda boda).
Structure every response exactly as:
1. 📖 Simple Definition
2. 🇰🇪 Local Kenyan Analogy  
3. 🔢 Step-by-Step Explanation
4. ✏️ Quick Practice Question
Tone: warm and encouraging like a knowledgeable older sibling.`;

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
      }
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error("Stream error:", error);
    throw error;
  }
}

export const generateDailyChallenge = async (language: string) => {
    let languageInstruction = "";
    if (language === 'English') {
      languageInstruction = "Return the question and answer in simple English.";
    } else if (language === 'Swahili') {
      languageInstruction = "Return the question and answer in clean Kiswahili.";
    } else if (language === 'Sheng') {
      languageInstruction = "Return the question and answer in authentic Nairobi Sheng.";
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: 'user', parts: [{ text: "Give me a challenging but fun STEM question for a Kenyan secondary school high schooler. Format: Question | Answer. Include a local Kenyan twist." }] }],
            config: {
                systemInstruction: `Generate a random Kenyan secondary school STEM (Science, Technology, Engineering, Mathematics) challenge question. it should be short, engaging. Language: ${languageInstruction}. Format: Question | Answer.`,
            }
        });
        return response.text || "What is the speed of light in a vacuum? | 299,792,458 m/s";
    } catch (error) {
        console.error("Daily challenge error:", error);
        return "What is the speed of light in a vacuum? | 299,792,458 m/s";
    }
};

export const generatePracticeSet = async (
  subject: string,
  topic: string,
  level: string,
  difficulty: string,
  numQuestions: number,
  questionTypes: string[],
  includeAnswers: boolean,
  language: string
) => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  let languageInstruction = "";
  if (language === 'English') {
    languageInstruction = "Respond entirely in clear, simple English.";
  } else if (language === 'Swahili') {
    languageInstruction = "Respond entirely in clean Kiswahili. Use scientific terms only where there is no good Swahili equivalent.";
  } else if (language === 'Sheng') {
    languageInstruction = "Respond in authentic Nairobi Sheng. Naturally code-switch between Swahili and English mid-sentence the way Kenyan youth actually talk. Use real Sheng expressions while keeping the explanation educational.";
  }

  const systemInstruction = `You are an expert Kenyan secondary school exam paper setter. 
Generate a practice question set for a student studying ${subject} on the topic "${topic}" at ${level} level. 
Match the difficulty: ${difficulty}. 
Include these question types: ${questionTypes.join(', ')}. 
Number of questions: ${numQuestions}.
Language: ${languageInstruction}

Follow the Kenya Institute of Curriculum Development (KICD) format and style for exam questions—clear, unambiguous, properly numbered. 
Use real Kenyan contexts in word problems where appropriate (names like Wanjiku, Otieno, Fatuma; places like Kisumu, Mombasa, Nakuru; scenarios like market prices in shillings, distances between Kenyan towns, population data). 

IMPORTANT: NEVER use LaTeX or dollar sign notation (e.g., $x^2$, $\frac{1}{2}$). 
Write all mathematics in human-readable plain text:
- Use x^2 for powers
- Use sqrt(x) for square roots
- Use 1/2 for fractions
- Use ( -b +- sqrt(D) ) / 2a for quadratic formulas
- Use => for implications
- Use Ksh. for currency
- Use normal text for units (m^2, cm^3)

Number all questions clearly. 
If multiple choice is included, provide four options labeled A, B, C, and D on separate lines. 
${includeAnswers ? "Include a complete 'Answers & Marking Scheme' section at the very end, separated clearly from the questions by a dividing line (---)." : "Do NOT include answers."}
Respond using Markdown formatting.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: `Generate ${numQuestions} ${difficulty} difficulty ${subject} questions about ${topic} for ${level}.` }] }],
      config: {
        systemInstruction,
        maxOutputTokens: 4096,
      }
    });

    return response.text || "Failed to generate questions. Please try again.";
  } catch (error) {
    console.error("Practice set generation error:", error);
    throw error;
  }
};

export const generateLesson = async (subject: string, topic: string, language: string) => {
  let languageInstruction = "";
  if (language === 'English') {
    languageInstruction = "Respond entirely in clear, simple English.";
  } else if (language === 'Swahili') {
    languageInstruction = "Respond entirely in clean Kiswahili. Use scientific terms only where there is no good Swahili equivalent.";
  } else if (language === 'Sheng') {
    languageInstruction = "Respond in authentic Nairobi Sheng. Naturally code-switch between Swahili and English mid-sentence the way Kenyan youth actually talk. Use real Sheng expressions while keeping the explanation educational.";
  }

  const systemInstruction = `You are Elimu AI delivering a complete structured lesson for a Kenyan secondary school student. 
Teach the topic "${topic}" in ${subject} thoroughly but in a friendly engaging way. 
Structure the lesson as:
1. Introduction and why this topic matters in real Kenyan life
2. Key concepts and definitions
3. Detailed explanation with local Kenyan analogies
4. Worked examples using Kenyan contexts
5. Common mistakes students make on this topic in KCSE and how to avoid them
6. Related topics the student should study next
7. Quick recap summary

IMPORTANT: NEVER use LaTeX or dollar sign notation. Write all mathematics in human-readable plain text.
Language: ${languageInstruction}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: `Teach me the topic: ${topic}` }] }],
      config: {
        systemInstruction,
        maxOutputTokens: 4096,
      }
    });

    return response.text || "Failed to generate lesson.";
  } catch (error) {
    console.error("Lesson generation error:", error);
    throw error;
  }
};

export const generateTopicSummary = async (subject: string, topic: string, language: string) => {
  let languageInstruction = "";
  if (language === 'English') {
    languageInstruction = "Respond in simple English.";
  } else if (language === 'Swahili') {
    languageInstruction = "Respond in clean Kiswahili.";
  } else if (language === 'Sheng') {
    languageInstruction = "Respond in authentic Nairobi Sheng.";
  }

  const systemInstruction = `Provide a concise revision-ready summary of the topic "${topic}" in ${subject}. 
Include: all key points, key terms defined briefly, and the most important formulas or facts to remember. 
Use plain text math notation throughout—no LaTeX.
Format with Markdown.
Language: ${languageInstruction}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: `Give me a summary of ${topic}` }] }],
      config: {
        systemInstruction,
        maxOutputTokens: 2048,
      }
    });

    return response.text || "Failed to generate summary.";
  } catch (error) {
    console.error("Summary error:", error);
    throw error;
  }
};

export const generateFormulaSheet = async (subject: string, level: string, language: string) => {
  const systemInstruction = `Requesting a comprehensive formula sheet for ${subject} at ${level} level. 
Include all key formulas, laws, constants, and equations the student needs to know for KCSE. 
Write in plain readable notation without LaTeX. 
Organize by sub-topic using Markdown. 
Language selection: ${language}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: `Generate a formula sheet for ${subject} ${level}` }] }],
      config: {
        systemInstruction,
        maxOutputTokens: 4096,
      }
    });

    return response.text || "Failed up generate formula sheet.";
  } catch (error) {
    console.error("Formula sheet error:", error);
    throw error;
  }
};

export const generatePastPaperPatterns = async (subject: string, topic: string, language: string) => {
  const systemInstruction = `Analyze most commonly tested question patterns on "${topic}" in ${subject} for KCSE past papers. 
Include: typical question formats, common scenarios used, key things examiners test, and 2-3 example questions with full worked answers. 
All math in plain notation. 
Language: ${language}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: `Analyze past paper patterns for ${topic}` }] }],
      config: {
        systemInstruction,
        maxOutputTokens: 4096,
      }
    });

    return response.text || "Failed to analyze patterns.";
  } catch (error) {
    console.error("Patterns error:", error);
    throw error;
  }
};

export const generateMiniTest = async (subject: string, topic: string, level: string, language: string) => {
  const systemInstruction = `Generate exactly 5 questions on "${topic}" in ${subject} at ${level} level. 
A mix of multiple choice (options A-D) and short answer. 
Format as JSON array: [{"question": "string", "options": ["A", "B", "C", "D"], "answer": "string", "explanation": "string"}]. 
Return ONLY the JSON array. Use plain math notation. 
Language: ${language}.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: `Generate a 5-question test for ${topic}` }] }],
      config: {
        systemInstruction,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Mini test error:", error);
    return [];
  }
};

