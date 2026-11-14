# PRD: Teacher-created Seesaw-like Activities

## Problem Statement

Teachers need a simple way to create reusable classroom activities, similar to Seesaw, where students can respond freely with text, drawing, and voice. The current teacher create flow only creates one-off drawing/voice activity instances and does not support reusable drafts, versioning, mixed response submissions, review/revision workflows, or future interactive game authoring.

## Solution

Build a first-class teacher authoring system on top of the existing `activities`, `activity_versions`, and `assignments` model.

`/teacher/activities/create` becomes a guided wizard with two modes:

1. **Free response activity**
   - Prompt/instructions
   - Allowed tools: text, drawing, voice
   - Link resources first; uploaded resources later
   - Optional family sharing on approval
   - Preview, save draft, make ready, assign now/later

2. **Interactive game activity**
   - Template gallery, DB/admin controlled
   - Future builders for Listen & Tap, quiz, matching, etc.
   - Uses the same activity/version/resource/assignment foundations

The first vertical slice is free-response end-to-end: teacher creates reusable activity → previews → makes ready → assigns → student submits text/drawing/voice → teacher approves or requests revision.

## User Stories

1. As a teacher, I want to choose between free-response and interactive game activity creation, so that I can start from the right authoring model.
2. As a teacher, I want to create a reusable free-response activity, so that I can assign it more than once.
3. As a teacher, I want to save drafts, so that I can prepare activities before assigning them.
4. As a teacher, I want to preview an unpublished draft as a student, so that I can verify the experience.
5. As a teacher, I want to make an activity ready to assign without making it public, so that my classroom content stays private.
6. As a teacher, I want to assign the latest ready version to a class or selected students, so that existing assignments remain stable.
7. As a student, I want to respond using text, drawing, voice, or a combination, so that I can show my work naturally.
8. As a student, I want my drawing work to be editable during revision, so that I can improve it instead of starting over.
9. As a student, I want to retry voice recordings before submitting, so that only my chosen final take is submitted.
10. As a teacher, I want a review queue of submitted work, so that I can quickly approve or request revisions.
11. As a teacher, I want revision history, so that I can see how a student improved their work.
12. As a teacher, I want optional family sharing on approval, so that approved work can become visible to families later.
13. As a teacher, I want my activity library organized by Drafts, Ready, Assigned/recent, and Archived, so that I can manage reusable materials.
14. As a teacher, I want to duplicate activities, so that I can copy and tweak work for another class.
15. As an admin, I want teacher-private activity support to coexist with public/library activities, so that the system can later support school/public sharing.

## Implementation Decisions

### Activity model

- Use existing `activities` and `activity_versions`.
- Add a visibility/scope concept: `private`, with `school` and `public` reserved for later.
- For teacher UX:
  - DB `draft` = Draft
  - DB `published` = Ready to assign
  - DB `archived` = Archived
  - DB `in_review` reserved for future sharing/moderation
- Teacher-created activities are private by default.
- Admins can manage all activities in MVP.

### Activity types

- Free-response is a real `activity_type`.
- Add metadata/capabilities over time:
  - renderer kind: React vs Phaser
  - authoring mode: admin-only / teacher-simple / hidden
  - auto-scored
  - produces submission
  - supports review

### Free-response config

Canonical activity title lives on the activity row.

Config contains:

```ts
{
  prompt: string;
  allowedTools: {
    text: boolean;
    drawing: boolean;
    voice: boolean;
  };
  shareWithFamilyOnApproval: boolean;
}
```

Validation:
- prompt required
- at least one allowed tool required
- ready/version creation blocked if invalid

### Resources

- Add `activity_resources`.
- Resources are version-snapshotted.
- First slice supports link resources only.
- Later supports uploaded image/audio/PDF via private storage and signed URLs.
- Student view order: title, prompt, resources, response tools.

### Assignment

- Use existing `assignments`.
- Assignment targets: class or selected individual students.
- Due date optional.
- Mandatory optional.
- Teachers assign latest ready version only.
- Existing assignments remain pinned to old versions.

### Student play/rendering

- Use generic `/play/:activityId`.
- If renderer is free-response, render native React instead of Phaser iframe.
- Teachers/admins can preview unpublished owned drafts with preview sessions.
- Students access resources/submissions through assignment authorization.

### Submissions

Add:

- `activity_submissions`
  - one current thread per student/assignment/activity/version
  - current status
  - latest/current attempt pointer
  - current draft state
- `activity_submission_attempts`
  - immutable submitted attempts
  - attempt number
  - response text
  - drawing/voice response data
  - review status
  - teacher feedback
  - optional family-facing comment

Statuses:
- draft
- submitted
- needs_revision
- approved

Rules:
- student can edit draft
- submitted locks until teacher requests revision
- revision starts from latest submitted attempt
- approval or revision applies to the latest attempt and updates submission aggregate status

### Artifacts

- Text is stored on submission/attempt.
- Drawing stores editable state plus a preview artifact.
- Voice allows multiple local takes but submits/uploads one final artifact.
- Media artifacts link to `submission_attempt_id`.
- Approved shared attempts can later surface in parent portfolio/feed.

### Migration strategy

- New authoring uses first-class activities.
- Existing `activity_instances` creative flow coexists temporarily.
- Long term, migrate old drawing/voice quick activities onto the new model.

## Testing Decisions

Test external behavior, not implementation details.

Important coverage:

- Activity visibility/RLS:
  - teacher sees own private drafts
  - students do not discover private activities except through assignment
  - admins can manage all
- Draft → ready/version snapshot:
  - existing assignments remain pinned to old versions
  - resources snapshot with version
- Free-response config validation:
  - requires prompt
  - requires at least one tool
- Assignment:
  - class assignment uses dynamic class membership
  - individual student assignment works
  - latest version assigned
- Student submission:
  - text+drawing+voice can be submitted together
  - submitted state locks editing
  - revision reopens latest attempt
- Review:
  - approve updates attempt and submission
  - request revision stores teacher feedback
- Preview:
  - teacher-owned draft preview allowed
  - non-owner preview denied

## Out of Scope for First Slice

- Uploaded teacher resources
- Parent portal UI for shared submissions
- Interactive game builders
- Listen & Tap media generation
- School/public sharing
- Rubrics
- Learning path integration
- Folders/collections
- Full offline mode
- Student photo/file uploads
- PDF/image annotation

## Further Notes

First milestone should deliver free-response end-to-end before interactive builders. Interactive game authoring should reuse the same activity/version/resource/assignment foundations rather than reintroducing template-specific side tables.
