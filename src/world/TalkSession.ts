import { CounterSession } from './CounterSession';
import type { WorldContext } from './WorldContext';

/**
 * Talking to somebody: what a tap on a person opens, before any counter.
 *
 * It is a counter with nothing to sell, and deliberately no more than that yet.
 * Everything that makes a conversation a thing to be *in* — walking up to open
 * it, walking off to end it, one at a time with the counters, the person the
 * quest desk asks about — is already the base's, so what a conversation says
 * and what it offers are the HUD's to draw from the tables: the greeting, the
 * person's quests, and a button for the counter they work. Dialog that
 * remembers what was asked is the state that will live here when there is some.
 */
export class TalkSession extends CounterSession {
  constructor(ctx: WorldContext) {
    super(ctx, 'talk');
  }
}
