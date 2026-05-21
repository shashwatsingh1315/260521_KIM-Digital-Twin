# Collections CRM: Promise-To-Pay & Kanban Board Design

## 1. Overview
The Collections module is evolving from a static dashboard into an active CRM. The core mechanism is the "Promise-To-Pay" (PTP) which acts as a "Hard Snooze" to pause escalations while actively tracking RM performance and negotiation outcomes.

## 2. Data Model Changes

### Promise-To-Pay (PTP) & Escalation State
*   **Table Updates:** Modify the existing `escalations` table to include:
    *   `status`: ENUM ('active', 'snoozed', 'resolved', 'broken_promise')
    *   `ptp_date`: DATE (The date the customer promised to pay)
    *   `last_hq_update_at`: TIMESTAMPTZ (Tracks the last touchpoint)
*   **Resolution Tracking:** When a case is finally closed, the system will record:
    *   Total number of touches (log entries).
    *   Total number of snoozes/promises.
    *   Days to Resolution (Actual Payment Date - Original Tranche Due Date).
*   **Background Wake-up:** A background check (or view calculation) will monitor snoozed cases. If `current_date > ptp_date`, the status flips to `broken_promise` and the case re-enters the active queue.

### Escalation Logs (Touches)
*   When an RM clicks "Snooze" or "Log Update", a record is inserted into `escalation_logs` detailing the reason, the date, and updating the parent case's `last_hq_update_at`.

## 3. UI/UX: The Kanban Board
The Collections UI (`CollectionsClient.tsx`) will be refactored into a Kanban/Board layout.

*   **Columns:**
    1.  **Overdue (Active):** Cases currently breaching thresholds with no active PTP.
    2.  **Snoozed / PTP:** Cases with an active Promise-To-Pay date in the future.
    3.  **Broken Promises:** Cases where the PTP date has passed without payment.
*   **Card Interactions:**
    *   Clicking a card opens a modal to "Log Update" or "Snooze (Set PTP)".
    *   "Hard Snooze" requires selecting a date, which moves the card to the Snoozed column.
*   **The "Neglect" Highlight:**
    *   Cards will visually change (e.g., a red border or warning icon) if `last_hq_update_at` is older than an admin-defined threshold (e.g., 3 days).
    *   A quick-filter toggle at the top of the board will allow managers to "Show Only Neglected Cases".

## 4. KPI Tracking
*   **RM Performance Metrics:** HQ can now measure:
    *   **PTP Hit Rate:** Percentage of PTPs that resulted in actual payment vs Broken Promises.
    *   **Effort to Resolve:** Average number of touches required to close an overdue case.