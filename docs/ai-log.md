# AI Usage Log

## Project
Turbo Chat - CLI

## AI Tool Used
- ChatGPT by OpenAI

## Purpose of AI Assistance
AI assistance was used as a development aid for understanding requirements, implementation guidance, debugging, documentation, and testing.

## Areas Where AI Was Used

### 1. Database Design
- Discussed the DirectMessage and DmRead database models.
- Reviewed Prisma relations between User, DirectMessage, and DmRead.
- Took guidance on the migration structure and self-message CHECK constraint.
- Verified the schema using Prisma validation and migration commands.

### 2. Direct Messaging Services
- Took assistance with structuring DM service functions.
- Worked on sending messages, listing conversations, retrieving conversation history, unread counts, and marking conversations as read.
- Reviewed input validation, error handling, and pagination logic.
- Tested service behaviour against the PostgreSQL database.

### 3. REST API
- Took guidance on implementing DM and room statistics routes.
- Integrated the routers into the Express application.
- Tested authenticated and unauthenticated HTTP requests.

### 4. Socket.IO Integration
- Took assistance with the DM socket handler structure.
- Worked on personal user rooms, DM delivery, acknowledgements, recipient online status, and rate limiting.
- Tested message delivery across multiple socket connections.

### 5. Room Statistics and Query Analysis
- Took assistance with the SQL query for finding the five most active rooms over the last seven days.
- Used EXPLAIN ANALYZE to inspect query execution.
- Documented the observed execution plan and performance.

### 6. Testing and Debugging
- Used AI assistance to understand errors and identify possible fixes.
- Prepared HTTP and Socket.IO test scripts.
- Ran the tests locally and checked the actual responses.
- Verified Prisma schema validation and migration status.

### 7. Documentation and Git
- Took assistance with documenting API contracts and database schema changes.
- Received guidance on staging only the relevant feature files, reviewing diffs, committing, and pushing the feature branch.
- Created and submitted a Pull Request for review.

## Human Verification and Responsibility

AI suggestions were reviewed and adapted during implementation rather than blindly accepted.

The developer:
- Ran the application locally.
- Executed database migrations and Prisma validation.
- Tested the DM services against the database.
- Ran the shell-based HTTP tests.
- Ran the Socket.IO integration tests.
- Reviewed Git changes before committing.
- Pushed the feature branch and completed the Pull Request workflow.

Final implementation decisions, local execution, testing, debugging, and verification were performed by the developer.

## Verification Summary

- Prisma schema validation: Passed
- Database migration: Applied successfully
- DM service tests: Passed
- Socket.IO DM tests: Passed
- Shell-based HTTP tests: Passed
- Feature branch pushed to GitHub
- Pull Request created, reviewed, and merged

## Note

AI was used as an assistance tool for learning, implementation guidance, debugging, and documentation. It was not treated as a substitute for running and verifying the application.
