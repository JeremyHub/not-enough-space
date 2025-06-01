use std::collections::HashMap;

use spacetimedb::{rand, reducer, table, Identity, ReducerContext, ScheduleAt, SpacetimeType, Table, TimeDuration};
use spacetimedb::rand::Rng;

const WORLD_WIDTH: i32 = 10000;
const WORLD_HEIGHT: i32 = 10000;

const TICK_TIME: i64 = 20000;

const USER_ACCELERATION: f32 = 4.0;
const VELOCITY_MULTIPLIER: f32 = 0.1;
const FRICTION: f32 = 0.9;

const MAX_AREA_PER_BIT: u64 = 5000;
const MAX_BITS: u64 = (WORLD_HEIGHT as u64 *WORLD_WIDTH as u64)/MAX_AREA_PER_BIT;
const MIN_BIT_WORTH: f32 = 0.1;
const MAX_BIT_WORTH: f32 = 2.0;
const MAX_BIT_SIZE: f32 = MAX_BIT_WORTH;

const STARTING_MOONS: u64 = 5000;
const MAX_MOON_SIZE: i32 = 3;
const MOON_DRIFT: f32 = 0.5;
const MOON_ACCELERATION: f32 = 2.0;
const MOON_ACCELERATION_ORBITING: f32 = 15.0;
const TANGENTIAL_ORBIT_STRENGTH: f32 = 6.0;
const PORTION_NON_ORBITING_MOONS_DIRECTION_UPDATED_PER_TICK: f64 = 0.005;
const ORBITING_MOON_SIZE_DIVISOR: f32 = 2.0;
const ORBITING_MOON_SIZE_DIVISOR_MIN: i32 = 4;
const ORBITING_MOON_SIZE_DIVISOR_MAX: i32 = 5;
const ORIBTING_MOON_USER_SPEED_RATIO_ADD: f32 = 0.9;
const ORIBITING_MOON_USER_SPEED_RATIO_THRESHOLD: f32 = 0.1;

const UPDATE_OFFLINE_PLAYERS: bool = true;


#[table(name = metadata, public)]
pub struct Metadata {
    world_height: i32,
    world_width: i32,
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
    dir_vec_x: f32,
    dir_vec_y: f32,
    color: Color,
    health: f32,
    size: f32,
    total_moon_size_oribiting: f32,
}

#[table(name = moon, public)]
pub struct Moon {
    #[primary_key]
    #[auto_inc]
    moon_id: u64,
    #[index(btree)]
    x: i32,
    y: i32,
    dx: f32,
    dy: f32,
    dir_vec_x: f32,
    dir_vec_y: f32,
    color: Color,
    health: f32,
    size: f32,
    orbiting: Option<Identity>,
}

pub fn get_user_size(health: f32) -> f32 {
    return if health < 1398.65 {(health/10.0) + 5.0} else {health.ln()*20.0};
}

#[table(name = bit, public)]
pub struct Bit {
    #[primary_key]
    #[auto_inc]
    bit_id: u64,
    #[index(btree)]
    x: i32,
    y: i32,
    size: f32,
    worth: f32,
    color: Color,
}

