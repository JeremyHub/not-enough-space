use spacetimedb::{table, reducer, Table, ReducerContext, Identity, TimeDuration, ScheduleAt, SpacetimeType};
use spacetimedb::rand::Rng;

const WORLD_WIDTH: i32 = 600;
const WORLD_HEIGHT: i32 = 600;

const ACCELERATION: f32 = 2.0;
const BRAKING_FORCE: f32 = 0.9;
const VELOCITY_MULTIPLIER: f32 = 0.1;
const FRICTION: f32 = 0.99;

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
    name: Option<String>,
    online: bool,
    x: f32,
    y: f32,
    dx: f32,
    dy: f32,
    direction: Option<Direction>,
    color: Color,
}

#[reducer]
/// Clients invoke this reducer to set their user names.
pub fn set_name(ctx: &ReducerContext, name: String) -> Result<(), String> {
    let name = validate_name(name)?;
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(User { name: Some(name), ..user });
        Ok(())
    } else {
        Err("Cannot set name for unknown user".to_string())
    }
}

/// Takes a name and checks if it's acceptable as a user's name.
fn validate_name(name: String) -> Result<String, String> {
    if name.is_empty() {
        Err("Names must not be empty".to_string())
    } else {
        Ok(name)
    }
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
// Called when a client connects to a SpacetimeDB database server
pub fn client_connected(ctx: &ReducerContext) {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        // If this is a returning user, i.e. we already have a `User` with this `Identity`,
        // set `online: true`.
        ctx.db.user().identity().update(User { online: true, ..user });
    } else {
        // If this is a new user, create a `User` row for the `Identity`,
        // which is online, but hasn't set a name.
        ctx.db.user().insert(User {
            name: None,
            identity: ctx.sender,
            online: true,
            x: ctx.rng().gen_range(0..=WORLD_WIDTH) as f32,
            y: ctx.rng().gen_range(0..=WORLD_HEIGHT) as f32,
            dx: 0.0,
            dy: 0.0,
            direction: None,
            color: Color{r: ctx.rng().gen_range(0..=255), g: ctx.rng().gen_range(0..=255), b: ctx.rng().gen_range(0..=255)}
        });
    }
}

#[reducer(client_disconnected)]
// Called when a client disconnects from SpacetimeDB database server
pub fn identity_disconnected(ctx: &ReducerContext) {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(User { online: false, ..user });
    } else {
        // This branch should be unreachable,
        // as it doesn't make sense for a client to disconnect without connecting first.
        log::warn!("Disconnect event for unknown user with identity {:?}", ctx.sender);
    }
}

#[table(name = tick_schedule, scheduled(tick))]
pub struct TickSchedule {
    #[primary_key]
    #[auto_inc]
    scheduled_id: u64,
    scheduled_at: ScheduleAt,
}


#[reducer]
pub fn tick(ctx: &ReducerContext, _args: TickSchedule) -> Result<(), String> {
    // Security: Only allow scheduler to call this reducer
    if ctx.sender != ctx.identity() {
        return Err("Reducer `tick` may only be invoked by the scheduler.".into());
    }

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
            
            // Bounce off left/right walls
            if new_x < 0.0 {
                new_x = 0.0;
                new_dx = -new_dx;
            } else if new_x >= WORLD_WIDTH as f32 {
                new_x = (WORLD_WIDTH - 1) as f32;
                new_dx = -new_dx;
            }
    
            // Bounce off top/bottom walls
            if new_y < 0.0 {
                new_y = 0.0;
                new_dy = -new_dy;
            } else if new_y >= WORLD_HEIGHT as f32 {
                new_y = (WORLD_HEIGHT - 1) as f32;
                new_dy = -new_dy;
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
    Ok(())
}

#[reducer(init)]
pub fn init(ctx: &ReducerContext) -> Result<(), String> {
    let tick_interval = TimeDuration::from_micros(60);
    ctx.db.tick_schedule().insert(TickSchedule {
        scheduled_id: 0, // auto_inc
        scheduled_at: tick_interval.into(),
    });
    Ok(())
}