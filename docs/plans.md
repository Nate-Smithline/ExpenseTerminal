# ExpenseTax — Cursor Build Spec
> Drop this file into your Cursor project as context. Reference it with `@expensetax-cursor-spec.md` in your prompts.

---

## Project overview

Rebuild of ExpenseTerminal into a hyper-simple tax deduction + cash management platform for side hustlers. The core promise: connect your bank, we find what you're missing at tax time — no manual tagging, no spreadsheets, no jargon.

**Design north star:** Apple-level simplicity. Every screen answers one question. The AI does the work; the user confirms or corrects.

**Current state:** A working version exists at expenseterminal.com. It is too complex — it requires users to manually tag every transaction and has too many steps before any value is shown. This rebuild starts fresh in phases.

---

## Tech stack assumptions

> Update this section to match your actual stack before using with Cursor.

- **Framework:** Next.js (App Router)
- **Database:** PostgreSQL via Prisma
- **Auth:** Clerk or NextAuth
- **Bank data:** Plaid (Transactions + Balance APIs)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Storage:** Supabase or AWS S3 (for export files)
- **Styling:** Tailwind CSS
- **Background jobs:** Inngest or Vercel Cron

---

## Phased build plan

### Phase 1 — Core loop (build this first)
The minimum that delivers a "wow" moment to a new user.

- [ ] Plaid connection + transaction sync
- [ ] Transaction rename algorithm (raw → clean name)
- [ ] Merchant memory table (learn from past renames + user corrections)
- [ ] Categorization + deduction scoring algorithm
- [ ] `CalculatedDeduction` model + calculation engine (home office dual-method, mileage, phone, internet, health insurance)
- [ ] Data source setup page (connect account, set lookback, set account type)
- [ ] Inbox page (mixed-account transactions needing review)
- [ ] Deductions page (manual deductions section + transaction deductions)
- [ ] Onboarding flow (4 screens: hustle type → calculated deductions setup → connect bank → first scan result)

### Phase 2 — Full app shell
- [ ] Home dashboard (3 hero metrics, pending banner, recent transactions)
- [ ] Transactions page (full ledger, search, filters)
- [ ] Sidebar with persistent search panel + account switcher
- [ ] Workspace / account switcher (multi-entity support)
- [ ] Settings page

### Phase 3 — Tax + cash
- [ ] Tax report page (by year and by quarter, export PDF/CSV)
- [ ] Cash snapshot page (balances, income vs expense trend)
- [ ] Daily Plaid sync cron job

### Phase 4 — Education + polish
- [ ] Help & learn page (contextual explainers)
- [ ] In-card deduction info tooltips
- [ ] Notification system (sync status, inbox badges)
- [ ] Team members / multi-user workspaces

---

## Data model

### Core design principles for the schema

1. Always store the raw Plaid data untouched alongside normalized fields.
2. Merchant memory lives in its own table — it is the intelligence layer.
3. User corrections are first-class data, not overrides.
4. Every transaction carries enough context to be independently useful (no joins required for display).
5. Calculated deductions (home office, mileage, phone, etc.) are first-class deductions — they live in their own table and flow into tax reports alongside transaction-based deductions.
6. For home office, always calculate both IRS methods behind the scenes and store both. Surface whichever is larger to the user, never ask them to choose.

---

### `workspaces`
Multi-entity support. One user can have multiple workspaces (e.g. "John Doe Plumbing", "Smith Family").

```prisma
model Workspace {
  id              String   @id @default(cuid())
  name            String                          // "John Doe Plumbing"
  businessType    String?                         // freelance | gig | creator | ecommerce | other
  taxFilingStatus String?                         // single | married_joint | married_separate | head_of_household
  fiscalYearStart Int      @default(1)            // month number (1 = January)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  members               WorkspaceMember[]
  dataSources           DataSource[]
  transactions          Transaction[]
  merchantMemory        MerchantMemory[]
  userTags              UserTag[]
  calculatedDeductions  CalculatedDeduction[]
}
```

### `workspace_members`

```prisma
model WorkspaceMember {
  id          String    @id @default(cuid())
  workspaceId String
  userId      String
  role        String    @default("member")       // owner | admin | member
  joinedAt    DateTime  @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id])
}
```

### `calculated_deductions`
Non-transaction deductions entered manually during onboarding or from the Deductions page. Covers home office, mileage, phone, internet, health insurance, retirement, and anything custom. Stored per tax year so the user can update them annually without losing history.

