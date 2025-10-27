#!/usr/bin/env node
/**
 * Update README.md with the latest posts from RSS feed and GitHub activity.
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import * as dotenv from 'dotenv';

// Load environment variables from .env file if it exists (for local development)
dotenv.config();

// Configuration
const RSS_FEED_URL = 'https://juanma.codes/feed';
const README_PATH = process.env.README_PATH || path.join(process.cwd(), 'profile', 'README.md');
const MAX_POSTS = 5;
const MAX_ACTIVITY = 5;
const MAX_RECENT_REPOS = 5;
const GITHUB_ORG = 'juanma-wp';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Optional, improves rate limits
const EXCLUDED_REPOS: string[] = []; // Repos to exclude from activity feed

// Markers to identify where to insert content
const POSTS_START_MARKER = '<!-- BLOG-POSTS:START -->';
const POSTS_END_MARKER = '<!-- BLOG-POSTS:END -->';
const ACTIVITY_START_MARKER = '<!-- GITHUB-ACTIVITY:START -->';
const ACTIVITY_END_MARKER = '<!-- GITHUB-ACTIVITY:END -->';
const REPOS_START_MARKER = '<!-- RECENT-REPOS:START -->';
const REPOS_END_MARKER = '<!-- RECENT-REPOS:END -->';
const FEATURED_START_MARKER = '<!-- FEATURED-REPOS:START -->';
const FEATURED_END_MARKER = '<!-- FEATURED-REPOS:END -->';

interface BlogPost {
  title: string;
  link: string;
  date: string;
}

interface GitHubActivity {
  type: 'commit' | 'release';
  repo: string;
  repoUrl: string;
  date: Date;
  message?: string;
  sha?: string;
  url: string;
  name?: string;
}

interface GitHubRepo {
  name: string;
  html_url: string;
  updated_at: string;
  fork: boolean;
  description?: string;
  topics?: string[];
  owner: {
    login: string;
  };
}

interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      date: string;
    };
  };
}

interface GitHubRelease {
  name?: string;
  tag_name: string;
  published_at: string;
  html_url: string;
}

/**
 * Fetch the latest posts from the RSS feed.
 */
async function fetchLatestPosts(feedUrl: string, maxPosts: number): Promise<BlogPost[]> {
  try {
    const response = await axios.get(feedUrl);
    const result = await parseStringPromise(response.data);

    const posts: BlogPost[] = [];
    const items = result.rss?.channel?.[0]?.item || [];

    for (let i = 0; i < Math.min(items.length, maxPosts); i++) {
      const item = items[i];
      const title = item.title?.[0] || 'Untitled';
      const link = item.link?.[0] || '';
      const pubDate = item.pubDate?.[0] || '';

      // Parse and format the date
      let formattedDate = pubDate;
      if (pubDate) {
        try {
          const date = new Date(pubDate);
          formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: '2-digit'
          });
        } catch (error) {
          console.warn(`Could not parse date: ${pubDate}`);
        }
      }

      posts.push({
        title,
        link,
        date: formattedDate
      });
    }

    return posts;
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

/**
 * Fetch recent commits and releases from organization repos.
 */
