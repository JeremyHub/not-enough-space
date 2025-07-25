use spacetimedb::rand::Rng;
use spacetimedb::{rand, Identity, ReducerContext, Table};

use crate::game_loop::dynamic_metadata as _;
use crate::user::user as _;

use super::game_loop;
use super::helpers;
use super::pub_reducers;
use super::user;

pub fn update_ai_directions(ctx: &ReducerContext) {
    let mut ai_users: Vec<_> = ctx.db.user().is_ai().filter(true).collect();
    use rand::seq::SliceRandom;
    ai_users.as_mut_slice().shuffle(&mut ctx.rng());

    let num_to_update = ((ai_users.len() as f32)
        * super::PORTION_AI_USERS_DIRECTION_UPDATED_PER_TICK)
        .ceil() as usize;

    for ai in ai_users.into_iter().take(num_to_update) {
        ctx.db.user().identity().update(user::User {
            dir_vec_x: (ctx.rng().gen_range(0..=100) as f32 / 100.0) - super::AI_DRIFT,
            dir_vec_y: (ctx.rng().gen_range(0..=100) as f32 / 100.0) - super::AI_DRIFT,
            username: ai.username.clone(),
            ..ai
        });
        if ctx
            .rng()
            .gen_bool(super::CHANCE_UPDATED_AI_SPAWNS_MOON as f64)
        {
            let _ = pub_reducers::sacrifice_health_for_moon(ctx, ai);
        }
    }
}

pub fn spawn_ai(ctx: &ReducerContext) {
    let current_num_ais = ctx.db.user().is_ai().filter(true).count();
    if current_num_ais < super::NUM_AIS {
        let ais_to_spawn = super::NUM_AIS - current_num_ais;
        let metadata = ctx.db.dynamic_metadata().id().find(0).unwrap();
        for _ in 0..ais_to_spawn {
            let color = helpers::Color {
                r: ctx.rng().gen_range(0..=255),
                g: ctx.rng().gen_range(0..=255),
                b: ctx.rng().gen_range(0..=255),
            };
            let x = ctx.rng().gen_range(0..=super::WORLD_WIDTH) as f32;
            let name: String = names_generator::get_random(ctx.rng());
            ctx.db.user().insert(user::User {
                identity: Identity::from_be_byte_array(ctx.rng().gen()),
                online: true,
                username: name,
                x,
                col_index: x.round() as i32,
                y: ctx.rng().gen_range(0..=super::WORLD_HEIGHT) as f32,
                dx: 0.0,
                dy: 0.0,
                dir_vec_x: 0.0,
                dir_vec_y: 0.0,
                color,
                health: super::USER_STARTING_HEALTH,
                size: user::get_user_size(super::USER_STARTING_HEALTH),
                total_moon_size_orbiting: 0.0,
                is_ai: true,
                speed_boost: 0.0,
                kills: 0,
                damage: 0.0,
                seed: ctx.rng().gen(),
                invincibility_ticks_left: super::USER_STARTING_INVINCIBILITY_TICKS,
            });
        }
        ctx.db
            .dynamic_metadata()
            .id()
            .update(game_loop::DynamicMetadata {
                id: 0,
                num_ais: metadata.num_ais + ais_to_spawn as u32,
                total_users: metadata.total_users + ais_to_spawn as u32,
            });
    }
}