```prisma
model CalculatedDeduction {
  id              String   @id @default(cuid())
  workspaceId     String
  year            Int                              // tax year (e.g. 2025)
  type            String                           // home_office | mileage | phone | internet | health_insurance | retirement | other
  label           String?                          // custom label when type = other

  // ── Home office inputs ──────────────────────────────────────────────────
  // Used for both the simplified and regular IRS methods. We calculate both
  // and store both; the UI always shows whichever is larger.
  workspaceSqFt       Float?                       // dedicated office sq footage
  totalHomeSqFt       Float?                       // total home sq footage
  monthlyRent         Float?                       // monthly rent/mortgage payment
  monthlyUtilities    Float?                       // optional: utilities for regular method
  // Derived home office results (calculated on save, never manually set)
  homeOfficePercent         Float?                 // workspaceSqFt / totalHomeSqFt
  homeOfficeSimplified      Float?                 // min(workspaceSqFt, 300) × $5 (IRS simplified)
  homeOfficeRegular         Float?                 // homeOfficePercent × (rent + utilities) × 12
  homeOfficeMethodUsed      String?                // "simplified" | "regular" — whichever is larger
  homeOfficeAnnualDeduction Float?                 // the winning method's annual amount

  // ── Mileage inputs ───────────────────────────────────────────────────────
  miles           Float?                           // business miles driven this year
  irsRatePerMile  Float?                           // IRS standard mileage rate for the year (e.g. 0.70 for 2025)
  // Derived
  mileageAnnualDeduction Float?                    // miles × irsRatePerMile

  // ── Percentage-based inputs (phone, internet) ────────────────────────────
  monthlyBillAmount   Float?                       // total monthly bill
  businessUsePercent  Float?                       // 0–100 (e.g. 50 for 50% business use)
  // Derived
  percentageAnnualDeduction Float?                 // monthlyBillAmount × 12 × (businessUsePercent / 100)

  // ── Fixed-amount inputs (health insurance, retirement, other) ────────────
  annualAmount    Float?                           // user-entered annual total

  // ── Final deduction amount ───────────────────────────────────────────────
  // This is the field that flows into the tax report. Set by the calculation
  // engine on save — never set directly.
  annualDeduction Float   @default(0)              // the actual deductible amount for this year

  // ── Metadata ─────────────────────────────────────────────────────────────
  isConfirmed     Boolean @default(false)          // user has reviewed and confirmed this
  userNote        String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace       Workspace @relation(fields: [workspaceId], references: [id])

  @@unique([workspaceId, year, type])              // one record per type per year per workspace
  @@index([workspaceId, year])
}
```

### `data_sources`
Each Plaid-connected account is a data source.

```prisma
model DataSource {
  id              String    @id @default(cuid())
  workspaceId     String
  plaidItemId     String    @unique                // Plaid item ID
  plaidAccessToken String                          // encrypted, never exposed to client
  plaidCursor     String?                          // for cursor-based sync (stores last sync position)
  institutionName String                           // "Chase", "Bank of America"
  accountName     String                           // "Checking ••4821"
  accountType     String                           // personal | business | mixed
  lookbackMonths  Int       @default(12)           // 3 | 6 | 12 | 24 | 0 (all)
  lastSyncedAt    DateTime?
  syncStatus      String    @default("pending")   // pending | syncing | success | error
  syncError       String?
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())

  workspace       Workspace   @relation(fields: [workspaceId], references: [id])
  transactions    Transaction[]
}
```

### `transactions`
The central table. Stores both the raw Plaid data and all derived fields.

```prisma
model Transaction {
  id                  String   @id @default(cuid())
  workspaceId         String
  dataSourceId        String
  
  // Raw Plaid fields — never modified
  plaidTransactionId  String   @unique
  plaidAccountId      String
  plaidRawName        String                        // "SQ *CNVS 84729 NY" — source of truth
  plaidCategory       String?                       // Plaid's own category string
  plaidAmount         Decimal                       // positive = debit, negative = credit (Plaid convention)
  plaidDate           DateTime                      // transaction date from Plaid
  plaidPending        Boolean  @default(false)
  plaidPaymentChannel String?                       // online | in store | other
  plaidRawJson        Json                          // full Plaid payload stored for reference

  // Derived — set by rename algorithm
  displayName         String?                       // "Canva" — shown in UI
  renameConfidence    Float?                        // 0.0–1.0
  renameSource        String?                       // ai | merchant_memory | user_correction
  merchantMemoryId    String?                       // FK to MerchantMemory if match found

  // Derived — set by categorization algorithm
  category            String?                       // "Software & tools", "Meals", "Travel"
  deductionSuggestions Json?                        // array of 3: [{type, label, likelihood, isSelected}]
  deductionLikelihood  String?                      // high | medium | low | none
  
  // User decisions
  status              String   @default("pending") // pending | deductible | personal | needs_review
  confirmedDeduction  String?                       // the deduction type user confirmed
  userNote            String?                       // optional note the user added
  reviewedAt          DateTime?
  reviewedBy          String?                       // userId

  // Routing
  routedToInbox       Boolean  @default(false)      // true if from a mixed account
  inboxResolvedAt     DateTime?

  // Tags
  userTags            TransactionTag[]

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  workspace           Workspace   @relation(fields: [workspaceId], references: [id])
  dataSource          DataSource  @relation(fields: [dataSourceId], references: [id])
  merchantMemory      MerchantMemory? @relation(fields: [merchantMemoryId], references: [id])

  @@index([workspaceId, plaidDate])
  @@index([workspaceId, status])
  @@index([workspaceId, routedToInbox])
}
```

### `merchant_memory`
The intelligence layer. Every time a transaction is renamed — by AI or by the user — this table learns. Future transactions with similar raw names look here first before hitting the AI.

```prisma
model MerchantMemory {
  id              String   @id @default(cuid())
  workspaceId     String
  
  // Matching
  rawNamePattern  String                           // normalized raw name used for fuzzy matching
  displayName     String                           // "Canva", "Amazon Web Services", "Blue Bottle Coffee"
  
  // Context
  defaultCategory     String?                      // most common category for this merchant
  defaultDeductionType String?                     // most common confirmed deduction type
  defaultLikelihood    String?                     // high | medium | low
  
  // Provenance
  source          String                           // ai_generated | user_correction | user_created
  confirmedCount  Int      @default(0)             // how many times a user confirmed this mapping
  correctedCount  Int      @default(0)             // how many times a user overrode this mapping
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace       Workspace     @relation(fields: [workspaceId], references: [id])
  transactions    Transaction[]

  @@unique([workspaceId, rawNamePattern])
  @@index([workspaceId, rawNamePattern])
}
```

