use spacetimedb::{table, Identity, ReducerContext, Table};
use spacetimedb::rand::Rng;

use super::helpers;

#[table(name = bit, public)]
pub struct Bit {
    #[primary_key]
    #[auto_inc]
    pub bit_id: i32,
    #[index(btree)]
    pub col_index: i32,
    pub x: f32,
    pub y: f32,
    pub dx: f32,
    pub dy: f32,
    pub size: f32,
    pub worth: f32,
    pub color: helpers::Color,
    #[index(btree)]
    pub moving: bool,
    pub owned_by: Option<Identity>,
}

pub fn spawn_bits(ctx: &ReducerContext) {
    let current_num_bits = ctx.db.bit().count();
    if current_num_bits < super::MAX_BITS {
        let bits_to_spawn = super::MAX_BITS - current_num_bits;
        for _ in 0..bits_to_spawn {
            let worth = ctx.rng().gen_range(super::MIN_BIT_WORTH..=super::MAX_BIT_WORTH);
            let size = worth;
            let x = ctx.rng().gen_range(0..=super::WORLD_WIDTH) as f32;
            let y = ctx.rng().gen_range(0..=super::WORLD_HEIGHT) as f32;
            let color = helpers::Color {
                r: ctx.rng().gen_range(0..=255),
                g: ctx.rng().gen_range(0..=255),
                b: ctx.rng().gen_range(0..=255),
            };
            ctx.db.bit().insert(Bit {
                bit_id: 0,
                col_index: x.round() as i32,
                x,
                y,
                dx: 0.0,
                dy: 0.0,
                size,
                worth,
                color,
                moving: false,
                owned_by: None,
            });
        }
    }
}

pub fn handle_explosion(ctx: &ReducerContext, x: f32, y: f32, worth: f32, color: helpers::Color) {
    // Spawn bits at the moon's position
    ctx.db.bit().insert(Bit {
        bit_id: 0,
        col_index: x.round() as i32,
        x,
        y,
        dx: 0.0,
        dy: 0.0,
        size: worth,
        worth,
        color,
        moving: false,
        owned_by: None,
    });
}

pub fn update_bits(ctx: &ReducerContext) {
    for bit in ctx.db.bit().moving().filter(true) {
        let upd = helpers::move_character(
            bit.x,
            bit.y,
            bit.dx,
            bit.dy,
            0.0,
            0.0,
            0.0,
        );
        let moving = bit.dx != 0.0 || bit.dy != 0.0;
        ctx.db.bit().bit_id().update(Bit {
            col_index: upd.x.round() as i32,
            x: upd.x,
            y: upd.y,
            dx: upd.dx,
            dy: upd.dy,
            moving,
            owned_by: if moving {bit.owned_by} else {None},
            ..bit
        });
    }
}
