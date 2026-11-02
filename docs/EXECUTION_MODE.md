# Manual and automatic execution

RC11 implements the owner's 2 November clarification in #114: execution mode is independent of provider/model. It supersedes the earlier provider documents' manual-only external restriction for explicitly enabled schedules. No schedule is enabled by installation or by selecting a model.

## Controls

In React/Electron and React/WebView2 the top bar has **Режим работы → Вручную / Автоматически**. Minimal WPF has the same choice under Connections and limits. Choosing a mode stops the current work safely and preserves the selection. Automatic mode initially remains paused; use **Продолжить** after including the desired gardens in their individual schedules. **Эврика** starts one bounded attempt in either mode and does not change the schedule.

Provider and model are selected separately. Claude supports Haiku/Sonnet/Opus, optional Groq keeps its explicit model, and Ollama uses its installed model. A confirmation before a provider/model change states the selected mode, effects on active work, quota/quality differences and whether scheduling will continue with the new model. Cancel preserves the previous choice and state. Confirmation drains the old job without discarding raw responses, preserves the execution mode, and continues a previously running schedule only under the disclosed new permission. Already paused scheduling stays paused. There is no fallback to another model/provider.

## External schedules and data

Continue for an external provider asks permission for the chosen model, scheduled gardens and permitted donors, daily attempts/calls/new-card limits and review-queue bound. Permission explicitly includes current and subsequently added participating ideas/cards and approved references/preferences within that scope. Each automatic attempt selects and freezes its own context without a separate preview; manual external jobs retain their exact-context preview and explicit one-job confirmation.

Authority lives only in controller memory. Pause, restart, sleep, restore, credentials/reconfiguration and scope/limit changes revoke it. A backup contains the mode and historical consent receipts, never a reusable authorization. A changed schedule must be confirmed again; cancelling or a late authentication result cannot grant permission. A pending manual preview blocks new scheduled attempts so its authoritative revision cannot be raced by a timer.

Timers still require garden inclusion, elapsed interval, available slots, remaining daily budget and space in the review queue. There is one active job, at most one shared format repair, no transport retry and no catch-up batch. The card, consumed pair and spent slot commit atomically; failed/negative/cancelled jobs retain the slot. Dispatched calls may consume the provider's quota even after cancellation. Closing to the tray keeps an enabled schedule running; Exit/restart stays paused.

Optional existing operator tracing covers the same pipeline/configuration stages in both modes, with only allowlisted technical metadata. It carries no garden names, scope IDs, source text, prompts or raw output and remains independently removable/default OFF.

## Verification boundary

`desktop/tests/automation.test.ts` uses fictional inputs and authored runtime/transport doubles to exercise every provider/Claude alias, bounded commits, mode independence, warnings/cancellation, authentication races, policy revocation, restart/restore, budgets and metadata. Actual WebView2 and WPF shortcut acceptance uses a marked isolated profile with inference hard-disabled and exercises the real controls. This is implementation evidence, not live scheduling latency, subscription availability or creative-quality certification. Development/promotion must not enable the owner's schedule or make a real model request.
