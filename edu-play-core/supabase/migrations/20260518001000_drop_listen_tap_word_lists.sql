-- Remove the abandoned teacher listen-tap word-list prototype.
-- Future Seesaw-like authoring should use first-class activities, assignments,
-- submissions, and review flows rather than this side-table.

DROP POLICY IF EXISTS "Owner deletes listen_tap_word_lists" ON listen_tap_word_lists;
DROP POLICY IF EXISTS "Owner updates listen_tap_word_lists" ON listen_tap_word_lists;
DROP POLICY IF EXISTS "Owner inserts listen_tap_word_lists" ON listen_tap_word_lists;
DROP POLICY IF EXISTS "Authenticated read listen_tap_word_lists" ON listen_tap_word_lists;

DROP TRIGGER IF EXISTS update_listen_tap_word_lists_updated_at ON listen_tap_word_lists;

DROP TABLE IF EXISTS listen_tap_word_lists;
