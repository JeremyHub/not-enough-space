use spacetimedb::{reducer, table, Identity, ReducerContext, ScheduleAt, Table, TimeDuration};

use crate::game_loop::dynamic_metadata as _;
use crate::user::user as _;

use super::game_loop;

#[table(name = leaderboard_update_schedule, scheduled(update_leaderboard))]
pub struct LeaderboardUpdateSchedule {
    #[primary_key]
    #[auto_inc]
    id: u64,
    scheduled_at: ScheduleAt,
}

#[table(name = leaderboard_entry, public)]
pub struct LeaderboardEntry {
    pub rank: u32,
    #[primary_key]
    pub identity: Identity,
    pub size: u32,
    pub username: String,
    pub kills: u32,
    pub damage: u32,
}

pub fn init_leaderboard_schedule(ctx: &ReducerContext) -> Result<(), String> {
    // Insert the initial leaderboard update schedule
    ctx.db
        .leaderboard_update_schedule()
        .insert(LeaderboardUpdateSchedule {
            id: 0,
            scheduled_at: ScheduleAt::Time(
                ctx.timestamp
                    + TimeDuration::from_micros(super::LEADERBOARD_UPDATE_INTERVAL_MICROS),
            ),
        });
    Ok(())
}

#[reducer]
pub fn update_leaderboard(
    ctx: &ReducerContext,
    _leaderboard_update_schedule: LeaderboardUpdateSchedule,
) -> Result<(), String> {
    if ctx.sender != ctx.identity() {
        return Err("Reducer `update_leaderboard` may only be invoked by the scheduler.".into());
    }

    // Collect all users and their sizes, usernames, kills, and damage
    let mut users: Vec<(Identity, f32, String, u32, f32)> = ctx
        .db
        .user()
        .iter()
        .map(|u| (u.identity, u.size, u.username.clone(), u.kills, u.damage))
        .collect();
    // Sort by size descending
    users.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // go through all users and update their leaderboard entry
    for (rank, (identity, size, username, kills, damage)) in users.iter().enumerate() {
        let rank = rank as u32 + 1; // ranks start at 1
        if ctx
            .db
            .leaderboard_entry()
            .identity()
            .find(*identity)
            .is_some()
        {
            // Update existing entry
            ctx.db
                .leaderboard_entry()
                .identity()
                .update(LeaderboardEntry {
                    rank,
                    identity: *identity,
                    size: *size as u32,
                    username: username.clone(),
                    kills: *kills,
                    damage: *damage as u32,
                });
        } else {
            // Insert new entry
            ctx.db.leaderboard_entry().insert(LeaderboardEntry {
                rank,
                identity: *identity,
                size: *size as u32,
                username: username.clone(),
                kills: *kills,
                damage: *damage as u32,
            });
        }
    }

    let metadata = ctx.db.dynamic_metadata().id().find(0).unwrap();
    // Update the total users in dynamic metadata
    ctx.db
        .dynamic_metadata()
        .id()
        .update(game_loop::DynamicMetadata {
            id: 0,
            num_ais: metadata.num_ais,
            total_users: users.len() as u32,
            game_reset_updates_since_last_update: metadata.game_reset_updates_since_last_update,
        });

    let interval = TimeDuration::from_micros(super::LEADERBOARD_UPDATE_INTERVAL_MICROS);
    ctx.db
        .leaderboard_update_schedule()
        .insert(LeaderboardUpdateSchedule {
            id: 0,
            scheduled_at: ScheduleAt::Time(ctx.timestamp + interval),
        });

    Ok(())
}
