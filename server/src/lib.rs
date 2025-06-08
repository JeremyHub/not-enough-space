use std::collections::HashMap;
use std::collections::HashSet;

use spacetimedb::rand::seq::SliceRandom;
use spacetimedb::{rand, reducer, table, Identity, ReducerContext, ScheduleAt, SpacetimeType, Table, TimeDuration};
use spacetimedb::rand::Rng;

// world
const WORLD_WIDTH: i32 = 10000;
const WORLD_HEIGHT: i32 = 10000;
const TICK_TIME: i64 = 20000;

// debug
const UPDATE_OFFLINE_PLAYERS: bool = true;

// acceleration
const USER_ACCELERATION: f32 = 2.0;
const VELOCITY_MULTIPLIER: f32 = 0.1;
const FRICTION: f32 = 0.9;

// moon spawning
const MOON_COLOR_DIFF: i32 = 50;
const MOON_COLOR_ANIMATION_SPEED: i32 = 1;
const USER_SECOND_COLOR_ABS_DIFF: i32 = 50;
const STARTING_MOON_COLOR: Color = Color { r: 255, g: 255, b: 255 };

// bits
const MAX_AREA_PER_BIT: u64 = 10000;
const MAX_BITS: u64 = (WORLD_HEIGHT as u64 *WORLD_WIDTH as u64)/MAX_AREA_PER_BIT;
const MIN_BIT_WORTH: f32 = 0.5;
const MAX_BIT_WORTH: f32 = 2.5;
const MAX_BIT_SIZE: f32 = MAX_BIT_WORTH;

// non-orbiting moon
const STARTING_MOONS: u64 = 200;
const MAX_MOON_SIZE: f32 = 5.0;
const MIN_MOON_SIZE: f32 = 3.0;
const MOON_DRIFT: f32 = 0.5;
const MOON_ACCELERATION: f32 = 1.5;
const PORTION_NON_ORBITING_MOONS_DIRECTION_UPDATED_PER_TICK: f64 = 0.005;

// moon oribit
const ORBIT_RADIUS_USER_SIZE_FACTOR_CLOSE: f32 = 0.2;
const ORBIT_RADIUS_CONST_CLOSE: f32 = 5.0;
const ORBIT_RADIUS_USER_SIZE_FACTOR_FAR: f32 = -3.2;
const ORBIT_RADIUS_CONST_FAR: f32 = 30.0;
const ADDITIONAL_ORBIT_RADIUS_MOON_SIZE_FACTOR_FAR: f32 = 21.0;
const ADDITIONAL_ORBIT_RADIUS_MOON_SIZE_FACTOR_CLOSE: f32 = 5.0;
const ORBIT_ANGULAR_VEL_RADIUS_FACTOR_CLOSE: f32 = 0.006;
const ORBIT_ANGULAR_VEL_RADIUS_FACTOR_FAR: f32 = 0.004;
const USER_SPEED_ORBIT_THRESHOLD: f32 = 5.0;
const ORBIT_MOVING_ACCELERATION_USER_SIZE_FACTOR: f32 = 0.5;
const ORBIT_MOVING_ACCELERATION_CONST: f32 = 5.0;
const ORBIT_STATIONARY_ACCELERATION_USER_SIZE_FACTOR: f32 = 0.2;
const ORBIT_STATIONARY_ACCELERATION_CONST: f32 = 5.0;

// moon scarifice
const MIN_HEALTH_TO_SACRIFICE: f32 = 80.0;
const MAX_MOON_SIZE_PER_HEALTH: f32 = 1.0;
const MIN_MOON_SIZE_PER_HEALTH: f32 = 0.3;
const PORTION_HEALTH_SACRIFICE: f32 = 1.0/40.0;


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

#[derive(SpacetimeType, Clone, Debug, PartialEq)]
pub enum OrbitState {
    Stationary,
    Moving,
}

#[table(name = moon, public)]
pub struct Moon {
    #[primary_key]
    #[auto_inc]
    moon_id: u64,
    #[index(btree)]
    col_index: i32,
    x: f32,
    y: f32,
    dx: f32,
    dy: f32,
    dir_vec_x: f32,
    dir_vec_y: f32,
    color: Color,
    health: f32,
    size: f32,
    orbiting: Option<Identity>,
    orbit_angle: f32,
    orbit_state: Option<OrbitState>,
    orbit_radius: f32,
    target_color: Option<Color>,
    orbital_velocity: Option<f32>,
    #[index(btree)]
    is_orbiting: bool,
}

