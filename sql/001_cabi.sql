begin;

create schema if not exists cabi_game;

create table if not exists cabi_game.pets (
    owner_id bigint primary key,
    weight_grams bigint not null check (weight_grams > 0)
);

create table if not exists cabi_game.meals (
    interaction_id bigint primary key,
    owner_id bigint not null references cabi_game.pets (owner_id),
    food_id text not null,
    gain_grams integer not null check (gain_grams > 0)
);

create index if not exists meals_owner_food_idx
    on cabi_game.meals (owner_id, food_id);

commit;