**How merchant memory matching works at query time:**
1. Normalize the incoming raw Plaid name (lowercase, strip punctuation, collapse whitespace)
2. Exact match against `rawNamePattern` in the workspace's merchant memory
3. If no exact match, fuzzy match (Levenshtein distance ≤ 2 or token overlap ≥ 0.8)
4. If match found with `confirmedCount >= 2`, use it directly (skip AI rename)
5. If match found but low confidence, use it as a hint to the AI prompt
6. If no match, send to AI rename; save result to merchant memory

### `user_tags`
User-defined labels that can be applied to transactions. Separate from categories — these are personal organizational labels.

```prisma
model UserTag {
  id          String   @id @default(cuid())
  workspaceId String
  name        String                               // "Q1 client work", "office remodel", "side project A"
  color       String?                              // hex color for display
  createdAt   DateTime @default(now())

  workspace     Workspace        @relation(fields: [workspaceId], references: [id])
  transactions  TransactionTag[]

  @@unique([workspaceId, name])
}
```

### `transaction_tags`
Join table.

```prisma
model TransactionTag {
  transactionId String
  tagId         String
  createdAt     DateTime @default(now())

  transaction   Transaction @relation(fields: [transactionId], references: [id])
  tag           UserTag     @relation(fields: [tagId], references: [id])

  @@id([transactionId, tagId])
}
```

### `notifications`

```prisma
model Notification {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String?
  type        String                               // sync_complete | sync_error | member_joined | inbox_new
  title       String
  body        String?
  metadata    Json?
  readAt      DateTime?
  createdAt   DateTime @default(now())
}
```

---

## Technical component specs

### 0. Calculated deduction engine

**File:** `lib/calculations/calculated-deductions.ts`

This runs any time a `CalculatedDeduction` record is created or updated. It populates all derived fields and sets `annualDeduction` to the correct final amount. Never let the client send `annualDeduction` directly — always recalculate server-side.

```typescript
// IRS rates — update annually
const IRS_RATES = {
  mileage: {
    2024: 0.67,
    2025: 0.70,
  },
  homeOfficeSimplifiedRatePerSqFt: 5.00,   // $5/sq ft (IRS simplified method)
  homeOfficeSimplifiedMaxSqFt: 300,         // max 300 sq ft for simplified method
}

function calculateHomeOffice(input: {
  workspaceSqFt: number
  totalHomeSqFt: number
  monthlyRent: number
  monthlyUtilities?: number
  year: number
}): {
  homeOfficePercent: number
  homeOfficeSimplified: number
  homeOfficeRegular: number
  homeOfficeMethodUsed: 'simplified' | 'regular'
  homeOfficeAnnualDeduction: number
} {
  const { workspaceSqFt, totalHomeSqFt, monthlyRent, monthlyUtilities = 0 } = input

  const homeOfficePercent = workspaceSqFt / totalHomeSqFt

  // IRS simplified method: $5 per sq ft, max 300 sq ft
  const qualifyingSqFt = Math.min(workspaceSqFt, IRS_RATES.homeOfficeSimplifiedMaxSqFt)
  const homeOfficeSimplified = qualifyingSqFt * IRS_RATES.homeOfficeSimplifiedRatePerSqFt

  // IRS regular method: business % × (annual rent + annual utilities)
  const annualHousingCost = (monthlyRent + monthlyUtilities) * 12
  const homeOfficeRegular = homeOfficePercent * annualHousingCost

  // Always use whichever method yields a larger deduction
  const homeOfficeMethodUsed = homeOfficeRegular >= homeOfficeSimplified ? 'regular' : 'simplified'
  const homeOfficeAnnualDeduction = Math.max(homeOfficeSimplified, homeOfficeRegular)

  return {
    homeOfficePercent: Math.round(homeOfficePercent * 10000) / 10000,  // 4 decimal places
    homeOfficeSimplified: Math.round(homeOfficeSimplified * 100) / 100,
    homeOfficeRegular: Math.round(homeOfficeRegular * 100) / 100,
    homeOfficeMethodUsed,
    homeOfficeAnnualDeduction: Math.round(homeOfficeAnnualDeduction * 100) / 100,
  }
}

function calculateMileage(miles: number, year: number): number {
  const rate = IRS_RATES.mileage[year] ?? IRS_RATES.mileage[2025]
  return Math.round(miles * rate * 100) / 100
}

function calculatePercentageBased(monthlyBill: number, businessPercent: number): number {
  return Math.round(monthlyBill * 12 * (businessPercent / 100) * 100) / 100
}

// Main entry point — called by API route on create/update
export async function computeAndSaveCalculatedDeduction(
  id: string,
  data: Partial<CalculatedDeduction>
) {
  const derived: Partial<CalculatedDeduction> = {}

  if (data.type === 'home_office' &&
      data.workspaceSqFt && data.totalHomeSqFt && data.monthlyRent) {
    const result = calculateHomeOffice({
      workspaceSqFt: data.workspaceSqFt,
      totalHomeSqFt: data.totalHomeSqFt,
      monthlyRent: data.monthlyRent,
      monthlyUtilities: data.monthlyUtilities ?? 0,
      year: data.year!,
    })
    Object.assign(derived, result)
    derived.annualDeduction = result.homeOfficeAnnualDeduction
  }

  if (data.type === 'mileage' && data.miles && data.year) {
    const rate = IRS_RATES.mileage[data.year] ?? IRS_RATES.mileage[2025]
    derived.irsRatePerMile = rate
    derived.mileageAnnualDeduction = calculateMileage(data.miles, data.year)
    derived.annualDeduction = derived.mileageAnnualDeduction
  }

  if ((data.type === 'phone' || data.type === 'internet') &&
      data.monthlyBillAmount && data.businessUsePercent) {
    derived.percentageAnnualDeduction = calculatePercentageBased(
      data.monthlyBillAmount,
      data.businessUsePercent
    )
    derived.annualDeduction = derived.percentageAnnualDeduction
  }

  if (['health_insurance', 'retirement', 'other'].includes(data.type!) && data.annualAmount) {
    derived.annualDeduction = data.annualAmount
  }

  return db.calculatedDeduction.upsert({
    where: { id },
    create: { ...data, ...derived } as any,
    update: { ...data, ...derived },
  })
}
```

