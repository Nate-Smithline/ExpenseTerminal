# Git Configuration

## Setting Git User Identity

Before making your first commit, configure your Git identity:

```bash
# Set your name (appears in commit history)
git config user.name "Your Name"

# Set your email (should match your GitHub email)
git config user.email "your.email@example.com"

# Verify your settings
git config user.name
git config user.email
```

### Global vs Local Configuration

**Global (applies to all repos on your machine):**
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**Local (only for this repo):**
```bash
cd /Users/nathansmith/Desktop/ledgerterminal/LedgerTerminal
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

---

## GitHub Authentication

Git doesn't use a password directly. You'll authenticate with GitHub using one of these methods:

### Option 1: Personal Access Token (Recommended)

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with `repo` scope
3. Use it instead of a password when pushing:
   ```bash
   git push
   # Username: your-github-username
   # Password: <paste your token>
   ```

### Option 2: SSH Keys (Better for ongoing use)

1. Generate an SSH key:
   ```bash
   ssh-keygen -t ed25519 -C "your.email@example.com"
   # Press Enter to accept default location
   # Optionally set a passphrase
   ```

2. Add the key to your SSH agent:
   ```bash
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```

3. Copy your public key:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

4. Add it to GitHub:
   - Go to GitHub → Settings → SSH and GPG keys
   - Click "New SSH key"
   - Paste your public key

5. Change your remote URL to use SSH:
   ```bash
   git remote set-url origin git@github.com:yourusername/LedgerTerminal.git
   ```

---

## Initial Git Setup for This Repo

```bash
cd /Users/nathansmith/Desktop/ledgerterminal/LedgerTerminal

# Initialize git (if not already done)
git init

# Set your user info (if not set globally)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Add all files
git add .

# Make your first commit
git commit -m "Initial commit: monorepo with NestJS backend and Next.js frontend"

# Add your GitHub remote (replace with your actual repo URL)
git remote add origin https://github.com/yourusername/LedgerTerminal.git

# Push to GitHub
git push -u origin main
# Or if your default branch is 'master':
git push -u origin master
```
