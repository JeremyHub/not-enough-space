use spacetimedb::{SpacetimeType};

#[derive(SpacetimeType, Clone, Debug, PartialEq, Copy)]
pub struct Color {
    pub r: i32,
    pub g: i32,
    pub b: i32,
}

pub struct CharacterUpdate {
    pub x: f32,
    pub y: f32,
    pub dx: f32,
    pub dy: f32,
}

pub fn move_character(x: f32, y: f32, dx: f32, dy: f32, dir_vec_x: f32, dir_vec_y: f32, acceleration: f32) -> CharacterUpdate {
    let mut new_dx: f32 = dx * super::FRICTION;
    let mut new_dy: f32 = dy * super::FRICTION;

    if dir_vec_x != 0.0 || dir_vec_y != 0.0 {
        let dir_length = (dir_vec_x.powi(2) + dir_vec_y.powi(2)).sqrt();
        if dir_length > 0.0 {
            new_dx += (dir_vec_x / dir_length) * acceleration;
            new_dy += (dir_vec_y / dir_length) * acceleration;
        }
    }

    let after_move_x = x + (dx * super::VELOCITY_MULTIPLIER);
    let after_move_y = y + (dy * super::VELOCITY_MULTIPLIER);

    let new_x;
    let new_y;

    (new_x, new_y) = wrap_coords(after_move_x, after_move_y);

    CharacterUpdate { x: new_x, y: new_y, dx: new_dx, dy: new_dy }
}

pub fn wrap_coords(x: f32, y: f32) -> (f32, f32) {
    let mut new_x = x;
    let mut new_y = y;

    if new_x < 0.0 { new_x = super::WORLD_WIDTH as f32 + new_x; }
    else if new_x > super::WORLD_WIDTH as f32 { new_x = new_x - super::WORLD_WIDTH as f32; }

    if new_y < 0.0 { new_y = super::WORLD_HEIGHT as f32 + new_y; }
    else if new_y >= super::WORLD_HEIGHT as f32 { new_y = new_y - super::WORLD_HEIGHT as f32; }

    (new_x, new_y)
}


pub fn wrapped_ranges(center: i32, radius: i32, world_max: i32) -> Vec<core::ops::Range<i32>> {
    let wrapped_center = if center < 0 {
        world_max + center
    } else if center > world_max {
        center - world_max
    } else {
        center
    };
    let range_bottom = wrapped_center - radius;
    let range_top = wrapped_center + radius;
    if range_bottom < 0 {
        vec![
            0..range_top,
            (world_max + range_bottom)..world_max
        ]
    } else if range_top > world_max {
        vec![
            range_bottom..world_max,
            0..(range_top - world_max)
        ]
    } else {
        vec![range_bottom..range_top]
    }
}

pub fn toroidal_distance(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    let dx = ((x1 - x2).abs()).min(super::WORLD_WIDTH as f32 - (x1 - x2).abs());
    let dy = ((y1 - y2).abs()).min(super::WORLD_HEIGHT as f32 - (y1 - y2).abs());
    (dx * dx + dy * dy).sqrt()
}

pub fn toroidal_vector(x1: f32, y1: f32, x2: f32, y2: f32) -> (f32, f32) {
    let mut dir_vec_x = x1 - x2;
    let mut dir_vec_y = y1 - y2;
    if dir_vec_x.abs() > super::WORLD_WIDTH as f32 / 2.0 {
        if dir_vec_x > 0.0 {
            dir_vec_x -= super::WORLD_WIDTH as f32;
        } else {
            dir_vec_x += super::WORLD_WIDTH as f32;
        }
    }
    if dir_vec_y.abs() > super::WORLD_HEIGHT as f32 / 2.0 {
        if dir_vec_y > 0.0 {
            dir_vec_y -= super::WORLD_HEIGHT as f32;
        } else {
            dir_vec_y += super::WORLD_HEIGHT as f32;
        }
    }
    return (dir_vec_x, dir_vec_y);
}