**Showing both methods to the user (home office only):**
When a home office deduction exists, the Deductions page shows:
```
Home office                           $1,440/yr
Using regular method — saves you $240 more than simplified
[Edit inputs]  [See both calculations]
```

The "See both calculations" expands inline:
```
Regular method    $1,440   ← currently using this
Simplified method $1,200
Based on: 150 sq ft workspace / 1,200 sq ft home / $800/mo rent
```

This builds trust — users can see the math and understand why you chose the method you did.

---

### 1. Daily Plaid sync job

**Trigger:** Nightly cron (2am user timezone) + on-demand from data sources page.

**File:** `lib/jobs/sync-plaid.ts`

```typescript
// Pseudocode — implement in your job runner (Inngest, Vercel Cron, etc.)

async function syncDataSource(dataSourceId: string) {
  const source = await db.dataSource.findUnique({ where: { id: dataSourceId } })
  
  // 1. Fetch new transactions using cursor (avoids re-fetching everything)
  const { added, modified, removed, nextCursor } = await plaid.transactionsSync({
    access_token: decrypt(source.plaidAccessToken),
    cursor: source.plaidCursor ?? undefined,
  })
  
  // 2. Insert new transactions (skip duplicates by plaidTransactionId)
  for (const txn of added) {
    await upsertTransaction(txn, source)
  }
  
  // 3. Update cursor so next sync continues from here
  await db.dataSource.update({
    where: { id: dataSourceId },
    data: { plaidCursor: nextCursor, lastSyncedAt: new Date(), syncStatus: 'success' }
  })
  
  // 4. Fire rename + categorization pipeline on newly added transactions only
  await enqueueEnrichmentBatch(added.map(t => t.transaction_id))
  
  // 5. Send notification
  await createNotification(source.workspaceId, 'sync_complete', `${added.length} new transactions synced`)
}

async function upsertTransaction(plaidTxn, source) {
  // Routing rule: mixed account → routedToInbox = true, status = 'needs_review'
  const routedToInbox = source.accountType === 'mixed'
  const status = source.accountType === 'personal' ? 'personal' : 'pending'
  
  await db.transaction.upsert({
    where: { plaidTransactionId: plaidTxn.transaction_id },
    create: {
      workspaceId: source.workspaceId,
      dataSourceId: source.id,
      plaidTransactionId: plaidTxn.transaction_id,
      plaidRawName: plaidTxn.name,
      plaidAmount: plaidTxn.amount,
      plaidDate: new Date(plaidTxn.date),
      plaidCategory: plaidTxn.personal_finance_category?.primary,
      plaidPending: plaidTxn.pending,
      plaidRawJson: plaidTxn,
      routedToInbox,
      status,
    },
    update: {
      plaidPending: plaidTxn.pending,   // update pending status if changed
    }
  })
}
```

---

### 2. Transaction rename algorithm

**File:** `lib/ai/rename-transaction.ts`

**Logic order (fastest/cheapest first):**

```
1. Normalize raw name (lowercase, strip codes/punctuation/locations)
2. Check merchant memory (exact match)     → if confirmedCount >= 2: use it, done
3. Check merchant memory (fuzzy match)     → if strong match: use as AI hint
4. Call Claude rename API
5. Save result to merchant memory
6. Return display name + confidence
```

**Normalization function:**
```typescript
function normalizeRawName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(sq|tst|pp|amzn mktp|checkcard|purchase)\s*\*/gi, '')  // strip known prefixes
    .replace(/\b\d{4,}\b/g, '')           // strip long number codes
    .replace(/\b[A-Z]{2}\b/g, '')         // strip 2-letter state codes
    .replace(/[^a-z0-9\s]/g, ' ')         // strip special chars
    .replace(/\s+/g, ' ')
    .trim()
}
```

**Claude prompt for rename:**
```typescript
const renamePrompt = `
You are a financial data cleaner. Convert this raw bank transaction name into a clean, human-readable merchant name.

Raw name: "${rawName}"
Normalized: "${normalizedName}"
${memoryHint ? `Similar past transaction was renamed to: "${memoryHint}"` : ''}

Rules:
- Return ONLY the merchant display name, nothing else
- Examples: "SQ *CNVS 84729 NY" → "Canva", "AMZN MKTP US*ABC123" → "Amazon", "UBER* EATS" → "Uber Eats"
- If the merchant is a known brand, use its proper name with correct capitalization
- If uncertain, return the cleanest version of the raw name you can produce
- Never invent a name you aren't confident about

Respond with JSON: { "displayName": string, "confidence": number (0.0-1.0) }
`
```

