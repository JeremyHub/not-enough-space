use spacetimedb::{table, reducer, Table, ReducerContext, Identity, TimeDuration, ScheduleAt, SpacetimeType};
use spacetimedb::rand::Rng;

const WORLD_WIDTH: i32 = 6000;
const WORLD_HEIGHT: i32 = 6000;

const TICK_TIME: i64 = 20000;

const ACCELERATION: f32 = 4.0;
const BRAKING_FORCE: f32 = 0.9;
const VELOCITY_MULTIPLIER: f32 = 0.1;
const FRICTION: f32 = 0.9;

const MAX_AREA_PER_BIT: u64 = 1200;
const MAX_BITS: u64 = ((WORLD_HEIGHT*WORLD_WIDTH) as u64)/MAX_AREA_PER_BIT;
const MIN_BIT_WORTH: f32 = 0.1;
const MAX_BIT_WORTH: f32 = 2.0;
const MAX_BIT_SIZE: f32 = MAX_BIT_WORTH;
const AREA_PER_BIT_SPAWN: f64 = 3600.0;
const BITS_SPAWNED_PER_TICK: f64 = ((1.0/AREA_PER_BIT_SPAWN))*((WORLD_HEIGHT*WORLD_WIDTH) as f64);

#[derive(SpacetimeType, Clone, Debug, PartialEq)]
pub enum Direction {
    N,
    NE,
    E,
    SE,
    S,
    SW,
    W,
    NW,
    Brake,
}

#[derive(SpacetimeType, Clone, Debug, PartialEq)]
pub struct Color {
    pub r: i32,
    pub g: i32,
    pub b: i32,
}

#[table(name = user, public)]
pub struct User {
    #[primary_key]
    identity: Identity,
    online: bool,
    x: f32,
    y: f32,
    dx: f32,
    dy: f32,
    direction: Option<Direction>,
    color: Color,
    health: f32,
    size: f32,
}

pub fn get_user_size(health: f32) -> f32 {
    return ((50.0*(health.powi(2)))+health)/((health*health)+200000.0) + 10.0;
}

#[table(name = bit, public,
    index(name = bit_position, btree(columns = [x, y])))]
pub struct Bit {
    #[primary_key]
    #[auto_inc]
    bit_id: u64,
    x: i32,
    y: i32,
    size: f32,
    worth: f32,
    color: Color,
}

#[reducer]
pub fn set_direction(ctx: &ReducerContext, direction: Option<Direction>) -> Result<(), String> {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(User { direction: direction, ..user });
        Ok(())
    } else {
        Err("Cannot set name for unknown user".to_string())
    }
}

#[reducer(client_connected)]
pub fn client_connected(ctx: &ReducerContext) {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(User { online: true, ..user });
    } else {
        ctx.db.user().insert(User {
            identity: ctx.sender,
            online: true,
            x: ctx.rng().gen_range(0..=WORLD_WIDTH) as f32,
            y: ctx.rng().gen_range(0..=WORLD_HEIGHT) as f32,
            dx: 0.0,
            dy: 0.0,
            direction: None,
            color: Color{r: ctx.rng().gen_range(0..=255), g: ctx.rng().gen_range(0..=255), b: ctx.rng().gen_range(0..=255)},
            health: 1.0,
            size: get_user_size(1.0),
        });
    }
}

#[reducer(client_disconnected)]
pub fn identity_disconnected(ctx: &ReducerContext) {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(User { online: false, ..user });
    } else {
        log::warn!("Disconnect event for unknown user with identity {:?}", ctx.sender);
    }
}


fn spawn_bits(ctx: &ReducerContext, tick_id: u64) {
    let current_num_bits = ctx.db.bit().count();
    if current_num_bits < MAX_BITS {
        let mut bits_to_spawn = 1;
        if BITS_SPAWNED_PER_TICK >= 1.0 {
            bits_to_spawn = BITS_SPAWNED_PER_TICK.round() as u64;
            if bits_to_spawn + current_num_bits > MAX_BITS {
                bits_to_spawn = MAX_BITS - current_num_bits;
            }
        } else {
            if !(tick_id % (1.0/BITS_SPAWNED_PER_TICK).round() as u64 == 0) {
                return
            }
        }
        for _ in 0..bits_to_spawn {
            let worth = ctx.rng().gen_range(MIN_BIT_WORTH..=MAX_BIT_WORTH);
            let size = worth;
            let x = ctx.rng().gen_range(0..=WORLD_WIDTH);
            let y = ctx.rng().gen_range(0..=WORLD_HEIGHT);
            let color = Color {
                r: ctx.rng().gen_range(0..=255),
                g: ctx.rng().gen_range(0..=255),
                b: ctx.rng().gen_range(0..=255),
            };
            ctx.db.bit().insert(Bit {
                bit_id: 0,
                x,
                y,
                size,
                worth,
                color,
            });
        }
    }
}

