# Contributing to Obsidian-Web 💎

Thank you for your interest in improving Obsidian-Web! Whether it's fixing bugs, improving the graph visualization, or adding new editor features, your contributions are welcome.

## 🛠️ Local Development Setup

1. **Fork the repository** and clone it locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/obsidian-web.git
   cd obsidian-web
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Environment Setup (Crucial Step)**:
   You need to link the app to a local Obsidian vault to test it. Create a `.env.local` file at the root:
   ```env
   # Point this to a test vault on your computer
   NOTES_PATH=C:/Users/YourName/Documents/TestVault
   AUTH_PASSWORD=dev_password
   ```
4. **Start the server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to view the app.

## 🧠 Architecture Notes
- **Frontend**: Next.js App Router with React 19.
- **Editor**: We use CodeMirror 6. Any new Markdown parsing features should be added via CodeMirror extensions.
- **Graph**: The force-directed graph is a custom Canvas implementation for performance. 

## 📦 Pull Request Process

1. Test your changes against a realistic Obsidian vault (with folders, links, and tags).
2. Ensure you haven't committed any personal markdown notes in the `/vault` directory.
3. Submit your PR with a clear description of what you added or fixed.