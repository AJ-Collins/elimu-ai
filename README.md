# Elimu AI - Personalized African Educational Assistant

## The Problem
Access to quality, personalized education is a challenge in many parts of East Africa. Students often struggle with complex scientific and mathematical concepts when taught in a language or context that doesn't resonate with their daily lives. Traditional textbooks lack interactivity, and generic AI tools often fail to provide culturally relevant examples or support local languages like Swahili and Sheng, leading to a disconnect in the learning process.

## Our Solution
Elimu AI is a hyper-localized, AI-powered educational platform designed specifically for Kenyan and East African students. It bridges the educational gap by tutoring students in languages they understand (English, Swahili, and Sheng) and uses culturally relevant analogies (e.g., using Matatus to explain physics concepts) to make learning intuitive and engaging.

## Architectural Choices

### Frontend Architecture
- **React 18 & TypeScript:** We chose React for its component-based architecture which allows us to build a highly interactive SPA (Single Page Application). TypeScript provides strict type safety, making the codebase robust and easier to maintain.
- **Vite:** Used as the build tool for blazing-fast development server start times and optimized production builds.
- **Tailwind CSS:** Selected for utility-first styling. It enables rapid UI iteration and ensures a consistent design system (using variables like `--color-forest` and `--color-gold`) without the overhead of maintaining huge CSS files.
- **Framer Motion:** Integrated to provide fluid, meaningful animations (like tab switching and loading states) that enhance the user experience and make the application feel polished and responsive.
- **Responsive Design:** Mobile-first layout ensuring students can access the platform seamlessly from feature phones and low-end smartphones, which are the primary internet access devices in the region.

### AI & Data Integration
- **Google Gemini AI SDK:** We utilize the modern `@google/genai` SDK to power the core educational features, including real-time chat, curriculum generation, and dynamically creating tailored practice questions. The AI is specifically prompted to provide "Local Analogies" and simple, step-by-step breakdowns.
- **Local Storage State Management:** For this phase, user progress, saved libraries, and daily challenges are persisted via the browser's `localStorage`. This allows for a fast, offline-tolerant experience without requiring immediate backend synchronization.

## Features
- **Multilingual Chat:** Ask questions and receive detailed explanations in English, Swahili, or Sheng.
- **Curriculum Tracker:** Interactive syllabus covering Mathematics, Physics, Chemistry, Biology, and Computer Science across primary and secondary school levels (Form 1-4).
- **Practice Generator:** Dynamically generates quizzes, multiple-choice questions, and long-form practice sets based on the student's selected topic and difficulty.
- **Saved Library:** Bookmark and save AI responses or practice sets for offline-like review.
- **Daily Challenges:** Engaging daily mini-tests to keep students learning consistently.

## How to Use the Tool

### Prerequisites
- Node.js (v18 or higher)
- A Google Gemini API Key

### Installation

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root of your project and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

3. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.

### Navigation Guide
- **Chat Tab:** Select your preferred language (English, Swahili, Sheng), choose a subject and level, and type your question. The AI will provide a simple definition, a local analogy, and a step-by-step breakdown.
- **Practice Tab:** Select a subject, topic, and difficulty. Click "Generate Practice Set" to get instant, AI-generated questions to test your knowledge. You can download these as PDFs.
- **Curriculum Tab:** View your overall progress. Click on a subject to see specific topics, and use the "Teach Me" or "Mini Test" features to master individual concepts.
- **Library Tab:** Access all the responses and practice sets you have bookmarked for quick revision.

## Future Roadmap
- Integration with Firebase for robust, cloud-synced user tracking and authentication.
- Voice-to-Text inputs optimized for local accents.
- WhatsApp Chatbot integration for wider accessibility.
