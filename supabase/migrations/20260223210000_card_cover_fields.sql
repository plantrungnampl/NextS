alter table public.cards
  add column if not exists cover_mode text not null default 'none',
  add column if not exists cover_size text not null default 'full',
  add column if not exists cover_color text,
  add column if not exists cover_colorblind_friendly boolean not null default false,
  add column if not exists cover_attachment_id uuid;

alter table public.cards
  drop constraint if exists cards_cover_mode_valid,
  drop constraint if exists cards_cover_size_valid,
  drop constraint if exists cards_cover_color_valid,
  drop constraint if exists cards_cover_payload_consistency;

alter table public.cards
  add constraint cards_cover_mode_valid
  check (cover_mode in ('none', 'attachment', 'color')),
  add constraint cards_cover_size_valid
  check (cover_size in ('full', 'header')),
  add constraint cards_cover_color_valid
  check (
    cover_color is null
    or cover_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  add constraint cards_cover_payload_consistency
  check (
    (cover_mode = 'none' and cover_attachment_id is null and cover_color is null)
    or (cover_mode = 'attachment' and cover_attachment_id is not null and cover_color is null)
    or (cover_mode = 'color' and cover_attachment_id is null and cover_color is not null)
  );

alter table public.cards
  drop constraint if exists cards_cover_attachment_fk;

alter table public.cards
  add constraint cards_cover_attachment_fk
  foreign key (cover_attachment_id)
  references public.attachments(id)
  on delete set null;

create index if not exists cards_cover_attachment_idx
  on public.cards (cover_attachment_id)
  where cover_attachment_id is not null;

with first_image_per_card as (
  select distinct on (card_id)
    card_id,
    id as attachment_id
  from public.attachments
  where content_type ilike 'image/%'
  order by card_id, created_at asc
)
update public.cards as cards
set
  cover_mode = 'attachment',
  cover_attachment_id = first_image_per_card.attachment_id
from first_image_per_card
where cards.id = first_image_per_card.card_id
  and cards.cover_mode = 'none'
  and cards.cover_attachment_id is null
  and cards.archived_at is null;