pub fn get_user_size(health: f32) -> f32 {
    return 100.0 * (0.0025 * health).atan() + 5.0;
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
        // Custom color generation logic
        let mut rng = ctx.rng();
        let mut channels = [0, 1, 2];
        channels.shuffle(&mut rng);

        let mut color_vals = [0i32; 3];

        // Pick first channel and assign random value
        let first_idx = channels[0];
        color_vals[first_idx] = rng.gen_range(50..=205);

        // Pick second channel, value must not be within const
        let second_idx = channels[1];
        let mut second_val;
        loop {
            second_val = rng.gen_range(50..=205);
            if (second_val - color_vals[first_idx]).abs() >= USER_SECOND_COLOR_ABS_DIFF {
                break;
            }
        }
        color_vals[second_idx] = second_val;

        // Pick third channel, assign random value
        let third_idx = channels[2];
        color_vals[third_idx] = rng.gen_range(50..=205);

        let color = Color {
            r: color_vals[0],
            g: color_vals[1],
            b: color_vals[2],
        };

        ctx.db.user().insert(User {
            identity: ctx.sender,
            online: true,
            x: rng.gen_range(0..=WORLD_WIDTH) as f32,
            y: rng.gen_range(0..=WORLD_HEIGHT) as f32,
            dx: 0.0,
            dy: 0.0,
            dir_vec_x: 0.0,
            dir_vec_y: 0.0,
            color,
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
        let x = ctx.rng().gen_range(0..=WORLD_WIDTH) as f32;
        let y = ctx.rng().gen_range(0..=WORLD_HEIGHT) as f32;
        let size = ctx.rng().gen_range(MIN_MOON_SIZE..=MAX_MOON_SIZE);
        ctx.db.moon().insert(Moon {
            moon_id: 0,
            col_index: x.round() as i32,
            x,
            y,
            dx: 0.0,
            dy: 0.0,
            dir_vec_x: ((ctx.rng().gen_range(0..=100) as f32 / 100.0) * 2.0) - MOON_DRIFT,
            dir_vec_y: ((ctx.rng().gen_range(0..=100) as f32 / 100.0) * 2.0) - MOON_DRIFT,
            color: STARTING_MOON_COLOR,
            health: size,
            size,
            orbiting: None,
            orbit_angle: 0.0,
            orbit_state: None,
            orbit_radius: 0.0,
            target_color: None,
            orbital_velocity: None,
            is_orbiting: false,
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
                // Determine if user is moving
                let user_speed = (user.dx.powi(2) + user.dy.powi(2)).sqrt();
                let moving = user_speed > USER_SPEED_ORBIT_THRESHOLD;
                let orbit_state: OrbitState;
                let mut orbit_radius: f32;
                let orbit_angular_vel: f32;
                if moving {
                    orbit_state = OrbitState::Moving;
                    orbit_radius = (ORBIT_RADIUS_USER_SIZE_FACTOR_FAR * user.size) + ORBIT_RADIUS_CONST_FAR + (ADDITIONAL_ORBIT_RADIUS_MOON_SIZE_FACTOR_FAR * (1.0/moon.size) * user.size);
                    orbit_angular_vel = ORBIT_ANGULAR_VEL_RADIUS_FACTOR_FAR * moon.size;
                } else {
                    orbit_state = OrbitState::Stationary;
                    orbit_radius = (ORBIT_RADIUS_USER_SIZE_FACTOR_CLOSE * user.size) + ORBIT_RADIUS_CONST_CLOSE + (ADDITIONAL_ORBIT_RADIUS_MOON_SIZE_FACTOR_CLOSE * (1.0/moon.size) * user.size);
                    orbit_angular_vel = ORBIT_ANGULAR_VEL_RADIUS_FACTOR_CLOSE * moon.size;
                };
                orbit_radius = orbit_radius.max(user.size + moon.size);

                // Advance orbit angle
                let mut orbit_angle = moon.orbit_angle;
                // Use orbital_velocity as multiplier
                let orbital_velocity = moon.orbital_velocity.unwrap_or(1.0);
                orbit_angle += orbital_velocity * orbit_angular_vel;
                if orbit_angle > std::f32::consts::PI * 2.0 {
                    orbit_angle -= std::f32::consts::PI * 2.0;
                }
                if orbit_angle < 0.0 {
                    orbit_angle += std::f32::consts::PI * 2.0;
                }

                // Compute desired moon position relative to user
                let user_x = user.x;
                let user_y = user.y;
                let new_x = user_x + orbit_radius * orbit_angle.cos();
                let new_y = user_y + orbit_radius * orbit_angle.sin();

                // compute minimal toroidal vector from moon's current position to desired position
                let mut dir_vec_x = new_x - moon.x;
                let mut dir_vec_y = new_y - moon.y;

                // Proper toroidal wrapping for direction vector
                if dir_vec_x.abs() > WORLD_WIDTH as f32 / 2.0 {
                    if dir_vec_x > 0.0 {
                        dir_vec_x -= WORLD_WIDTH as f32;
                    } else {
                        dir_vec_x += WORLD_WIDTH as f32;
                    }
                }
                if dir_vec_y.abs() > WORLD_HEIGHT as f32 / 2.0 {
                    if dir_vec_y > 0.0 {
                        dir_vec_y -= WORLD_HEIGHT as f32;
                    } else {
                        dir_vec_y += WORLD_HEIGHT as f32;
                    }
                }
                let dir_length = (dir_vec_x.powi(2) + dir_vec_y.powi(2)).sqrt();

                // scale velocity increment by distance (clamped to avoid zero)
                let distance_scale = dir_length.max(1.0); // minimum 1.0 to avoid division by zero
                let acceleration = if moving { (ORBIT_MOVING_ACCELERATION_USER_SIZE_FACTOR * user.size) + ORBIT_MOVING_ACCELERATION_CONST } else { (ORBIT_STATIONARY_ACCELERATION_USER_SIZE_FACTOR * user.size) + ORBIT_STATIONARY_ACCELERATION_CONST };
                let scale = distance_scale / orbit_radius; // normalized, so it slows as it gets closer

                // Calculate the velocity increment, but clamp so we don't overshoot
                let mut delta_vx = (dir_vec_x / dir_length) * acceleration * scale;
                let mut delta_vy = (dir_vec_y / dir_length) * acceleration * scale;

                // Clamp the increment
                let max_step = dir_length;
                let step_length = (delta_vx.powi(2) + delta_vy.powi(2)).sqrt();
                if step_length > max_step {
                    let clamp_factor = max_step / step_length;
                    delta_vx *= clamp_factor;
                    delta_vy *= clamp_factor;
                }

                // Update moon with new position and velocity
                let (updated_x, updated_y) = wrap_coords(moon.x + delta_vx, moon.y + delta_vy);
                ctx.db.moon().moon_id().update(Moon {
                    col_index: updated_x.round() as i32,
                    x: updated_x,
                    y: updated_y,
                    dx: delta_vx,
                    dy: delta_vy,
                    orbit_angle,
                    orbit_state: Some(orbit_state),
                    orbit_radius,
                    is_orbiting: true,
                    ..moon
                });
                continue;
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
    fn x(&self) -> f32 { self.x }
    fn y(&self) -> f32 { self.y }
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

fn move_character<C: Character>(character: &C, acceleration: f32) -> CharacterUpdate {
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

    (new_x, new_y) = wrap_coords(after_move_x, after_move_y);

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

fn rearrange_orbit_angles(ctx: &ReducerContext, user_id: Identity) {
    // Collect all moons orbiting this user
    let mut orbiting_moons: Vec<_> = ctx.db.moon().iter()
        .filter(|m| m.orbiting == Some(user_id))
        .collect();
    let n = orbiting_moons.len();
    if n == 0 { return; }
    // Sort by current angle to minimize angle change
    orbiting_moons.sort_by(|a, b| a.orbit_angle.partial_cmp(&b.orbit_angle).unwrap_or(std::cmp::Ordering::Equal));
    // Assign equally spaced angles, preserving order
    for (i, moon) in orbiting_moons.into_iter().enumerate() {
        let angle = (i as f32) * (2.0 * std::f32::consts::PI / n as f32);
        ctx.db.moon().moon_id().update(Moon {
            orbit_angle: angle,
            ..moon
        });
    }
}

fn update_users(ctx: &ReducerContext) {
    // move users
    for user in ctx.db.user().iter() {
        if user.online || UPDATE_OFFLINE_PLAYERS {
            let upd = move_character(&user, USER_ACCELERATION);
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
    let mut users_with_new_moon: Vec<Identity> = Vec::new();
    for user in ctx.db.user().iter() {
        if user.online || UPDATE_OFFLINE_PLAYERS {
            if user.total_moon_size_oribiting < user.size {
                for range in wrapped_ranges(user.x.round() as i32, (user.size + MAX_MOON_SIZE as f32) as i32, WORLD_WIDTH) {
                    for moon in ctx.db.moon().col_index().filter(range) {
                        if moon.orbiting.is_none() {
                            if toroidal_distance(user.x, user.y, moon.x, moon.y) <= (user.size + moon.size) {
                                // Pick a target color based on the user's color
                                let (target_color, orbital_velocity) = new_moon_params(ctx, user.color.clone());
                                ctx.db.moon().moon_id().update(Moon {
                                    orbiting: Some(user.identity),
                                    orbit_angle: ctx.rng().gen_range(0.0..(2.0 * std::f32::consts::PI)),
                                    target_color: Some(target_color),
                                    orbital_velocity: Some(orbital_velocity),
                                    is_orbiting: true,
                                    ..moon
                                });
                                *moon_size_map.entry(user.identity).or_insert(0.0) += moon.size;
                                users_with_new_moon.push(user.identity);
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
    // Rearrange orbit angles for users who got a new moon
    let mut seen = HashSet::new();
    for user_id in users_with_new_moon {
        if seen.insert(user_id) {
            rearrange_orbit_angles(ctx, user_id);
        }
    }
}

fn new_moon_params(ctx: &ReducerContext, color: Color) -> (Color, f32) {
    let mut rng = ctx.rng();
    let clamp = |v: i32| v.max(0).min(255);
    let offset = rng.gen_range(-MOON_COLOR_DIFF..=MOON_COLOR_DIFF);
    let target_color = Color {
        r: clamp(color.r + offset),
        g: clamp(color.g + offset),
        b: clamp(color.b + offset),
    };
    // Assign random orbital velocity between -1.0 and 1.0 (excluding velocities where abs < 0.5)
    let orbital_velocity =  if rng.gen_bool(0.5) {
        rng.gen_range(-1.0..=-0.5)
    } else {
        rng.gen_range(0.5..=1.0)
    };
    (target_color, orbital_velocity)
}

fn update_moons(ctx: &ReducerContext) {
    update_moon_directions(ctx);
    for moon in ctx.db.moon().iter() {
        // Only move non-orbiting moons
        if moon.orbiting.is_none() {
            let acceleration = MOON_ACCELERATION;
            let upd = move_character(&moon, acceleration);
            ctx.db.moon().moon_id().update(Moon {
                col_index: upd.x.round() as i32,
                x: upd.x,
                y: upd.y,
                dx: upd.dx,
                dy: upd.dy,
                is_orbiting: false,
                ..moon
            });
        } else {
            if let Some(target_color) = moon.target_color.as_ref() {
                if moon.color != *target_color {
                    let mut new_r = moon.color.r;
                    let mut new_g = moon.color.g;
                    let mut new_b = moon.color.b;
                    if (target_color.r - moon.color.r).abs() > 0 {
                        new_r += (target_color.r - moon.color.r).signum() * MOON_COLOR_ANIMATION_SPEED;
                    }
                    if (target_color.g - moon.color.g).abs() > 0 {
                        new_g += (target_color.g - moon.color.g).signum() * MOON_COLOR_ANIMATION_SPEED;
                    }
                    if (target_color.b - moon.color.b).abs() > 0 {
                        new_b += (target_color.b - moon.color.b).signum() * MOON_COLOR_ANIMATION_SPEED;
                    }
                    let new_color = Color {
                        r: new_r.max(0).min(255),
                        g: new_g.max(0).min(255),
                        b: new_b.max(0).min(255),
                    };
                    ctx.db.moon().moon_id().update(Moon {
                        color: new_color,
                        ..moon
                    });
                }
            }
        }
    }

    let mut to_destroy: Vec<u64> = Vec::new();
    let mut explosions: Vec<(f32, f32, f32, Color)> = Vec::new(); // (x, y, worth, color)

    // Collect all orbiting moons with is_orbiting == true
    let orbiting_moons: Vec<_> = ctx.db.moon().is_orbiting().filter(true).collect();

    // For each orbiting moon, check for collision with other orbiting moons in nearby col_index ranges
    for moon in &orbiting_moons {
        if moon.orbiting.is_none() {
            continue;
        }
        // Only check each pair once
        if to_destroy.contains(&moon.moon_id) {
            continue;
        }
        let search_radius = (moon.size + MAX_MOON_SIZE) as i32;
        for range in wrapped_ranges(moon.col_index, search_radius, WORLD_WIDTH) {
            for other in ctx.db.moon().col_index().filter(range) {
                if other.moon_id == moon.moon_id {
                    continue;
                }
                if !other.is_orbiting || other.orbiting.is_none() || to_destroy.contains(&other.moon_id) {
                    continue;
                }
                // Only check if orbiting different users
                if moon.orbiting == other.orbiting {
                    continue;
                }
                // Check collision
                if toroidal_distance(moon.x, moon.y, other.x, other.y) <= (moon.size + other.size) {
                    // Only destroy the smaller moon, reduce the size of the larger moon by the size of the smaller
                    if moon.size > other.size {
                        // Moon survives, other is destroyed
                        to_destroy.push(other.moon_id);
                        explosions.push((other.x, other.y, other.size, other.color.clone()));
                        // Reduce moon's size
                        if let Some(moon_obj) = ctx.db.moon().moon_id().find(moon.moon_id) {
                            let new_size = moon.size - other.size;
                            let new_health = moon.health - other.size;
                            ctx.db.moon().moon_id().update(Moon {
                                size: new_size,
                                health: new_health,
                                ..moon_obj
                            });
                        }
                    } else if other.size > moon.size {
                        // Other survives, moon is destroyed
                        to_destroy.push(moon.moon_id);
                        explosions.push((moon.x, moon.y, moon.size, moon.color.clone()));
                        // Reduce other's size
                        if let Some(other_obj) = ctx.db.moon().moon_id().find(other.moon_id) {
                            let new_size = other.size - moon.size;
                            let new_health = other.health - moon.size;
                            ctx.db.moon().moon_id().update(Moon {
                                size: new_size,
                                health: new_health,
                                ..other_obj
                            });
                        }
                    } else {
                        // Equal size, both destroyed
                        to_destroy.push(moon.moon_id);
                        to_destroy.push(other.moon_id);
                        explosions.push((moon.x, moon.y, moon.size, moon.color.clone()));
                        explosions.push((other.x, other.y, other.size, other.color.clone()));
                    }
                    break; // Only destroy once per moon
                }
            }
        }
    }

    // Destroy moons and spawn bits, and subtract from users' moon total
    for moon_id in to_destroy {
        if let Some(moon) = ctx.db.moon().moon_id().find(moon_id) {
            // Subtract from user's moon total if orbiting
            if let Some(user_id) = moon.orbiting {
                if let Some(user) = ctx.db.user().identity().find(user_id) {
                    let new_total = (user.total_moon_size_oribiting - moon.size).max(0.0);
                    ctx.db.user().identity().update(User {
                        total_moon_size_oribiting: new_total,
                        ..user
                    });
                }
            }
            ctx.db.moon().delete(moon);
        }
    }
    for (x, y, worth, color) in explosions {
        // Spawn bits at the moon's position, worth = size, size = worth
        ctx.db.bit().insert(Bit {
            bit_id: 0,
            x: x.round() as i32,
            y: y.round() as i32,
            size: worth,
            worth,
            color,
        });
    }

    // check user :: moon (orbiting other players) collision
    let mut users_to_remove = Vec::new();
    for user in ctx.db.user().iter() {
        for range in wrapped_ranges(user.x.round() as i32, (user.size + MAX_MOON_SIZE as f32) as i32, WORLD_WIDTH) {
            for moon in ctx.db.moon().col_index().filter(range) {
                // Only consider orbiting moons, not orbiting this user
                if !moon.is_orbiting || moon.orbiting == Some(user.identity) {
                    continue;
                }
                if toroidal_distance(moon.x, moon.y, user.x, user.y) <= (moon.size + user.size) {
                    // If moon is larger than user, user dies, else subtract moon.size from user's health
                    let new_health = user.health - moon.size;
                    if new_health < 0.0 {
                        // User dies, remove them
                        users_to_remove.push(user.identity);
                    } else {
                        let new_size = get_user_size(new_health);
                        ctx.db.user().identity().update(User {
                            health: new_health,
                            size: new_size,
                            color: user.color.clone(),
                            ..user
                        });
                    }
                    // Turn moon into a bit at its position
                    ctx.db.bit().insert(Bit {
                        bit_id: 0,
                        x: moon.x.round() as i32,
                        y: moon.y.round() as i32,
                        size: moon.size,
                        worth: moon.size,
                        color: moon.color.clone(),
                    });
                    // Remove the moon and subtract from user's moon total
                    if let Some(orbiting_id) = moon.orbiting {
                        if let Some(orbiting_user) = ctx.db.user().identity().find(orbiting_id) {
                            let new_total = (orbiting_user.total_moon_size_oribiting - moon.size).max(0.0);
                            ctx.db.user().identity().update(User {
                                total_moon_size_oribiting: new_total,
                                ..orbiting_user
                            });
                        }
                    }
                    ctx.db.moon().delete(moon);
                    break; // Only process one collision per user per tick
                }
            }
        }
    }

    // Remove users who died
    for user_id in users_to_remove {
        if let Some(user) = ctx.db.user().identity().find(user_id) {
            // Remove all moons orbiting this user
            for moon in ctx.db.moon().iter() {
                if moon.orbiting == Some(user.identity) {
                    ctx.db.moon().delete(moon);
                }
            }
            // Remove the user
            // TODO figure out what this does to the client who died
            ctx.db.user().delete(user);
        } else {
            log::warn!("Tried to remove user with identity {:?} but they do not exist.", user_id);
        }
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

#[reducer]
pub fn sacrifice_health_for_moon(ctx: &ReducerContext) -> Result<(), String> {
    let moon_size_per_health = ctx.rng().gen_range(MIN_MOON_SIZE_PER_HEALTH..=MAX_MOON_SIZE_PER_HEALTH);
    
    let user = match ctx.db.user().identity().find(ctx.sender) {
        Some(u) => u,
        None => return Err("User not found.".to_string()),
    };

    if user.health < MIN_HEALTH_TO_SACRIFICE {
        return Err(format!("You must have at least {} health.", MIN_HEALTH_TO_SACRIFICE));
    }

    let health_to_sacrifice = user.health/PORTION_HEALTH_SACRIFICE;
    let moon_size = health_to_sacrifice * moon_size_per_health;

    let (moon_color, orbital_velocity) = new_moon_params(ctx, user.color.clone());

    // Subtract health and update user, and add to total_moon_size_oribiting
    let new_health = user.health - health_to_sacrifice;
    let new_size = get_user_size(new_health);
    let new_total_moon_size_oribiting = user.total_moon_size_oribiting + moon_size;
    ctx.db.user().identity().update(User {
        health: new_health,
        size: new_size,
        total_moon_size_oribiting: new_total_moon_size_oribiting,
        ..user
    });

    // Spawn the moon at the user's current position, orbiting the user
    ctx.db.moon().insert(Moon {
        moon_id: 0,
        col_index: user.x.round() as i32,
        x: user.x,
        y: user.y,
        dx: 0.0,
        dy: 0.0,
        dir_vec_x: 0.0,
        dir_vec_y: 0.0,
        color: moon_color.clone(),
        health: moon_size,
        size: moon_size,
        orbiting: Some(user.identity),
        orbit_angle: ctx.rng().gen_range(0.0..(2.0 * std::f32::consts::PI)),
        orbit_state: None,
        orbit_radius: 0.0,
        target_color: Some(moon_color),
        orbital_velocity: Some(orbital_velocity),
        is_orbiting: true,
    });

    rearrange_orbit_angles(ctx, user.identity);

    Ok(())
}
