use spacetimedb::{ReducerContext, Table};

use crate::bit::bit as _;
use crate::user::user as _;

use super::user;
use super::helpers;

pub fn users_eat_bits(ctx: &ReducerContext) {
    for user in ctx.db.user().iter() {
        if user.online || super::UPDATE_OFFLINE_PLAYERS {
            let mut bits_to_eat = Vec::new();
            for range in helpers::wrapped_ranges(user.x.round() as i32, (user.size + super::MAX_BIT_SIZE) as i32, super::WORLD_WIDTH) {
                for bit in ctx.db.bit().x().filter(range) {
                    if helpers::toroidal_distance(user.x, user.y, bit.x as f32, bit.y as f32) <= (user.size + bit.size) {
                        bits_to_eat.push(bit);
                    }
                }
            }
            let mut new_health = user.health;
            for bit in bits_to_eat {
                new_health += bit.worth;
                ctx.db.bit().delete(bit);
            }
            ctx.db.user().identity().update(user::User {
                health: new_health,
                size: user::get_user_size(new_health),
                ..user
            });
        }
    }
}
