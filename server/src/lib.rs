pub mod bit;
pub mod user;
pub mod moon;
pub mod game_loop;
pub mod helpers;
pub mod moon_moon;
pub mod pub_reducers;
pub mod user_bit;
pub mod user_moon;
pub mod ai;
pub mod user_user;

// world
pub const WORLD_WIDTH: i32 = 10000;
pub const WORLD_HEIGHT: i32 = 10000;
pub const TICK_TIME: i64 = 20000;
pub const VELOCITY_MULTIPLIER: f32 = 0.1;
pub const FRICTION: f32 = 0.9;

// debug
pub const UPDATE_OFFLINE_PLAYERS: bool = true;

// users
pub const USER_ACCELERATION: f32 = 2.0;
pub const USER_STARTING_HEALTH: f32 = 1.0;
pub const SPEED_BOOST_DECAY: f32 = 0.95;
pub const MAX_USER_SIZE: f32 = 200.0;
pub const MIN_USERNAME_LENGTH: usize = 2;

// moon spawning
pub const MOON_COLOR_DIFF: i32 = 50;
pub const MOON_COLOR_ANIMATION_SPEED: i32 = 1;
pub const USER_SECOND_COLOR_ABS_DIFF: i32 = 50;
pub const STARTING_MOON_COLOR: helpers::Color = helpers::Color { r: 255, g: 255, b: 255 };

// bits
pub const MAX_AREA_PER_BIT: u64 = 10000;
pub const MAX_BITS: u64 = (WORLD_HEIGHT as u64 *WORLD_WIDTH as u64)/MAX_AREA_PER_BIT;
pub const MIN_BIT_WORTH: f32 = 0.5;
pub const MAX_BIT_WORTH: f32 = 2.5;
pub const MAX_BIT_SIZE: f32 = MAX_BIT_WORTH;
pub const BIT_ACCELERATION: f32 = USER_ACCELERATION;

// non-orbiting moon
pub const NUM_FREE_MOONS: u64 = 200;
pub const MAX_FREE_MOON_SIZE: f32 = 5.0;
pub const MIN_MOON_SIZE: f32 = 3.0;
pub const MOON_DRIFT: f32 = 0.5;
pub const MOON_ACCELERATION: f32 = 1.5;
pub const PORTION_FREE_MOONS_DIRECTION_UPDATED_PER_TICK: f64 = 0.005;

// moon oribit
pub const ORBIT_RADIUS_USER_SIZE_FACTOR_CLOSE: f32 = 0.2;
pub const ORBIT_RADIUS_ADD_CLOSE: f32 = 5.0;
pub const ORBIT_RADIUS_USER_SIZE_FACTOR_FAR: f32 = -3.2;
pub const ORBIT_RADIUS_ADD_FAR: f32 = 30.0;
pub const ADDITIONAL_ORBIT_RADIUS_MOON_SIZE_FACTOR_FAR: f32 = 21.0;
pub const ADDITIONAL_ORBIT_RADIUS_MOON_SIZE_FACTOR_CLOSE: f32 = 5.0;
pub const ORBIT_ANGULAR_VEL_RADIUS_FACTOR_CLOSE: f32 = 0.006;
pub const ORBIT_ANGULAR_VEL_RADIUS_FACTOR_FAR: f32 = 0.004;
pub const USER_SPEED_ORBIT_THRESHOLD: f32 = 5.0;
pub const ORBIT_MOVING_ACCELERATION_USER_SIZE_FACTOR: f32 = 0.5;
pub const ORBIT_MOVING_ACCELERATION_ADD: f32 = 5.0;
pub const ORBIT_STATIONARY_ACCELERATION_USER_SIZE_FACTOR: f32 = 0.2;
pub const ORBIT_STATIONARY_ACCELERATION_ADD: f32 = 5.0;

// moon common
pub const MAX_POSSIBLE_MOON_SIZE: f32 = MAX_FREE_MOON_SIZE.max(MAX_HEALTH_SACRIFICE);

// moon scarifice
pub const MAX_MOON_SIZE_PER_HEALTH: f32 = 1.0;
pub const MIN_MOON_SIZE_PER_HEALTH: f32 = 0.3;
pub const PORTION_HEALTH_SACRIFICE: f32 = 1.0/20.0;
pub const MAX_HEALTH_SACRIFICE: f32 = 10.0;
pub const MIN_HEALTH_SACRIFICE: f32 = 1.0;
pub const SACRIFICE_SPEED_BOOST: f32 = USER_ACCELERATION;

// ai
pub const PORTION_AI_USERS_DIRECTION_UPDATED_PER_TICK: f32 = 0.01;
pub const CHANCE_UPDATED_AI_SPAWNS_MOON: f64 = 0.1;
pub const NUM_AIS: usize = 50;
pub const AI_ACCELERATION: f32 = USER_ACCELERATION/2.0;
