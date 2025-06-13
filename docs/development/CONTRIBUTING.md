# Contributing to Serverless Agent Architecture Starter

Thank you for your interest in contributing to the Serverless Agent Architecture Starter! This project aims to provide a solid foundation for developers building AI-powered applications with serverless architectures.

## 🤝 Code of Conduct

By participating in this project, you agree to:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## 🔍 Before You Begin

### Check Existing Issues

Before creating a new issue or pull request, please:

1. **Search existing issues** to see if your problem/idea has already been reported
2. **Check closed issues** as your question may have already been answered
3. **Review pull requests** to ensure you're not duplicating effort

### Create an Issue First

For any significant changes, please create an issue first to discuss:

- **Bug reports**: Describe the bug, steps to reproduce, and expected behavior
- **Feature requests**: Explain the feature and why it would be valuable
- **Architecture improvements**: Suggest enhancements to the pattern
- **Documentation**: Propose better ways to explain the architecture
- **Questions**: Ask in issues if you need clarification

This helps ensure your time is well spent and aligns with the project direction.

## 🛠️ How to Contribute

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/yourusername/serverless-agents.git
cd serverless-agents
git remote add upstream https://github.com/brookr/serverless-agents.git
```

### 2. Create a Branch

```bash
# Create a branch for your feature or fix
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 3. Set Up Development Environment

Follow the setup instructions in the README:

```bash
# Install dependencies
npm install
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env.local
# Add your API keys
```

### 4. Make Your Changes

- **Write clean code** that follows the existing style
- **Add tests** if applicable
- **Update documentation** if you change functionality
- **Keep commits focused** - one feature/fix per commit
- **Write descriptive commit messages**
- **Consider the starter nature** - changes should benefit all users

### 5. Test Your Changes

```bash
# Run the development servers
npm run dev  # In one terminal
uvicorn api.agents:app --reload --port 8000  # In another

# Check for TypeScript errors
npm run build

# Lint your code
npm run lint
```

### 6. Submit a Pull Request

1. Push your branch to your fork
2. Create a pull request from your branch to `main`
3. Fill out the PR template with:
   - What changes you made
   - Why you made them
   - How it improves the starter
   - Any breaking changes
   - Related issue numbers

## 📝 Pull Request Guidelines

### PR Title Format

- `feat: Add new feature` - New features
- `fix: Fix issue with...` - Bug fixes
- `docs: Update README` - Documentation changes
- `style: Format code` - Code style changes
- `refactor: Restructure agent workflow` - Code refactoring
- `test: Add tests for...` - Test additions
- `chore: Update dependencies` - Maintenance tasks
- `example: Add new use case` - Example implementations

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated if needed
- [ ] Tests pass locally
- [ ] No console errors or warnings
- [ ] Related issue linked
- [ ] Consider impact on users adapting the starter

## 🐛 Reporting Bugs

When reporting bugs, include:

1. **Environment**: OS, Node version, Python version
2. **Steps to reproduce**: Clear, numbered steps
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Screenshots/logs**: If applicable
6. **Possible solution**: If you have ideas

## 💡 Suggesting Features

When suggesting features:

1. **Use case**: Explain who would benefit and how
2. **Architecture fit**: How it enhances the pattern
3. **Current limitation**: What can't be done now
4. **Proposed solution**: Your idea for implementation
5. **Alternatives**: Other ways to solve the problem
6. **Additional context**: Mockups, examples, etc.

## 🏗️ Project Structure Guide

Understanding the codebase:

- `/src/app/` - Next.js pages and API routes
- `/src/components/` - React components
- `/src/inngest/` - Workflow orchestration
- `/api/` - Python FastAPI agents
- `/src/lib/` - Utility functions and styles

## 🚀 Areas for Contribution

Looking for ideas? Here are areas where we'd love help:

### Architecture Enhancements

- Improve the agent communication pattern
- Updating libraries to the latest versions
- Add middleware for common tasks
- Create utility functions for agent development
- Enhance error handling patterns
- Add monitoring and observability examples

### Documentation

- Create tutorials for different use cases
- Add architecture diagrams
- Write deployment guides for different platforms
- Document best practices
- Create video walkthroughs

### Link to Example Implementations

- Build example agents for common tasks
- Create workflow templates
- Add authentication examples
- Show integration patterns with external services
- Demonstrate testing strategies
- Add a README section for example implementations

### Developer Experience

- Improve local development setup
- Add development tools
- Create debugging utilities
- Enhance TypeScript types
- Add code generation tools

### Performance

- Implement caching strategies
- Add rate limiting examples
- Show batching patterns
- Demonstrate edge computing patterns

## 🤔 Questions?

If you have questions:

1. Check the documentation first
2. Search existing issues
3. Create a new issue with the "question" label
4. Join our discussions (if available)

## 🙏 Recognition

Contributors will be:

- Listed in the project README
- Thanked in release notes
- Given credit in commit messages

Thank you for contributing to make this starter better for everyone building serverless AI applications!

---

**Note**: This project is released under CC0, meaning your contributions will be in the public domain.
