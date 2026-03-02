# 🍋 Contributing to Lemonade SDK Interviewer

**Welcome, Contributor!** 🌟

I'm **Nova**, the Lemonade SDK Contribution Coordinator. I'm thrilled you're here to help improve the Interviewer application. We prioritize **quality over speed** and **contributor empowerment**.

This guide will help you contribute effectively while maintaining the high standards of the Lemonade ecosystem.

---

## 📜 The Golden Rules

1.  **Quality First**: We prefer one solid, well-tested PR over ten quick fixes.
2.  **Consistency**: We follow strict coding standards.
    - **TypeScript**: ESLint + Prettier
    - **Python**: Black formatting + Pylint + MyPy
3.  **Respect**: We follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 🚀 Getting Started

### 1. The Workflow
We use the **Feature Branch Workflow**. Please do NOT push directly to `main`.

1.  **Create a Branch**: `git checkout -b feature/your-feature-name`
2.  **Develop**: Write code, add tests.
3.  **Verify**: Run `npm run dev` and `npm test` locally.
4.  **Commit**: Use semantic commit messages (e.g., `feat: add voice support`, `fix: resolve db error`).
5.  **Push**: `git push origin feature/your-feature-name`
6.  **PR**: Open a Pull Request on GitHub.

### 2. Development Environment
Ensure you have:
- Node.js (v18+)
- Python (3.10+)
- PowerShell (for Windows scripts)

**Setup:**
```bash
npm install
pip install -r requirements.txt
```

---

## 🧪 Quality Standards

### TypeScript / Electron
- **Linting**: `npm run lint` must pass.
- **Type Safety**: No `any` types unless absolutely necessary.
- **Testing**: Jest tests must pass (`npm test`).

### Python (Lemonade API)
- **Formatting**: Code must be formatted with `black`.
- **Linting**: `pylint` score must be > 9.0.
- **Type Checking**: `mypy` must pass without errors.

---

## 📝 Pull Request Process

1.  **Template**: Fill out the PR template completely.
2.  **CI/CD**: Wait for all checks to pass (Node.js CI, Python CI, CodeQL).
3.  **Review**: Address all comments from reviewers.
4.  **Merge**: Once approved, squash and merge!

---

## 🎨 UI/UX Guidelines
If you are modifying the UI, please adhere to our **Lemonade Branding**:
- **Colors**: Use the defined CSS variables (Yellow/Gold accents, Stark Black/White backgrounds).
- **Typography**: Clean, high-contrast sans-serif.
- **Accessibility**: Ensure high contrast and screen reader support.

---

**Need Help?**
Check out the `.github/YOUR_WORKFLOW_GUIDE.md` for a detailed walkthrough of our git processes.

Happy Coding! 🍋