async function fetchGitHubActivity(orgName: string, maxItems: number): Promise<GitHubActivity[]> {
  try {
    // Prepare headers with token if available
    const headers: any = {
      'Accept': 'application/vnd.github.v3+json'
    };
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `token ${GITHUB_TOKEN}`;
      console.log('Using authenticated GitHub API requests');
    }

    // Get organization repos
    const orgReposUrl = `https://api.github.com/orgs/${orgName}/repos?per_page=100&type=all&sort=updated`;

    let repos: GitHubRepo[] = [];
    try {
      const orgReposResponse = await axios.get<GitHubRepo[]>(orgReposUrl, { headers });
      repos = orgReposResponse.data.filter(
        r => !r.fork && !EXCLUDED_REPOS.includes(r.name)
      );
      console.log(`Found ${repos.length} organization non-fork repositories from ${orgName}`);
    } catch (error: any) {
      console.error(`Could not fetch repos from organization ${orgName}:`, error.message);
      return [];
    }

    // Sort repos by updated date
    repos.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    console.log(`Total: ${repos.length} non-fork repositories from ${orgName}`);

    const activities: GitHubActivity[] = [];

    // Fetch recent commits from each repo
    for (let i = 0; i < Math.min(repos.length, 20); i++) {
      const repo = repos[i];
      const repoName = repo.name;
      const repoUrl = repo.html_url;
      const repoOwner = repo.owner.login;

      // Get commits
      const commitsUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/commits?per_page=3`;

      try {
        const commitsResponse = await axios.get<GitHubCommit[]>(commitsUrl, { headers });

        for (const commit of commitsResponse.data) {
          const commitMessage = commit.commit.message.split('\n')[0]; // First line only
          const commitDate = commit.commit.author.date;
          const commitSha = commit.sha.substring(0, 7);
          const commitUrl = commit.html_url;

          if (commitDate) {
            activities.push({
              type: 'commit',
              repo: repoName,
              repoUrl: repoUrl,
              message: commitMessage,
              sha: commitSha,
              url: commitUrl,
              date: new Date(commitDate)
            });
          }
        }
      } catch (error) {
        // Skip if commits can't be fetched (e.g., empty repo)
      }

      // Get releases
      const releasesUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases?per_page=3`;

      try {
        const releasesResponse = await axios.get<GitHubRelease[]>(releasesUrl, { headers });

        for (const release of releasesResponse.data) {
          const releaseName = release.name || release.tag_name || 'Release';
          const releaseDate = release.published_at;
          const releaseUrl = release.html_url;

          if (releaseDate) {
            activities.push({
              type: 'release',
              repo: repoName,
              repoUrl: repoUrl,
              name: releaseName,
              url: releaseUrl,
              date: new Date(releaseDate)
            });
          }
        }
      } catch (error) {
        // Skip if releases can't be fetched
      }
    }

    // Sort by date and return most recent
    activities.sort((a, b) => b.date.getTime() - a.date.getTime());
    return activities.slice(0, maxItems);

  } catch (error) {
    console.error('Error fetching GitHub activity:', error);
    return [];
  }
}

interface RepoWithCommit extends GitHubRepo {
  lastCommit?: {
    sha: string;
    url: string;
    message: string;
    date: Date;
  };
}

/**
 * Fetch the most recently updated repositories from the organization with their last commits.
 * Excludes repositories with the "featured" topic to avoid duplication.
 */
async function fetchRecentRepos(orgName: string, maxRepos: number): Promise<RepoWithCommit[]> {
  try {
    // Prepare headers with token if available
    const headers: any = {
      'Accept': 'application/vnd.github.mercy-preview+json' // Required for topics API
    };
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }

    // Get organization repos - fetch more to ensure we get enough after filtering
    const fetchCount = Math.max(maxRepos * 3, 15); // Fetch more to account for forks and featured repos
    const orgReposUrl = `https://api.github.com/orgs/${orgName}/repos?per_page=${fetchCount}&type=all&sort=updated`;

    try {
      const orgReposResponse = await axios.get<GitHubRepo[]>(orgReposUrl, { headers });
      // Filter out forks and featured repos, then get exactly maxRepos repositories
      const repos = orgReposResponse.data
        .filter(r => !r.fork && (!r.topics || !r.topics.includes('featured')))
        .slice(0, maxRepos);

      console.log(`Found ${repos.length} recent non-fork, non-featured repositories from ${orgName}`);

      // Fetch the last commit for each repository
      const reposWithCommits: RepoWithCommit[] = [];
      for (const repo of repos) {
        const repoWithCommit: RepoWithCommit = { ...repo };

        // Get the last commit
        const commitsUrl = `https://api.github.com/repos/${repo.owner.login}/${repo.name}/commits?per_page=1`;
        try {
          const commitsResponse = await axios.get<GitHubCommit[]>(commitsUrl, { headers });
          if (commitsResponse.data.length > 0) {
            const commit = commitsResponse.data[0];
            repoWithCommit.lastCommit = {
              sha: commit.sha.substring(0, 7),
              url: commit.html_url,
              message: commit.commit.message.split('\n')[0], // First line only
              date: new Date(commit.commit.author.date)
            };
          }
        } catch (error) {
          // If we can't get the commit, just continue without it
          console.log(`Could not fetch last commit for ${repo.name}`);
        }

        reposWithCommits.push(repoWithCommit);
      }

      return reposWithCommits;
    } catch (error: any) {
      console.error(`Could not fetch recent repos from organization ${orgName}:`, error.message);
      return [];
    }
  } catch (error) {
    console.error('Error fetching recent repos:', error);
    return [];
  }
}

