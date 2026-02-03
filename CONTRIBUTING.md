# Contributing to AI Interviewer

Thank you for your interest in contributing to AI Interviewer! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences

## How to Contribute

### Reporting Bugs

Before creating a bug report:
1. Check if the bug has already been reported in Issues
2. Update to the latest version to see if it's already fixed
3. Collect information about the bug

Include in your bug report:
- Clear, descriptive title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable
- Environment details (OS, Node version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- Use a clear, descriptive title
- Provide detailed description of the suggested enhancement
- Explain why this enhancement would be useful
- List any alternative solutions you've considered

### Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

#### Pull Request Guidelines

- Follow the existing code style
- Update documentation as needed
- Add tests for new features
- Keep changes focused - one feature per PR
- Write clear commit messages

## Development Setup

1. Clone your fork:
```bash
git clone https://github.com/your-username/interviewer.git
cd interviewer
```

2. Install dependencies:
```bash
npm install
```

3. Create a branch:
```bash
git checkout -b feature/my-feature
```

4. Start development:
```bash
npm run dev
```

## Project Structure

```
src/
├── electron_app/     # Electron main process
├── ui/              # React frontend
├── database/        # Database layer
├── services/        # Business logic
├── mcp/            # MCP integration
├── types/          # TypeScript types
└── utils/          # Utilities
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define interfaces for all data structures
- Avoid `any` type when possible
- Use meaningful variable and function names

### React

- Use functional components with hooks
- Keep components small and focused
- Use TypeScript for props
- Follow React best practices

### Styling

- Use Tailwind CSS for styling
- Follow existing design patterns
- Ensure responsive design
- Test on multiple screen sizes

### Database

- Use prepared statements
- Follow repository pattern
- Keep SQL in repository layer
- Add appropriate indexes

## Testing

### Running Tests

```bash
npm test
```

### Writing Tests

- Write unit tests for utilities and services
- Write integration tests for database operations
- Test edge cases and error conditions
- Aim for good code coverage

## Documentation

- Update README.md for user-facing changes
- Update ARCHITECTURE.md for architectural changes
- Add JSDoc comments for public APIs
- Keep documentation clear and concise

## Commit Messages

Follow conventional commits format:

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(interview): add voice input support
fix(database): correct SQLite connection handling
docs(readme): update installation instructions
```

## Review Process

1. Maintainer reviews the PR
2. Feedback may be provided
3. Make requested changes
4. Once approved, PR will be merged

## Areas for Contribution

### High Priority

- Voice input/output for interviews
- Additional AI model integrations
- Performance optimizations
- Mobile companion app
- Cloud sync functionality

### Good First Issues

- UI improvements
- Documentation enhancements
- Adding tests
- Bug fixes
- Translation support

### Advanced

- Architecture improvements
- Database migrations system
- Advanced MCP integrations
- Analytics dashboard
- Team collaboration features

## Questions?

Feel free to:
- Open an issue for discussion
- Reach out to maintainers
- Join our community discussions

Thank you for contributing! 🎉
