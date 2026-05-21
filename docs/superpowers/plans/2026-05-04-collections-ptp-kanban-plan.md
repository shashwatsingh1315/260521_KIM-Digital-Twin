# Collections CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the Collections module from a static dashboard into an active CRM with a Promise-To-Pay (PTP) Kanban board and RM neglect highlighting.

**Architecture:** We will add PTP and tracking fields to the `escalations` table, create server actions to manage updates, and refactor `CollectionsClient.tsx` into a Kanban board with "Overdue", "Snoozed", and "Broken Promises" columns.

**Tech Stack:** Next.js, Supabase (PostgreSQL), Tailwind CSS, Lucide React

---

### Task 1: Database Migration for PTP and Escalations

**Files:**
- Create: `supabase/migrations/20260504000001_collections_ptp.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: Add PTP and tracking fields to escalations

BEGIN;

-- 1. Drop existing status constraint
ALTER TABLE public.escalations DROP CONSTRAINT IF EXISTS escalations_status_check;

-- 2. Update existing 'open' statuses to 'active'
UPDATE public.escalations SET status = 'active' WHERE status = 'open';

-- 3. Add new columns
ALTER TABLE public.escalations 
  ADD COLUMN IF NOT EXISTS ptp_date DATE,
  ADD COLUMN IF NOT EXISTS last_hq_update_at TIMESTAMPTZ DEFAULT now();

-- 4. Add the new constraint
ALTER TABLE public.escalations 
  ADD CONSTRAINT escalations_status_check 
  CHECK (status IN ('active', 'snoozed', 'resolved', 'broken_promise', 'escalated_to_next'));

-- 5. Create an RPC to refresh PTP statuses (move snoozed to broken_promise if date passed)
CREATE OR REPLACE FUNCTION refresh_ptp_statuses()
RETURNS void AS $$
BEGIN
  UPDATE public.escalations
  SET status = 'broken_promise'
  WHERE status = 'snoozed' AND ptp_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
```

- [ ] **Step 2: Apply the migration to verify**

Run: `pnpm supabase migration up` (or equivalent `supabase` command depending on setup)
Expected: Success.

### Task 2: Server Actions for Collections CRM

**Files:**
- Modify: `src/app/collections/actions.ts`

- [ ] **Step 1: Add the new actions**

```typescript
"use server";
import { createClient } from '@/utils/supabase/server';
import { getCurrentUser } from '@/utils/auth';
import { revalidatePath } from 'next/cache';

export async function refreshPtpStatuses() {
  const supabase = await createClient();
  await supabase.rpc('refresh_ptp_statuses');
}

export async function logUpdate(caseId: string, escalationId: string, outcome: string, actionType: 'call' | 'visit' | 'note' = 'note') {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  
  const supabase = await createClient();
  
  await supabase.from('escalation_logs').insert({
    escalation_id: escalationId,
    logged_by: user.id,
    action_type: actionType,
    outcome: outcome
  });

  await supabase.from('escalations').update({
    last_hq_update_at: new Date().toISOString()
  }).eq('id', escalationId);

  revalidatePath('/collections');
}

export async function snoozeCase(caseId: string, escalationId: string, ptpDate: string, reason: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  
  const supabase = await createClient();
  
  await supabase.from('escalation_logs').insert({
    escalation_id: escalationId,
    logged_by: user.id,
    action_type: 'note',
    outcome: `PTP Set for ${ptpDate}: ${reason}`
  });

  await supabase.from('escalations').update({
    status: 'snoozed',
    ptp_date: ptpDate,
    last_hq_update_at: new Date().toISOString()
  }).eq('id', escalationId);

  revalidatePath('/collections');
}
```

- [ ] **Step 2: Commit**
```bash
git add supabase/migrations src/app/collections/actions.ts
git commit -m "feat: db migration and actions for collections PTP"
```

### Task 3: Update Collections Data Fetching

**Files:**
- Modify: `src/app/collections/page.tsx`

- [ ] **Step 1: Inject PTP Refresh and Fetch Escalations**

Update the Supabase query in `CollectionsPage` to call `refreshPtpStatuses` and include the `escalations` table.

```typescript
// Add to imports
import { refreshPtpStatuses } from './actions';

// Inside CollectionsPage, before fetching:
await refreshPtpStatuses();

// Update the select query:
  const { data: cases } = await supabase
    .from('credit_cases')
    .select(`
      id, case_number, status, bill_amount, composite_credit_days, escalation_level,
      billing_date, decided_bill_amount, actual_bill_amount,
      customer:parties!credit_cases_customer_party_id_fkey(legal_name),
      escalations (id, status, ptp_date, last_hq_update_at)
    `)
    .in('status', ['Billing Active', 'Pending Write-Off Approval']);
```

- [ ] **Step 2: Commit**
```bash
git add src/app/collections/page.tsx
git commit -m "feat: fetch escalations and refresh ptp status in collections page"
```

### Task 4: Kanban Board UI Implementation

**Files:**
- Modify: `src/app/collections/CollectionsClient.tsx`

- [ ] **Step 1: Replace Table with Kanban Layout**

Rewrite `CollectionsClient.tsx` to display columns: Overdue, Snoozed / PTP, Broken Promises. Add a "Show Neglected" toggle. Neglected = `last_hq_update_at` older than 3 days.

