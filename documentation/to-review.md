# Recommended Skills

To maintain and develop CocoaBridge effectively, you should have a working grasp of the following. They're ordered roughly by how often you'll encounter them day-to-day.

---

## 1. JavaScript / Node.js

The backend is plain JavaScript (Node.js with ES modules). No TypeScript on the backend currently.

- [Node.js docs](https://nodejs.org/en/docs)
- [MDN JavaScript reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- Focus on: async/await, ES modules (`import`/`export`), the event loop

---

## 2. React

The frontend is React 19. Understanding hooks and component composition is essential before touching the frontend.

- [React docs](https://react.dev)
- Focus on: `useState`, `useEffect`, `useContext`, custom hooks, React Router (`useNavigate`, `useParams`)

---

## 3. TanStack Query

Every API call in the frontend goes through TanStack Query. Understand this before making any frontend data changes.

- [TanStack Query docs](https://tanstack.com/query/latest)
- Focus on: `useQuery` (for fetching), `useMutation` (for writes), query invalidation, loading/error states

---

## 4. Tailwind CSS + DaisyUI

All styling uses Tailwind utility classes. DaisyUI provides pre-built component classes (buttons, modals, tables, etc.) built on top of Tailwind.

- [Tailwind CSS docs](https://tailwindcss.com/docs)
- [DaisyUI docs](https://daisyui.com/docs)

---

## 5. Prisma

The ORM used to interact with the PostgreSQL database. You'll use it whenever touching data models or writing DB queries.

- [Prisma docs](https://www.prisma.io/docs)
- Focus on: schema syntax, `prisma migrate`, `prisma generate`, the Prisma Client query API (`findMany`, `upsert`, `create`, `update`, etc.)

---

## 6. SQL / Relational Data

The database is PostgreSQL (hosted on Neon). A basic understanding of relational data will help you read the Prisma schema and debug data issues.

- [PostgreSQL docs](https://www.postgresql.org/docs)
- Focus on: tables, foreign keys, joins, indexes, the difference between a schema and a database

---

## 7. Git

All version control is through Git and GitHub. See `github.md` for the project's specific workflow.

- [Git docs](https://git-scm.com/doc)
- [GitHub flow guide](https://docs.github.com/en/get-started/using-github/github-flow)
- Focus on: branching, committing, pushing, pull requests, reverting

---

## 8. NPM

Package manager used across all three sub-projects (backend, frontend, mcp).

- [NPM docs](https://docs.npmjs.com)
- Key commands: `npm install`, `npm run <script>`, `npm update`

---

## 9. Inngest

You'll encounter Inngest when debugging data sync issues or adding new background jobs. You don't need to be an expert, but understanding how event-driven and cron functions work will help.

- [Inngest docs](https://www.inngest.com/docs)
- Focus on: how cron functions are defined, how to trigger them manually, how to read the Inngest dashboard

---

## 10. Clerk

You'll encounter Clerk if you touch authentication, user management, or the auth middleware. The basics (how Clerk tokens work and how `protectRoute` middleware uses them) are enough to start.

- [Clerk docs](https://clerk.com/docs)
- Focus on: how Clerk tokens are verified server-side, the `clerkMiddleware` in Express
