begin;

create table if not exists cabi_game.gym_attempts (
    interaction_id bigint primary key,
    owner_id bigint not null references cabi_game.pets (owner_id),
    excuse text,
    loss_grams integer not null check (loss_grams >= 0),
    weight_grams bigint not null check (weight_grams > 0),
    check (excuse is null or loss_grams = 0)
);

create index if not exists gym_workouts_owner_idx
    on cabi_game.gym_attempts (owner_id)
    where loss_grams > 0;

commit;
