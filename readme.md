# 🧭 Mentlio Career Platform

<div align="center">
  <h3>Your AI-Powered Career Compass ✨</h3>
  <p>Revolutionizing career guidance with 3D roadmaps, personalized AI agents, and real-time mentorship.</p>
</div>

---

## 📖 Introduction

**Mentlio** is a comprehensive career development platform designed to guide students and professionals through their career journey. By leveraging cutting-edge **AI**, **3D visualization**, and **real-time communication**, Mentlio bridges the gap between ambition and reality. Whether you're deciding on a major, preparing for interviews, or seeking 1:1 mentorship, Mentlio's intelligent agents and immersive tools are here to help.

## 🌟 Key Features

### 🗺️ Immersive 3D Career Roadmaps
Visualize your career path potential like never before. Interactive **Roadmaps & Learning Paths** create an engaging way to explore different execution strategies and milestones for your chosen field.

### 🎯 AI-Personalized Learning Tracks
Forget generic advice. Mentlio's AI analyzes your profile, skills, and goals to generate **customized learning tracks**. Step-by-step guidance ensures you learn exactly what you need to succeed.

### 🎙️ Voice AI Mock Interviews
Practice makes perfect. Realistic **Voice Agents** conduct mock interviews, providing real-time feedback on your responses, tone, and confidence to get you job-ready.

### 🤖 Intelligent Career Agents
Unsure which path to take? Our **AI Career Agents** (powered by Google Gemini & LangChain) act as your personal counselors. Chat with them to decode your interests, discover suitable colleges, and identify high-growth career opportunities.

### 🎓 Smart College Suggestions
Data-driven recommendations to help you find the best educational institutions that align with your career aspirations and academic profile.

### 🤝 1:1 Mentor Connect
Connect directly with industry experts. Integrated **Video Call** features facilitate seamless mock interviews, guidance sessions, and networking with mentors worldwide.

## 🛠️ Tech Stack

**Frontend & UI**
- **Framework:** Next.js 16 (Turbopack)
- **Styling:** Tailwind CSS v4, Framer Motion
- **UI Components:** Radix UI, Lucide React, Magic UI
- **Workflow & Visualization:** React Flow

**AI & Intelligence**
- **LLMs:** Google Gemini (Gemini 2.5), Groq (Llama 3.3 70B)
- **Voice AI:** Vapi AI
- **Frameworks:** LangChain
- **Vector DB:** Pinecone
- **Search Agents:** Tavily, SerpApi

**Backend & Services**
- **Database & Auth:** Supabase (PostgreSQL + Auth)
- **Storage & Caching:** Google Cloud Storage, ImageKit, Upstash Redis
- **Real-time Video:** ZegoCloud
- **Payments:** Razorpay

## 🚀 Getting Started

Follow these instructions to set up the project locally.

### Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm

### Installation

1. **Navigate to the project directory**
   ```bash
   cd mentlio-career-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Set up Environment Variables**
   Ensure your `.env.local` file is configured with your Supabase, Groq, and Gemini credentials:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # AI Keys
   GROQ_API_KEY=your_groq_api_key
   GEMINI_API_KEY=your_gemini_api_key
   NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) with your browser to explore Mentlio.

## 📄 License

This project is licensed under the MIT License.
