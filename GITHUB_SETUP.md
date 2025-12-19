# Steps to Push Project to GitHub

Follow these steps to upload your Clock In/Out System to GitHub:

## Step 1: Initialize Git Repository (if not already done)

Open Terminal and navigate to your project directory:

```bash
cd "/Users/abhie2005/Desktop/Clock in clock out"
```

Initialize git repository:

```bash
git init
```

## Step 2: Add All Files

Add all files to git staging:

```bash
git add .
```

Verify what will be committed (optional):

```bash
git status
```

You should see all your project files ready to be committed. Note: `node_modules/`, `.db` files, and other ignored files won't be added (thanks to `.gitignore`).

## Step 3: Make Initial Commit

```bash
git commit -m "Initial commit: Clock In/Out System with authentication and reporting"
```

## Step 4: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+" icon** in the top right corner
3. Select **"New repository"**
4. Fill in the details:
   - **Repository name**: `clock-in-clock-out` (or any name you prefer)
   - **Description**: "Full-stack clock in/out system with user authentication, reporting, and Excel export"
   - **Visibility**: Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click **"Create repository"**

## Step 5: Connect Local Repository to GitHub

GitHub will show you commands. Use these (replace `YOUR_USERNAME` with your GitHub username):

```bash
git remote add origin https://github.com/YOUR_USERNAME/clock-in-clock-out.git
```

Or if you prefer SSH (if you have SSH keys set up):

```bash
git remote add origin git@github.com:YOUR_USERNAME/clock-in-clock-out.git
```

## Step 6: Push to GitHub

```bash
git branch -M main
git push -u origin main
```

You'll be prompted to enter your GitHub username and password (or Personal Access Token).

**Note**: If you're using HTTPS and GitHub asks for a password, you need to use a **Personal Access Token** instead of your password:
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with `repo` permissions
3. Use that token as your password

## Step 7: Verify

Visit your GitHub repository URL:
```
https://github.com/YOUR_USERNAME/clock-in-clock-out
```

You should see all your files uploaded!

---

## Important Notes

✅ **What will be uploaded:**
- All source code files
- package.json files
- README.md
- .gitignore
- Project structure

❌ **What will NOT be uploaded** (thanks to .gitignore):
- node_modules/ folders
- Database files (.db, .sqlite)
- Build files
- Environment variables
- Log files
- OS-specific files

## Future Updates

Whenever you make changes and want to push updates:

```bash
git add .
git commit -m "Description of your changes"
git push
```

## Optional: Add GitHub Badges or Update README

After pushing, you can:
- Add a link to your live demo (if you deploy it)
- Add screenshots
- Update README with more details
- Add a license file

