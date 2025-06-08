use spacetimedb::{table, ReducerContext, Table};
use spacetimedb::rand::Rng;

use super::helpers;

#[table(name = bit, public)]
pub struct Bit {
    #[primary_key]
    #[auto_inc]
    pub bit_id: u64,
    #[index(btree)]
    pub x: i32,
    pub y: i32,
    pub size: f32,
    pub worth: f32,
    pub color: helpers::Color,
}


pub fn spawn_bits(ctx: &ReducerContext) {
    let current_num_bits = ctx.db.bit().count();
    if current_num_bits < super::MAX_BITS {
        let bits_to_spawn = super::MAX_BITS - current_num_bits;
        for _ in 0..bits_to_spawn {
            let worth = ctx.rng().gen_range(super::MIN_BIT_WORTH..=super::MAX_BIT_WORTH);
            let size = worth;
            let x = ctx.rng().gen_range(0..=super::WORLD_WIDTH);
            let y = ctx.rng().gen_range(0..=super::WORLD_HEIGHT);
            let color = helpers::Color {
                r: ctx.rng().gen_range(0..=255),
                g: ctx.rng().gen_range(0..=255),
                b: ctx.rng().gen_range(0..=255),
            };
            ctx.db.bit().insert(Bit {
                bit_id: 0,
                x,
                y,
                size,
                worth,
                color,
            });
        }
    }
}

pub fn handle_explosion(ctx: &ReducerContext, x: f32, y: f32, worth: f32, color: helpers::Color) {
    // Spawn bits at the moon's position
    ctx.db.bit().insert(Bit {
        bit_id: 0,
        x: x.round() as i32,
        y: y.round() as i32,
        size: worth,
        worth,
        color,
    });
}
