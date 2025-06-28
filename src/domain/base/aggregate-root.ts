/**
 * Base AggregateRoot class for domain aggregates
 * Aggregates are clusters of domain objects that can be treated as a single unit
 */

import { Entity } from "./entity";

export abstract class AggregateRoot<TId> extends Entity<TId> {
  /**
   * Mark the aggregate as modified
   * This can be used by repositories to track changes
   */
  protected markAsModified(): void {
    // This method can be extended to track aggregate modifications
    // For example, updating a "lastModified" timestamp
  }
}
