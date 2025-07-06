
use spacetimedb::{table, reducer, Table, ReducerContext, ScheduleAt, TimeDuration, Identity};

use crate::user::user as _;

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
    pub size: f32,
    pub username: String,
}

pub fn init_leaderboard_schedule(ctx: &ReducerContext) -> Result<(), String> {
    // Insert the initial leaderboard update schedule
    ctx.db.leaderboard_update_schedule().insert(LeaderboardUpdateSchedule {
        id: 0,
        scheduled_at: ScheduleAt::Time(ctx.timestamp + TimeDuration::from_micros(super::LEADERBOARD_UPDATE_INTERVAL_MICROS)),
    });
    Ok(())
}

#[reducer]
pub fn update_leaderboard(ctx: &ReducerContext, _leaderboard_update_schedule: LeaderboardUpdateSchedule) -> Result<(), String> {
    
    if ctx.sender != ctx.identity() {
        return Err("Reducer `update_leaderboard` may only be invoked by the scheduler.".into());
    }
    
    // Collect all users and their sizes and usernames
    let mut users: Vec<(Identity, f32, String)> = ctx.db.user().iter()
        .map(|u| (u.identity, u.size, u.username.clone()))
        .collect();
    // Sort by size descending
    users.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Clear the leaderboard table
    for entry in ctx.db.leaderboard_entry().iter() {
        ctx.db.leaderboard_entry().delete(entry);
    }

    // Insert sorted users into leaderboard with rank, size, and username
    for (i, (identity, size, username)) in users.iter().enumerate() {
        ctx.db.leaderboard_entry().insert(LeaderboardEntry {
            rank: (i + 1) as u32,
            identity: *identity,
            size: *size,
            username: username.clone(),
        });
    }

    let interval = TimeDuration::from_micros(super::LEADERBOARD_UPDATE_INTERVAL_MICROS);
    ctx.db.leaderboard_update_schedule().insert(LeaderboardUpdateSchedule {
        id: 0,
        scheduled_at: ScheduleAt::Time(ctx.timestamp + interval),
    });

    Ok(())
}
