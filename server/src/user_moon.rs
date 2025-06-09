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
    ctx.db.user().identity().update(user::User {
        health: new_health,
        size: new_size,
        color: user.color.clone(),
        ..*user
    });
    // Turn moon into a bit at its position
    ctx.db.bit().insert(bit::Bit {
        bit_id: 0,
        x: moon.x.round() as i32,
        y: moon.y.round() as i32,
        size: moon.size,
        worth: moon.size*2.0, // hack to make it no net loss
        color: moon.color.clone(),
    });
    // Remove the moon and subtract from user's moon total
    if let Some(orbiting_id) = moon.orbiting {
        if let Some(orbiting_user) = ctx.db.user().identity().find(orbiting_id) {
            let new_total = orbiting_user.total_moon_size_oribiting - moon.size;
            ctx.db.user().identity().update(user::User {
                total_moon_size_oribiting: new_total,
                ..orbiting_user
            });
        }
    }
    ctx.db.moon().delete(moon);
}

pub fn handle_user_non_oribiting_moon_collision(ctx: &ReducerContext, user: &user::User, moon: moon::Moon) -> f32 {
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
            for range in helpers::wrapped_ranges(user.x.round() as i32, (user.size + super::MAX_MOON_SIZE as f32) as i32, super::WORLD_WIDTH) {
                for moon in ctx.db.moon().col_index().filter(range) {
                    if moon.orbiting.is_none() {
                        if can_get_moon_into_orbit(&user, moon.size) {
                            if helpers::toroidal_distance(user.x, user.y, moon.x, moon.y) <= (user.size + moon.size) {
                                new_user_moon_size += handle_user_non_oribiting_moon_collision(ctx, &user, moon);
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
        for range in helpers::wrapped_ranges(user.x.round() as i32, (user.size + super::MAX_MOON_SIZE as f32) as i32, super::WORLD_WIDTH) {
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
