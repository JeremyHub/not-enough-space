use spacetimedb::{reducer, table, ReducerContext, ScheduleAt, Table, TimeDuration};

use crate::bit::bit as _;
use crate::game_loop::dynamic_metadata as _;
use crate::game_loop::static_metadata as _;
use crate::game_loop::tick_meta as _;
use crate::game_loop::tick_schedule as _;
use crate::leaderboard::leaderboard_entry as _;
use crate::leaderboard::leaderboard_update_schedule as _;
use crate::moon::moon as _;
use crate::user::user as _;

use super::game_loop;

#[table(name = game_reset_schedule, scheduled(game_reset))]
pub struct GameResetSchedule {
    #[primary_key]
    #[auto_inc]
    id: u64,
    scheduled_at: ScheduleAt,
}

pub fn init_game_reset_schedule(ctx: &ReducerContext) -> Result<(), String> {
    // Insert the initial game reset schedule
    ctx.db.game_reset_schedule().insert(GameResetSchedule {
        id: 0,
        scheduled_at: ScheduleAt::Time(
            ctx.timestamp + TimeDuration::from_micros(super::GAME_RESET_UPDATE_INTERVAL_MICROS),
        ),
    });
    Ok(())
}

pub fn delete_all_from_table(ctx: &ReducerContext) {
    for item in ctx.db.user().iter() {
        ctx.db.user().delete(item);
    }
    for item in ctx.db.moon().iter() {
        ctx.db.moon().delete(item);
    }
    for item in ctx.db.leaderboard_entry().iter() {
        ctx.db.leaderboard_entry().delete(item);
    }
    for item in ctx.db.bit().iter() {
        ctx.db.bit().delete(item);
    }
    for item in ctx.db.tick_schedule().iter() {
        ctx.db.tick_schedule().delete(item);
    }
    for item in ctx.db.tick_meta().iter() {
        ctx.db.tick_meta().delete(item);
    }
    for item in ctx.db.static_metadata().iter() {
        ctx.db.static_metadata().delete(item);
    }
    for item in ctx.db.dynamic_metadata().iter() {
        ctx.db.dynamic_metadata().delete(item);
    }
    for item in ctx.db.game_reset_schedule().iter() {
        ctx.db.game_reset_schedule().delete(item);
    }
    for item in ctx.db.leaderboard_update_schedule().iter() {
        ctx.db.leaderboard_update_schedule().delete(item);
    }
    for item in ctx.db.leaderboard_entry().iter() {
        ctx.db.leaderboard_entry().delete(item);
    }
}

#[reducer]
pub fn game_reset(
    ctx: &ReducerContext,
    _game_reset_schedule: GameResetSchedule,
) -> Result<(), String> {
    if ctx.sender != ctx.identity() {
        return Err("Reducer `game_reset` may only be invoked by the scheduler.".into());
    }

    let metadata = ctx.db.dynamic_metadata().id().find(0);
    if let Some(metadata) = metadata {
        if metadata.game_reset_updates_since_last_update >= super::GAME_RESET_UPDATES_TO_RESET {
            delete_all_from_table(ctx);
            game_loop::init(ctx)?;
            return Ok(());
        }
        ctx.db
            .dynamic_metadata()
            .id()
            .update(game_loop::DynamicMetadata {
                id: 0,
                num_ais: metadata.num_ais,
                total_users: metadata.total_users,
                game_reset_updates_since_last_update: metadata.game_reset_updates_since_last_update
                    + 1,
            });
    }

    let interval = TimeDuration::from_micros(super::GAME_RESET_UPDATE_INTERVAL_MICROS);
    ctx.db.game_reset_schedule().insert(GameResetSchedule {
        id: 0,
        scheduled_at: ScheduleAt::Time(ctx.timestamp + interval),
    });

    Ok(())
}
