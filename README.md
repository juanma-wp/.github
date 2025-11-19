# GitHub Profile Automation

This repository contains the automation scripts that power my GitHub profile README, automatically updating it with my latest blog posts and GitHub activity.

## 🚀 Features

- **Automated Blog Post Updates**: Fetches and displays my latest blog posts from the RSS feed
- **GitHub Activity Tracking**: Shows recent commits and repository activity
- **Daily Updates**: Runs automatically via GitHub Actions on a daily schedule
- **TypeScript Implementation**: Built with TypeScript for type safety and maintainability

## 📁 Repository Structure

- `src/` - TypeScript source files for the profile update logic
- `dist/` - Compiled JavaScript files
- `.github/workflows/` - GitHub Actions workflow for automated updates
- `profile/` - Contains the actual profile README that gets updated

## 🛠️ How It Works

1. **GitHub Actions Workflow**: Runs daily at 00:00 UTC (configurable)
2. **RSS Feed Parsing**: Fetches latest posts from the blog RSS feed
3. **GitHub API Integration**: Retrieves recent repository activity
4. **README Generation**: Updates the profile README with fresh content
5. **Auto-commit**: Commits and pushes changes automatically

## 🔧 Technologies Used

- **TypeScript**: Main programming language
- **Node.js**: Runtime environment
- **GitHub Actions**: CI/CD and automation
- **axios**: HTTP client for API requests
- **xml2js**: XML/RSS feed parsing
- **dotenv**: Environment variable management

## 📊 Workflow

The automation runs through a GitHub Actions workflow that:
- Checks out the repository
- Sets up Node.js environment
- Installs dependencies
- Builds the TypeScript code
- Runs the update script
- Commits and pushes any changes

## 🔐 Configuration

The project uses environment variables for configuration:
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions for API access
- RSS feed URL and other settings can be configured in the source code

## 📝 License

MIT
