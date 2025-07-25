use spacetimedb::rand::Rng;
use spacetimedb::{rand, table, Identity, ReducerContext, SpacetimeType, Table};

use crate::user::user as _;

use super::helpers;
use super::user;

#[derive(SpacetimeType, Clone, Debug, PartialEq)]
pub enum OrbitState {
    Stationary,
    Moving,
}

#[table(name = moon, public)]
#[derive(Clone)]
pub struct Moon {
    #[primary_key]
    #[auto_inc]
    pub moon_id: i32,
    #[index(btree)]
    pub col_index: i32,
    pub x: f32,
    pub y: f32,
    pub dx: f32,
    pub dy: f32,
    pub dir_vec_x: f32,
    pub dir_vec_y: f32,
    pub color: helpers::Color,
    pub health: f32,
    pub size: f32,
    pub orbiting: Option<Identity>,
    pub orbit_angle: f32,
    pub orbit_state: Option<OrbitState>,
    pub orbit_radius: f32,
    pub target_color: Option<helpers::Color>,
    pub orbital_velocity: Option<f32>,
    #[index(btree)]
    pub is_orbiting: bool,
}

pub fn spawn_moons(ctx: &ReducerContext) {
    let num_moons =
        super::NUM_FREE_MOONS - ctx.db.moon().is_orbiting().filter(false).count() as u64;
    for _ in 0..num_moons {
        let x = ctx.rng().gen_range(0..=super::WORLD_WIDTH) as f32;
        let y = ctx.rng().gen_range(0..=super::WORLD_HEIGHT) as f32;
        let size = ctx
            .rng()
            .gen_range(super::MIN_FREE_MOON_SIZE..=super::MAX_FREE_MOON_SIZE);
        ctx.db.moon().insert(Moon {
            moon_id: 0,
            col_index: x.round() as i32,
            x,
            y,
            dx: 0.0,
            dy: 0.0,
            dir_vec_x: ((ctx.rng().gen_range(0..=100) as f32 / 100.0) * 2.0) - super::MOON_DRIFT,
            dir_vec_y: ((ctx.rng().gen_range(0..=100) as f32 / 100.0) * 2.0) - super::MOON_DRIFT,
            color: super::STARTING_MOON_COLOR,
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

pub fn update_moons(ctx: &ReducerContext) {
    update_free_moons_directions(ctx);
    update_oribiting_moons(ctx);

    for moon in ctx.db.moon().iter() {
        if moon.orbiting.is_none() {
            move_free_moons(ctx, moon);
        } else {
            animate_moon_color(ctx, moon);
        }
    }
}

fn move_free_moons(ctx: &ReducerContext, moon: Moon) {
    let acceleration = super::MOON_ACCELERATION;
    let upd = helpers::move_character(
        moon.x,
        moon.y,
        moon.dx,
        moon.dy,
        moon.dir_vec_x,
        moon.dir_vec_y,
        acceleration,
    );
    ctx.db.moon().moon_id().update(Moon {
        col_index: upd.x.round() as i32,
        x: upd.x,
        y: upd.y,
        dx: upd.dx,
        dy: upd.dy,
        is_orbiting: false,
        ..moon
    });
}

pub fn new_moon_params(ctx: &ReducerContext, color: &helpers::Color) -> (helpers::Color, f32) {
    let mut rng = ctx.rng();
    let clamp = |v: i32| v.clamp(0, 255);
    let offset = rng.gen_range(-super::MOON_COLOR_DIFF..=super::MOON_COLOR_DIFF);
    let target_color = helpers::Color {
        r: clamp(color.r + offset),
        g: clamp(color.g + offset),
        b: clamp(color.b + offset),
    };
    // Assign random orbital velocity between -1.0 and -0.5, or 0.5 and 1.0
    let orbital_velocity = if rng.gen_bool(0.5) {
        rng.gen_range(-1.0..=-0.5)
    } else {
        rng.gen_range(0.5..=1.0)
    };
    (target_color, orbital_velocity)
}

fn update_oribiting_moons(ctx: &ReducerContext) {
    for moon in ctx.db.moon().iter() {
        if let Some(user_id) = moon.orbiting {
            let user = ctx.db.user().identity().find(user_id);
            if let Some(user) = user {
                // Determine if user is moving
                let user_speed = (user.dx.powi(2) + user.dy.powi(2)).sqrt();
                let moving = (user_speed > super::USER_SPEED_ORBIT_THRESHOLD)
                    || (user.dir_vec_x != 0.0 || user.dir_vec_y != 0.0);
                let orbit_state: OrbitState;
                let mut orbit_radius: f32 = user.size + moon.size;
                let orbit_angular_vel: f32;
                let orbit_radius_moon_size_factor = 1.0
                    - (moon.size - super::MIN_POSSIBLE_MOON_SIZE)
                        / (super::MAX_POSSIBLE_MOON_SIZE - super::MIN_POSSIBLE_MOON_SIZE);
                if moving {
                    orbit_state = OrbitState::Moving;
                    orbit_radius += super::ADDL_ORBIT_RADIUS_FAR_PER_USER_SIZE
                        * orbit_radius_moon_size_factor
                        * user.size;
                    orbit_angular_vel = super::ORBIT_ANGULAR_VEL_RADIUS_FACTOR_FAR * moon.size;
                } else {
                    orbit_state = OrbitState::Stationary;
                    orbit_radius += super::ADDL_ORBIT_RADIUS_CLOSE_PER_USER_SIZE
                        * orbit_radius_moon_size_factor
                        * user.size;
                    orbit_angular_vel = super::ORBIT_ANGULAR_VEL_RADIUS_FACTOR_CLOSE * moon.size;
                };

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
                let (dir_vec_x, dir_vec_y) = helpers::toroidal_vector(new_x, new_y, moon.x, moon.y);
                let dir_length = (dir_vec_x.powi(2) + dir_vec_y.powi(2)).sqrt();

                // scale velocity increment by distance (clamped to avoid zero)
                let distance_scale = dir_length.max(1.0); // minimum 1.0 to avoid division by zero
                let acceleration = if moving {
                    (super::ORBIT_MOVING_ACCELERATION_USER_SIZE_FACTOR * user.size)
                        + super::ORBIT_MOVING_ACCELERATION_ADD
                } else {
                    (super::ORBIT_STATIONARY_ACCELERATION_USER_SIZE_FACTOR * user.size)
                        + super::ORBIT_STATIONARY_ACCELERATION_ADD
                };
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
                let (updated_x, updated_y) =
                    helpers::wrap_coords(moon.x + delta_vx, moon.y + delta_vy);
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

fn update_free_moons_directions(ctx: &ReducerContext) {
    let mut free_moons: Vec<_> = ctx
        .db
        .moon()
        .iter()
        .filter(|b| b.orbiting.is_none())
        .collect();
    use rand::seq::SliceRandom;
    free_moons.as_mut_slice().shuffle(&mut ctx.rng());

    let num_to_update = ((free_moons.len() as f32)
        * super::PORTION_FREE_MOONS_DIRECTION_UPDATED_PER_TICK)
        .ceil() as usize;
    for moon in free_moons.into_iter().take(num_to_update) {
        ctx.db.moon().moon_id().update(Moon {
            dir_vec_x: ((ctx.rng().gen_range(0..=100) as f32 / 100.0) * 2.0) - super::MOON_DRIFT,
            dir_vec_y: ((ctx.rng().gen_range(0..=100) as f32 / 100.0) * 2.0) - super::MOON_DRIFT,
            ..moon
        });
    }
}

pub fn delete_moon(ctx: &ReducerContext, moon: Moon) {
    // Subtract from user's moon total if orbiting
    if let Some(user_id) = moon.orbiting {
        if let Some(user) = ctx.db.user().identity().find(user_id) {
            let new_total = (user.total_moon_size_orbiting - moon.size).max(0.0);
            ctx.db.user().identity().update(user::User {
                total_moon_size_orbiting: new_total,
                ..user
            });
        }
    }
    ctx.db.moon().delete(moon);
}

fn animate_moon_color(ctx: &ReducerContext, moon: Moon) {
    if let Some(target_color) = moon.target_color.as_ref() {
        if moon.color != *target_color {
            let mut new_r = moon.color.r;
            let mut new_g = moon.color.g;
            let mut new_b = moon.color.b;
            if (target_color.r - moon.color.r).abs() > 0 {
                new_r +=
                    (target_color.r - moon.color.r).signum() * super::MOON_COLOR_ANIMATION_SPEED;
            }
            if (target_color.g - moon.color.g).abs() > 0 {
                new_g +=
                    (target_color.g - moon.color.g).signum() * super::MOON_COLOR_ANIMATION_SPEED;
            }
            if (target_color.b - moon.color.b).abs() > 0 {
                new_b +=
                    (target_color.b - moon.color.b).signum() * super::MOON_COLOR_ANIMATION_SPEED;
            }
            let new_color = helpers::Color {
                r: new_r.clamp(0, 255),
                g: new_g.clamp(0, 255),
                b: new_b.clamp(0, 255),
            };
            ctx.db.moon().moon_id().update(Moon {
                color: new_color,
                ..moon
            });
        }
    }
}
