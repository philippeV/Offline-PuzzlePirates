export type EntityId = number;

export interface EntityIdCounter {
  nextEntityId: EntityId;
}

export const FIRST_ENTITY_ID: EntityId = 1;

export function takeEntityId(counter: EntityIdCounter): EntityId {
  const id = counter.nextEntityId;
  counter.nextEntityId = id + 1;
  return id;
}
