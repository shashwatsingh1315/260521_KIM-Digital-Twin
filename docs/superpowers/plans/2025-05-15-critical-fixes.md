# Repository Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 critical issues across the repository to ensure stability, security, and correct functional behavior.

**Architecture:** Surgical application of fixes to React components and utility modules.

**Tech Stack:** Next.js, React, TypeScript, Node.js (crypto).

---

### Task 1: Fix State Initialization in NewCaseForm.tsx

**Files:**
- Modify: `src/app/cases/new/NewCaseForm.tsx`

- [ ] **Step 1: Move state setters above `refreshParties`**
Move `customerPartyId` and `contractorPartyId` `useState` hooks before the `refreshParties` function definition.

```tsx
  // Move these up
  const [customerPartyId, setCustomerPartyId] = useState('');
  const [contractorPartyId, setContractorPartyId] = useState('');

  const refreshParties = async (newParty?: any) => {
    // ...
  };
```

### Task 2: Secure E2E Auth Bypass in auth.ts

**Files:**
- Modify: `src/utils/auth.ts`

- [ ] **Step 1: Add production guard to E2E_AUTH_BYPASS check**
Ensure that the bypass only works in non-production environments.

```tsx
    // E2E Test Bypass
    if (process.env.NODE_ENV !== 'production' && process.env.E2E_AUTH_BYPASS === 'true') {
      // ...
    }
```

### Task 3: Fix Prop Passing in CaseWorkspace.tsx

**Files:**
- Modify: `src/app/cases/[id]/CaseWorkspace.tsx`

- [ ] **Step 1: Verify and ensure props are passed to OverviewTab**
Ensure `showCounterOffer, setShowCounterOffer, showUnlock, setShowUnlock, showPersonaChange, setShowPersonaChange` are correctly passed to `<OverviewTab />`.

### Task 4: Fix UUID Generation in csv.ts

**Files:**
- Modify: `src/utils/csv.ts`

- [ ] **Step 1: Update crypto import and usage**
Import `randomUUID` from `crypto` and replace `crypto.randomUUID()` with `randomUUID()`.

```tsx
import { randomUUID } from 'crypto';
// ...
const customer_code = (obj.customer_code || '').trim() || `CUST-IMP-${randomUUID()}`;
```

### Task 5: Fix Round Type in ApprovalsTab.tsx

**Files:**
- Modify: `src/app/cases/[id]/ApprovalsTab.tsx`

- [ ] **Step 1: Change roundType value in Ambiguity Board form**
Update the hidden input `roundType` value from `ambiguity_board` to `appeal`.

```tsx
<input type="hidden" name="roundType" value="appeal" />
```

### Task 6: Final Verification

- [ ] **Step 1: Run Type Check**
Run `npx tsc --noEmit` to ensure no type errors were introduced.
