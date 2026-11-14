# Implementation Issue Plan: Teacher-created Activities

Parent PRD: `docs/prd/teacher-created-activities.md`

## Recommended milestone order

1. Issues 1–7: authoring + ready + assign + preview foundation
2. Issues 8–10: student submit + teacher review
3. Issues 11–13: resources, sharing semantics, library polish

---

## 1. Private teacher activity foundation

**Type:** AFK  
**Blocked by:** None

Build private teacher-owned activities using existing activity/version infrastructure.

### Acceptance criteria

- [ ] Activities support private visibility scope.
- [ ] Teacher-created activities are private by default.
- [ ] Teachers can see/manage only their own private activities.
- [ ] Admins can manage all.
- [ ] Public/library activities remain visible as before.
- [ ] Tests cover visibility and RLS behavior.

---

## 2. Register free-response as an activity type

**Type:** AFK  
**Blocked by:** Issue 1

### Acceptance criteria

- [ ] `free-response` exists as an activity type.
- [ ] It is marked as React-rendered, teacher-authorable, submission-producing, reviewable, not auto-scored.
- [ ] Config schema validates prompt, allowed tools, and family sharing setting.
- [ ] Invalid configs cannot become ready.

---

## 3. `/teacher/activities/create` wizard shell

**Type:** AFK  
**Blocked by:** Issue 2

### Acceptance criteria

- [ ] Create page starts with Free response / Interactive game mode cards.
- [ ] Free-response builder supports title, prompt, allowed tools, share setting.
- [ ] Interactive game mode shows template gallery placeholder using authoring availability.
- [ ] Teacher can save a free-response draft.
- [ ] Draft appears in My activities.

---

## 4. My activities hub

**Type:** AFK  
**Blocked by:** Issue 3

### Acceptance criteria

- [ ] `/teacher/activities` has Library / My activities tabs.
- [ ] My activities shows Drafts, Ready, Assigned/recent, Archived.
- [ ] Cards expose mode-specific actions: Edit, Preview, Assign, Duplicate, Archive.
- [ ] Public/library cards still support Preview/Assign.
- [ ] Search/filter basics work for owned activities.

---

## 5. Make ready + version snapshot

**Type:** AFK  
**Blocked by:** Issue 3

### Acceptance criteria

- [ ] Teacher can make valid draft ready.
- [ ] Ready action creates immutable activity version.
- [ ] UI calls it “Ready to assign,” not “Publish.”
- [ ] Editing after ready changes draft only.
- [ ] Existing versions remain unchanged.
- [ ] Tests prove version pinning behavior.

---

## 6. Free-response preview through `/play`

**Type:** AFK  
**Blocked by:** Issues 2, 5

### Acceptance criteria

- [ ] `/play/:activityId` can render React free-response player.
- [ ] Teacher can preview own draft via preview session.
- [ ] Preview looks like student mode.
- [ ] Submit is disabled/mock in preview.
- [ ] Non-owner teacher cannot preview another teacher’s draft.

---

## 7. Universal assign latest ready version

**Type:** AFK  
**Blocked by:** Issue 5

### Acceptance criteria

- [ ] Teacher can assign latest ready version to class.
- [ ] Teacher can assign latest ready version to selected students.
- [ ] Due date is optional.
- [ ] Mandatory flag supported.
- [ ] Assignment pins version id.
- [ ] Student access is authorized through assignment.

---

## 8. Free-response submission model

**Type:** AFK  
**Blocked by:** Issue 7

### Acceptance criteria

- [ ] Add submission and submission-attempt data model.
- [ ] Submission is created lazily when student starts.
- [ ] Attempt history is preserved.
- [ ] Submitted attempt becomes immutable.
- [ ] Current submission stores aggregate/latest state.
- [ ] Tests cover draft, submitted, needs revision, approved transitions.

---

## 9. Student free-response tools: text + drawing + voice

**Type:** AFK  
**Blocked by:** Issue 8

### Acceptance criteria

- [ ] Student sees prompt and allowed Add text / Draw / Record buttons.
- [ ] Student can combine all enabled tools.
- [ ] At least one response is required to submit.
- [ ] Drawing stores editable state and preview artifact.
- [ ] Voice supports retry locally and submits one final recording.
- [ ] Local draft backup protects unsaved work.
- [ ] Submitted work locks editing.

---

## 10. Teacher review queue

**Type:** AFK  
**Blocked by:** Issue 9

### Acceptance criteria

- [ ] Teacher sees submitted attempts needing review.
- [ ] Teacher can approve latest attempt.
- [ ] Teacher can request revision with student-facing feedback.
- [ ] Revision reopens latest attempt as editable baseline.
- [ ] Attempt review status and submission aggregate status both update.
- [ ] Tests cover approve/revision state transitions.

---

## 11. Link resources first slice

**Type:** AFK  
**Blocked by:** Issue 5

### Acceptance criteria

- [ ] Teacher can add ordered link resources to free-response activity.
- [ ] Resources snapshot with activity version.
- [ ] Student sees resources below prompt.
- [ ] Existing assigned versions keep old resource list after edits.
- [ ] Resource authorization respects owner/admin/student assignment access.

---

## 12. Family sharing backend semantics

**Type:** AFK  
**Blocked by:** Issue 10

### Acceptance criteria

- [ ] Activity has share-on-approval setting.
- [ ] Approval records family-share eligibility for approved attempt.
- [ ] Student-facing feedback remains separate from optional family-facing comment.
- [ ] Parent UI is not required yet.
- [ ] Tests verify approval/share state.

---

## 13. Duplicate and archive teacher activities

**Type:** AFK  
**Blocked by:** Issue 4

### Acceptance criteria

- [ ] Duplicate creates a new private draft with copied config/resources.
- [ ] Archive hides activity from active My activities sections.
- [ ] Archived activities do not affect existing assignments.
- [ ] Teacher cannot duplicate/archive activities they do not own.
