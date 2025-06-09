use spacetimedb::{ReducerContext, Table};

use crate::user::user as _;

use super::user;
use super::helpers;

fn handle_user_user_collision(ctx: &ReducerContext, user1: &user::User, user2: &user::User) {
    // Elastic collision: update velocities if overlapping and not the same user
    if user1.identity == user2.identity {
        return;
    }

    // Vector between centers (toroidal)
    let (dx, dy) = helpers::toroidal_vector(user1.x, user1.y, user2.x, user2.y);
    let dist = (dx * dx + dy * dy).sqrt();
    if dist == 0.0 {
        return; // avoid division by zero
    }

    // Only process if overlapping
    let min_dist = user1.size + user2.size;
    if dist > min_dist {
        return;
    }

    // Mass proportional to size
    let m1 = user1.size;
    let m2 = user2.size;

    // Normal vector
    let nx = dx / dist;
    let ny = dy / dist;

    // Relative velocity
    let dvx = user1.dx - user2.dx;
    let dvy = user1.dy - user2.dy;

    // Velocity along normal
    let rel_vel = dvx * nx + dvy * ny;
    if rel_vel > 0.0 {
        return; // already moving apart
    }

    // 1D elastic collision along normal
    let impulse = (2.0 * rel_vel) / (m1 + m2);

    let new_dx1 = user1.dx - impulse * m2 * nx;
    let new_dy1 = user1.dy - impulse * m2 * ny;
    let new_dx2 = user2.dx + impulse * m1 * nx;
    let new_dy2 = user2.dy + impulse * m1 * ny;

    // Push users apart to avoid sticking
    let overlap = min_dist - dist;
    let push1 = overlap * (m2 / (m1 + m2));
    let push2 = overlap * (m1 / (m1 + m2));
    let (new_x1, new_y1) = helpers::wrap_coords(user1.x + nx * push1, user1.y + ny * push1);
    let (new_x2, new_y2) = helpers::wrap_coords(user2.x - nx * push2, user2.y - ny * push2);

    ctx.db.user().identity().update(user::User {
        dx: new_dx1,
        dy: new_dy1,
        x: new_x1,
        y: new_y1,
        ..*user1
    });
    ctx.db.user().identity().update(user::User {
        dx: new_dx2,
        dy: new_dy2,
        x: new_x2,
        y: new_y2,
        ..*user2
    });
}

pub fn check_user_user_collisions(ctx: &ReducerContext) {
    for user1 in ctx.db.user().iter() {
        if user1.online || super::UPDATE_OFFLINE_PLAYERS {
            for range in helpers::wrapped_ranges(user1.x.round() as i32, (user1.size + super::MAX_USER_SIZE as f32) as i32, super::WORLD_WIDTH) {
                for user2 in ctx.db.user().col_index().filter(range) {
                    if user2.online || super::UPDATE_OFFLINE_PLAYERS {
                        if helpers::toroidal_distance(user1.x, user1.y, user2.x, user2.y) <= (user1.size + user2.size) {
                            handle_user_user_collision(ctx, &user1, &user2);
                        }
                    }
                }
            }
        }
    }
}