**After rename — update merchant memory:**
```typescript
async function updateMerchantMemory(workspaceId, rawNamePattern, displayName, source) {
  await db.merchantMemory.upsert({
    where: { workspaceId_rawNamePattern: { workspaceId, rawNamePattern } },
    create: { workspaceId, rawNamePattern, displayName, source },
    update: {
      displayName,              // update if user corrected
      confirmedCount: source === 'user_correction'
        ? { increment: 1 }
        : undefined,
    }
  })
}
```

**User correction flow:**
When a user taps a transaction name and edits it, call `correctTransactionName(transactionId, newName)`. This should:
1. Update `transaction.displayName` and set `renameSource = 'user_correction'`
2. Upsert merchant memory with `source = 'user_correction'`, increment `confirmedCount`
3. Find other transactions in the workspace with the same `rawNamePattern` and offer to rename them too ("Rename all 4 similar transactions?")

---

### 3. Categorization + deduction scoring algorithm

**File:** `lib/ai/categorize-transaction.ts`

**Skips for:**
- Transactions with `status = 'personal'` (from personal-type accounts)
- Transactions with `status = 'needs_review'` that haven't been resolved in Inbox yet

**Claude prompt:**
```typescript
const categorizePrompt = `
You are a tax categorization assistant for self-employed professionals in the US.

Transaction details:
- Merchant: "${displayName}"
- Amount: $${amount}
- Date: ${date}
- Plaid category: "${plaidCategory}"
- Business type: "${businessType}"   (e.g. freelance, gig driver, creator, ecommerce)
- Account type: "${accountType}"     (business | mixed — personal is pre-filtered)

Your job:
1. Assign a plain-English category (not IRS jargon). Use one of: 
   Software & tools, Advertising & marketing, Meals & entertainment, Travel, 
   Home office, Phone & internet, Professional services, Supplies & equipment, 
   Education & training, Health insurance, Other business expense

2. Generate exactly 3 potential deduction types, ranked by fit for this business type.
   Pre-select the best match as isSelected: true.

3. Rate overall deduction likelihood: high | medium | low | none

Respond with JSON only:
{
  "category": string,
  "deductionSuggestions": [
    { "type": string, "label": string, "likelihood": "high"|"medium"|"low", "isSelected": boolean },
    { "type": string, "label": string, "likelihood": "high"|"medium"|"low", "isSelected": boolean },
    { "type": string, "label": string, "likelihood": "high"|"medium"|"low", "isSelected": boolean }
  ],
  "deductionLikelihood": "high"|"medium"|"low"|"none"
}
`
```

**Routing after categorization:**
```typescript
// Only show deduction card if:
// - accountType is 'business' AND deductionLikelihood is not 'none'
// - OR accountType is 'mixed' AND user resolved in Inbox as 'business'
// Personal transactions → never show deduction card
```

---

## Visual component specs — page by page

### Onboarding (4 screens, no sidebar)

**Screen 1 — What's your side hustle?**
- Large heading: "What kind of work do you do?"
- 5 large tap targets (not a dropdown): Freelance · Gig work · Creator · Ecommerce · Something else
- Selected state: filled border + checkmark
- Progress dots at top (1 of 4). No back button on first screen.
- Sets `workspace.businessType` — used to prime AI categorization throughout the app.

**Screen 2 — Quick deduction setup (the non-transaction deductions)**
- Heading: "Let's find every deduction — not just your card transactions"
- Subheading: "Check anything that applies. You can always update these later."
- Checklist of 5 items. Each checked item reveals an inline mini-form:

```
[ ] I work from home
    ↳ Workspace size:  [___] sq ft
      Total home size: [___] sq ft
      Monthly rent:    $[_____]
      (optional) Monthly utilities: $[_____]
      "We'll calculate the best method automatically"

[ ] I drive for work
    ↳ Estimated miles this year: [_______]  (or skip)
      "We'll use the IRS rate of $0.70/mile"

[ ] I pay for my own health insurance
    ↳ Monthly premium: $[_____]

[ ] I use my personal phone for work
    ↳ Business use:  [25%]  [50%]  [75%]  (tap to select)

[ ] I use a personal internet connection for work
    ↳ Monthly bill: $[_____]
      Business use: [25%]  [50%]  [75%]
```

- "Skip for now" link at bottom — nothing on this screen is required
- Progress dots: 2 of 4

**Screen 3 — Connect your bank**
- Heading: "Connect your bank account"
- Subheading: "We'll scan for things you can write off. Takes about 60 seconds."
- Single large CTA: "Connect via Plaid"
- Small secondary: "Upload a CSV instead" (escape hatch for v1)
- Trust signals: "Bank-level encryption · We never store your credentials · Disconnect anytime"
- Progress dots: 3 of 4

**Screen 4 — First scan result (the wow moment)**
- Runs enrichment pipeline immediately after Plaid connects
- Loading state: "Scanning [N] transactions..." with animated progress bar
- Result state reveals a stacked breakdown:

```
We found $4,820 in potential deductions

$3,240   from your bank transactions    →
  $980   home office                    → (only if screen 2 was filled in)
  $420   phone & internet
  $180   health insurance premiums
```

- Each line is tappable and navigates to the relevant section
- If screen 2 was skipped entirely: show only the transaction number and a soft nudge
  "Add home office, mileage, and more to see your full picture →"
- CTA: "See your deductions" → enters the main app, sidebar appears
- Progress dots: 4 of 4


---

### Sidebar

Always visible after onboarding. Two sections separated by a divider.

**Top section — navigation**
```
[Workspace switcher dropdown]
─────────────────────────────
Home
Deductions          [badge: unreviewed count]
Inbox               [badge: needs review count]
Transactions
Cash
Tax Report
─────────────────────────────
Data Sources
Settings
Help & Learn
```

