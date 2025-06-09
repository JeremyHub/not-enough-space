use spacetimedb::rand::seq::SliceRandom;
use spacetimedb::{reducer, ReducerContext, Table};
use spacetimedb::rand::Rng;

use crate::moon::moon as _;
use crate::user::user as _;

use super::user;
use super::moon;
use super::helpers;
use super::user_moon;

#[reducer]
pub fn sacrifice_health_for_moon_reducer(ctx: &ReducerContext) -> Result<(), String> {
    let user = match ctx.db.user().identity().find(ctx.sender) {
        Some(u) => u,
        None => return Err("User not found.".to_string()),
    };

    return sacrifice_health_for_moon(ctx, user);
}

pub fn sacrifice_health_for_moon(ctx: &ReducerContext, user: user::User) -> Result<(), String> {
    let moon_size_per_health = ctx.rng().gen_range(super::MIN_MOON_SIZE_PER_HEALTH..=super::MAX_MOON_SIZE_PER_HEALTH);

    let mut health_to_sacrifice = (user.health*super::PORTION_HEALTH_SACRIFICE).min(super::MAX_HEALTH_SACRIFICE);
    
    if health_to_sacrifice < super::MIN_HEALTH_SACRIFICE {
        return Err(format!("You dont have enough health to sacrifice."));
    }

    if !user_moon::can_get_moon_into_orbit(&user, health_to_sacrifice*super::MAX_MOON_SIZE_PER_HEALTH) { // use max here so user can cheese to get the max every time
        if user_moon::can_get_moon_into_orbit(&user, super::MIN_HEALTH_SACRIFICE*super::MAX_MOON_SIZE_PER_HEALTH) {
            health_to_sacrifice = super::MIN_HEALTH_SACRIFICE
        } else {
            return Err(format!("You already have too many moons."));
        }
    }

    let moon_size = health_to_sacrifice * moon_size_per_health;

    let (moon_color, orbital_velocity) = moon::new_moon_params(ctx, &user.color);

    // Subtract health and update user, and add to total_moon_size_oribiting
    let new_health = user.health - health_to_sacrifice;
    let new_size = user::get_user_size(new_health);
    let new_total_moon_size_oribiting = user.total_moon_size_oribiting + moon_size;
    ctx.db.user().identity().update(user::User {
        health: new_health,
        size: new_size,
        total_moon_size_oribiting: new_total_moon_size_oribiting,
        speed_boost: user.speed_boost + super::SACRIFICE_SPEED_BOOST,
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

#[reducer(client_connected)]
pub fn client_connected(ctx: &ReducerContext) {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(user::User { online: true, ..user });
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
            if (second_val - color_vals[first_idx]).abs() >= super::USER_SECOND_COLOR_ABS_DIFF {
                break;
            }
        }
        color_vals[second_idx] = second_val;

        // Pick third channel, assign random value
        let third_idx = channels[2];
        color_vals[third_idx] = rng.gen_range(50..=205);

        let color = helpers::Color {
            r: color_vals[0],
            g: color_vals[1],
            b: color_vals[2],
        };

        ctx.db.user().insert(user::User {
            identity: ctx.sender,
            online: true,
            x: rng.gen_range(0..=super::WORLD_WIDTH) as f32,
            y: rng.gen_range(0..=super::WORLD_HEIGHT) as f32,
            dx: 0.0,
            dy: 0.0,
            dir_vec_x: 0.0,
            dir_vec_y: 0.0,
            color,
            health: super::USER_STARTING_HEALTH,
            size: user::get_user_size(super::USER_STARTING_HEALTH),
            total_moon_size_oribiting: 0.0,
            is_ai: false,
            speed_boost: 0.0,
        });
    }
}

#[reducer(client_disconnected)]
pub fn identity_disconnected(ctx: &ReducerContext) {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(user::User { online: false, ..user });
    } else {
        log::warn!("Disconnect event for unknown user with identity {:?}", ctx.sender);
    }
}