```tsx
"use client";
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { logUpdate, snoozeCase } from './actions';

export default function CollectionsClient({ collections, stats, escalations }: any) {
  const [showNeglected, setShowNeglected] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'update' | 'snooze' | null>(null);
  const [outcome, setOutcome] = useState('');
  const [ptpDate, setPtpDate] = useState('');
  
  const now = new Date().getTime();

  // Helper to process cases
  const processedCases = collections.map((c: any) => {
    // Sort escalations by created_at desc, pick the latest
    const activeEsc = c.escalations?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const status = activeEsc?.status || 'active';
    
    let isNeglected = false;
    if (activeEsc?.last_hq_update_at) {
      const daysSinceUpdate = (now - new Date(activeEsc.last_hq_update_at).getTime()) / 86400000;
      isNeglected = daysSinceUpdate > 3;
    } else {
      isNeglected = true; // No updates yet
    }

    return { ...c, activeEsc, boardStatus: status, isNeglected };
  });

  const displayCases = processedCases.filter((c: any) => !showNeglected || c.isNeglected);

  const overdue = displayCases.filter((c: any) => c.boardStatus === 'active');
  const snoozed = displayCases.filter((c: any) => c.boardStatus === 'snoozed');
  const broken = displayCases.filter((c: any) => c.boardStatus === 'broken_promise');

  const handleSave = async () => {
    if (!selectedCase?.activeEsc?.id) return;
    if (modalMode === 'update') {
      await logUpdate(selectedCase.id, selectedCase.activeEsc.id, outcome);
    } else if (modalMode === 'snooze') {
      await snoozeCase(selectedCase.id, selectedCase.activeEsc.id, ptpDate, outcome);
    }
    setModalMode(null);
    setOutcome('');
    setPtpDate('');
  };

  const renderCard = (c: any) => (
    <Card key={c.id} className={`p-4 mb-3 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${c.isNeglected ? 'border-l-destructive bg-destructive/5' : 'border-l-primary'}`} onClick={() => setSelectedCase(c)}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-bold text-sm">{c.case_number}</span>
        {c.isNeglected && <AlertCircle className="w-4 h-4 text-destructive" />}
      </div>
      <p className="text-sm font-semibold truncate mb-1">{c.customer?.legal_name || 'Unknown'}</p>
      <p className="text-xs text-muted-foreground mb-3">₹{(c.decided_bill_amount || c.bill_amount || 0).toLocaleString('en-IN')}</p>
      
      <div className="flex gap-2 text-xs text-muted-foreground">
        {c.activeEsc?.ptp_date && (
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> PTP: {new Date(c.activeEsc.ptp_date).toLocaleDateString()}</span>
        )}
        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3"/> {c.activeEsc?.last_hq_update_at ? 'Updated' : 'No logs'}</span>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Collections CRM</h1>
          <p className="text-sm text-muted-foreground">Manage Promise-to-Pay and active escalations.</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="neglect-mode" checked={showNeglected} onCheckedChange={setShowNeglected} />
          <Label htmlFor="neglect-mode" className="text-destructive font-semibold">Show Neglected ({'>'}3 Days)</Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Overdue */}
        <div className="bg-muted/30 p-4 rounded-xl border">
          <h3 className="font-bold mb-4 flex justify-between">Overdue / Active <Badge>{overdue.length}</Badge></h3>
          <div className="min-h-[200px]">{overdue.map(renderCard)}</div>
        </div>

        {/* Snoozed */}
        <div className="bg-muted/30 p-4 rounded-xl border">
          <h3 className="font-bold mb-4 flex justify-between text-orange-600">Snoozed / PTP <Badge variant="secondary">{snoozed.length}</Badge></h3>
          <div className="min-h-[200px]">{snoozed.map(renderCard)}</div>
        </div>

        {/* Broken Promises */}
        <div className="bg-muted/30 p-4 rounded-xl border">
          <h3 className="font-bold mb-4 flex justify-between text-destructive">Broken Promises <Badge variant="destructive">{broken.length}</Badge></h3>
          <div className="min-h-[200px]">{broken.map(renderCard)}</div>
        </div>
      </div>

      {/* Action Modal */}
      <Dialog open={!!modalMode} onOpenChange={(open) => !open && setModalMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalMode === 'update' ? 'Log HQ Update' : 'Set Promise-To-Pay (Snooze)'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {modalMode === 'snooze' && (
              <div className="space-y-2">
                <Label>Promise Date</Label>
                <Input type="date" value={ptpDate} onChange={e => setPtpDate(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>{modalMode === 'snooze' ? 'PTP Details / Notes' : 'Call/Visit Outcome'}</Label>
              <Textarea placeholder="What did the customer say?" value={outcome} onChange={e => setOutcome(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalMode(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!outcome || (modalMode === 'snooze' && !ptpDate)}>Save Action</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Case Details Modal (Quick action picker) */}
      <Dialog open={!!selectedCase && !modalMode} onOpenChange={(open) => !open && setSelectedCase(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCase?.case_number} - {selectedCase?.customer?.legal_name}</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col gap-3">
            <Button onClick={() => setModalMode('update')} className="w-full justify-start" variant="outline"><MessageSquare className="mr-2 w-4 h-4"/> Log Standard Update</Button>
            <Button onClick={() => setModalMode('snooze')} className="w-full justify-start text-orange-600 border-orange-200 hover:bg-orange-50" variant="outline"><Calendar className="mr-2 w-4 h-4"/> Set Promise-To-Pay (Snooze)</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/app/collections/CollectionsClient.tsx
git commit -m "feat: kanban board ui with ptp and neglect highlighting"
```