**Bottom section — search panel**
- Persistent `<input>` labeled "Search transactions"
- Matches: `displayName`, `plaidRawName`, `category`, `userTags.name`
- Filter chips below input (appear after first search or on expand):
  - Status: All · Deductible · Personal · Uncategorized
  - Category: dropdown
  - Date range: quick picks (This year · Q1 · Q2 · Q3 · Q4 · Custom)
- Results update the active page's list in real time
- Clear all link when filters are active

---

### Home dashboard

**Layout:** Single column, no sidebar content. Mobile-first.

**Hero row — 3 metric cards**
```
[Deductions found]    [Cash balance]    [Business spend]
    $3,240                $8,450            $1,820
  this year           across accounts     this month
```

**Pending banner** (show only when inbox count > 0)
```
[yellow] 4 transactions need a quick look  →  Review in Inbox
```

**Deductions progress card**
- "You've confirmed $X of $Y potential deductions"
- Simple progress bar (confirmed / total found)
- "Review remaining [N]" link

**Recent activity strip**
- Last 5 transactions, each showing: display name · amount · status chip
- "View all" link to Transactions page

**Quick actions row**
- "Add account" button
- "Export tax report" button

---

### Deductions page

**Header**
- Page title: "Deductions"
- Total confirmed (large green): "$2,340 confirmed"
- Potential additional (muted): "+ $900 to review"
- Filter: All · Confirmed · Needs review

**Section 1 — Calculated deductions (always at top)**
These are the non-transaction deductions entered during onboarding or added manually.
```
CALCULATED DEDUCTIONS
──────────────────────────────────────────────────────
Home office       $1,440/yr    Regular method  [Edit]
                               Saves $240 vs simplified
Phone (50%)         $300/yr                   [Edit]
Health insurance  $1,800/yr                   [Edit]
──────────────────────────────────────────────────────
+ Add deduction (home office / mileage / phone / other)
```

- "Edit" opens the same inline mini-form from onboarding screen 2
- Home office row always shows which method is being used with the savings callout
- "See both calculations" expand link shows the math for both methods:
  ```
  Regular method    $1,440   ← using this (saves you $240 more)
  Simplified method $1,200
  Based on: 150 sq ft / 1,200 sq ft home / $800/mo rent
  ```
- If user hasn't set up any calculated deductions, show a soft CTA card:
  "Do you work from home, drive for work, or pay your own health insurance?
   These could add $X,XXX to your deductions. [Set up in 2 minutes →]"

**Section 2 — Transaction deductions**
AI-suggested deductions from bank transactions. Only shows transactions where:
- Account type is `business` AND deductionLikelihood is not `none`
- OR account type was `mixed` AND user resolved as business in Inbox

**Deduction card (per transaction)**
```
┌─────────────────────────────────────────────┐
│  Canva                              $15.99  │
│  Software & tools       [Likely deductible] │  ← green badge
│                                             │
│  Subscription fee — design software         │
│  [?] What makes this deductible?           │
│                                             │
│  [Mark personal]          [Confirm ✓]      │
└─────────────────────────────────────────────┘
```

- Confidence badge colors: green (high) · yellow (medium) · gray (review)
- Info icon opens a bottom sheet: 2–3 sentence plain-English explanation
- "Confirm" is prominent; "Mark personal" is secondary
- After confirm: card collapses to a compact confirmed row, moves to bottom of list

---

### Inbox page

Three tabs: **Review** · **Notifications** · **Activity**

**Review tab — mixed-account transactions**

Each card shows a transaction from a mixed account that needs classification:

```
┌─────────────────────────────────────────────┐
│  Starbucks                          $14.80  │
│  Aug 3 · Chase Checking ••4821              │
│                                             │
│  Is this a business expense?                │
│                                             │
│  [Personal]  [Client meeting ✓]  [Team]    │
│               ↑ pre-selected by AI          │
└─────────────────────────────────────────────┘
```

- Middle option pre-selected (filled border)
- Selecting any option immediately resolves and slides card out
- Personal → transaction marked personal, no deduction
- Business option selected → transaction enters deduction flow

**Notifications tab**
- Sync complete/error messages
- System updates

**Activity tab**
- Member joined workspace
- Exports generated
- Bulk actions taken

---

### Transactions page

**Full ledger view**

Column layout (desktop) / card list (mobile):
- Display name (primary, bold)
- Date
- Amount
- Status chip: Deductible · Personal · Uncategorized · Needs review
- Category
- Source account (small tag)

**Expanded row (tap to expand)**
- Raw bank name: "SQ *CNVS 84729 NY" (muted, small)
- All 3 deduction suggestions (radio group, user can change)
- User note field
- Tag management
- "Correct merchant name" link

**Sidebar search** filters this list in real time.

---

### Cash snapshot page

**Header metric**
- Total balance across all accounts (large)
- Last updated timestamp

**Trend chart**
- Income vs business expenses, current month
- Month selector: ← Aug 2025 →

**Account cards**
Each connected account:
```
Chase Checking ••4821     $4,230.00
Business · Last synced 2 hours ago
```

**Note:** No debt tracker, no budgeting tools in v1.

---

### Tax report page

**Controls row**
- Year selector: `< 2024    2025    2026 >`
- Period selector: `Full year · Q1 · Q2 · Q3 · Q4`

**Summary header**
```
2025 — Q2 (Apr–Jun)
Total deductions:           $2,655
  From bank transactions:   $1,115
  Calculated (home, miles): $1,540
Potential (unreviewed):       $390
```

