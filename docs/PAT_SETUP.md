# Setting up Personal Access Token for Gists

The GitHub Actions workflow needs a Personal Access Token (PAT) to fetch gist information, as the default `GITHUB_TOKEN` doesn't have permission to access gists.

## Steps to Create and Configure PAT:

### 1. Create a Personal Access Token

1. Go to GitHub Settings → [Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name like "GitHub Profile Updater"
4. Set an expiration (recommended: 90 days, and set a reminder to renew)
5. Select the following scopes:
   - `gist` (to read gist information)
   - `repo` (if you want full repo access for better API limits)
   - OR just `public_repo` (if you only need public repository access)
6. Click "Generate token"
7. **Copy the token immediately** (you won't be able to see it again!)

### 2. Add the Token to Your Repository Secrets

1. Go to your repository: https://github.com/juanma-wp/.github
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `GH_PAT`
5. Value: Paste the token you copied
6. Click "Add secret"

## How It Works

The workflow is configured to use the PAT if available, falling back to the default token:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GH_PAT || secrets.GITHUB_TOKEN }}
```

- If `GH_PAT` is set, it will use that (and gists will work)
- If not, it falls back to `GITHUB_TOKEN` (gists won't work, but everything else will)

## Token Permissions Explained

- **`gist`**: Required to read gist information including star counts
- **`repo` or `public_repo`**: Helps with API rate limits and repository access
- The default `GITHUB_TOKEN` in Actions can't access gists due to security restrictions

## Security Notes

- Never commit your PAT to the repository
- Use repository secrets to store sensitive tokens
- Regularly rotate your tokens (every 90 days is recommended)
- Use the minimum required permissions

## Troubleshooting

If you see a 403 error for gists in the GitHub Actions logs:
- Verify the `GH_PAT` secret is set correctly
- Check that the token hasn't expired
- Ensure the token has the `gist` scope

If gists still show 0 stars:
- This might be due to API caching
- Recently starred gists may take time to reflect in the API
- The script has a fallback to show recent gists when stars aren't detected