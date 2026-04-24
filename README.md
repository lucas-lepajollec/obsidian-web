<div align="center">
  <h1>💎 Obsidian-Web</h1>
  <p><strong>A Sleek, Mobile-First Web Interface for Your Obsidian Vault</strong></p>
  
  [![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

  <br />
</div>

Obsidian-Web is a high-performance, mobile-optimized web viewer and editor for your Obsidian vaults. Designed to feel familiar to Obsidian users while being accessible from any browser, it allows you to browse your notes, visualize your knowledge graph, and edit content on the go with a premium, glassmorphic UI.

## ✨ Features

- **📱 Mobile-First Design**: Fully responsive interface with touch-optimized buttons, slide-out panels, and a smooth bottom-sheet action menu.
- **📝 Real-time Markdown Editing**: Integrated CodeMirror 6 editor with syntax highlighting and automatic saving.
- **🕸️ Interactive Knowledge Graph**: Visualize the connections between your notes with a performant 2D graph view.
- **🔍 Global Search & Folders**: Quickly navigate your vault with an intuitive folder tree and a lightning-fast full-text search.
- **🔒 Secure Access**: Password-protected edit mode to ensure your notes remain private while allowing read-only access.
- **🌗 Premium Aesthetics**: A handcrafted design system featuring sleek gradients, subtle micro-animations, and a deep-space dark mode.
- **📦 Zero-Config Docker**: Ready to deploy in seconds with a multi-stage Docker build optimized for size and performance.

---

## 🛠️ Tech Stack

| Category         | Technologies Used                                                                 |
| ---------------- | --------------------------------------------------------------------------------- |
| **Frontend Core**| Next.js 15 (App Router), React 19, TypeScript                                     |
| **Styling**      | Tailwind CSS 4, Custom Vanilla CSS, Lucide React (Icons)                          |
| **Editor**       | CodeMirror 6 (Markdown, One Dark Theme)                                           |
| **Visualization**| Force-directed Graph (Custom Canvas implementation)                               |
| **Deployment**   | Docker (Multi-stage node:22-alpine standalone build)                              |

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v20+) and [npm](https://www.npmjs.com/) installed.
For production, [Docker](https://docs.docker.com/get-docker/) is recommended.

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/lucas-lepajollec/obsidian-web.git
   cd obsidian-web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure your vault path:**
   Create a `.env.local` file (or set the environment variable):
   ```env
   NOTES_PATH=C:/Users/YourName/Documents/MyVault
   AUTH_PASSWORD=your_secure_password
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   *The application will be running at `http://localhost:3000`.*

---

## 🐳 Docker Deployment

The easiest way to deploy Obsidian-Web is using Docker Compose.

**1. Create a `docker-compose.yml` file:**

```yaml
services:
  obsidian-web:
    image: ghcr.io/lucas-lepajollec/obsidian-web:latest
    container_name: obsidian-web
    ports:
      - "2506:2506"
    volumes:
      - /path/to/your/obsidian/vault:/vault
    environment:
      - NOTES_PATH=/vault
      - AUTH_PASSWORD=votre_mot_de_passe_secret
    restart: unless-stopped
```

**2. Start the application:**

```bash
docker compose up -d
```

The application will be available at **http://localhost:2506**.

---

## 📂 Project Structure

```text
obsidian-web/
├── vault/                  # Demo vault (included for testing)
├── public/                 # Static assets
├── src/
│   ├── app/                # Next.js App Router (Pages, API Routes, Layouts)
│   ├── components/         # React components (Editor, Viewer, Graph, Sidebar)
│   ├── lib/                # Backend logic (Vault indexing, file operations)
│   └── globals.css         # Global styles and Tailwind directives
├── Dockerfile              # Multi-stage production build
└── docker-compose.yml      # Deployment configuration
```

---

## 🤝 Contributing

Feel free to open issues or submit pull requests to improve Obsidian-Web!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<div align="center">

Made with ❤️ by [Lucas Lepajollec](https://github.com/lucas-lepajollec)

</div>
