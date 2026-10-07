import type { ChatProvider } from './types';
import { AI_ENDPOINT_URL } from './prompt';
import { simulatedProvider } from './simulated';
import { remoteProvider } from './remote';

export function getProvider(): ChatProvider { return AI_ENDPOINT_URL ? remoteProvider : simulatedProvider; }
export * from './types';
export { buildSummary } from './summary';