**Category breakdown table**
Three columns — transactions, calculated, total — so an accountant can see the source at a glance:

| Category | From bank | Calculated | Total |
|---|---|---|---|
| Software & tools | $480 | — | $480 |
| Home office | — | $360 | $360 |
| Meals & entertainment | $340 | — | $340 |
| Phone & internet | $60 | $75 | $135 |
| Health insurance | — | $450 | $450 |
| Travel & mileage | $235 | $655 | $890 |

When quarter view is active, calculated deductions show prorated amounts with a note:
`Home office $360  (Q2 portion of $1,440/yr)`

**Home office transparency panel** (only if home_office calculated deduction exists)
```
Home office — regular method              $360 this quarter
────────────────────────────────────────────────────────────
Regular method    $1,440/yr  ← using this
Simplified method $1,200/yr  (saves you $240 more with regular)

Based on: 150 sq ft workspace / 1,200 sq ft total home / $800/mo rent
[Edit inputs]
```

**What to do with this** (always visible)
> "Share this report with your accountant or open TurboTax Self-Employed. Use the CSV for line-by-line detail, or the PDF for a clean summary your accountant can read."

**Export row**
- `[Download PDF]`  `[Download CSV]`
- Both exports include the full breakdown: transaction line items + calculated deduction inputs and results, clearly labeled
- CSV has two sheets: "Transactions" and "Calculated deductions"

**Quarterly estimated tax callout** (yellow banner, shown before each due date)
> "Q2 estimated taxes are due June 15. Based on your deductions this quarter, consider setting aside approximately $X."

---

### Data sources page

**Connected accounts list**
Each source card:
```
┌─────────────────────────────────────────────┐
│  Chase Bank                                 │
│  Checking ••4821                            │
│                                             │
│  Type:      [Business ▾]                   │  ← dropdown: personal | business | mixed
│  History:   [12 months ▾]                  │  ← dropdown: 3mo | 6mo | 12mo | 24mo | All
│                                             │
│  Last sync: 2 hours ago · 14 new           │
│  [Sync now]                  [Disconnect]  │
└─────────────────────────────────────────────┘
```

**Important logic:** Changing account type from personal/business → mixed will route all existing uncategorized transactions from that account to the Inbox.

**Add account CTA**
- "Connect another account" → launches Plaid Link flow
- After Plaid success, user sets type + lookback before first sync

---

### Settings page

Sections:
1. **Your business** — business type, name, tax filing status
2. **Tax preferences** — fiscal year start, estimated tax reminders on/off
3. **Team** — invite members (email), role assignment, remove member
4. **Billing** — current plan, upgrade, cancel
5. **Data** — export all data (JSON), delete workspace
6. **Accounts** — shortcut to Data Sources page

---

### Help & learn page

**Search bar** at top — searches all articles.

**Sections:**
- Getting started (3 articles)
- Understanding deductions (5 articles: what qualifies, home office, mileage, meals, software)
- Tax time (2 articles: what to do with your report, quarterly estimates)
- Video library (embed your training videos here)

**Article format:** Title · 2–4 paragraphs · 1 plain-language example · "Still confused? Ask us" link.

**Contextual links:** Every deduction card in the app links to the relevant Help article via the `[?]` info icon.

---

## Tax report — year/quarter query logic

