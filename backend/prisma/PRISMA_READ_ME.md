# Prisma Setup & Schema Update Guide

## 1. Install Prisma

```bash
npm install prisma --save-dev
npm install @prisma/client
```
---

## 2. Initialize Prisma

```bash
npx prisma init
```
This creates:

* `prisma/schema.prisma`
* `.env` (for `DATABASE_URL`)

---

## 3. Configure Database Connection

Edit `.env`:

```env
DATABASE_URL="url_here"
```

Edit `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

---

## 4. Generate Prisma Client (Required)

Run this anytime the schema changes:

```bash
npx prisma generate
```

---

## 5. First Migration (New Project)

```bash
npx prisma migrate dev --name init
```

* Creates migration files
* Updates the database
* Regenerates Prisma Client

---

## 6. Using Prisma Client in Code

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;
```

---

## 7. Updating the Schema

### When you change `schema.prisma`:

#### Development

```bash
npx prisma migrate dev --name describe_change
```

* Diff schema vs DB
* Create a migration
* Apply it
* Regenerate the client

#### Production

```bash
npx prisma migrate deploy
```

**Note: Never run `migrate dev` in production**

---

## 8. Quick Schema Checks

Format schema: 
```bash
npx prisma format
```

Validate schema:

```bash
npx prisma validate
```

Open DB browser:

```bash
npx prisma studio
```