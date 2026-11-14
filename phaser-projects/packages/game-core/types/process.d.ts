// Minimal `process.env` declaration for browser-bundled code.
// Vite replaces `process.env.NODE_ENV` (and similar keys) at build time, so
// the runtime never touches a real Node `process`. This shim lets
// `tsc --noEmit` type-check the package standalone without pulling
// `@types/node` into browser code.
declare const process: {
	env: {
		NODE_ENV?: string;
		USE_SPRITESHEETS?: string;
		[key: string]: string | undefined;
	};
};
