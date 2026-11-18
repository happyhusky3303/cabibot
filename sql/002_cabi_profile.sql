begin;

alter table cabi_game.pets
    add column if not exists owner_name text,
    add column if not exists cabi_name text,
    add column if not exists description text;

commit;
