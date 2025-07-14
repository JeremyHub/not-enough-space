use spacetimedb::{ReducerContext, Table};

use crate::user::user as _;

use super::helpers;
use super::user;

fn handle_user_user_collision(ctx: &ReducerContext, user1: &user::User, user2: &user::User) {
    let char1 = helpers::Character {
        x: user1.x,
        y: user1.y,
        dx: user1.dx,
        dy: user1.dy,
        size: user1.size,
    };
    let char2 = helpers::Character {
        x: user2.x,
        y: user2.y,
        dx: user2.dx,
        dy: user2.dy,
        size: user2.size,
    };
    let (char1_upd, char2_upd) = match helpers::elastic_collision(&char1, &char2) {
        Some(value) => value,
        None => return,
    };

    ctx.db.user().identity().update(user::User {
        dx: char1_upd.dx,
        dy: char1_upd.dy,
        x: char1_upd.x,
        y: char1_upd.y,
        username: user1.username.clone(),
        ..*user1
    });
    ctx.db.user().identity().update(user::User {
        dx: char2_upd.dx,
        dy: char2_upd.dy,
        x: char2_upd.x,
        y: char2_upd.y,
        username: user2.username.clone(),
        ..*user2
    });
}

pub fn check_user_user_collisions(ctx: &ReducerContext) {
    for user1 in ctx.db.user().iter() {
        if user1.online || super::UPDATE_OFFLINE_PLAYERS {
            for range in helpers::wrapped_ranges(
                user1.x.round() as i32,
                (user1.size + super::MAX_USER_SIZE) as i32,
                super::WORLD_WIDTH,
            ) {
                for user2 in ctx.db.user().col_index().filter(range) {
                    if (user1.identity != user2.identity)
                        && (user2.online || super::UPDATE_OFFLINE_PLAYERS)
                        && helpers::toroidal_distance(user1.x, user1.y, user2.x, user2.y)
                            <= (user1.size + user2.size)
                    {
                        handle_user_user_collision(ctx, &user1, &user2);
                    }
                }
            }
        }
    }
}
