use spacetimedb::{table, Identity, ReducerContext, Table};

use crate::moon::moon as _;

use super::helpers;

#[table(name = user, public)]
#[derive(Clone)]
pub struct User {
    #[primary_key]
    pub identity: Identity,
    pub online: bool,
    pub username: String,
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
    pub total_moon_size_oribiting: f32,
    #[index(btree)]
    pub is_ai: bool,
    pub speed_boost: f32,
    pub kills: u32,
    pub damage: f32,
}

pub fn get_user_size(health: f32) -> f32 {
    (100.0 * (0.0025 * health).atan() + 5.0).clamp(0.0, super::MAX_USER_SIZE)
}

pub fn handle_user_death(ctx: &ReducerContext, user: User) {
    // Remove all moons orbiting this user
    for moon in ctx.db.moon().iter() {
        if moon.orbiting == Some(user.identity) {
            ctx.db.moon().delete(moon);
        }
    }
    ctx.db.user().delete(user);
}

pub fn update_users(ctx: &ReducerContext) {
    // move users
    for user in ctx.db.user().iter() {
        if user.online || super::UPDATE_OFFLINE_PLAYERS {
            let upd = helpers::move_character(
                user.x,
                user.y,
                user.dx,
                user.dy,
                user.dir_vec_x,
                user.dir_vec_y,
                if user.is_ai {super::AI_ACCELERATION} else {super::USER_ACCELERATION} + user.speed_boost,
            );
            ctx.db.user().identity().update(User {
                col_index: upd.x.round() as i32,
                x: upd.x,
                y: upd.y,
                dx: upd.dx,
                dy: upd.dy,
                speed_boost: if user.speed_boost > 0.1 {user.speed_boost * super::SPEED_BOOST_DECAY} else {0.0},
                ..user
            });
        }
    }
}
