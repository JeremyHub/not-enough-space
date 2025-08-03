use spacetimedb::{reducer, table, ReducerContext, ScheduleAt, Table, TimeDuration};

use super::ai;
use super::bit;
use super::game_reset;
use super::leaderboard;
use super::moon;
use super::moon_moon;
use super::user;
use super::user_bit;
use super::user_moon;
use super::user_user;

#[table(name = tick_schedule, scheduled(tick))]
pub struct TickSchedule {
    #[primary_key]
    #[auto_inc]
    id: u64,
    scheduled_at: ScheduleAt,
}

#[table(name = tick_meta)]
pub struct TickMeta {
    #[primary_key]
    id: u64,
    last_tick: spacetimedb::Timestamp,
}

#[table(name = static_metadata, public)]
pub struct StaticMetadata {
    world_height: i32,
    world_width: i32,
    ticks_per_second: u32,
    game_reset_updates_per_second: i64,
}

#[table(name = dynamic_metadata, public)]
pub struct DynamicMetadata {
    #[primary_key]
    pub id: u64,
    pub num_ais: u32,
    pub total_users: u32,
    pub game_reset_updates_until_reset: u64,
}

#[reducer]
pub fn tick(ctx: &ReducerContext, tick_schedule: TickSchedule) -> Result<(), String> {
    if ctx.sender != ctx.identity() {
        return Err("Reducer `tick` may only be invoked by the scheduler.".into());
    }

    bit::spawn_bits(ctx);
    bit::update_bits(ctx);

    ai::spawn_ai(ctx);
    ai::update_ai_directions(ctx);

    moon::spawn_moons(ctx);
    moon::update_moons(ctx);

    user::update_users(ctx);

    user_moon::check_moon_user_collisions(ctx);

    moon_moon::check_moon_moon_collisions(ctx);

    user_bit::check_user_bit_collisions(ctx);

    user_user::check_user_user_collisions(ctx);

    let last_tick = ctx.db.tick_meta().id().find(0);
    let mut next_tick_schedule = super::TICK_TIME;
    if let Some(meta) = last_tick {
        let elapsed = ctx
            .timestamp
            .time_duration_since(meta.last_tick)
            .unwrap()
            .to_micros();
        next_tick_schedule = super::TICK_TIME - elapsed;
        ctx.db.tick_meta().id().update(TickMeta {
            id: 0,
            last_tick: ctx.timestamp,
        });
        if elapsed > super::TICK_TIME * 2 {
            log::info!("Tick {} at {}ms after last tick", tick_schedule.id, elapsed);
        }
    } else {
        ctx.db.tick_meta().insert(TickMeta {
            id: 0,
            last_tick: ctx.timestamp,
        });
        log::info!("First tick!");
    }

    let tick_interval = TimeDuration::from_micros(next_tick_schedule);
    ctx.db.tick_schedule().insert(TickSchedule {
        id: 0,
        scheduled_at: ScheduleAt::Time(ctx.timestamp + tick_interval),
    });

    Ok(())
}

#[reducer(init)]
pub fn init(ctx: &ReducerContext) -> Result<(), String> {
    ctx.db.static_metadata().insert(StaticMetadata {
        world_height: super::WORLD_HEIGHT,
        world_width: super::WORLD_WIDTH,
        ticks_per_second: super::TICKS_PER_SECOND,
        game_reset_updates_per_second: super::GAME_RESET_UPDATE_INTERVAL_MICROS / 1_000_000,
    });
    ctx.db.dynamic_metadata().insert(DynamicMetadata {
        id: 0,
        num_ais: 0,
        total_users: 0,
        game_reset_updates_until_reset: super::GAME_RESET_UPDATES_TO_RESET,
    });
    ctx.db.tick_schedule().insert(TickSchedule {
        id: 0,
        scheduled_at: ScheduleAt::Time(ctx.timestamp),
    });
    leaderboard::init_leaderboard_schedule(ctx)?;
    game_reset::init_game_reset_schedule(ctx)?;
    Ok(())
}
