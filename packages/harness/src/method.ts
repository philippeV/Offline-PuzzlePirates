import type { SessionRegistry } from './sessions.ts';

export type MethodHandler = (params: unknown, registry: SessionRegistry) => unknown;
