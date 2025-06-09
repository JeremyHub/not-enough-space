use spacetimedb::{ReducerContext, Table};
use spacetimedb::rand::Rng;

use crate::bit::bit as _;
use crate::moon::moon as _;
use crate::user::user as _;

use super::user;
use super::moon;
use super::helpers;
use super::bit;

pub fn handle_user_and_oribiting_moon_collision(ctx: &ReducerContext, user: &user::User, moon: moon::Moon) {
    let new_health = user.health - moon.size;
    let new_size = user::get_user_size(new_health);

    // Calculate angle from moon to user
    let dx = user.x - moon.x;
    let dy = user.y - moon.y;
    let angle_to_user = dy.atan2(dx);

    // Nudge the orbit angle away from the user
    let nudge_amount = std::f32::consts::PI / 10.0;
    let angle_diff = (moon.orbit_angle - angle_to_user).rem_euclid(2.0 * std::f32::consts::PI);

    // If the moon is "ahead" of the user in its orbit, nudge forward, else backward
    let new_orbit_angle = if angle_diff < std::f32::consts::PI {
        moon.orbit_angle + nudge_amount
    } else {
        moon.orbit_angle - nudge_amount
    };

    ctx.db.user().identity().update(user::User {
        health: new_health,
        size: new_size,
        color: user.color.clone(),
        ..*user
    });
    ctx.db.moon().moon_id().update(moon::Moon {
        orbit_angle: new_orbit_angle,
        orbital_velocity: Some(-moon.orbital_velocity.unwrap_or(0.0)),
        ..moon
    });
    // TODO bits fly towards player whose moon did the hit
}

pub fn handle_user_free_moon_collision(ctx: &ReducerContext, user: &user::User, moon: moon::Moon) -> f32 {
    // Pick a target color based on the user's color
    let (target_color, orbital_velocity) = moon::new_moon_params(ctx, &user.color);
    ctx.db.moon().moon_id().update(moon::Moon {
        orbiting: Some(user.identity),
        orbit_angle: ctx.rng().gen_range(0.0..(2.0 * std::f32::consts::PI)),
        target_color: Some(target_color),
        orbital_velocity: Some(orbital_velocity),
        is_orbiting: true,
        ..moon
    });
    return moon.size;
}

pub fn check_moon_user_collisions(ctx: &ReducerContext) {

    // user : non-oribiting-moon collisions
    for user in ctx.db.user().iter() {
        if user.online || super::UPDATE_OFFLINE_PLAYERS {
            let mut new_user_moon_size = user.total_moon_size_oribiting;
            for range in helpers::wrapped_ranges(user.x.round() as i32, (user.size + super::MAX_FREE_MOON_SIZE as f32) as i32, super::WORLD_WIDTH) {
                for moon in ctx.db.moon().col_index().filter(range) {
                    if moon.orbiting.is_none() {
                        if can_get_moon_into_orbit(&user, moon.size) {
                            if helpers::toroidal_distance(user.x, user.y, moon.x, moon.y) <= (user.size + moon.size) {
                                new_user_moon_size += handle_user_free_moon_collision(ctx, &user, moon);
                            }
                        }
                    }
                }
            }
            if user.total_moon_size_oribiting != new_user_moon_size {
                // After handling all moons for this user, update their total_moon_size_oribiting if needed
                ctx.db.user().identity().update(user::User {
                    total_moon_size_oribiting: new_user_moon_size,
                    ..user
                });
            }
        }
    }

    // user : oribiting-moon collision
    for user in ctx.db.user().iter() {
        for range in helpers::wrapped_ranges(user.x.round() as i32, (user.size + super::MAX_FREE_MOON_SIZE as f32) as i32, super::WORLD_WIDTH) {
            for moon in ctx.db.moon().col_index().filter(range) {
                if !moon.is_orbiting || moon.orbiting == Some(user.identity) {
                    continue;
                }
                if helpers::toroidal_distance(moon.x, moon.y, user.x, user.y) <= (moon.size + user.size) {
                    handle_user_and_oribiting_moon_collision(ctx, &user, moon);
                }
            }
        }
        if user.health <= 0.0 {
            user::handle_user_death(ctx, user);
        }
    }
}

pub fn can_get_moon_into_orbit(user: &user::User, moon_size: f32) -> bool {
    // TODO consider moving back to size not health if its too laggy
    if user.health < user.total_moon_size_oribiting + moon_size {
        return false;
    }
    return true;
}