```typescript
// lib/queries/tax-report.ts

type TaxPeriod = {
  year: number
  quarter?: 1 | 2 | 3 | 4   // undefined = full year
}

function getTaxPeriodDateRange(period: TaxPeriod): { start: Date, end: Date } {
  const { year, quarter } = period

  if (!quarter) {
    return {
      start: new Date(`${year}-01-01`),
      end: new Date(`${year}-12-31`),
    }
  }

  const quarterMap = {
    1: { start: '01-01', end: '03-31' },
    2: { start: '04-01', end: '06-30' },
    3: { start: '07-01', end: '09-30' },
    4: { start: '10-01', end: '12-31' },
  }

  return {
    start: new Date(`${year}-${quarterMap[quarter].start}`),
    end: new Date(`${year}-${quarterMap[quarter].end}`),
  }
}

async function getTaxReport(workspaceId: string, period: TaxPeriod) {
  const { start, end } = getTaxPeriodDateRange(period)

  // ── Transaction-based deductions ────────────────────────────────────────
  const transactions = await db.transaction.findMany({
    where: {
      workspaceId,
      plaidDate: { gte: start, lte: end },
      status: { in: ['deductible', 'pending'] },
    },
  })

  const txnByCategory = transactions.reduce((acc, txn) => {
    const key = txn.category ?? 'Other'
    if (!acc[key]) acc[key] = { confirmed: 0, potential: 0 }
    if (txn.status === 'deductible') acc[key].confirmed += Number(txn.plaidAmount)
    if (txn.status === 'pending') acc[key].potential += Number(txn.plaidAmount)
    return acc
  }, {} as Record<string, { confirmed: number; potential: number }>)

  // ── Calculated deductions ────────────────────────────────────────────────
  // Calculated deductions are annual. For quarter view, we prorate them evenly
  // across 4 quarters (annual / 4). This is a simplification — mileage and
  // home office could be tracked more precisely, but for most users prorating
  // is accurate enough and far simpler to understand.
  const calculatedDeductions = await db.calculatedDeduction.findMany({
    where: { workspaceId, year: period.year, isConfirmed: true },
  })

  const quarterMultiplier = period.quarter ? 0.25 : 1.0

  const calcByCategory: Record<string, { confirmed: number; potential: number }> = {}
  for (const calc of calculatedDeductions) {
    // Map calc type to plain-English category label
    const categoryMap: Record<string, string> = {
      home_office: 'Home office',
      mileage: 'Travel & mileage',
      phone: 'Phone & internet',
      internet: 'Phone & internet',
      health_insurance: 'Health insurance',
      retirement: 'Retirement contributions',
      other: calc.label ?? 'Other business expense',
    }
    const key = categoryMap[calc.type] ?? 'Other business expense'
    if (!calcByCategory[key]) calcByCategory[key] = { confirmed: 0, potential: 0 }
    // Calculated deductions are always confirmed (user entered them)
    calcByCategory[key].confirmed += calc.annualDeduction * quarterMultiplier
  }

  // ── Merge both sources ───────────────────────────────────────────────────
  const allCategories = new Set([
    ...Object.keys(txnByCategory),
    ...Object.keys(calcByCategory),
  ])

  const byCategory: Record<string, { confirmed: number; potential: number; source: string[] }> = {}
  for (const cat of allCategories) {
    byCategory[cat] = {
      confirmed: (txnByCategory[cat]?.confirmed ?? 0) + (calcByCategory[cat]?.confirmed ?? 0),
      potential: (txnByCategory[cat]?.potential ?? 0) + (calcByCategory[cat]?.potential ?? 0),
      source: [
        ...(txnByCategory[cat] ? ['transactions'] : []),
        ...(calcByCategory[cat] ? ['calculated'] : []),
      ],
    }
  }

  const totalConfirmedTxn = transactions
    .filter(t => t.status === 'deductible')
    .reduce((sum, t) => sum + Number(t.plaidAmount), 0)

  const totalConfirmedCalc = calculatedDeductions
    .reduce((sum, c) => sum + c.annualDeduction * quarterMultiplier, 0)

  const totalPotential = transactions
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + Number(t.plaidAmount), 0)

  return {
    period,
    totalConfirmed: totalConfirmedTxn + totalConfirmedCalc,
    totalConfirmedTransactions: totalConfirmedTxn,
    totalConfirmedCalculated: totalConfirmedCalc,
    totalPotential,
    byCategory,
    transactions,                  // for CSV export line items
    calculatedDeductions,          // for CSV export line items
    // Home office method detail — for transparency section in UI
    homeOfficeDetail: calculatedDeductions.find(c => c.type === 'home_office') ?? null,
  }
}
```

**Tax report page — what changes with quarter view:**

When a quarter is selected, calculated deductions are prorated (÷ 4) and a note appears:
```
Home office    $360    (Q2 portion of $1,440/yr)
```

The full-year view always shows the annual total with no proration note needed.

**Category breakdown table on the Tax Report page** — shows both sources transparently:

| Category | From transactions | Calculated | Total |
|---|---|---|---|
| Software & tools | $480 | — | $480 |
| Home office | — | $1,440 | $1,440 |
| Meals & entertainment | $340 | — | $340 |
| Phone & internet | $60 | $300 | $360 |
| Health insurance | — | $1,800 | $1,800 |
| Travel & mileage | $280 | $490 | $770 |

The split-column approach lets an accountant immediately see what came from bank records vs. what was calculated separately — exactly what they need to file correctly.

---

## Search implementation

```typescript
// lib/queries/search-transactions.ts
// Called from sidebar search panel, updates active page list in real time

async function searchTransactions(workspaceId: string, params: {
  query?: string
  status?: string[]
  category?: string
  dateFrom?: Date
  dateTo?: Date
  tagIds?: string[]
}) {
  const { query, status, category, dateFrom, dateTo, tagIds } = params

  return db.transaction.findMany({
    where: {
      workspaceId,
      ...(query && {
        OR: [
          { displayName: { contains: query, mode: 'insensitive' } },
          { plaidRawName: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
          { userTags: { some: { tag: { name: { contains: query, mode: 'insensitive' } } } } },
        ]
      }),
      ...(status?.length && { status: { in: status } }),
      ...(category && { category }),
      ...(dateFrom && { plaidDate: { gte: dateFrom } }),
      ...(dateTo && { plaidDate: { lte: dateTo } }),
      ...(tagIds?.length && { userTags: { some: { tagId: { in: tagIds } } } }),
    },
    include: { userTags: { include: { tag: true } } },
    orderBy: { plaidDate: 'desc' },
  })
}
```

---

## Cleanup notes for existing codebase

When reviewing existing ExpenseTerminal code, look to remove or replace:

- Any UI that asks users to manually tag/categorize transactions one at a time
- Keyboard shortcut-based review workflows
- "Audit-ready" language anywhere in copy
- Schedule C line item references in the UI (replace with plain-English category names)
- Any onboarding flow longer than 3 steps before first value is shown
- Bulk categorization tools (phase 2+ if needed, not v1)
- The "Burn Through Transactions" concept entirely — replace with Inbox review + Deductions confirm

---

## Copy guidelines

Replace these phrases everywhere:

| Old (delete) | New (use) |
|---|---|
| "Audit-ready reports" | "Ready for your accountant" |
| "Schedule C line item" | "Category" or specific name |
| "Categorize transactions" | "Review your deductions" |
| "Burn through transactions" | (remove entirely) |
| "Tax deduction" (technical) | "Write-off" or "business expense" |
| "Expense tracking" | "Finding your deductions" |
| "Fiscal year" | "Tax year" |

Tone: friendly, confident, human. Write like a knowledgeable friend who happens to know taxes — not like software.