/**
 * Generate markdown for the posts section.
 */
function generatePostsMarkdown(posts: BlogPost[]): string {
  const lines = [POSTS_START_MARKER];

  for (const post of posts) {
    lines.push(`- [${post.title}](${post.link}) - ${post.date}`);
  }

  lines.push(POSTS_END_MARKER);
  return lines.join('\n');
}

/**
 * Generate markdown for GitHub activity.
 */
function generateActivityMarkdown(activities: GitHubActivity[]): string {
  if (activities.length === 0) {
    return `${ACTIVITY_START_MARKER}\n*No recent activity*\n${ACTIVITY_END_MARKER}`;
  }

  const lines = [ACTIVITY_START_MARKER];

  for (const activity of activities) {
    const formattedDate = activity.date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: '2-digit'
    });

    if (activity.type === 'commit') {
      lines.push(
        `- **[${activity.repo}](${activity.repoUrl})**: [${activity.sha}](${activity.url}) - ${activity.message} (${formattedDate})`
      );
    } else if (activity.type === 'release') {
      lines.push(
        `- **[${activity.repo}](${activity.repoUrl})**: Released [${activity.name}](${activity.url}) (${formattedDate})`
      );
    }
  }

  lines.push(ACTIVITY_END_MARKER);
  return lines.join('\n');
}

/**
 * Fetch repositories with "featured" topic from the organization.
 */
async function fetchFeaturedRepos(orgName: string): Promise<RepoWithCommit[]> {
  try {
    // Prepare headers with token if available
    const headers: any = {
      'Accept': 'application/vnd.github.mercy-preview+json' // Required for topics API
    };
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }

    // Get all organization repos
    const orgReposUrl = `https://api.github.com/orgs/${orgName}/repos?per_page=100&type=all`;

    try {
      const orgReposResponse = await axios.get<GitHubRepo[]>(orgReposUrl, { headers });
      // Filter repos that have the "featured" topic and are not forks
      const featuredRepos = orgReposResponse.data.filter(
        r => !r.fork && r.topics && r.topics.includes('featured')
      );

      console.log(`Found ${featuredRepos.length} featured repositories from ${orgName}`);

      // Sort by updated date
      featuredRepos.sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      // Fetch the last commit for each featured repository
      const reposWithCommits: RepoWithCommit[] = [];
      for (const repo of featuredRepos) {
        const repoWithCommit: RepoWithCommit = { ...repo };

        // Get the last commit
        const commitsUrl = `https://api.github.com/repos/${repo.owner.login}/${repo.name}/commits?per_page=1`;
        try {
          const commitsResponse = await axios.get<GitHubCommit[]>(commitsUrl, { headers });
          if (commitsResponse.data.length > 0) {
            const commit = commitsResponse.data[0];
            repoWithCommit.lastCommit = {
              sha: commit.sha.substring(0, 7),
              url: commit.html_url,
              message: commit.commit.message.split('\n')[0], // First line only
              date: new Date(commit.commit.author.date)
            };
          }
        } catch (error) {
          // If we can't get the commit, just continue without it
          console.log(`Could not fetch last commit for ${repo.name}`);
        }

        reposWithCommits.push(repoWithCommit);
      }

      return reposWithCommits;
    } catch (error: any) {
      console.error(`Could not fetch featured repos from organization ${orgName}:`, error.message);
      return [];
    }
  } catch (error) {
    console.error('Error fetching featured repos:', error);
    return [];
  }
}

