# Install dependencies
npm install

# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only
npm run test:security     # Security tests only
npm run test:performance  # Performance tests only
npm run test:reliability  # Reliability tests only

# Run all test suites sequentially
npm run test:all

# Code quality checks
npm run lint              # Run ESLint
npm run lint:fix          # Auto-fix ESLint issues
npm run format            # Format code with Prettier
npm run format:check      # Check code formatting
