# GitHub Profile Updater

This TypeScript application automatically updates your GitHub profile README with your latest blog posts and GitHub activity.

## 📋 Features

- Fetches latest blog posts from an RSS feed
- Retrieves recent GitHub activity (commits and releases)
- Updates your profile README with both blog posts and activity
- Runs automatically via GitHub Actions
- Can be executed locally for testing

## 🚀 Setup

### Prerequisites

- Node.js 20 or higher
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. For local development, create a `.env` file (optional):
```bash
cp .env.example .env
```
Then edit `.env` and add your GitHub personal access token (improves API rate limits).

## 🛠️ Usage

### Local Development

Run the TypeScript version directly (without building):
```bash
npm run update-profile:dev
```

### Production

Build and run the compiled JavaScript:
```bash
npm run build
npm run update-profile
```

### NPM Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run TypeScript directly with tsx
- `npm run update-profile` - Run the compiled JavaScript
- `npm run update-profile:dev` - Run TypeScript directly for development

## 🤖 GitHub Actions

The workflow runs automatically:
- Daily at 00:00 UTC
- Can be triggered manually from GitHub Actions tab

The workflow file is located at `.github/workflows/update-readme.yml`

## 📁 Project Structure

```
.github/
├── src/
│   └── update-profile.ts    # Main TypeScript source
├── dist/                     # Compiled JavaScript (generated)
├── package.json             # Node.js dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── .env.example             # Environment variables template
└── workflows/
    └── update-readme.yml    # GitHub Actions workflow
```

## ⚙️ Configuration

Edit these constants in `src/update-profile.ts`:

- `RSS_FEED_URL` - Your blog's RSS feed URL
- `README_PATH` - Path to your README file
- `MAX_POSTS` - Number of blog posts to display
- `MAX_ACTIVITY` - Number of GitHub activities to display
- `GITHUB_USERNAME` - Your GitHub username
- `EXCLUDED_REPOS` - Repositories to exclude from activity

## 📝 README Markers

Your README must contain these markers for the script to work:

```markdown
<!-- BLOG-POSTS:START -->
<!-- BLOG-POSTS:END -->

<!-- GITHUB-ACTIVITY:START -->
<!-- GITHUB-ACTIVITY:END -->
```

The script will replace content between these markers.

## 🔐 Environment Variables

- `GITHUB_TOKEN` - Optional GitHub personal access token for increased API rate limits

## 📄 License

MIT