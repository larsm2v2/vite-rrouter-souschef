# Clean Architecture Recipe Project

A modern recipe application leveraging Clean Architecture principles, with separate client and server components. The application allows users to manage recipes, create grocery lists, and generate new recipes using AI.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Features](#features)
- [Technologies](#technologies)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Installation](#installation)
- [Testing](#testing)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Project Structure

### Server

The server is organized according to Clean Architecture principles with the following layers:

```
src/
├── 01_entities/             # Core domain models
├── 02_use_cases/            # Application-specific business rules
├── 03_adapters/             # Interface adapters (repositories, controllers)
├── 04_factories/            # Dependency injection factories
├── 05_frameworks/           # External frameworks and tools
├── 07_tests/                # Integration and unit tests
│   ├── 01_entities/         # Entity tests
│   ├── 02_use_cases/        # Use case tests
│   ├── 03_adapters/         # Adapter tests
│   ├── 05_frameworks/       # Framework tests
│   └── app.test.ts          # Application entry point tests
```

### Clean Recipe Service

A standalone microservice that provides recipe cleaning functionality:

```
clean-recipe-service/
├── src/
│   ├── cleanRecipe.ts       # Core recipe cleaning logic
│   ├── index.ts             # Entry point
│   └── routes.ts            # API routes
```

### Client

The frontend is built with React, TypeScript, and Vite:

```
client/
├── public/                  # Public assets
└── src/
    ├── assets/              # Static assets
    ├── components/          # React components
    │   ├── Recipes/         # Recipe-related components
    │   └── SousChef/        # AI recipe generation components
    └── ...                  # Other application files
```

---

## Features

- **User Authentication:** Google OAuth integration for secure login.
- **Recipe Management:** Create, read, update, and delete recipes.
- **Grocery Lists:** Automatically generate grocery lists from recipes.
- **AI Recipe Generation:** Generate new recipes based on user preferences.
- **Clean Architecture:** Separation of concerns for better maintainability.
- **Microservice Architecture:** Recipe cleaning service as a standalone component.

---

## Technologies

### Server

- **Node.js:** JavaScript runtime
- **Express:** Web framework
- **TypeScript:** Static typing
- **PostgreSQL:** Database
- **Passport.js:** Authentication
- **Google Generative AI:** AI integration for recipe generation

### Client

- **React:** UI library
- **TypeScript:** Static typing
- **Vite:** Build tool
- **React Router:** Navigation
- **CSS Modules:** Styling

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [PostgreSQL](https://www.postgresql.org/)
- Google API credentials (for OAuth and Generative AI)

### Environment Setup

Create `.env` files in the `server` and `clean-recipe-service` directories:

<details>
<summary>Example: <strong>server/.env</strong></summary>

```env
SESSION_SECRET=your_session_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:8000/auth/google/callback
CLIENT_URL=http://localhost:5173
API_KEY=your_google_generative_ai_key
PG_USER=postgres_user
PG_HOST=localhost
PG_DATABASE=souschef
PG_PASSWORD=postgres_password
PG_PORT=5432
```
</details>

<details>
<summary>Example: <strong>clean-recipe-service/.env</strong></summary>

```env
PORT=3000
```
</details>

### Installation

#### Server

```sh
cd server
npm install
npm run build
npm start
```

#### Clean Recipe Service

```sh
cd clean-recipe-service
npm install
npm start
```

#### Client

```sh
cd client
npm install
npm run dev
```

---

## Testing

The project uses **Jest** for testing across all layers of the application:

- **Run server tests**
  ```sh
  cd server
  npm test
  ```

- **Run clean-recipe-service tests**
  ```sh
  cd clean-recipe-service
  npm test
  ```

---

## Architecture

This project follows Clean Architecture principles (still transitioning to clean architecture):

- **Entities:** Core business objects independent of frameworks
- **Use Cases:** Business logic and application-specific rules
- **Adapters:** Interfaces to external systems (repositories, controllers)
- **Factories:** Dependency injection to create use cases and repositories
- **Frameworks:** External tools like Express, PostgreSQL, and Passport

---

## Contributing

1. Fork the repository
2. Create your feature branch:  
   `git checkout -b feature/amazing-feature`
3. Commit your changes:  
   `git commit -m 'Add some amazing feature'`
4. Push to the branch:  
   `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Clean Architecture by Robert C. Martin](https://8thlight.com/blog/uncle-bob/2012/08/13/the-clean-architecture.html)
- Google Generative AI for recipe generation
- Express.js, React, and the entire open-source community
