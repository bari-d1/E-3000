
## E-3000 User Flows and Technology Interactions

This document shows each user behavior in the app and which technologies handle it. Diagrams are Mermaid blocks you can paste into any Mermaid viewer.

Tech components at a glance

- UI: EJS templates, Tailwind CSS, a light touch of HTMX, vanilla JS where needed

- Server: Node.js, Express routes, Passport Local auth with express-session, bcrypt, Zod validation, Helmet, csurf, express-rate-limit, morgan

- Data: Prisma ORM, SQLite database, AuditLog table

- Deploy: Render or Railway, custom domain, daily DB backups

## 1) First visit: view Login or Register

What happens

- Express serves EJS page styled by Tailwind

- Helmet adds security headers

- csurf injects CSRF token in the form

- morgan logs the request

```mermaid
sequenceDiagram
  actor U as User
  participant B as Browser UI (EJS+Tailwind)
  participant X as Express Routes
  participant M as Helmet+csurf+morgan
  U->>X: GET /login or /register
  X->>M: Apply security, add CSRF
  X-->>B: HTML (EJS), CSRF token embedded
  B-->>U: Login or Register form
```

## 2) Register

What happens

- Zod validates fields

- bcrypt hashes password

- Prisma writes user to SQLite

- Passport starts a session, cookie set

- AuditLog records CREATE
  
```mermaid
sequenceDiagram
  actor U as User
  participant B as Browser UI
  participant X as POST /register
  participant V as Zod Validation
  participant A as bcrypt+Passport
  participant P as Prisma ORM
  participant D as SQLite DB
  participant L as AuditLog

  U->>X: POST /register (form + CSRF)
  X->>V: Validate name, email, password, gender, age range, nationality
  V-->>X: Valid
  X->>A: Hash password, create session
  X->>P: create User
  P->>D: INSERT user
  D-->>P: OK
  X->>L: write CREATE(User)
  X-->>B: 302 Redirect to /dashboard + Set-Cookie
```

## 3) Login

What happens

- Passport verifies credentials

- express-session creates session

- csurf and rate limit protect the endpoint
  
```mermaid
sequenceDiagram
  actor U as User
  participant X as POST /login
  participant A as Passport Local
  participant S as express-session
  U->>X: POST /login (email, password, CSRF)
  X->>A: verify
  A-->>X: success
  X->>S: create session
  X-->>U: 302 to /dashboard with session cookie
```

## 4) Create a new session submission

What happens

- EJS form includes CSRF token

- Zod validates types and rules

- Duplicate signature guard prevents accidental repeats

- Prisma inserts session

- AuditLog records CREATE

```mermaid
sequenceDiagram
  actor U as User
  participant B as New Session Form (EJS)
  participant X as POST /sessions
  participant V as Zod+Rules
  participant P as Prisma
  participant D as SQLite
  participant L as AuditLog

  U->>B: Fill counts and notes
  B->>X: POST /sessions (CSRF)
  X->>V: validate ints, gospel>=3, witness>=3, caps <= engaged, duplicate signature
  V-->>X: Valid
  X->>P: create Session
  P->>D: INSERT session row
  D-->>P: OK
  X->>L: write CREATE(Session)
  X-->>B: 302 to /sessions?mine=true with success message
```

## 5) Edit or delete within 24 hours

What happens

- Guard checks edit window and role

- Zod revalidates fields on save

- Prisma updates or deletes

- AuditLog records UPDATE or DELETE

```mermaid
sequenceDiagram
  actor U as User
  participant X as GET /sessions/:id/edit
  participant G as Edit Window Guard
  participant S as POST/PATCH /sessions/:id
  participant V as Zod Validation
  participant P as Prisma
  participant D as SQLite
  participant L as AuditLog

  U->>X: Open edit page
  X->>G: check editable_until, role
  G-->>X: allowed
  U->>S: Submit changes (CSRF)
  S->>V: validate fields again
  V-->>S: valid
  S->>P: UPDATE session
  P->>D: update row
  D-->>P: OK
  S->>L: write UPDATE(Session) with diff
  S-->>U: 302 back to detail
```

## 6) View dashboard and totals

What happens

- Prisma runs aggregate queries for sums

- Date range and scope filters apply

- EJS renders cards and progress to 3000

```mermaid
sequenceDiagram
  actor U as User
  participant X as GET /dashboard?from=&to=&scope=
  participant P as Prisma aggregate
  participant D as SQLite
  participant B as EJS Dashboard

  U->>X: GET with date range and scope
  X->>P: SUM engaged, gospel, witness, decisions, prayed
  P->>D: SELECT with WHERE session_date range
  D-->>P: rows -> sums
  X-->>B: HTML with totals and progress to 3000
  B-->>U: Cards and progress bar
```

## 7) Admin views all sessions and exports CSV

What happens

- Admin lists sessions with filters

- CSV export streams rows with headers

- Rate limit guards export endpoint

```mermaid
sequenceDiagram
  actor A as Admin
  participant L as GET /sessions (All)
  participant P as Prisma
  participant D as SQLite
  participant E as GET /admin/export.csv
  A->>L: Filter list by date
  L->>P: findMany with WHERE and ORDER
  P->>D: SELECT
  D-->>P: rows
  L-->>A: HTML table
  A->>E: Download CSV
  E->>P: findMany for export
  P->>D: SELECT
  D-->>P: rows
  E-->>A: text/csv stream
```

## 8) Logout

What happens

- Passport destroys session

- Cookie cleared

- Redirect to login

```mermaid
sequenceDiagram
  actor U as User
  participant X as POST /logout
  participant S as express-session
  U->>X: POST /logout (CSRF)
  X->>S: destroy session
  X-->>U: 302 to /login and cookie cleared
```

## 9) Safeguards that trigger during flows

What happens

- express-rate-limit on POST routes

- CSRF check on every mutating request

- Duplicate signature detection

- Validation rules for numbers and ratios

- Optional suspicious flags and under review filter

```mermaid
flowchart TD
  A[POST /sessions] --> B{CSRF ok}
  B -->|no| R1[403]
  B -->|yes| C{Rate limit ok}
  C -->|no| R2[429]
  C -->|yes| D{Duplicate signature?}
  D -->|yes| R3[409 duplicate]
  D -->|no| E{Validation rules}
  E -->|fail| R4[400 with field errors]
  E -->|pass| F[Prisma INSERT + AuditLog]
```

## Scope notes

- Admins can submit sessions the same way evangelists do

- Aggregates are computed on demand for simplicity and freshness

- Daily backups and environment variables are part of ops hygiene