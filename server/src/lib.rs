use spacetimedb::{rand, reducer, table, Identity, ReducerContext, ScheduleAt, SpacetimeType, Table, TimeDuration};
use spacetimedb::rand::Rng;
// use rand::Rng;

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
const AREA_PER_BIT_SPAWN: f64 = 36000.0;
const BITS_SPAWNED_PER_TICK: f64 = ((1.0/AREA_PER_BIT_SPAWN))*(WORLD_HEIGHT as f64*WORLD_WIDTH as f64);

const STARTING_BOTS: u64 = 5000;
const MAX_BOT_SIZE: i32 = 3;
const BOT_DRIFT: f32 = 0.5;
const BOT_ACCELERATION: f32 = 2.0;
const BOT_ACCELERATION_ORBITING: f32 = 6.0;
const TANGENTIAL_ORBIT_STRENGTH: f32 = 5.0;
const PORTION_NON_ORBITING_BOTS_DIRECTION_UPDATED_PER_TICK: f64 = 0.005;

const UPDATE_OFFLINE_PLAYERS: bool = true;


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
}

#[table(name = bot, public)]
pub struct Bot {
    #[primary_key]
    #[auto_inc]
    bot_id: u64,
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
    return 4.0 * (health.ln() * (11.0 / 34.0) + 1.0);
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

fn spawn_bots(ctx: &ReducerContext, num_bots: u64) {
    for _ in 0..num_bots {
        let x = ctx.rng().gen_range(0..=WORLD_WIDTH);
        let y = ctx.rng().gen_range(0..=WORLD_HEIGHT);
        let color = Color {
            r: ctx.rng().gen_range(0..=255),
            g: ctx.rng().gen_range(0..=255),
            b: ctx.rng().gen_range(0..=255),
        };
        let size = ctx.rng().gen_range(1..=MAX_BOT_SIZE);
        ctx.db.bot().insert(Bot {
            bot_id: 0,
            x,
            y,
            dx: 0.0,
            dy: 0.0,
            dir_vec_x: 0.0,
            dir_vec_y: 0.0,
            color,
            health: size as f32,
            size: size as f32,
            orbiting: None,
        });
    }
}

fn update_bot_directions(ctx: &ReducerContext) {
    let mut non_orbiting_bots: Vec<_> = ctx.db.bot().iter().filter(|b| b.orbiting.is_none()).collect();
    use rand::seq::SliceRandom;
    let mut rng = ctx.rng();
    non_orbiting_bots.as_mut_slice().shuffle(&mut rng);

    let num_to_update = ((non_orbiting_bots.len() as f64) * PORTION_NON_ORBITING_BOTS_DIRECTION_UPDATED_PER_TICK)
        .ceil() as usize;
    for bot in non_orbiting_bots.into_iter().take(num_to_update) {
        ctx.db.bot().bot_id().update(Bot {
            dir_vec_x: ((ctx.rng().gen_range(0..=100) as f32 / 100.0) * 2.0) - BOT_DRIFT,
            dir_vec_y: ((ctx.rng().gen_range(0..=100) as f32 / 100.0) * 2.0) - BOT_DRIFT,
            ..bot
        });
    }
    // TODO: does not take into account wrapping around edges
    for bot in ctx.db.bot().iter() {
        if let Some(user_id) = bot.orbiting {
            let user = ctx.db.user().identity().find(user_id);
            if let Some(user) = user {
                let dir_vec_x = user.x - bot.x as f32;
                let dir_vec_y = user.y - bot.y as f32;
                let dir_length = (dir_vec_x.powi(2) + dir_vec_y.powi(2)).sqrt();
                if dir_length > 0.0 {
                    let norm_x = dir_vec_x / dir_length;
                    let norm_y = dir_vec_y / dir_length;
                    let perp_x = -norm_y;
                    let perp_y = norm_x;
                    let tangential = (ctx.rng().gen_range(0..=100) as f32 / 100.0) * (TANGENTIAL_ORBIT_STRENGTH/bot.size);
                    ctx.db.bot().bot_id().update(Bot {
                        dir_vec_x: norm_x + perp_x * tangential,
                        dir_vec_y: norm_y + perp_y * tangential,
                        ..bot
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

impl Character for Bot {
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
    // handle user:user and user:bot collisions
    for user in ctx.db.user().iter() {
        if user.online || UPDATE_OFFLINE_PLAYERS {
            let total_bot_size_oribiting = ctx.db.bot().iter().filter(|b| b.orbiting == Some(user.identity)).map(|b| b.size).sum::<f32>();
            if total_bot_size_oribiting < user.size {
                for bot in ctx.db.bot().x().filter((user.x.round() as i32)-((user.size+MAX_BOT_SIZE as f32).round() as i32)..(user.x.round() as i32)+((user.size+MAX_BOT_SIZE as f32).round() as i32)) {
                    if ((user.x - bot.x as f32).powi(2) + (user.y - bot.y as f32).powi(2)).sqrt() <= bot.size + user.size {
                        ctx.db.bot().bot_id().update(Bot {
                            orbiting: Some(user.identity),
                            ..bot
                        });
                    }
                }
            }
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

fn update_bots(ctx: &ReducerContext) {
    update_bot_directions(ctx);
    for bot in ctx.db.bot().iter() {
        let acceleration = if bot.orbiting.is_some() {
            BOT_ACCELERATION_ORBITING
        } else {
            BOT_ACCELERATION
        };
        let upd = move_character(&bot, acceleration, true);
        ctx.db.bot().bot_id().update(Bot {
            x: upd.x as i32,
            y: upd.y as i32,
            dx: upd.dx,
            dy: upd.dy,
            ..bot
        });
    }
}

fn users_eat_bits(ctx: &ReducerContext) {
    for user in ctx.db.user().iter() {
        if user.online || UPDATE_OFFLINE_PLAYERS{
            let mut bits_to_eat = Vec::new();
            for bit in ctx.db.bit().x().filter((user.x.round() as i32)-((user.size+MAX_BIT_SIZE).round() as i32)..(user.x.round() as i32)+((user.size+MAX_BIT_SIZE).round() as i32)) {
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
    
    update_bots(ctx);

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
    spawn_bots(ctx, STARTING_BOTS);
    ctx.db.tick_schedule().insert(TickSchedule {
        id: 0,
        scheduled_at: ScheduleAt::Time(ctx.timestamp),
    });
    Ok(())
}
