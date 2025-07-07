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
    let (new_orbit_angle, new_orbital_velocity) = {
        let nudge = if angle_diff < std::f32::consts::PI {
            nudge_amount
        } else {
            -nudge_amount
        };
        let new_angle = moon.orbit_angle + nudge;
        let old_velocity = moon.orbital_velocity.unwrap_or(0.0);
        // Only swap sign if nudge is in the opposite direction of velocity
        let new_velocity = if old_velocity != 0.0 && nudge.signum() != old_velocity.signum() {
            -old_velocity
        } else {
            old_velocity
        };
        (new_angle, Some(new_velocity))
    };
    // Update user and moon with new health, size, orbit angle, and orbital velocity
    ctx.db.user().identity().update(user::User {
        health: new_health,
        size: new_size,
        color: user.color,
        username: user.username.clone(),
        ..*user
    });
    ctx.db.moon().moon_id().update(moon::Moon {
        orbit_angle: new_orbit_angle,
        orbital_velocity: new_orbital_velocity,
        ..moon
    });
    // update the owning user's damage or kills
    if let Some(owner_identity) = moon.orbiting {
        if let Some(owner) = ctx.db.user().identity().find(owner_identity) {
            ctx.db.user().identity().update(user::User {
                damage: owner.damage + moon.size,
                kills: if new_health <= 0.0 { owner.kills + 1 } else { owner.kills },
                ..owner
            });
        }
    }
    // spawn a bit at the collision point, going twards the user who owns the moon that did the hit, owned by the owner of the moon
    if let Some(owner_identity) = moon.orbiting {
        if let Some(owner) = ctx.db.user().identity().find(owner_identity) {
            // dont normalize so that the bit is launched with a velocity proportional to the distance from the moon to the user
            let (dx, dy) = helpers::toroidal_vector(owner.x, owner.y, moon.x, moon.y);
            ctx.db.bit().insert(bit::Bit {
                bit_id: 0,
                col_index: moon.x.round() as i32,
                x: moon.x,
                y: moon.y,
                dx: dx * super::BIT_LAUNCH_VELOCITY,
                dy: dy * super::BIT_LAUNCH_VELOCITY,
                color: user.color,
                size: moon.size,
                worth: moon.size,
                owned_by: Some(owner_identity),
                moving: true,
            });
        }
    }
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
    moon.size
}

pub fn check_moon_user_collisions(ctx: &ReducerContext) {

    // user : non-oribiting-moon collisions
    for user in ctx.db.user().iter() {
        if user.online || super::UPDATE_OFFLINE_PLAYERS {
            let mut new_user_moon_size = user.total_moon_size_oribiting;
            for range in helpers::wrapped_ranges(user.x.round() as i32, (user.size + super::MAX_FREE_MOON_SIZE) as i32, super::WORLD_WIDTH) {
                for moon in ctx.db.moon().col_index().filter(range) {
                    if moon.orbiting.is_none() && can_get_moon_into_orbit(&user, moon.size) && helpers::toroidal_distance(user.x, user.y, moon.x, moon.y) <= (user.size + moon.size) {
                        new_user_moon_size += handle_user_free_moon_collision(ctx, &user, moon);
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
        for range in helpers::wrapped_ranges(user.x.round() as i32, (user.size + super::MAX_FREE_MOON_SIZE) as i32, super::WORLD_WIDTH) {
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
    if user.size < user.total_moon_size_oribiting + moon_size {
        return false;
    }
    true
}
