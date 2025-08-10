# Voice Scam Shield (Faustic)

**AI-Powered Voice Detection for Scam Prevention**

Voice Scam Shield is an intelligent web application that uses advanced AI to analyze voicemails and detect synthetic voices, helping users identify potential voice-based scams and fraud attempts.

## 🚀 Project Description

With the rise of AI-generated voices and deepfake technology, voice-based scams are becoming increasingly sophisticated. Voice Scam Shield provides users with a powerful tool to:

- **Analyze Audio Files**: Upload voicemails or audio recordings for AI analysis
- **Detect Synthetic Voices**: Identify artificially generated speech patterns
- **Assess Scam Risk**: Get detailed risk assessments and recommendations
- **Track History**: Review past analyses and build awareness over time
- **Multi-language Support**: Available in 12 languages for global accessibility

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v18 or higher) - [Install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- npm or yarn package manager
- Supabase account (for backend services)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/voice-scam-shield.git
   cd voice-scam-shield
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173` to view the application

### Mobile Development (Optional)

For mobile app development using Capacitor:

```bash
# Install Capacitor CLI globally
npm install -g @capacitor/cli

# Build the web app
npm run build

# Add mobile platforms
npx cap add ios
npx cap add android

# Run on mobile
npx cap run ios
npx cap run android
```

## 📦 Dependencies & Tech Stack

### Core Technologies
- **React 18** - Frontend framework
- **TypeScript** - Type safety and development experience
- **Vite** - Build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern UI component library

### Backend & Authentication
- **Supabase** - Backend-as-a-Service (database, auth, edge functions)
- **@supabase/supabase-js** - Supabase client library

### AI & Analysis
- Custom edge functions for voice analysis
- AI-powered voice detection algorithms

### Mobile Support
- **Capacitor** - Cross-platform mobile app development
- **@capacitor/filesystem** - File system access
- **@capacitor/haptics** - Haptic feedback
- **@capacitor/share** - Native sharing capabilities

### UI & User Experience
- **React Router DOM** - Client-side routing
- **React Hook Form** - Form handling and validation
- **React Query** - Data fetching and caching
- **i18next** - Internationalization (12 languages)
- **Lucide React** - Icon library
- **Sonner** - Toast notifications

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Recharts** - Data visualization

## 🌍 Supported Languages

- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Russian (ru)
- Arabic (ar)
- Hindi (hi)
- Japanese (ja)
- Korean (ko)
- Chinese (zh)

## 🚀 Deployment

### Using Lovable Platform
1. Open your [Lovable project](https://lovable.dev/projects/40b8a3a9-1416-416a-8277-c5cc54b8f63f)
2. Click Share → Publish
3. Your app will be deployed automatically

### Custom Domain
To connect a custom domain:
1. Navigate to Project > Settings > Domains in Lovable
2. Click "Connect Domain"
3. Follow the setup instructions

## 👥 Team Credits

This project was developed by:

- **Victor Nadu** - Lead Developer & AI Integration Specialist
- **Fausto Fang** - UI/UX Designer & Frontend Developer

## 🔧 Development Workflow

### Using Lovable (Recommended)
- Visit the [Lovable Project](https://lovable.dev/projects/40b8a3a9-1416-416a-8277-c5cc54b8f63f)
- Make changes using natural language prompts
- Changes are automatically committed to this repository

### Using Local IDE
- Clone the repository and make changes locally
- Push changes to GitHub - they will automatically sync with Lovable
- Maintain full version control and collaboration capabilities

### Using GitHub Codespaces
- Click the "Code" button and select "Codespaces"
- Launch a new Codespace environment
- Edit directly in the browser-based IDE

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is developed for educational and demonstration purposes. Please ensure compliance with applicable AI and privacy regulations when using voice analysis technologies.

## 🔗 Links

- **Live Demo**: [Voice Scam Shield](https://40b8a3a9-1416-416a-8277-c5cc54b8f63f.lovableproject.com/)
- **Lovable Project**: [Edit in Lovable](https://lovable.dev/projects/40b8a3a9-1416-416a-8277-c5cc54b8f63f)
- **Documentation**: [Lovable Docs](https://docs.lovable.dev/)

---

*Built with ❤️ using [Lovable](https://lovable.dev) - The AI-powered web development platform*