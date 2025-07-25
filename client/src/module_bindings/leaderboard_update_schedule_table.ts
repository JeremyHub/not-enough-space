// THIS FILE IS AUTOMATICALLY GENERATED BY SPACETIMEDB. EDITS TO THIS FILE
// WILL NOT BE SAVED. MODIFY TABLES IN YOUR MODULE SOURCE CODE INSTEAD.

// This was generated using spacetimedb cli version 1.2.0 (commit fb41e50eb73573b70eea532aeb6158eaac06fae0).

/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
import {
  AlgebraicType,
  AlgebraicValue,
  BinaryReader,
  BinaryWriter,
  ConnectionId,
  DbConnectionBuilder,
  DbConnectionImpl,
  Identity,
  ProductType,
  ProductTypeElement,
  SubscriptionBuilderImpl,
  SumType,
  SumTypeVariant,
  TableCache,
  TimeDuration,
  Timestamp,
  deepEqual,
  type CallReducerFlags,
  type DbContext,
  type ErrorContextInterface,
  type Event,
  type EventContextInterface,
  type ReducerEventContextInterface,
  type SubscriptionEventContextInterface,
} from "@clockworklabs/spacetimedb-sdk";
import { LeaderboardUpdateSchedule } from "./leaderboard_update_schedule_type";
import { type EventContext, type Reducer, RemoteReducers, RemoteTables } from ".";

/**
 * Table handle for the table `leaderboard_update_schedule`.
 *
 * Obtain a handle from the [`leaderboardUpdateSchedule`] property on [`RemoteTables`],
 * like `ctx.db.leaderboardUpdateSchedule`.
 *
 * Users are encouraged not to explicitly reference this type,
 * but to directly chain method calls,
 * like `ctx.db.leaderboardUpdateSchedule.on_insert(...)`.
 */
export class LeaderboardUpdateScheduleTableHandle {
  tableCache: TableCache<LeaderboardUpdateSchedule>;

  constructor(tableCache: TableCache<LeaderboardUpdateSchedule>) {
    this.tableCache = tableCache;
  }

  count(): number {
    return this.tableCache.count();
  }

  iter(): Iterable<LeaderboardUpdateSchedule> {
    return this.tableCache.iter();
  }
  /**
   * Access to the `id` unique index on the table `leaderboard_update_schedule`,
   * which allows point queries on the field of the same name
   * via the [`LeaderboardUpdateScheduleIdUnique.find`] method.
   *
   * Users are encouraged not to explicitly reference this type,
   * but to directly chain method calls,
   * like `ctx.db.leaderboardUpdateSchedule.id().find(...)`.
   *
   * Get a handle on the `id` unique index on the table `leaderboard_update_schedule`.
   */
  id = {
    // Find the subscribed row whose `id` column value is equal to `col_val`,
    // if such a row is present in the client cache.
    find: (col_val: bigint): LeaderboardUpdateSchedule | undefined => {
      for (let row of this.tableCache.iter()) {
        if (deepEqual(row.id, col_val)) {
          return row;
        }
      }
    },
  };

  onInsert = (cb: (ctx: EventContext, row: LeaderboardUpdateSchedule) => void) => {
    return this.tableCache.onInsert(cb);
  }

  removeOnInsert = (cb: (ctx: EventContext, row: LeaderboardUpdateSchedule) => void) => {
    return this.tableCache.removeOnInsert(cb);
  }

  onDelete = (cb: (ctx: EventContext, row: LeaderboardUpdateSchedule) => void) => {
    return this.tableCache.onDelete(cb);
  }

  removeOnDelete = (cb: (ctx: EventContext, row: LeaderboardUpdateSchedule) => void) => {
    return this.tableCache.removeOnDelete(cb);
  }

  // Updates are only defined for tables with primary keys.
  onUpdate = (cb: (ctx: EventContext, oldRow: LeaderboardUpdateSchedule, newRow: LeaderboardUpdateSchedule) => void) => {
    return this.tableCache.onUpdate(cb);
  }

  removeOnUpdate = (cb: (ctx: EventContext, onRow: LeaderboardUpdateSchedule, newRow: LeaderboardUpdateSchedule) => void) => {
    return this.tableCache.removeOnUpdate(cb);
  }}
