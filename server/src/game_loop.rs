use spacetimedb::{reducer, table, ReducerContext, ScheduleAt, Table, TimeDuration};

use super::user;
use super::moon;
use super::bit;
use super::user_moon;
use super::user_user;
use super::moon_moon;
use super::user_bit;
use super::ai;

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


#[table(name = metadata, public)]
pub struct Metadata {
    world_height: i32,
    world_width: i32,
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
        let elapsed = ctx.timestamp.time_duration_since(meta.last_tick).unwrap().to_micros();
        next_tick_schedule = super::TICK_TIME-elapsed;
        ctx.db.tick_meta().id().update(TickMeta { id: 0, last_tick: ctx.timestamp });
        if elapsed > super::TICK_TIME*2 {
            log::info!("Tick {} at {}ms after last tick", tick_schedule.id, elapsed);
        }
    } else {
        ctx.db.tick_meta().insert(TickMeta { id: 0, last_tick: ctx.timestamp });
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
    ctx.db.metadata().insert(Metadata {
        world_height: super::WORLD_HEIGHT,
        world_width: super::WORLD_WIDTH,
    });
    ctx.db.tick_schedule().insert(TickSchedule {
        id: 0,
        scheduled_at: ScheduleAt::Time(ctx.timestamp),
    });
    Ok(())
}
