-- ============================================================
-- SessionPool Web — Initial Schema
-- ============================================================

-- Profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  instagram_handle text not null,
  display_name text,
  streak int default 0,
  last_participation_date date,
  created_at timestamptz default now()
);

-- Sessions (scheduled time blocks)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  session_type text not null check (session_type in ('immerse', 'recover')),
  starts_at timestamptz not null,
  duration_minutes int default 30,
  gate_duration_minutes int default 5,
  status text default 'upcoming' check (status in ('upcoming', 'gate_open', 'matching', 'active', 'completed')),
  created_at timestamptz default now()
);

-- Session participants (users who joined a gate)
create table session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  status text default 'waiting' check (status in ('waiting', 'matched', 'in_room', 'completed')),
  unique(session_id, user_id)
);

-- Groups (matched groups within a session)
create table groups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  livekit_room_name text not null,
  group_type text default 'matched' check (group_type in ('matched', 'universal', 'lobby')),
  avg_streak float,
  created_at timestamptz default now()
);

-- Group members
create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  unique(group_id, user_id)
);

-- Instant queue (always-matchable users)
create table instant_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade unique,
  session_type text,
  joined_at timestamptz default now()
);

-- Indexes
create index idx_sessions_status on sessions(status);
create index idx_sessions_starts_at on sessions(starts_at);
create index idx_session_participants_session on session_participants(session_id);
create index idx_session_participants_user on session_participants(user_id);
create index idx_groups_session on groups(session_id);
create index idx_group_members_group on group_members(group_id);
create index idx_group_members_user on group_members(user_id);
create index idx_instant_queue_type on instant_queue(session_type);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table sessions enable row level security;
alter table session_participants enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table instant_queue enable row level security;

-- Profiles: read all, update own
create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Sessions: all authenticated can read
create policy "Sessions are viewable by authenticated users"
  on sessions for select
  to authenticated
  using (true);

-- Session participants: insert/read own, read co-participants
create policy "Users can join sessions"
  on session_participants for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can view session participants"
  on session_participants for select
  to authenticated
  using (true);

-- Groups: read for members
create policy "Users can view groups they belong to"
  on groups for select
  to authenticated
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = groups.id
        and group_members.user_id = auth.uid()
    )
  );

-- Group members: read for co-members
create policy "Users can view their group members"
  on group_members for select
  to authenticated
  using (
    exists (
      select 1 from group_members as gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
    )
  );

-- Instant queue: users can manage own entry
create policy "Users can manage own queue entry"
  on instant_queue for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role bypass (for API routes / cron jobs)
-- The service_role key bypasses RLS by default in Supabase
