use spacetimedb::rand::Rng;
use spacetimedb::{reducer, ReducerContext, Table};

use crate::moon::moon as _;
use crate::user::user as _;

use super::helpers;
use super::moon;
use super::user;
use super::user_moon;

#[reducer]
pub fn sacrifice_health_for_moon_reducer(ctx: &ReducerContext) -> Result<(), String> {
    let user = match ctx.db.user().identity().find(ctx.sender) {
        Some(u) => u,
        None => return Err("User not found.".to_string()),
    };

    sacrifice_health_for_moon(ctx, user)
}

pub fn sacrifice_health_for_moon(ctx: &ReducerContext, user: user::User) -> Result<(), String> {
    if user.health < super::MAX_HEALTH_SACRIFICE {
        return Err("You don't have enough health to sacrifice for a moon.".to_string());
    }

    if !user_moon::can_get_moon_into_orbit(&user, super::MAX_HEALTH_SACRIFICE) {
        return Err("You already have too many moons.".to_string());
    }

    let moon_size = ctx
        .rng()
        .gen_range(super::MIN_HEALTH_SACRIFICE..=super::MAX_HEALTH_SACRIFICE);

    let (moon_color, orbital_velocity) = moon::new_moon_params(ctx, &user.color);

    // Subtract health and update user, and add to total_moon_size_orbiting
    let new_health = user.health - moon_size;
    let new_size = user::get_user_size(new_health);
    let new_total_moon_size_orbiting = user.total_moon_size_orbiting + moon_size;
    ctx.db.user().identity().update(user::User {
        health: new_health,
        size: new_size,
        total_moon_size_orbiting: new_total_moon_size_orbiting,
        speed_boost: user.speed_boost.max(super::SACRIFICE_SPEED_BOOST),
        ..user
    });

    // Spawn the moon at the user's current position, orbiting the user
    ctx.db.moon().insert(moon::Moon {
        moon_id: 0,
        col_index: user.x.round() as i32,
        x: user.x,
        y: user.y,
        dx: 0.0,
        dy: 0.0,
        dir_vec_x: 0.0,
        dir_vec_y: 0.0,
        color: moon_color,
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

    Ok(())
}

#[reducer]
pub fn set_dir_vec(ctx: &ReducerContext, dir_vec_x: f32, dir_vec_y: f32) -> Result<(), String> {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(user::User {
            dir_vec_x,
            dir_vec_y,
            ..user
        });
        Ok(())
    } else {
        Err("Cannot set dir vec for unknown user".to_string())
    }
}

#[reducer]
pub fn set_user_meta(
    ctx: &ReducerContext,
    username: String,
    color: helpers::Color,
    seed: u64,
) -> Result<(), String> {
    if username.len() < super::MIN_USERNAME_LENGTH {
        log::warn!(
            "User {} tried to connect with a too short username: {}",
            ctx.sender,
            username
        );
        return Err("Username is too short".to_string());
    }

    fn is_color_too_white_or_black(color: &helpers::Color) -> bool {
        let brightness = 0.299 * color.r as f32 + 0.587 * color.g as f32 + 0.114 * color.b as f32;
        !(50.0..=200.0).contains(&brightness)
    }

    if is_color_too_white_or_black(&color) {
        log::warn!(
            "User {username} tried to connect with a color that is too white or black: {color:?}"
        );
        return Err("Invalid color".to_string());
    }

    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(user::User {
            username,
            color,
            seed,
            ..user
        });
        Ok(())
    } else {
        Err("Cannot set user meta for unknown user".to_string())
    }
}

#[reducer(client_connected)]
pub fn client_connected(ctx: &ReducerContext) {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(user::User {
            online: true,
            ..user
        });
    } else {
        let mut rng = ctx.rng();
        let x = rng.gen_range(0..=super::WORLD_WIDTH) as f32;
        ctx.db.user().insert(user::User {
            identity: ctx.sender,
            online: true,
            username: "connecting...".to_string(),
            x,
            col_index: x.round() as i32,
            y: rng.gen_range(0..=super::WORLD_HEIGHT) as f32,
            dx: 0.0,
            dy: 0.0,
            dir_vec_x: 0.0,
            dir_vec_y: 0.0,
            color: helpers::Color { r: 255, g: 0, b: 0 },
            health: super::USER_STARTING_HEALTH,
            size: user::get_user_size(super::USER_STARTING_HEALTH),
            total_moon_size_orbiting: 0.0,
            is_ai: false,
            speed_boost: 0.0,
            kills: 0,
            damage: 0.0,
            seed: rng.gen(),
        });
    }
}

#[reducer(client_disconnected)]
pub fn identity_disconnected(ctx: &ReducerContext) {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(user::User {
            online: false,
            ..user
        });
    } else {
        log::warn!(
            "Disconnect event for unknown user with identity {:?}",
            ctx.sender
        );
    }
}
