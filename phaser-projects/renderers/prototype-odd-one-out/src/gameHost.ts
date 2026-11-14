import PrototypeOddOneOutLevel from './scenes/PrototypeOddOneOutLevel';
import PrototypePreload from './scenes/PrototypePreload';
import {
    defineGameTemplate,
    mountGameTemplate,
    type GameDiagnosticsSnapshot,
    type GameTemplateHandle,
    type GameTemplateMountOptions
} from '@edu-play/game-core';

export interface PrototypeOddOneOutMountOptions extends GameTemplateMountOptions {}
export type { GameDiagnosticsSnapshot };
export type GameHandle = GameTemplateHandle<PrototypeOddOneOutMountOptions>;

export const prototypeOddOneOutTemplate = defineGameTemplate<PrototypeOddOneOutMountOptions>({
    id: 'prototype-odd-one-out',
    defaultGameId: 'prototype-odd-one-out-01',
    scenes: [PrototypePreload, PrototypeOddOneOutLevel]
});

export function mountPrototypeOddOneOutGame(
    container?: HTMLElement,
    initialOptions: PrototypeOddOneOutMountOptions = {}
): GameHandle {
    return mountGameTemplate(prototypeOddOneOutTemplate, container, initialOptions);
}