/**
 * Generate markdown for recent repositories.
 */
function generateRecentReposMarkdown(repos: RepoWithCommit[]): string {
  if (repos.length === 0) {
    return `${REPOS_START_MARKER}\n*No repositories found*\n${REPOS_END_MARKER}`;
  }

  const lines = [REPOS_START_MARKER];

  for (const repo of repos) {
    // Start with repo name
    let line = `- **[${repo.name}](${repo.html_url})**`;

    // Add description if available
    if (repo.description) {
      line += `: ${repo.description}`;
    }

    // Add last commit details if available
    if (repo.lastCommit) {
      const commitDate = repo.lastCommit.date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: '2-digit'
      });

      line += `\n  - <small><em>Last commit: [${repo.lastCommit.sha}](${repo.lastCommit.url}) - ${repo.lastCommit.message} (${commitDate})</em></small>`;
    } else {
      // Fallback if we couldn't fetch the last commit
      const updatedDate = new Date(repo.updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: '2-digit'
      });
      line += `\n  - <small><em>Last updated: ${updatedDate}</em></small>`;
    }

    lines.push(line);
  }

  lines.push(REPOS_END_MARKER);
  return lines.join('\n');
}

/**
 * Generate markdown for featured repositories with the "featured" topic.
 */
function generateFeaturedReposMarkdown(repos: RepoWithCommit[]): string {
  if (repos.length === 0) {
    return `${FEATURED_START_MARKER}\n*No featured repositories found. Add the "featured" topic to repositories you want to highlight.*\n${FEATURED_END_MARKER}`;
  }

  const lines = [FEATURED_START_MARKER];

  for (const repo of repos) {
    // Start with repo name
    let line = `- **[${repo.name}](${repo.html_url})**`;

    // Add description if available
    if (repo.description) {
      line += `: ${repo.description}`;
    }

    // Add last commit details with small/em formatting
    if (repo.lastCommit) {
      const commitDate = repo.lastCommit.date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: '2-digit'
      });

      line += `\n  - <small><em>Last commit: [${repo.lastCommit.sha}](${repo.lastCommit.url}) - ${repo.lastCommit.message} (${commitDate})</em></small>`;
    } else {
      // Fallback if we couldn't fetch the last commit
      const updatedDate = new Date(repo.updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: '2-digit'
      });
      line += `\n  - <small><em>Last updated: ${updatedDate}</em></small>`;
    }

    lines.push(line);
  }

  lines.push(FEATURED_END_MARKER);
  return lines.join('\n');
}

/**
 * Update a specific section in the README between markers.
 */
function updateReadmeSection(
  content: string,
  startMarker: string,
  endMarker: string,
  newContentMd: string
): string {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex + endMarker.length);
    return before + newContentMd + after;
  }

  return content;
}

/**
 * Update the README file with the latest posts, GitHub activity, recent repos, and featured repos.
 */
function updateReadme(
  readmePath: string,
  postsMarkdown: string,
  activityMarkdown: string,
  recentReposMarkdown: string,
  featuredReposMarkdown: string
): void {
  let content = fs.readFileSync(readmePath, 'utf-8');
  let sectionsUpdated = 0;

  // Update posts section if markdown is provided
  if (postsMarkdown) {
    content = updateReadmeSection(
      content,
      POSTS_START_MARKER,
      POSTS_END_MARKER,
      postsMarkdown
    );
    sectionsUpdated++;
  }

  // Update activity section if markdown is provided
  if (activityMarkdown) {
    content = updateReadmeSection(
      content,
      ACTIVITY_START_MARKER,
      ACTIVITY_END_MARKER,
      activityMarkdown
    );
    sectionsUpdated++;
  }

  // Update recent repos section if markdown is provided
  if (recentReposMarkdown) {
    content = updateReadmeSection(
      content,
      REPOS_START_MARKER,
      REPOS_END_MARKER,
      recentReposMarkdown
    );
    sectionsUpdated++;
  }

  // Update featured repos section if markdown is provided
  if (featuredReposMarkdown) {
    content = updateReadmeSection(
      content,
      FEATURED_START_MARKER,
      FEATURED_END_MARKER,
      featuredReposMarkdown
    );
    sectionsUpdated++;
  }

  if (sectionsUpdated > 0) {
    fs.writeFileSync(readmePath, content, 'utf-8');
    console.log(`✓ README updated successfully (${sectionsUpdated} section${sectionsUpdated === 1 ? '' : 's'} updated)`);
  } else {
    console.log('No sections were updated');
  }
}