fn update_users(ctx: &ReducerContext) {
    for user in ctx.db.user().iter() {
        if user.online{
            let mut new_dx: f32 = user.dx * FRICTION;
            let mut new_dy: f32 = user.dy * FRICTION;

            match user.direction {
                Some(Direction::N) => {
                    new_dy -= ACCELERATION;
                }
                Some(Direction::NE) => {
                    new_dy -= ACCELERATION;
                    new_dx += ACCELERATION;
                }
                Some(Direction::E) => {
                    new_dx += ACCELERATION;
                }
                Some(Direction::SE) => {
                    new_dy += ACCELERATION;
                    new_dx += ACCELERATION;
                }
                Some(Direction::S) => {
                    new_dy += ACCELERATION;
                }
                Some(Direction::SW) => {
                    new_dy += ACCELERATION;
                    new_dx -= ACCELERATION;
                }
                Some(Direction::W) => {
                    new_dx -= ACCELERATION;
                }
                Some(Direction::NW) => {
                    new_dy -= ACCELERATION;
                    new_dx -= ACCELERATION;
                }
                Some(Direction::Brake) => {
                    new_dx *= BRAKING_FORCE;
                    new_dy *= BRAKING_FORCE;
                }
                None => {}
            }

            let mut new_x = user.x + (user.dx * VELOCITY_MULTIPLIER);
            let mut new_y = user.y + (user.dy * VELOCITY_MULTIPLIER);
            
            if new_x < 0.0 {
                new_x = 0.0;
            } else if new_x >= WORLD_WIDTH as f32 {
                new_x = (WORLD_WIDTH - 1) as f32;
            }
    
            if new_y < 0.0 {
                new_y = 0.0;
            } else if new_y >= WORLD_HEIGHT as f32 {
                new_y = (WORLD_HEIGHT - 1) as f32;
            }
    
            ctx.db.user().identity().update(User {
                x: new_x,
                y: new_y,
                dx: new_dx,
                dy: new_dy,
                ..user
            });
        }
    }
}

fn users_eat_bits(ctx: &ReducerContext) {
    for user in ctx.db.user().iter() {
        if user.online {
            let mut bits_to_eat = Vec::new();
            for bit in ctx.db.bit().bit_position().filter((user.x.round() as i32)-((user.size+MAX_BIT_SIZE).round() as i32)..(user.x.round() as i32)+((user.size+MAX_BIT_SIZE).round() as i32)) {
                if ((user.x - bit.x as f32).powi(2) + (user.y - bit.y as f32).powi(2)).sqrt() <= bit.size + user.size {
                    bits_to_eat.push(bit);
                }
            }
            let mut new_health = user.health;
            for bit in bits_to_eat {
                new_health += bit.worth;
                ctx.db.bit().delete(bit);
            }
            ctx.db.user().identity().update(User {
                health: new_health,
                size: get_user_size(new_health),
                ..user
            });
        }
    }
}

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


#[reducer]
pub fn tick(ctx: &ReducerContext, tick_schedule: TickSchedule) -> Result<(), String> {
    if ctx.sender != ctx.identity() {
        return Err("Reducer `tick` may only be invoked by the scheduler.".into());
    }

    spawn_bits(ctx, tick_schedule.id);
    
    update_users(ctx);
    
    users_eat_bits(ctx);
    
    let last_tick = ctx.db.tick_meta().id().find(0);
    let mut next_tick_schedule = TICK_TIME;
    if let Some(meta) = last_tick {
        let elapsed = ctx.timestamp.time_duration_since(meta.last_tick).unwrap().to_micros();
        next_tick_schedule = TICK_TIME-elapsed;
        ctx.db.tick_meta().id().update(TickMeta { id: 0, last_tick: ctx.timestamp });
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
    ctx.db.tick_schedule().insert(TickSchedule {
        id: 0,
        scheduled_at: ScheduleAt::Time(ctx.timestamp),
    });
    Ok(())
}