#[reducer]
pub fn set_dir_vec(ctx: &ReducerContext, dir_vec_x: f32, dir_vec_y: f32) -> Result<(), String> {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(User { 
            dir_vec_x,
            dir_vec_y,
            ..user
        });
        Ok(())
    } else {
        Err("Cannot set dir vec for unknown user".to_string())
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
            dir_vec_x: 0.0,
            dir_vec_y: 0.0,
            color: Color{r: ctx.rng().gen_range(0..=255), g: ctx.rng().gen_range(0..=255), b: ctx.rng().gen_range(0..=255)},
            health: 1.0,
            size: get_user_size(1.0),
            total_moon_size_oribiting: 0.0,
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


fn spawn_bits(ctx: &ReducerContext) {
    let current_num_bits = ctx.db.bit().count();
    if current_num_bits < MAX_BITS {
        let bits_to_spawn = MAX_BITS - current_num_bits;
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

fn spawn_moons(ctx: &ReducerContext, num_moons: u64) {
    for _ in 0..num_moons {
        let x = ctx.rng().gen_range(0..=WORLD_WIDTH);
        let y = ctx.rng().gen_range(0..=WORLD_HEIGHT);
        let color = Color {
            r: ctx.rng().gen_range(0..=255),
            g: ctx.rng().gen_range(0..=255),
            b: ctx.rng().gen_range(0..=255),
        };
        let size = ctx.rng().gen_range(1..=MAX_MOON_SIZE);
        ctx.db.moon().insert(Moon {
            moon_id: 0,
            x,
            y,
            dx: 0.0,
            dy: 0.0,
            dir_vec_x: ((ctx.rng().gen_range(0..=100) as f32 / 100.0) * 2.0) - MOON_DRIFT,
            dir_vec_y: ((ctx.rng().gen_range(0..=100) as f32 / 100.0) * 2.0) - MOON_DRIFT,
            color,
            health: size as f32,
            size: size as f32,
            orbiting: None,
        });
    }
}

fn update_moon_directions(ctx: &ReducerContext) {
    let mut non_orbiting_moons: Vec<_> = ctx.db.moon().iter().filter(|b| b.orbiting.is_none()).collect();
    use rand::seq::SliceRandom;
    let mut rng = ctx.rng();
    non_orbiting_moons.as_mut_slice().shuffle(&mut rng);

    let num_to_update = ((non_orbiting_moons.len() as f64) * PORTION_NON_ORBITING_MOONS_DIRECTION_UPDATED_PER_TICK)
        .ceil() as usize;
    for moon in non_orbiting_moons.into_iter().take(num_to_update) {
        ctx.db.moon().moon_id().update(Moon {
            dir_vec_x: ((ctx.rng().gen_range(0..=100) as f32 / 100.0) * 2.0) - MOON_DRIFT,
            dir_vec_y: ((ctx.rng().gen_range(0..=100) as f32 / 100.0) * 2.0) - MOON_DRIFT,
            ..moon
        });
    }
    for moon in ctx.db.moon().iter() {
        if let Some(user_id) = moon.orbiting {
            let user = ctx.db.user().identity().find(user_id);
            if let Some(user) = user {
                let mut dir_vec_x = user.x - moon.x as f32;
                let mut dir_vec_y = user.y - moon.y as f32;

                // Handle wrapping for x
                if dir_vec_x.abs() > (WORLD_WIDTH as f32) / 2.0 {
                    if dir_vec_x > 0.0 {
                        dir_vec_x -= WORLD_WIDTH as f32;
                    } else {
                        dir_vec_x += WORLD_WIDTH as f32;
                    }
                }
                // Handle wrapping for y
                if dir_vec_y.abs() > (WORLD_HEIGHT as f32) / 2.0 {
                    if dir_vec_y > 0.0 {
                        dir_vec_y -= WORLD_HEIGHT as f32;
                    } else {
                        dir_vec_y += WORLD_HEIGHT as f32;
                    }
                }
                let dir_length = (dir_vec_x.powi(2) + dir_vec_y.powi(2)).sqrt();
                
                if dir_length > 0.0 {
                    let norm_x = dir_vec_x / dir_length;
                    let norm_y = dir_vec_y / dir_length;
                    let perp_x = -norm_y;
                    let perp_y = norm_x;
                    let tangential = TANGENTIAL_ORBIT_STRENGTH/((moon.size/ORBITING_MOON_SIZE_DIVISOR)+ctx.rng().gen_range(ORBITING_MOON_SIZE_DIVISOR_MIN..=ORBITING_MOON_SIZE_DIVISOR_MAX) as f32)+(user.size/30.0);
                    let user_speed_ratio = (user.dx.powi(2) + user.dy.powi(2)).sqrt()/(USER_ACCELERATION/VELOCITY_MULTIPLIER);
                    let new_dx = moon.dx * (user_speed_ratio+ORIBTING_MOON_USER_SPEED_RATIO_ADD);
                    let new_dy = moon.dy * (user_speed_ratio+ORIBTING_MOON_USER_SPEED_RATIO_ADD);
                    ctx.db.moon().moon_id().update(Moon {
                        dir_vec_x: norm_x + perp_x * tangential,
                        dir_vec_y: norm_y + perp_y * tangential,
                        dx: if user_speed_ratio < ORIBITING_MOON_USER_SPEED_RATIO_THRESHOLD { new_dx } else { moon.dx },
                        dy: if user_speed_ratio < ORIBITING_MOON_USER_SPEED_RATIO_THRESHOLD { new_dy } else { moon.dy },
                        ..moon
                    });
                    continue;
                }
            }
        }
    }
}

trait Character {
    fn x(&self) -> f32;
    fn y(&self) -> f32;
    fn dx(&self) -> f32;
    fn dy(&self) -> f32;
    fn dir_vec_x(&self) -> f32;
    fn dir_vec_y(&self) -> f32;
}

impl Character for User {
    fn x(&self) -> f32 { self.x }
    fn y(&self) -> f32 { self.y }
    fn dx(&self) -> f32 { self.dx }
    fn dy(&self) -> f32 { self.dy }
    fn dir_vec_x(&self) -> f32 { self.dir_vec_x }
    fn dir_vec_y(&self) -> f32 { self.dir_vec_y }
}

impl Character for Moon {
    fn x(&self) -> f32 { self.x as f32 }
    fn y(&self) -> f32 { self.y as f32 }
    fn dx(&self) -> f32 { self.dx }
    fn dy(&self) -> f32 { self.dy }
    fn dir_vec_x(&self) -> f32 { self.dir_vec_x }
    fn dir_vec_y(&self) -> f32 { self.dir_vec_y }
}

struct CharacterUpdate {
    x: f32,
    y: f32,
    dx: f32,
    dy: f32,
}

fn move_character<C: Character>(character: &C, acceleration: f32, handle_wrapping: bool) -> CharacterUpdate {
    let mut new_dx: f32 = character.dx() * FRICTION;
    let mut new_dy: f32 = character.dy() * FRICTION;

    if character.dir_vec_x() != 0.0 || character.dir_vec_y() != 0.0 {
        let dir_length = (character.dir_vec_x().powi(2) + character.dir_vec_y().powi(2)).sqrt();
        if dir_length > 0.0 {
            new_dx += (character.dir_vec_x() / dir_length) * acceleration;
            new_dy += (character.dir_vec_y() / dir_length) * acceleration;
        }
    }

    let after_move_x = character.x() + (character.dx() * VELOCITY_MULTIPLIER);
    let after_move_y = character.y() + (character.dy() * VELOCITY_MULTIPLIER);

    let new_x;
    let new_y;

    if handle_wrapping {
        (new_x, new_y) = wrap_coords(after_move_x, after_move_y);
    } else {
        new_x = after_move_x;
        new_y = after_move_y;
    }

    CharacterUpdate { x: new_x, y: new_y, dx: new_dx, dy: new_dy }
}

fn wrap_coords(x: f32, y: f32) -> (f32, f32) {
    let mut new_x = x;
    let mut new_y = y;

    if new_x < 0.0 { new_x = WORLD_WIDTH as f32 - new_x; }
    else if new_x >= WORLD_WIDTH as f32 { new_x = new_x - WORLD_WIDTH as f32; }

    if new_y < 0.0 { new_y = WORLD_HEIGHT as f32 - new_y; }
    else if new_y >= WORLD_HEIGHT as f32 { new_y = new_y - WORLD_HEIGHT as f32; }

    (new_x, new_y)
}

fn wrap_character<C: Character>(character: &C) -> CharacterUpdate {

    let (new_x, new_y) = wrap_coords(character.x(), character.y());

    CharacterUpdate {
        x: new_x,
        y: new_y,
        dx: character.dx(),
        dy: character.dy(),
    }
}

fn update_users(ctx: &ReducerContext) {
    // move users
    for user in ctx.db.user().iter() {
        if user.online || UPDATE_OFFLINE_PLAYERS {
            let upd = move_character(&user, USER_ACCELERATION, false);
            ctx.db.user().identity().update(User {
                x: upd.x,
                y: upd.y,
                dx: upd.dx,
                dy: upd.dy,
                ..user
            });
        }
    }
    // handle user:user and user:moon collisions
    let mut moon_size_map: HashMap<Identity, f32> = HashMap::new();
    for user in ctx.db.user().iter() {
        if user.online || UPDATE_OFFLINE_PLAYERS {
            if user.total_moon_size_oribiting < user.size {
                for range in wrapped_ranges(user.x.round() as i32, (user.size + MAX_MOON_SIZE as f32) as i32, WORLD_WIDTH) {
                    for moon in ctx.db.moon().x().filter(range) {
                        if moon.orbiting.is_none() {
                            if toroidal_distance(user.x, user.y, moon.x as f32, moon.y as f32) <= (user.size + moon.size) {
                                ctx.db.moon().moon_id().update(Moon {
                                    orbiting: Some(user.identity),
                                    ..moon
                                });
                                *moon_size_map.entry(user.identity).or_insert(0.0) += moon.size;
                            }
                        }
                    }
                }
            }
        }
    }
    for (identity, new_oribing_size) in moon_size_map {
        if let Some(user) = ctx.db.user().identity().find(identity) {
            ctx.db.user().identity().update(User {
                total_moon_size_oribiting: new_oribing_size + user.total_moon_size_oribiting,
                ..user
            });
        }
    }

    // handle character wrapping
    for user in ctx.db.user().iter() {
        if user.online || UPDATE_OFFLINE_PLAYERS {
            let upd = wrap_character(&user);
            ctx.db.user().identity().update(User {
                x: upd.x,
                y: upd.y,
                dx: upd.dx,
                dy: upd.dy,
                ..user
            });
        }
    }
}

fn update_moons(ctx: &ReducerContext) {
    update_moon_directions(ctx);
    for moon in ctx.db.moon().iter() {
        let acceleration = if moon.orbiting.is_some() {
            MOON_ACCELERATION_ORBITING
        } else {
            MOON_ACCELERATION
        };
        let upd = move_character(&moon, acceleration, true);
        ctx.db.moon().moon_id().update(Moon {
            x: upd.x as i32,
            y: upd.y as i32,
            dx: upd.dx,
            dy: upd.dy,
            ..moon
        });
    }
}

fn users_eat_bits(ctx: &ReducerContext) {
    for user in ctx.db.user().iter() {
        if user.online || UPDATE_OFFLINE_PLAYERS {
            let mut bits_to_eat = Vec::new();
            for range in wrapped_ranges(user.x.round() as i32, (user.size + MAX_BIT_SIZE) as i32, WORLD_WIDTH) {
                for bit in ctx.db.bit().x().filter(range) {
                    if toroidal_distance(user.x, user.y, bit.x as f32, bit.y as f32) <= (user.size + bit.size) {
                        bits_to_eat.push(bit);
                    }
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

fn wrapped_ranges(center: i32, radius: i32, max: i32) -> Vec<core::ops::Range<i32>> {
    let min = center - radius;
    let max_range = center + radius;
    if min < 0 {
        // Wraps left edge: two ranges
        vec![
            0..max_range.min(max),
            (max + min)..max
        ]
    } else if max_range >= max {
        // Wraps right edge: two ranges
        vec![
            min..max,
            0..(max_range - max)
        ]
    } else {
        // No wrap: single range
        vec![min..max_range]
    }
}

fn toroidal_distance(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    let dx = ((x1 - x2).abs()).min(WORLD_WIDTH as f32 - (x1 - x2).abs());
    let dy = ((y1 - y2).abs()).min(WORLD_HEIGHT as f32 - (y1 - y2).abs());
    (dx * dx + dy * dy).sqrt()
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

    spawn_bits(ctx);
    
    update_moons(ctx);

    update_users(ctx);
    
    users_eat_bits(ctx);

    
    let last_tick = ctx.db.tick_meta().id().find(0);
    let mut next_tick_schedule = TICK_TIME;
    if let Some(meta) = last_tick {
        let elapsed = ctx.timestamp.time_duration_since(meta.last_tick).unwrap().to_micros();
        next_tick_schedule = TICK_TIME-elapsed;
        ctx.db.tick_meta().id().update(TickMeta { id: 0, last_tick: ctx.timestamp });
        if elapsed > TICK_TIME*2 {
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
    spawn_moons(ctx, STARTING_MOONS);
    ctx.db.metadata().insert(Metadata {
        world_height: WORLD_HEIGHT,
        world_width: WORLD_WIDTH,
    });
    ctx.db.tick_schedule().insert(TickSchedule {
        id: 0,
        scheduled_at: ScheduleAt::Time(ctx.timestamp),
    });
    Ok(())
}