/**
 * Check if markers exist in the README content.
 */
function hasMarkers(content: string, startMarker: string, endMarker: string): boolean {
  return content.includes(startMarker) && content.includes(endMarker);
}

/**
 * Main function to fetch posts, GitHub activity, and update README.
 */
async function main(): Promise<void> {
  try {
    // Check if README exists
    if (!fs.existsSync(README_PATH)) {
      console.error(`README not found at ${README_PATH}`);
      process.exit(1);
    }

    // Read the README content to check which sections to update
    const readmeContent = fs.readFileSync(README_PATH, 'utf-8');

    // Check which markers are present
    const hasBlogPosts = hasMarkers(readmeContent, POSTS_START_MARKER, POSTS_END_MARKER);
    const hasGitHubActivity = hasMarkers(readmeContent, ACTIVITY_START_MARKER, ACTIVITY_END_MARKER);
    const hasRecentRepos = hasMarkers(readmeContent, REPOS_START_MARKER, REPOS_END_MARKER);
    const hasFeaturedRepos = hasMarkers(readmeContent, FEATURED_START_MARKER, FEATURED_END_MARKER);

    if (!hasBlogPosts && !hasGitHubActivity && !hasRecentRepos && !hasFeaturedRepos) {
      console.log('No update markers found in README. Nothing to update.');
      return;
    }

    let postsMarkdown = '';
    let activityMarkdown = '';
    let recentReposMarkdown = '';
    let featuredReposMarkdown = '';

    // Fetch blog posts only if markers exist
    if (hasBlogPosts) {
      console.log(`Fetching latest ${MAX_POSTS} posts from ${RSS_FEED_URL}...`);
      const posts = await fetchLatestPosts(RSS_FEED_URL, MAX_POSTS);
      console.log(`✓ Found ${posts.length} posts`);
      postsMarkdown = generatePostsMarkdown(posts);
    } else {
      console.log('Blog posts section not found in README, skipping...');
    }

    // Fetch GitHub activity only if markers exist
    if (hasGitHubActivity) {
      console.log(`Fetching GitHub activity from organization ${GITHUB_ORG}...`);
      const activities = await fetchGitHubActivity(GITHUB_ORG, MAX_ACTIVITY);
      console.log(`✓ Found ${activities.length} recent activities`);
      activityMarkdown = generateActivityMarkdown(activities);
    } else {
      console.log('GitHub activity section not found in README, skipping...');
    }

    // Fetch recent repos only if markers exist
    if (hasRecentRepos) {
      console.log(`Fetching ${MAX_RECENT_REPOS} most recent repositories from ${GITHUB_ORG}...`);
      const recentRepos = await fetchRecentRepos(GITHUB_ORG, MAX_RECENT_REPOS);
      console.log(`✓ Found ${recentRepos.length} recent repositories`);
      recentReposMarkdown = generateRecentReposMarkdown(recentRepos);
    } else {
      console.log('Recent repositories section not found in README, skipping...');
    }

    // Fetch featured repos only if markers exist
    if (hasFeaturedRepos) {
      console.log(`Fetching featured repositories from ${GITHUB_ORG}...`);
      const featuredRepos = await fetchFeaturedRepos(GITHUB_ORG);
      console.log(`✓ Found ${featuredRepos.length} featured repositories`);
      featuredReposMarkdown = generateFeaturedReposMarkdown(featuredRepos);
    } else {
      console.log('Featured repositories section not found in README, skipping...');
    }

    // Update README with only the sections that exist
    updateReadme(README_PATH, postsMarkdown, activityMarkdown, recentReposMarkdown, featuredReposMarkdown);

    console.log('✓ Done!');
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main();
}