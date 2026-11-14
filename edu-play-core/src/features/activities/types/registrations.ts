// Side-effect module that registers every concrete activity type with the
// shared registry. Imported once from `@/features/activities` so any
// surface consuming the public API (page route, ActivityPlayer parent)
// gets all types registered without manually opting in.
//
// Adding a new type: import its definition here and call
// `registerActivityType(...)`. Don't add the registration call inside the
// type's own module — keeping registration centralized makes test resets
// (`__resetActivityTypeRegistryForTests`) actually rehydrate cleanly.

import { registerActivityType } from '../registry';
import { drawingCanvasDefinition } from './drawing-canvas';
import { voiceRecordingType } from './voice-recording';

registerActivityType(drawingCanvasDefinition);
registerActivityType(voiceRecordingType);
