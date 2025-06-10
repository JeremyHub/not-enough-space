use spacetimedb::{ReducerContext, Table};

use crate::user::user as _;

use super::user;
use super::helpers;

fn handle_user_user_collision(ctx: &ReducerContext, user1: &user::User, user2: &user::User) {
    let (char1_upd, char2_upd) = match helpers::elastic_collision(user1.x, user1.y, user1.dx, user1.dy, user1.size, user2.x, user2.y, user2.dx, user2.dy, user2.size) {
        Some(value) => value,
        None => return,
    };

    ctx.db.user().identity().update(user::User {
        dx: char1_upd.dx,
        dy: char1_upd.dy,
        x: char1_upd.x,
        y: char1_upd.y,
        ..*user1
    });
    ctx.db.user().identity().update(user::User {
        dx: char2_upd.dx,
        dy: char2_upd.dy,
        x: char2_upd.x,
        y: char2_upd.y,
        ..*user2
    });
}

pub fn check_user_user_collisions(ctx: &ReducerContext) {
    for user1 in ctx.db.user().iter() {
        if user1.online || super::UPDATE_OFFLINE_PLAYERS {
            for range in helpers::wrapped_ranges(user1.x.round() as i32, (user1.size + super::MAX_USER_SIZE) as i32, super::WORLD_WIDTH) {
                for user2 in ctx.db.user().col_index().filter(range) {
                    if (user1.identity != user2.identity) && (user2.online || super::UPDATE_OFFLINE_PLAYERS) && helpers::toroidal_distance(user1.x, user1.y, user2.x, user2.y) <= (user1.size + user2.size) {
                        handle_user_user_collision(ctx, &user1, &user2);
                    }
                }
            }
        }
    }
}
