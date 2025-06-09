use spacetimedb::{ReducerContext};

use crate::moon::moon as _;

use super::moon;
use super::helpers;
use super::bit;

fn handle_moon_moon_collision(ctx: &ReducerContext, to_destroy: &mut Vec<u64>, explosions: &mut Vec<(f32, f32, f32, helpers::Color)>, moon: &moon::Moon, other: moon::Moon) {
    // Only destroy the smaller moon, reduce the size of the larger moon by the size of the smaller
    if moon.size > other.size {
        // Moon survives, other is destroyed
        to_destroy.push(other.moon_id);
        explosions.push((other.x, other.y, other.size, other.color.clone()));
        // Reduce moon's size
        if let Some(moon_obj) = ctx.db.moon().moon_id().find(moon.moon_id) {
            let new_size = moon.size - other.size;
            let new_health = moon.health - other.size;
            ctx.db.moon().moon_id().update(moon::Moon {
                size: new_size,
                health: new_health,
                ..moon_obj
            });
        }
    } else if other.size > moon.size {
        // Other survives, moon is destroyed
        to_destroy.push(moon.moon_id);
        explosions.push((moon.x, moon.y, moon.size, moon.color.clone()));
        // Reduce other's size
        if let Some(other_obj) = ctx.db.moon().moon_id().find(other.moon_id) {
            let new_size = other.size - moon.size;
            let new_health = other.health - moon.size;
            ctx.db.moon().moon_id().update(moon::Moon {
                size: new_size,
                health: new_health,
                ..other_obj
            });
        }
    } else {
        // Equal size, both destroyed
        to_destroy.push(moon.moon_id);
        to_destroy.push(other.moon_id);
        explosions.push((moon.x, moon.y, moon.size, moon.color.clone()));
        explosions.push((other.x, other.y, other.size, other.color.clone()));
    }
}

pub fn check_moon_moon_collisions(ctx: &ReducerContext) {
    // moon moon collisions
    let mut to_destroy: Vec<u64> = Vec::new();
    let mut explosions: Vec<(f32, f32, f32, helpers::Color)> = Vec::new(); // (x, y, worth, color)
    let orbiting_moons: Vec<_> = ctx.db.moon().is_orbiting().filter(true).collect();
    for moon in &orbiting_moons {
        if moon.orbiting.is_none() {
            continue;
        }
        if to_destroy.contains(&moon.moon_id) {
            continue;
        }
        let search_radius = (moon.size + super::MAX_MOON_SIZE.max(super::MAX_HEALTH_SACRIFICE)) as i32;
        for range in helpers::wrapped_ranges(moon.col_index, search_radius, super::WORLD_WIDTH) {
            for other in ctx.db.moon().col_index().filter(range) {
                if other.moon_id == moon.moon_id {
                    continue;
                }
                if !other.is_orbiting || other.orbiting.is_none() || to_destroy.contains(&other.moon_id) {
                    continue;
                }
                if moon.orbiting == other.orbiting {
                    continue;
                }
                if helpers::toroidal_distance(moon.x, moon.y, other.x, other.y) <= (moon.size + other.size) {
                    handle_moon_moon_collision(ctx, &mut to_destroy, &mut explosions, moon, other);
                }
            }
        }
    }
    for moon_id in to_destroy {
        if let Some(moon) = ctx.db.moon().moon_id().find(moon_id) {
            moon::delete_moon(ctx, moon);
        }
    }
    for (x, y, worth, color) in explosions {
        bit::handle_explosion(ctx, x, y, worth, color);
    }
}
