# Contributing to eAushadhi Integration Plugin

Thank you for your interest in contributing to the eAushadhi Integration Plugin for CARE! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project follows the CARE Community Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/care_eaushadhi_fe.git
   cd care_eaushadhi_fe
   ```
3. **Add the upstream repository**:
   ```bash
   git remote add upstream https://github.com/care-ecosystem/care_eaushadhi_fe.git
   ```

## Development Setup

### Prerequisites

- Node.js (refer to CARE FE for exact version)
- npm or yarn
- Git
- CARE FE repository cloned locally
- Backend plugins running (care_eaushadhi, super_batch_request)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Configure CARE FE to use local plugin:
   ```bash
   REACT_ENABLED_APPS="care-ecosystem/care_eaushadhi_fe@localhost:5177"
   ```

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected behavior**
- **Actual behavior**
- **Screenshots** (if applicable)
- **Environment details** (OS, browser, CARE version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear title and description**
- **Detailed explanation** of the proposed functionality
- **Use cases** and benefits
- **Mockups or examples** (if applicable)

### Code Contributions

1. **Pick an issue** or create a new one discussing your proposed changes
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes** following the coding standards
4. **Test your changes** thoroughly
5. **Commit your changes** with clear commit messages
6. **Push to your fork**:
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Create a Pull Request** on GitHub

## Coding Standards

### TypeScript/React Guidelines

- Use **TypeScript** for all new code
- Follow **React Hooks** patterns
- Use **functional components** (no class components)
- Implement **proper prop types** and interfaces
- Add **JSDoc comments** for complex functions

### Code Style

- Use **ESLint** configuration provided in the repository
- Format code with **Prettier**
- Use **meaningful variable and function names**
- Keep functions **small and focused**
- Follow **DRY principle** (Don't Repeat Yourself)

### File Organization

```
src/
├── components/
│   ├── ui/              # Reusable UI components
│   └── pluggables/      # CARE pluggable components
├── pages/               # Page components
├── contexts/            # React context providers
├── lib/                 # Utility functions and constants
└── apis/                # API integration code
```

### Component Guidelines

- Place reusable components in `components/ui/`
- Place pluggable components in `components/pluggables/`
- Place page components in `pages/`
- Use consistent naming: `ComponentName.tsx`
- Export default for main component, named exports for utilities

### Styling

- Use **Tailwind CSS** for styling
- Follow existing utility class patterns
- Avoid inline styles unless necessary
- Use CSS modules for component-specific styles (if needed)

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```bash
feat(delivery): add bulk delete functionality

Add ability to delete multiple delivery items at once.
Implements permission-based deletion control.

Closes #123
```

```bash
fix(mapping): resolve product mapping search issue

Fixed issue where product search was not returning results
for eAushadhi drug names with special characters.

Fixes #456
```

## Pull Request Process

1. **Update documentation** if you're changing functionality
2. **Add tests** for new features
3. **Ensure all tests pass**
4. **Update CHANGELOG.md** with your changes
5. **Request review** from maintainers
6. **Address review comments** promptly
7. **Squash commits** if requested

### PR Title Format

Use the same format as commit messages:
```
feat(component): brief description
```

### PR Description Template

```markdown
## Description
[Describe what this PR does]

## Related Issue
Fixes #[issue number]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
[Describe how you tested your changes]

## Screenshots (if applicable)
[Add screenshots here]

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests
- [ ] All tests pass locally
```

## Testing

### Running Tests

```bash
npm run test
```

### Writing Tests

- Write tests for all new features
- Update tests when modifying existing features
- Aim for high test coverage
- Test edge cases and error scenarios

### Test Guidelines

- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Test both success and failure scenarios

## Documentation

### Code Documentation

- Add JSDoc comments for:
  - All exported functions
  - Complex logic
  - Component props interfaces
- Include examples in documentation
- Document parameters and return values

### README Updates

Update README.md when you:
- Add new features
- Change existing functionality
- Update dependencies
- Modify setup instructions

### Internationalization (i18n)

When adding new user-facing text:
1. Add key to `public/locale/en.json`
2. Use `useTranslation` hook to access translations
3. Follow existing naming conventions for keys

## Questions?

If you have questions:
- Check existing [documentation](README.md)
- Search [existing issues](https://github.com/care-ecosystem/care_eaushadhi_fe/issues)
- Ask in CARE Community forums
- Create a new issue with the `question` label

## License

By contributing, you agree that your contributions will be licensed under the ISC License.

---

Thank you for contributing to the eAushadhi Integration Plugin! 🎉
